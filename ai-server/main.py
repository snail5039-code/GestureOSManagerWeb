# main.py
import json
import time
from pathlib import Path
from collections import deque, defaultdict
from typing import Any, Dict, List, Optional

import numpy as np
import torch
from fastapi import FastAPI
from pydantic import BaseModel

# =========================
# 0) FastAPI
# =========================
app = FastAPI()

# =========================
# 1) 상수 / 설정
# =========================
T = 30
HAND_POINTS = 21
FACE_POINTS = 70
FEAT_DIM = 336  # hand(2*21*3=126) + face(70*3=210)

BASE_TH = 0.60
WIN_SIZE = 5
VOTE_MIN_RATIO = 0.60
MIN_AVG_PROB = 0.60
COOLDOWN_SEC = 0.7
TOPK_K = 5
TOPK_WEIGHTS = [1.0, 0.6, 0.35, 0.2, 0.1]
SESSION_TTL_SEC = 30

ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT / "current"   # ✅ 너 폴더 구조가 current 쓰는걸로 보였음

# =========================
# 2) 모델 정의 (너 코드에 맞게 유지)
# =========================
class TCNClassifier(torch.nn.Module):
    def __init__(self, feat_dim: int, num_classes: int):
        super().__init__()
        self.net = torch.nn.Sequential(
            torch.nn.Conv1d(feat_dim, 256, kernel_size=3, padding=1),
            torch.nn.ReLU(),
            torch.nn.AdaptiveAvgPool1d(1),
        )
        self.head = torch.nn.Sequential(
            torch.nn.Flatten(),
            torch.nn.Linear(256, num_classes),
        )

    def forward(self, x):
        # x: (B, T, F) -> (B, F, T)
        x = x.transpose(1, 2)
        x = self.net(x)
        x = self.head(x)
        return x

# =========================
# 3) label map / label_to_text 로드
# =========================
def norm_word(lb: str) -> str:
    # WORD37 -> WORD00037, WORD0037 -> WORD00037 등 보정
    if not lb:
        return lb
    if lb.startswith("WORD"):
        tail = lb[4:]
        if tail.isdigit():
            return "WORD" + tail.zfill(5)
    return lb

def load_label_map() -> Dict[int, str]:
    p = MODEL_DIR / "label_map.json"
    raw = json.loads(p.read_text(encoding="utf-8"))
    return {int(k): v for k, v in raw.items()}

def load_label_to_text() -> Dict[str, str]:
    p = MODEL_DIR / "label_to_text.json"
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))

idx_to_label = load_label_map()
label_to_idx = {v: k for k, v in idx_to_label.items()}
label_to_text = load_label_to_text()

# =========================
# 4) 모델 로드 (best_model_top5 우선)
# =========================
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("device:", device)

cand_paths = [
    MODEL_DIR / "best_model_top5.pth",
    MODEL_DIR / "best_model.pth",
    MODEL_DIR / "best_model_top1.pth",
    MODEL_DIR / "model.pth",
]
MODEL_PATH = next((p for p in cand_paths if p.exists()), None)
print("MODEL_PATH =", MODEL_PATH)

if MODEL_PATH is None:
    raise FileNotFoundError(f"model not found. tried={cand_paths}")

model = TCNClassifier(feat_dim=FEAT_DIM, num_classes=len(label_to_idx)).to(device)

try:
    state = torch.load(MODEL_PATH, map_location="cpu", weights_only=True)
except TypeError:
    state = torch.load(MODEL_PATH, map_location="cpu")

state_dict = state.get("state_dict", state)
model_sd = model.state_dict()

# head.weight -> head.1.weight 같은 케이스 보정(너 pasted에 있던 로직)
if "head.weight" in state_dict and "head.1.weight" in model_sd:
    state_dict["head.1.weight"] = state_dict.pop("head.weight")
if "head.bias" in state_dict and "head.1.bias" in model_sd:
    state_dict["head.1.bias"] = state_dict.pop("head.bias")

filtered = {}
for k, v in state_dict.items():
    if k in model_sd and hasattr(v, "shape") and v.shape == model_sd[k].shape:
        filtered[k] = v

