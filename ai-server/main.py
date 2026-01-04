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
FEAT_DIM = (2 * HAND_N * 3) + (FACE_N * 3)  # 336

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

idx_to_label = {int(k): v for k, v in load_json(LABEL_MAP_PATH).items()}
label_to_text = load_json(LABEL_TO_TEXT_PATH)
num_classes = len(idx_to_label)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

model = TCNClassifier(FEAT_DIM, num_classes).to(device)
state = torch.load(MODEL_PATH, map_location="cpu")

# best_model.pth가 {"state_dict": ...} 형태면 꺼내기
if isinstance(state, dict) and "state_dict" in state:
    state = state["state_dict"]

model.load_state_dict(state, strict=True)
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

def hand_mean_x(hand_points: Any) -> float:
    if not isinstance(hand_points, list) or len(hand_points) == 0:
        return 1e9
    xs = []
    for p in hand_points[:HAND_N]:
        if isinstance(p, dict):
            xs.append(float(p.get("x", 0.0) or 0.0))
    return float(np.mean(xs)) if xs else 1e9

# =========================
# 전처리: frames -> (T,336)
# - face: 0번 점 기준 x,y anchor 빼기
# - 전체 feature /1000 스케일
# - hands는 "Right=0, Left=1"로 고정시키고 싶으니까:
#   Camera.jsx가 보낸 슬롯 순서(0=Right, 1=Left)를 그대로 사용
# =========================
def make_input(frames: List[Dict[str, Any]]) -> Optional[np.ndarray]:
    if len(frames) < T:
        return None

    frames = frames[-T:]
    seq: List[np.ndarray] = []

    zero_frames = 0

    for f in frames:
        hands = f.get("hands", None)
        face = f.get("face", None)

        hand_list = hands if isinstance(hands, list) else []
        face70 = points_to_nx3(face, FACE_N)

        # 얼굴이 완전 0이면 의미 없음
        face_nonzero = bool(np.any(face70[:, 0] != 0) or np.any(face70[:, 1] != 0))

        # 좌/우 판단용 기준점 (원본 얼굴 x)
        face_anchor_x = float(face70[0, 0]) if face70.shape[0] > 0 else 0.0

        # --- 손 2슬롯 만들기: Right(slot0), Left(slot1)
        hR = np.zeros((HAND_N, 3), dtype=np.float32)  # Right
        hL = np.zeros((HAND_N, 3), dtype=np.float32)  # Left

        # Camera.jsx에서 항상 [Right(0), Left(1)] 순서로 2개 슬롯을 보냄
        # 따라서 sorted로 x좌표 정렬을 하면 안 되고, 인덱스 그대로 믿어야 함
        if len(hand_list) >= 1:
            # slot0: Right
            hR = points_to_nx3(hand_list[0], HAND_N)
            
            # slot1: Left (있으면)
            if len(hand_list) >= 2:
                hL = points_to_nx3(hand_list[1], HAND_N)

            # MIRRORED 옵션: 물리적으로 좌우를 바꾸고 싶을 때 사용
            if MIRRORED:
                hR, hL = hL, hR

        # --- face anchor (x,y만)
        if face70.shape[0] > 0:
            anchor = face70[0, :2].copy()
            face70[:, 0] -= anchor[0]
            face70[:, 1] -= anchor[1]

        # 입력이 “거의 전부 0”이면 그 프레임은 의미 없음 → zero 카운트
        hands_nonzero = bool(np.any(hR[:, 0] != 0) or np.any(hR[:, 1] != 0) or np.any(hL[:, 0] != 0) or np.any(hL[:, 1] != 0))
        if (not hands_nonzero) or (not face_nonzero):
            zero_frames += 1

        # ✅ 학습과 동일 순서로 벡터 구성: [Right(0), Left(1), Face]
        vec = np.concatenate([hR.reshape(-1), hL.reshape(-1), face70.reshape(-1)], axis=0)  # (336,)
        seq.append(vec)

    # 너무 많은 프레임이 0이면 예측 포기
    if zero_frames > int(T * 0.6):
        return None

    x = np.stack(seq, axis=0).astype(np.float32)  # (T,336)

    
    
    # DEBUG: 입력 데이터 통계 확인
    raw_max = np.max(np.abs(x))
    raw_p95 = np.percentile(np.abs(x), 95)
    print(f"[DEBUG] make_input: raw_max={raw_max:.4f}, p95={raw_p95:.4f}")

    # ✅ 좌표 스케일 자동 감지
    # 학습 시엔 Pixel(0~1000+) / 1000.0 = 0~1 로 맞춤.
    # 만약 입력이 이미 0~1 범위(MediaPipe normalized)라면 /1000 하면 안 됨(0이 됨 -> 성병 고정 원인 추정)
    # 단, 이상치(outlier) 하나가 튀어서 max가 10을 넘을 수도 있으므로 95% 분위수 사용
    if raw_p95 > 10.0:
        print("[DEBUG] Scaling applied (/1000)")
        x = x / 1000.0  # Pixel 좌표면 스케일링
    else:
        print("[DEBUG] No scaling applied")
    # else: 이미 0~1 범위면 그대로 사용
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
                streak=_streak
            )

        xt = torch.from_numpy(x).unsqueeze(0).to(device)  # (1,T,336)
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
            streak=_streak
        )
