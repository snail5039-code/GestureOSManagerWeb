from fastapi import FastAPI
from pydantic import BaseModel
from typing import Any, List
from predict import SimpleClassifier, load_label_map, preprocess_like_train
from pathlib import Path
import numpy as np
import torch
import json

app = FastAPI()

device = "cpu"

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "current"   # current 폴더에서만 모델 읽기

T = 30
HAND_POINTS = 21
FACE_POINTS = 478


def load_label_to_text():
    path = MODEL_DIR / "label_to_text.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


label_to_text = load_label_to_text()

label_to_idx, idx_to_label = load_label_map(MODEL_DIR / "label_map.json")
model = SimpleClassifier(num_classes=len(label_to_idx)).to(device)

state = torch.load(MODEL_DIR / "model.pth", map_location=device)
model.load_state_dict(state)
model.eval()


class TranslateRequest(BaseModel):
    frames: List[Any]


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


@app.post("/predict")
def predict(req: TranslateRequest):
    frames = req.frames or []

    seq_hand = []
    seq_face = []

    framesReceivedHand = 0
    framesReceivedFace = 0

    for f in frames:
        if not isinstance(f, dict):
            continue

        hands = f.get("hands", None)
        face = f.get("face", None)

        # (2,21,3) 손 프레임 만들기
        frame_hand = np.zeros((2, HAND_POINTS, 3), dtype=np.float32)
        if isinstance(hands, list):
            for hi in range(min(2, len(hands))):
                hand = hands[hi]
                # ✅ 문법/구조 안전 처리
                if isinstance(hand, list) and len(hand) > 0 and isinstance(hand[0], dict):
                    frame_hand[hi] = points_dict_to_nx3(hand, HAND_POINTS)

        # (478,3) 얼굴 프레임 만들기 (있으면 채워지고, 없으면 0)
        frame_face = points_dict_to_nx3(face, FACE_POINTS)

        has_hand = frame_hand.sum() != 0
        has_face = frame_face.sum() != 0

        # ✅ 핵심 조건: 손이 없으면 얼굴만 있어도 번역에 포함시키지 않음
        if not has_hand:
            continue

        seq_hand.append(frame_hand)
        seq_face.append(frame_face)

        framesReceivedHand += 1
        if has_face:
            framesReceivedFace += 1

    framesReceivedAny = len(seq_hand)

    # ✅ 손 프레임이 0개면 번역 안함
    if framesReceivedAny == 0:
        return {
            "text": "번역 실패",
            "confidence": 0.0,
            "framesReceived": 0,
            "framesReceivedHand": 0,
            "framesReceivedFace": 0,
            "framesReceivedAny": 0,
        }

    # 길이 T(30) 맞추기
    if framesReceivedAny >= T:
        seq_hand = seq_hand[-T:]
        seq_face = seq_face[-T:]
    else:
        pad_count = T - framesReceivedAny
        seq_hand += [np.zeros((2, HAND_POINTS, 3), dtype=np.float32) for _ in range(pad_count)]
        seq_face += [np.zeros((FACE_POINTS, 3), dtype=np.float32) for _ in range(pad_count)]

    x_hand = np.stack(seq_hand, axis=0)  # (30,2,21,3)

    # ✅ 지금 모델이 손 입력만 받는 구조라서(너 predict.py 기준) 손만 전처리/예측
    x2 = preprocess_like_train(x_hand)
    xt = torch.from_numpy(x2).unsqueeze(0).to(device)  # (1,30,2,21,3)

    with torch.no_grad():
        logits = model(xt)
        probs = torch.softmax(logits, dim=1)[0].cpu().numpy()

    pred_idx = int(probs.argmax())
    label = idx_to_label[pred_idx]
    human_text = label_to_text.get(label, label)
    confidence = float(probs[pred_idx])

    return {
        "label": label,
        "text": human_text,
        "confidence": confidence,
        "framesReceived": framesReceivedHand,
        "framesReceivedHand": framesReceivedHand,
        "framesReceivedFace": framesReceivedFace,
        "framesReceivedAny": framesReceivedAny,
    }


class LabelMapItem(BaseModel):
    label: str
    text: str


@app.post("/label-map")
def upsert_label_map(item: LabelMapItem):
    global label_to_text
    label_to_text[item.label] = item.text

    path = MODEL_DIR / "label_to_text.json"
    path.write_text(json.dumps(label_to_text, ensure_ascii=False, indent=2), encoding="utf-8")

    return {"ok": True, "count": len(label_to_text)}







# =========================
# 샘플 데이터로 /predict 테스트 (python main.py 로 실행)
# =========================
if __name__ == "__main__":
    from fastapi.testclient import TestClient

    client = TestClient(app)

    def make_points(n, base=0.1):
        # n개의 {x,y,z} 포인트 생성 (sum != 0 되게 base 줌)
        return [{"x": base + i * 0.001, "y": base + i * 0.001, "z": 0.0} for i in range(n)]

    def make_frame(has_hand: bool, has_face: bool):
        # hands는 [Right, Left] 또는 [0번,1번] 형태로 보내는 중이니까
        # 여기선 한 손만 넣어도 됨
        if has_hand:
            hands = [make_points(HAND_POINTS, 0.1), []]   # 한 손만
        else:
            hands = [[], []]

        if has_face:
            face = make_points(FACE_POINTS, 0.2)
        else:
            face = []

        return {"hands": hands, "face": face}

    def make_seq(has_hand: bool, has_face: bool, n=T):
        return [make_frame(has_hand, has_face) for _ in range(n)]

    def run_case(title, frames):
        print("\n==============================")
        print(title)
        r = client.post("/predict", json={"frames": frames})
        print("status:", r.status_code)
        try:
            print("json:", r.json())
        except Exception:
            print("text:", r.text)