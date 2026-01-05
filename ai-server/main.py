# ai-server/main.py
# -*- coding: utf-8 -*-

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn
from fastapi import FastAPI
from pydantic import BaseModel, Field

# =========================
# 설정
# =========================
T = int(os.getenv("T", "30"))
HAND_N = 21
FACE_N = 70

# ✅ 손만/손+얼굴 토글
# - 손만 모드로 쓸 거면: USE_FACE=0
# - 손+얼굴 모델을 쓸 거면: USE_FACE=1
USE_FACE = os.getenv("USE_FACE", "0") == "1"

# ✅ 손 정규화(추천)
# - 1: 손목 기준 + 손 크기 기준으로 정규화 (해상도/거리 차이 영향 ↓)
# - 0: 정규화 안 함(대신 pixel이면 /1000 스케일링)
HAND_NORM = os.getenv("HAND_NORM", "1") == "1"

FEAT_DIM = (2 * HAND_N * 3) + ((FACE_N * 3) if USE_FACE else 0)

THRESHOLD = float(os.getenv("THRESHOLD", "0.60"))  # final 판정 기준
STREAK_N = int(os.getenv("STREAK_N", "8"))         # 같은 라벨 연속 N번이면 final

# 카메라가 "거울(셀카)"처럼 뒤집힌 좌표로 들어오면 1로 켜서 좌/우 판단 반전
MIRRORED = os.getenv("MIRRORED", "0") == "1"

BASE_DIR = Path(__file__).resolve().parent
CURRENT = BASE_DIR / "current"

LABEL_MAP_PATH = CURRENT / "label_map.json"        # {"0":"WORD00001", ...}
LABEL_TO_TEXT_PATH = CURRENT / "label_to_text.json"
MODEL_PATH = CURRENT / "best_model.pth"


