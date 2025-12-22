from fastapi import FastAPI                 # FastAPI 서버 기능
from pydantic import BaseModel              # 요청 JSON을 DTO처럼 받게 해줌
from typing import Any, List                # 타입 표시용 (frames는 리스트)
from predict import SimpleClassifier, load_label_map, preprocess_like_train
from pathlib import Path
import numpy as np                          # 숫자 배열(모델 입력)을 만들 때 쓰는 라이브러리
import torch
import json


app = FastAPI()                             # FastAPI 서버 생성

# cpu로 모델 돌리고 모델 구조 만들고 학습시켜놨던 모델 가져오는 거임
device = "cpu"

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "current"   # ✅ current 폴더에서만 모델 읽기

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

class TranslateRequest(BaseModel):          # 요청(body) JSON 형식 정의 (요청 DTO)
    frames: List[Any]                       # frames는 배열(리스트). 안의 내용은 일단 Any(아무거나)

@app.post("/predict")                       # POST /predict 로 요청 오면 아래 함수 실행
def predict(req: TranslateRequest):         # req = 프론트가 보낸 요청(JSON)을 TranslateRequest로 만든 것
    frames = req.frames or []               # frames가 None일 수 있으니, 없으면 빈 리스트로 처리
    T = 30                                  # ✅ 우리가 고정할 프레임 길이(30프레임). (10fps면 약 3초)

    seq = []                                # 여기엔 "프레임 텐서"들을 차곡차곡 모을 거임

    for f in frames:                        # frames 안에 있는 프레임을 하나씩 꺼내서 f로 받음
        hands = f.get("hands") if isinstance(f, dict) else None  # f가 dict일 때만 hands 꺼냄
        if not hands:                       # hands가 없으면(손이 안 잡혔으면)
            continue                        # 이 프레임은 건너뜀

        frame_tensor = np.zeros((2, 21, 3), dtype=np.float32)    # ✅ 한 프레임을 (양손2, 점21, xyz3) 크기로 0으로 생성

        for hi in range(min(2, len(hands))): # hands가 1개면 0만, 2개면 0과 1까지 (최대 2손만 사용)
            hand = hands[hi]                # hi번째 손 데이터 꺼내기 (랜드마크 21개가 들어있는 리스트)
            if isinstance(hand, list) and len(hand) >= 21 and isinstance(hand[0], dict):  # 구조가 맞는지 체크
                pts = [[p.get("x", 0.0), p.get("y", 0.0), p.get("z", 0.0)] for p in hand[:21]]  # 21개 점을 [x,y,z]로 변환
                frame_tensor[hi] = np.array(pts, dtype=np.float32) # frame_tensor에 해당 손(0 or 1) 자리에 채워 넣기

        seq.append(frame_tensor)            # 완성된 프레임(2,21,3)을 seq에 추가

    framesReceived = len(seq)               # 손이 실제로 잡힌 프레임 개수(=seq에 들어간 개수)

    if framesReceived >= T:                 # 프레임이 30개 이상이면
        seq = seq[-T:]                      # 마지막 30개만 사용 (길이 맞추기)
    else:                                   # 프레임이 30개 미만이면
        pad_count = T - framesReceived      # 부족한 개수 계산
        pad_frames = [np.zeros((2, 21, 3), dtype=np.float32) for _ in range(pad_count)]  # 부족한 만큼 0프레임 만들기
        seq = seq + pad_frames              # 뒤에 0프레임을 붙여서 길이를 30으로 맞춤

    x = np.stack(seq, axis=0)               # ✅ 최종 입력 x 생성: (T,2,21,3) 즉 (30,2,21,3)




    print("x shape:", x.shape, "framesReceived:", framesReceived)  # 확인용(필요하면 켜기)
    print("hand0 sum:", x[:,0].sum(), "hand1 sum:", x[:,1].sum())
    # 조졌다 파이썬 개어렵다 ㅋㅋㅋㅋㅋㅋㅋㅋ 즉 ai가 먹기 좋게 모양을 일정하게 정리한거임!!
    
    # ===== 여기까지가 "AI 모델 들어가기 직전 단계" =====
    # 이제 모델이 생기면 model(x) 같은 걸 하면 됨

        # =========================================
    # 0) 손이 하나도 안 잡혔으면 모델 돌릴 필요 없음
    # =========================================
    if framesReceived == 0:
        return {
            "text": "번역 실패",
            "confidence": 0.0,
            "framesReceived": 0
        }

    # =========================================
    # 1) 학습 때랑 똑같이 전처리 적용 (중요!!)
    #    - 손목 기준 상대좌표
    #    - 스케일 나누기(정규화)
    #    - (predict.py에서 쓰던 함수 재사용)
    # =========================================
    x2 = preprocess_like_train(x)

    # =========================================
    # 2) numpy -> torch 텐서로 변환
    #    + unsqueeze(0)로 "배치 차원" 추가
    #    (30,2,21,3)  ->  (1,30,2,21,3)
    # =========================================
    xt = torch.from_numpy(x2).unsqueeze(0).to(device)

    # =========================================
    # 3) 예측은 학습이 아니라서 미분 계산 필요 없음
    #    no_grad() 쓰면 더 빠르고 메모리 덜 먹음
    # =========================================
    with torch.no_grad():
        # 모델에 넣어서 "점수(logits)" 얻기
        logits = model(xt)

        # 점수(logits)를 "확률(probs)"로 변환
        # softmax 하면 각 클래스 확률 합이 1이 됨
        # [0] 은 배치(1개) 중 첫 번째 데이터 꺼내는 것
        probs = torch.softmax(logits, dim=1)[0].cpu().numpy()

    # =========================================
    # 4) 가장 확률이 큰 클래스 번호(idx) 찾기
    # =========================================
    pred_idx = int(probs.argmax())

    # =========================================
    # 5) idx -> 실제 라벨 문자열로 변환
    #    (idx_to_label은 label_map.json 기반)
    # =========================================
    label = idx_to_label[pred_idx]

    human_text = label_to_text.get(label, label) 
    # =========================================
    # 6) confidence = 그 라벨의 확률값(0~1)
    # =========================================
    confidence = float(probs[pred_idx])

    # =========================================
    # 7) 최종 응답 JSON 반환
    # =========================================
    return {
    "label": label,
    "text": human_text,
    "confidence": confidence,
    "framesReceived": framesReceived
    }


    # 13) 최종 JSON 응답으로 반환 (스프링/프론트가 그대로 받음)
    # text = "안녕하세요!" if framesReceived >= 15 else "다시 해주세요"          # (임시) 프레임 수 기준 더미 로직
    # confidence = 0.77 if framesReceived >= 15 else 0.3                        # (임시) 신뢰도도 더미 값

    # return {"text": text, "confidence": confidence, "framesReceived": framesReceived}  # 최종 응답(JSON)

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