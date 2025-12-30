# test_request.py
import requests
import random

URL = "http://127.0.0.1:8000/predict"

T = 30
HAND_POINTS = 21
FACE_POINTS = 478

def rand_hand_frame():
    # (2,21,3)
    # 값 범위는 대충 0~1로 만들어도 됨(테스트용)
    return [
        [[random.random(), random.random(), 0.0] for _ in range(HAND_POINTS)],
        [[random.random(), random.random(), 0.0] for _ in range(HAND_POINTS)],
    ]

def rand_face_frame():
    # (478,3)
    return [[random.random(), random.random(), 0.0] for _ in range(FACE_POINTS)]

def main():
    payload = {
        "session_id": "debug_user1",
        "seq_hand": [rand_hand_frame() for _ in range(T)],
        "seq_face": [rand_face_frame() for _ in range(T)],
    }

    r = requests.post(URL, json=payload, timeout=30)
    print("status:", r.status_code)
    print(r.json())

if __name__ == "__main__":
    main()