# =========================
# train.py 모델 구조와 동일
# =========================
class TCNClassifier(nn.Module):
    def __init__(self, feat_dim: int, num_classes: int):
        super().__init__()
        self.backbone = nn.Sequential(
            nn.Conv1d(feat_dim, 256, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.BatchNorm1d(256),

            nn.Conv1d(256, 256, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.BatchNorm1d(256),

            nn.Conv1d(256, 128, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.BatchNorm1d(128),
        )
        self.head = nn.Sequential(
            nn.Dropout(0.2),
            nn.Linear(128, num_classes)
        )

    def forward(self, x):
        # (B,T,F) -> (B,F,T)
        x = x.transpose(1, 2)
        h = self.backbone(x)      # (B,128,T)
        h = h.mean(dim=2)         # (B,128)
        return self.head(h)       # (B,C)


def load_json(p: Path) -> Dict[str, Any]:
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))


def load_idx_to_label(label_map_path: Path) -> dict[int, str]:
    raw = load_json(label_map_path)

    # label_map.json이 {"label2id": {...}} 형태면 꺼내기
    if isinstance(raw, dict) and "label2id" in raw and isinstance(raw["label2id"], dict):
        raw = raw["label2id"]

    if not isinstance(raw, dict) or len(raw) == 0:
        raise ValueError(f"label_map.json format invalid: {type(raw)}")

    keys = list(raw.keys())
    vals = list(raw.values())

    # 형태 A: {"0":"WORD00001"} (idx -> label)
    if all(str(k).isdigit() for k in keys):
        return {int(k): str(v) for k, v in raw.items()}

    # 형태 B: {"WORD00001":0} (label -> idx)
    if all(str(v).isdigit() for v in vals):
        return {int(v): str(k) for k, v in raw.items()}

    raise ValueError(f"Unsupported label_map.json format. sample={list(raw.items())[:3]}")

idx_to_label = load_idx_to_label(LABEL_MAP_PATH)

label_to_text = load_json(LABEL_TO_TEXT_PATH)
num_classes = len(idx_to_label)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

model = TCNClassifier(FEAT_DIM, num_classes).to(device)

try:
    state = torch.load(MODEL_PATH, map_location="cpu")
    # best_model.pth가 {"state_dict": ...} 형태면 꺼내기
    if isinstance(state, dict) and "state_dict" in state:
        state = state["state_dict"]
    model.load_state_dict(state, strict=True)
except Exception as e:
    # 서버가 아예 안 뜨면 디버깅이 더 힘드니까 메시지라도 친절하게
    print("[FATAL] model load failed:", repr(e))
    print("  - FEAT_DIM:", FEAT_DIM, "(USE_FACE=", USE_FACE, ")")
    print("  - MODEL_PATH:", str(MODEL_PATH))
    raise

model.eval()


# =========================
# Request/Response
# =========================
class PredictRequest(BaseModel):
    frames: List[Dict[str, Any]]


class PredictResponse(BaseModel):
    label: str = ""
    text: str = ""
    confidence: float = 0.0
    frames_received: int = Field(0, alias="frames_received")
    mode: str = "pending"  # pending|final|error
    streak: int = 0
    candidates: Optional[List[Tuple[str, float]]] = None  # debug용

    class Config:
        allow_population_by_field_name = True


app = FastAPI()


# =========================
# Utils
# =========================
def points_to_nx3(points: Any, n_expected: int) -> np.ndarray:
    """[{x,y,z}, ...] -> (n,3). 없으면 0 패딩."""
    out = np.zeros((n_expected, 3), dtype=np.float32)
    if not isinstance(points, list):
        return out
    m = min(len(points), n_expected)
    for i in range(m):
        p = points[i]
        if not isinstance(p, dict):
            continue
        out[i, 0] = float(p.get("x", 0.0) or 0.0)
        out[i, 1] = float(p.get("y", 0.0) or 0.0)
        out[i, 2] = float(p.get("z", 0.0) or 0.0)
    return out


WRIST = 0
MIDDLE_MCP = 9


def normalize_hand_21x3(hand: np.ndarray) -> np.ndarray:
    """(21,3) 손을 손목 기준 + 손 크기 기준으로 정규화."""
    out = hand.copy()
    # 손이 0이면 그대로
    if not (np.any(out[:, 0] != 0) or np.any(out[:, 1] != 0)):
        return out

    wrist = out[WRIST, :2].copy()
    scale = np.linalg.norm(out[MIDDLE_MCP, :2] - wrist)
    if scale < 1e-6:
        return out

    out[:, :2] = (out[:, :2] - wrist) / scale
    # 학습 파이프라인과 통일(너희는 손 z를 0으로 통일해서 학습했었음)
    out[:, 2] = 0.0
    return out


def maybe_scale_like_train(x: np.ndarray) -> np.ndarray:
    """HAND_NORM=0일 때만: pixel(수백~수천)이면 /1000 스케일. 이미 0~1이면 그대로."""
    raw_p95 = float(np.percentile(np.abs(x), 95))
    if raw_p95 > 10.0:
        return x / 1000.0
    return x


# =========================
# 전처리: frames -> (T, FEAT_DIM)
# - hands: 2슬롯(0=Right, 1=Left) 전제
# - face: USE_FACE=1일 때만 읽음
# =========================
def make_input(frames: List[Dict[str, Any]]) -> Optional[np.ndarray]:
    if len(frames) < T:
        return None

    frames = frames[-T:]
    seq: List[np.ndarray] = []
    zero_frames = 0

    for f in frames:
        hands = f.get("hands", None)
        hand_list = hands if isinstance(hands, list) else []

        # --- 손 2슬롯: Right(slot0), Left(slot1)
        hR = np.zeros((HAND_N, 3), dtype=np.float32)
        hL = np.zeros((HAND_N, 3), dtype=np.float32)

        if len(hand_list) >= 1:
            hR = points_to_nx3(hand_list[0], HAND_N)
            if len(hand_list) >= 2:
                hL = points_to_nx3(hand_list[1], HAND_N)
            if MIRRORED:
                hR, hL = hL, hR

        if HAND_NORM:
            hR = normalize_hand_21x3(hR)
            hL = normalize_hand_21x3(hL)

        hands_nonzero = bool(
            np.any(hR[:, 0] != 0) or np.any(hR[:, 1] != 0) or
            np.any(hL[:, 0] != 0) or np.any(hL[:, 1] != 0)
        )
        if not hands_nonzero:
            zero_frames += 1

        if USE_FACE:
            face = f.get("face", None)
            face70 = points_to_nx3(face, FACE_N)

            # 얼굴 상대좌표(0번 점 기준 x,y anchor 빼기)
            if face70.shape[0] > 0:
                anchor = face70[0, :2].copy()
                face70[:, 0] -= anchor[0]
                face70[:, 1] -= anchor[1]

            vec = np.concatenate([hR.reshape(-1), hL.reshape(-1), face70.reshape(-1)], axis=0)
        else:
            vec = np.concatenate([hR.reshape(-1), hL.reshape(-1)], axis=0)

        seq.append(vec.astype(np.float32))

    # 너무 많은 프레임이 0이면 예측 포기
    if zero_frames > int(T * 0.6):
        return None

    x = np.stack(seq, axis=0).astype(np.float32)  # (T,FEAT_DIM)

    # HAND_NORM이면 이미 스케일/이동 정규화가 돼 있으니 추가 스케일링 금지
    if not HAND_NORM:
        x = maybe_scale_like_train(x)

    return x


# =========================
# streak 로직
# =========================
_last_label: Optional[str] = None
_streak: int = 0


@app.get("/health")
def health():
    return {
        "ok": True,
        "device": str(device),
        "num_classes": num_classes,
        "model_path": str(MODEL_PATH),
        "feat_dim": FEAT_DIM,
        "use_face": USE_FACE,
        "hand_norm": HAND_NORM,
        "mirrored": MIRRORED,
    }


@app.post("/predict", response_model=PredictResponse, response_model_by_alias=True)
def predict(req: PredictRequest):
    global _last_label, _streak

    try:
        frames = req.frames or []
        x = make_input(frames)
        if x is None:
            return PredictResponse(
                mode="error",
                frames_received=len(frames),
                label="",
                text="",
                confidence=0.0,
                streak=_streak,
            )

        xt = torch.from_numpy(x).unsqueeze(0).to(device)  # (1,T,F)
        with torch.no_grad():
            logits = model(xt)[0]
            probs = torch.softmax(logits, dim=-1)

        top1_prob, top1_idx = torch.max(probs, dim=0)
        top1_prob = float(top1_prob.item())
        top1_idx = int(top1_idx.item())

        label = idx_to_label.get(top1_idx, str(top1_idx))
        text = label_to_text.get(label, label)

        k = min(5, probs.numel())
        top5_probs, top5_idxs = torch.topk(probs, k=k)
        candidates = [
            (idx_to_label.get(int(i), str(int(i))), float(p))
            for p, i in zip(top5_probs.tolist(), top5_idxs.tolist())
        ]

        if _last_label == label and top1_prob >= THRESHOLD:
            _streak += 1
        else:
            _last_label = label
            _streak = 1 if top1_prob >= THRESHOLD else 0

        mode = "final" if _streak >= STREAK_N else "pending"

        return PredictResponse(
            label=label,
            text=text,
            confidence=top1_prob,
            frames_received=len(frames),
            mode=mode,
            streak=_streak,
            candidates=candidates,
        )

    except Exception as e:
        print("[ERROR] /predict:", repr(e))
        return PredictResponse(
            mode="error",
            frames_received=len(req.frames or []),
            label="",
            text="",
            confidence=0.0,
            streak=_streak,
        )