model_sd.update(filtered)
missing, unexpected = model.load_state_dict(model_sd, strict=False)
print("missing:", missing)
print("unexpected:", unexpected)

model.eval()

# =========================
# 5) 세션(윈도우 voting)
# =========================
SESSION_STATE: Dict[str, Dict[str, Any]] = {}

def cleanup_sessions():
    now = time.time()
    dead = [sid for sid, st in SESSION_STATE.items() if now - st["last_time"] > SESSION_TTL_SEC]
    for sid in dead:
        del SESSION_STATE[sid]

# =========================
# 6) frames -> (30,336)
# =========================
def points_dict_to_nx3(points: Any, n_points: int) -> np.ndarray:
    out = np.zeros((n_points, 3), dtype=np.float32)
    if not isinstance(points, list) or len(points) == 0:
        return out
    if not isinstance(points[0], dict):
        return out
    m = min(len(points), n_points)
    for i in range(m):
        p = points[i]
        out[i, 0] = float(p.get("x", 0.0))
        out[i, 1] = float(p.get("y", 0.0))
        out[i, 2] = float(p.get("z", 0.0))
    return out

def make_tcn_input_from_frames(frames: List[Dict[str, Any]]):
    seq_hand, seq_face = [], []
    frames_hand, frames_face = 0, 0

    for f in frames:
        if not isinstance(f, dict):
            continue
        hands = f.get("hands", None)
        face = f.get("face", None)

        frame_hand = np.zeros((2, HAND_POINTS, 3), dtype=np.float32)
        if isinstance(hands, list):
            for hi in range(min(2, len(hands))):
                frame_hand[hi] = points_dict_to_nx3(hands[hi], HAND_POINTS)

        frame_face = points_dict_to_nx3(face, FACE_POINTS)

        has_hand = (frame_hand.sum() != 0)
        has_face = (frame_face.sum() != 0)

        # ✅ 손 없는 프레임은 버림
        if not has_hand:
            continue

        seq_hand.append(frame_hand)
        seq_face.append(frame_face)
        frames_hand += 1
        if has_face:
            frames_face += 1

    if frames_hand == 0:
        return None, 0, 0

    if frames_hand >= T:
        seq_hand = seq_hand[-T:]
        seq_face = seq_face[-T:]
    else:
        pad = T - frames_hand
        seq_hand += [np.zeros((2, HAND_POINTS, 3), dtype=np.float32) for _ in range(pad)]
        seq_face += [np.zeros((FACE_POINTS, 3), dtype=np.float32) for _ in range(pad)]

    x_hand = np.stack(seq_hand, axis=0).reshape(T, -1).astype(np.float32)  # (30,126)
    x_face = np.stack(seq_face, axis=0).astype(np.float32)                # (30,70,3)

    # 얼굴 anchor 상대좌표
    anchor_xy = x_face[:, 0:1, :2]
    x_face[:, :, :2] = x_face[:, :, :2] - anchor_xy
    x_face = x_face.reshape(T, -1).astype(np.float32)                     # (30,210)

    x = np.concatenate([x_hand, x_face], axis=1)                           # (30,336)
    return x, frames_hand, frames_face

# =========================
# 7) Request/Response
# =========================
class PredictRequest(BaseModel):
    session_id: Optional[str] = "default"
    frames: List[Any]
    forceFinal: Optional[bool] = False

class Candidate(BaseModel):
    label: str
    text: Optional[str]
    prob: float

class PredictResponse(BaseModel):
    mode: str
    label: Optional[str]
    text: Optional[str]
    confidence: float
    streak: int
    framesReceived: int
    candidates: List[Candidate]

# =========================
# 8) health
# =========================
@app.get("/health")
def health():
    return {
        "ok": True,
        "modelPath": str(MODEL_PATH),
        "numClasses": len(label_to_idx),
        "hasLabelToText": bool(label_to_text),
    }

