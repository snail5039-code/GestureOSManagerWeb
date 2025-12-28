# main.py
# ============================================================
# FastAPI 메인 서버 (너 프로젝트 구조 기준: main.py가 엔트리)
#
# 이 서버가 하는 일:
# 1) 프론트/스프링에서 frames(List[dict])를 받는다.
#    각 frame은 {"hands": [...], "face": [...]} 형태
#
# 2) 손(2*21*3=126) + 얼굴(478*3=1434) = 1560 차원으로 합쳐서
#    (T=30, F=1560) 입력을 만든다.
#
# 3) 학습된 TCN 모델(best_model_face.pth)로 추론해서
#    top1 라벨/확률 + topK 후보를 만든다.
#
# 4) "자동 확정" 규칙:
#    - top1 확률이 BASE_TH 미만이면: pending (확신 낮음)
#    - 같은 라벨이 STREAK_N번 연속 나오고 + top1 확률이 FINAL_TH 이상이면: final
#
# 5) session_id 별로 연속(streak)을 관리한다.
# ============================================================

from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from pathlib import Path
import time
import json
import numpy as np
import torch

from train import TCNClassifier  # ✅ 학습 때 쓴 모델 클래스 그대로 사용

# ------------------------------------------------------------
# 0) FastAPI 앱
# ------------------------------------------------------------
app = FastAPI()

# ------------------------------------------------------------
# 1) 경로/상수
# ------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "current"        # ✅ 모델/라벨맵/텍스트맵은 current 폴더에서만 읽기

T = 30
HAND_POINTS = 21
FACE_POINTS = 478

# 손(2*21*3=126) + 얼굴(478*3=1434) = 1560
FEAT_DIM = 1560

# ------------------------------------------------------------
# 2) 자동 확정 규칙(전략 파라미터)
# ------------------------------------------------------------
BASE_TH = 0.50     # 이 값 미만이면 확신 낮음 -> streak 리셋/보류
FINAL_TH = 0.65    # 이 값 이상 + streak 조건이면 final 확정
STREAK_N = 2       # 같은 라벨이 몇 번 연속 나오면 확정할지

SESSION_TTL_SEC = 10  # 오래된 세션 상태 자동 삭제

# ------------------------------------------------------------
# 3) label_to_text 로드 (라벨 -> 한국어 텍스트)
# ------------------------------------------------------------
def load_label_to_text() -> Dict[str, str]:
    p = MODEL_DIR / "label_to_text.json"
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}

label_to_text = load_label_to_text()

# ------------------------------------------------------------
# 4) label_map 로드 (정수 인덱스 -> 라벨 문자열)
#    train.py에서 저장한 idx_to_label 형태:
#       {"0":"WORD0001","1":"WORD0002",...}
# ------------------------------------------------------------
def load_label_map() -> Dict[int, str]:
    p = MODEL_DIR / "label_map.json"
    if not p.exists():
        raise FileNotFoundError(f"label_map.json not found: {p}")

    raw = json.loads(p.read_text(encoding="utf-8"))
    # json key는 문자열이므로 int로 변환
    return {int(k): v for k, v in raw.items()}

idx_to_label = load_label_map()
label_to_idx = {v: k for k, v in idx_to_label.items()}

# ------------------------------------------------------------
# 5) 모델 로드
# ------------------------------------------------------------
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("device:", device)

MODEL_PATH = MODEL_DIR / "best_model_face.pth"  # ✅ 손+얼굴 학습 best 모델
print("MODEL_PATH =", MODEL_PATH)
print("exists? =", MODEL_PATH.exists())
if not MODEL_PATH.exists():
    raise FileNotFoundError(f"model not found: {MODEL_PATH}")

model = TCNClassifier(feat_dim=FEAT_DIM, num_classes=len(label_to_idx)).to(device)
state = torch.load(MODEL_PATH, map_location=device)
model.load_state_dict(state)
model.eval()

# ------------------------------------------------------------
# 6) session 상태 저장 (연속 확정용)
#   session_id -> {"last_label": str|None, "streak": int, "last_time": float}
# ------------------------------------------------------------
SESSION_STATE: Dict[str, Dict[str, Any]] = {}

def cleanup_sessions():
    """오래된 세션 삭제 (메모리 누수 방지)"""
    now = time.time()
    dead = [sid for sid, st in SESSION_STATE.items()
            if now - st["last_time"] > SESSION_TTL_SEC]
    for sid in dead:
        del SESSION_STATE[sid]

# ------------------------------------------------------------
# 7) 유틸: [{x,y,z}, ...] 형태 -> (N,3) np 배열로 변환
# ------------------------------------------------------------
def points_dict_to_nx3(points: Any, n_points: int) -> np.ndarray:
    """
    points: 보통 프론트에서 보내는 [{"x":..,"y":..,"z":..}, ...] 리스트
    n_points: HAND_POINTS(21) or FACE_POINTS(478)
    """
    out = np.zeros((n_points, 3), dtype=np.float32)

    # points가 리스트 아니거나 비어있으면 0으로 반환
    if not isinstance(points, list) or len(points) == 0:
        return out

    # 첫 원소가 dict가 아니면 구조가 이상한 것 -> 0으로 반환
    if not isinstance(points[0], dict):
        return out

    m = min(len(points), n_points)
    for i in range(m):
        p = points[i]
        out[i, 0] = float(p.get("x", 0.0))
        out[i, 1] = float(p.get("y", 0.0))
        out[i, 2] = float(p.get("z", 0.0))
    return out

# ------------------------------------------------------------
# 8) frames -> (30,1560) 만들기
# ------------------------------------------------------------
def make_tcn_input_from_frames(frames: List[Dict[str, Any]]):
    """
    frames: [{"hands":[hand0, hand1], "face":[...]} ...]
      - hands: [ [ {x,y,z}*21 ], [ {x,y,z}*21 ] ] 형태
      - face : [ {x,y,z}*478 ] 형태

    리턴:
      x: (30,1560)
      frames_hand: 손이 들어온 프레임 수
      frames_face: 얼굴이 들어온 프레임 수(손 있는 프레임 중 얼굴도 있는 수)
    """

    seq_hand = []
    seq_face = []

    frames_hand = 0
    frames_face = 0

    for f in frames:
        if not isinstance(f, dict):
            continue

        hands = f.get("hands", None)
        face = f.get("face", None)

        # 한 프레임의 손 (2,21,3)
        frame_hand = np.zeros((2, HAND_POINTS, 3), dtype=np.float32)

        if isinstance(hands, list):
            # hands[0], hands[1] 두 손만 사용
            for hi in range(min(2, len(hands))):
                hand_points = hands[hi]
                frame_hand[hi] = points_dict_to_nx3(hand_points, HAND_POINTS)

        # 한 프레임의 얼굴 (478,3)
        frame_face = points_dict_to_nx3(face, FACE_POINTS)

        has_hand = (frame_hand.sum() != 0)
        has_face = (frame_face.sum() != 0)

        # ✅ 핵심 정책: 손이 없으면 학습/추론에 넣지 않음
        # (손이 있어야 수어 시작으로 판단)
        if not has_hand:
            continue

        seq_hand.append(frame_hand)
        seq_face.append(frame_face)

        frames_hand += 1
        if has_face:
            frames_face += 1

    # 손 프레임이 0개면 실패
    if frames_hand == 0:
        return None, 0, 0

    # 길이 T 맞추기 (30)
    if frames_hand >= T:
        seq_hand = seq_hand[-T:]
        seq_face = seq_face[-T:]
    else:
        pad = T - frames_hand
        seq_hand += [np.zeros((2, HAND_POINTS, 3), dtype=np.float32) for _ in range(pad)]
        seq_face += [np.zeros((FACE_POINTS, 3), dtype=np.float32) for _ in range(pad)]

    # (30,2,21,3) -> (30,126)
    x_hand = np.stack(seq_hand, axis=0).astype(np.float32)
    hand_flat = x_hand.reshape(T, -1)

    # (30,478,3) -> (30,1434)
    x_face = np.stack(seq_face, axis=0).astype(np.float32)

    # 얼굴은 카메라 위치 변화에 민감하니까
    # 각 프레임에서 0번 포인트를 기준(anchor)으로 x,y를 상대좌표화
    anchor_xy = x_face[:, 0:1, :2]              # (30,1,2)
    x_face[:, :, :2] = x_face[:, :, :2] - anchor_xy

    face_flat = x_face.reshape(T, -1)

    # concat -> (30,1560)
    x = np.concatenate([hand_flat, face_flat], axis=1)

    # 학습 때 /1000 스케일을 썼으면 여기서도 동일하게 맞춰줌(일관성!)
    x = x / 1000.0

    return x, frames_hand, frames_face