# =========================
# 9) predict
# =========================
@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    try:
        cleanup_sessions()

        sid = req.session_id or "default"
        frames = req.frames or []
        force_final = bool(req.forceFinal)

        made = make_tcn_input_from_frames(frames)
        if made[0] is None:
            return PredictResponse(
                mode="pending", label=None, text=None,
                confidence=0.0, streak=0, framesReceived=0, candidates=[]
            )

        x, frames_hand, frames_face = made

        x_t = torch.from_numpy(x).unsqueeze(0).to(device)  # (1,30,336)
        with torch.no_grad():
            logits = model(x_t)
            probs = torch.softmax(logits, dim=1)[0]         # (C,)

        confidence, pred_idx = torch.max(probs, dim=0)
        confidence = float(confidence.item())
        pred_label = idx_to_label[int(pred_idx.item())]

        # topK 후보
        k = min(TOPK_K, probs.numel())
        topk = torch.topk(probs, k=k)
        candidates: List[Candidate] = []
        for p, idx in zip(topk.values.tolist(), topk.indices.tolist()):
            lb = idx_to_label[int(idx)]
            candidates.append(Candidate(
                label=lb,
                text=label_to_text.get(norm_word(lb)) or label_to_text.get(lb),
                prob=float(p)
            ))

        # 원샷 강제확정
        if force_final:
            return PredictResponse(
                mode="final",
                label=pred_label,
                text=label_to_text.get(norm_word(pred_label)) or label_to_text.get(pred_label),
                confidence=confidence,
                streak=1,
                framesReceived=frames_hand,
                candidates=candidates
            )

        # session window voting
        now = time.time()
        st = SESSION_STATE.get(sid)
        if st is None:
            st = {"buf": deque(maxlen=WIN_SIZE), "last_time": now, "cooldown_until": 0.0}
            SESSION_STATE[sid] = st
        st["last_time"] = now

        if confidence < BASE_TH:
            return PredictResponse(
                mode="pending", label=None, text=None,
                confidence=confidence, streak=0,
                framesReceived=frames_hand, candidates=candidates
            )

        st["buf"].append({"topk": [(c.label, float(c.prob)) for c in candidates], "t": now})

        if now < st["cooldown_until"]:
            return PredictResponse(
                mode="pending", label=None, text=None,
                confidence=confidence, streak=len(st["buf"]),
                framesReceived=frames_hand, candidates=candidates
            )

        scores = defaultdict(float)
        for item in st["buf"]:
            for r, (lb, pr) in enumerate(item["topk"]):
                w = TOPK_WEIGHTS[r] if r < len(TOPK_WEIGHTS) else 1.0
                scores[lb] += w * pr

        if not scores:
            return PredictResponse(
                mode="pending", label=None, text=None,
                confidence=confidence, streak=len(st["buf"]),
                framesReceived=frames_hand, candidates=candidates
            )

        winner = max(scores.items(), key=lambda x: x[1])[0]
        total = float(sum(scores.values()))
        vote_ratio = float(scores[winner] / total) if total > 0 else 0.0

        probs_w = []
        for item in st["buf"]:
            pr = 0.0
            for lb, p in item["topk"]:
                if lb == winner:
                    pr = float(p)
                    break
            probs_w.append(pr)
        avg_prob = float(sum(probs_w) / max(1, len(probs_w)))

        if vote_ratio >= VOTE_MIN_RATIO and avg_prob >= MIN_AVG_PROB:
            st["buf"].clear()
            st["cooldown_until"] = now + COOLDOWN_SEC
            return PredictResponse(
                mode="final",
                label=winner,
                text=label_to_text.get(norm_word(winner)) or label_to_text.get(winner),
                confidence=avg_prob,
                streak=WIN_SIZE,
                framesReceived=frames_hand,
                candidates=candidates
            )

        return PredictResponse(
            mode="pending", label=None, text=None,
            confidence=confidence, streak=len(st["buf"]),
            framesReceived=frames_hand, candidates=candidates
        )

    except Exception as e:
        # ✅ 파이썬이 여기서 뻗으면 스프링이 timeout으로 죽어버리니까,
        # 무조건 응답을 "빨리" 줘서 원인 파악 가능하게 함.
        print("[ERROR] /predict exception:", repr(e))
        return PredictResponse(
            mode="error", label=None, text=None,
            confidence=0.0, streak=0, framesReceived=0, candidates=[]
        )