# ------------------------------------------------------------
# 9) Request / Response 스키마
# ------------------------------------------------------------
class PredictRequest(BaseModel):
    # session_id가 없으면 기본값 default로 (프론트가 안 보내도 됨)
    session_id: Optional[str] = "default"
    frames: List[Any]

class Candidate(BaseModel):
    label: str
    text: Optional[str]
    prob: float

class PredictResponse(BaseModel):
    mode: str                 # "final" or "pending"
    label: Optional[str]      # final이면 채움, pending이면 None
    text: Optional[str]       # label_to_text 매핑 결과(없으면 None)
    confidence: float         # top1 확률
    streak: int               # 현재 연속 카운트(디버그용)
    candidates: List[Candidate]  # 후보 topK (프론트에서 3개 보여주기 가능)

# ------------------------------------------------------------
# 10) /predict (유일한 엔드포인트로 통일)
# ------------------------------------------------------------
@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    cleanup_sessions()

    sid = req.session_id or "default"
    frames = req.frames or []

    # 1) frames -> (30,1560)
    made = make_tcn_input_from_frames(frames)
    if made[0] is None:
        # 손이 하나도 없으면 pending 처리
        return PredictResponse(
            mode="pending",
            label=None,
            text=None,
            confidence=0.0,
            streak=0,
            candidates=[]
        )

    x, frames_hand, frames_face = made
    xt = torch.from_numpy(x).unsqueeze(0).to(device)  # (1,30,1560)

    # 2) 모델 추론
    with torch.no_grad():
        logits = model(xt)[0]               # (C,)
        probs = torch.softmax(logits, dim=0)

    # 3) top1 + topK 후보 만들기
    confidence, pred_idx = torch.max(probs, dim=0)
    confidence = float(confidence.item())
    pred_label = idx_to_label[int(pred_idx.item())]

    # 후보는 3개만 내려주자(원하면 5로 바꿔도 됨)
    k = min(3, probs.numel())
    topk = torch.topk(probs, k=k)
    candidates = []
    for p, idx in zip(topk.values.tolist(), topk.indices.tolist()):
        lb = idx_to_label[int(idx)]
        candidates.append(Candidate(
            label=lb,
            text=label_to_text.get(lb),
            prob=float(p)
        ))

    # 4) session별 streak 업데이트
    now = time.time()
    st = SESSION_STATE.get(sid)
    if st is None:
        st = {"last_label": None, "streak": 0, "last_time": now}
        SESSION_STATE[sid] = st
    st["last_time"] = now

    # (a) 확신 낮으면 pending + streak 리셋
    if confidence < BASE_TH:
        st["last_label"] = None
        st["streak"] = 0
        return PredictResponse(
            mode="pending",
            label=None,
            text=None,
            confidence=confidence,
            streak=0,
            candidates=candidates
        )

    # (b) 확신 어느 정도면 streak 갱신
    if st["last_label"] == pred_label:
        st["streak"] += 1
    else:
        st["last_label"] = pred_label
        st["streak"] = 1

    # (c) 최종 확정 조건
    if st["streak"] >= STREAK_N and confidence >= FINAL_TH:
        # 확정 후 다음 단어를 위해 초기화
        st["last_label"] = None
        st["streak"] = 0
        return PredictResponse(
            mode="final",
            label=pred_label,
            text=label_to_text.get(pred_label),
            confidence=confidence,
            streak=STREAK_N,
            candidates=candidates
        )

    # 아직 확정 못함
    return PredictResponse(
        mode="pending",
        label=None,
        text=None,
        confidence=confidence,
        streak=st["streak"],
        candidates=candidates
    )
