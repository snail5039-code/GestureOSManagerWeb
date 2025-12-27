# “원본 JSON을 딥러닝이 먹기 쉬운 배열 파일로 바꾸는 코드”

import argparse
import json
from pathlib import Path
import numpy as np

T = 30
POINTS = 21 #손 랜드마크 점
FACE_POINTS = 478

# 파일 일기
def load_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))

def hand_keypoints_to_21x3(hand_kps):
    out = np.zeros((POINTS, 3), dtype=np.float32) # 0 0 0 빈 그릇 생성
    if not isinstance(hand_kps, list) or len(hand_kps) < POINTS * 3: # 길이가 63 보다 작으면 0 배열 반환
        return out
    arr = np.array(hand_kps[:POINTS * 3], dtype=np.float32).reshape(POINTS, 3)
    out[:, 0] = arr[:, 0]  # x
    out[:, 1] = arr[:, 1]  # y
    return out
    # 결과는 항상 21, 3 근데 왜 ?

def mp_points_to_nx3(points, n_points: int):
    out = np.zeros((n_points, 3), dtype=np.float32)
    if not isinstance(points, list) or len(points) == 0:
        return out
    if not isinstance(points[0], dict):
        return out    # mediapipe손용 변환 함수 추가
                      # 왜? 이게 없으면 손이 전부 0으로 나올 가능성이 큼
    
    m = min(len(points), n_points)
    for i in range(m):
        p = points[i]
        out[i, 0] = float(p.get("x", 0.0))
        out[i, 1] = float(p.get("y", 0.0))
        out[i, 2] = float(p.get("z", 0.0))
    return out

def face_keypoints_to_478x3(face_kps): # 얼굴쪽 따로 추가
    out = np.zeros((FACE_POINTS, 3), dtype=np.float32)

    if isinstance(face_kps, list) and len(face_kps) > 0 and isinstance(face_kps[0], dict):
        m = min(len(face_kps), FACE_POINTS)

        for i in range(m):
            p = face_kps[i]
            out[i, 0] = float(p.get("x" , 0.0))
            out[i, 1] = float(p.get("y" , 0.0))
            out[i, 2] = float(p.get("z" , 0.0))
        return out
    
    if isinstance(face_kps, list) and len(face_kps) >= FACE_POINTS * 3 and all(isinstance(v, (int, float)) for v in face_kps[:6]):
        arr = np.array(face_kps[:FACE_POINTS * 3], dtype=np.float32).reshape(FACE_POINTS, 3)
        out[:, :] = arr
        return out
    return out 

def one_frame_json_to_tensor(j):
    frame = np.zeros((2, POINTS, 3), dtype=np.float32)

    if not isinstance(j, dict):
        return frame

    if "hands" in j and isinstance(j["hands"], list):
        hands = j.get("hands") or []
        if len(hands) > 0:
            frame[0] = mp_points_to_nx3(hands[0], POINTS)
        if len(hands) > 1:
            frame[1] = mp_points_to_nx3(hands[1], POINTS)
        return frame     # hands 지원 분기 추가!!!@@@@@@@@@

    people = j.get("people", None) # 피플은 어디서 나오는건지? 

    # 1) people이 "사람 1명 dict"인 경우 (너 케이스)
    if isinstance(people, dict) and (
        "hand_left_keypoints_2d" in people or "hand_right_keypoints_2d" in people
    ):
        p0 = people

    # 2) people이 list인 경우: [person0, person1, ...]
    elif isinstance(people, list) and len(people) > 0 and isinstance(people[0], dict):
        p0 = people[0]

    # 3) people이 dict인데 {"0": person0, "1": person1} 같은 경우
    elif isinstance(people, dict) and len(people) > 0:
        # 값이 dict인 항목만 추려서 첫 번째 선택
        dict_items = [(k, v) for k, v in people.items() if isinstance(v, dict)]
        if not dict_items:
            return frame

        # 숫자키 우선 정렬 시도
        try:
            k0 = sorted([k for k, _ in dict_items], key=lambda x: int(str(x)))[0]
        except:
            k0 = dict_items[0][0]

        p0 = people[k0]

    else:
        return frame

    left = p0.get("hand_left_keypoints_2d", [])
    right = p0.get("hand_right_keypoints_2d", [])

    frame[0] = hand_keypoints_to_21x3(right)
    frame[1] = hand_keypoints_to_21x3(left)
    return frame

def one_frame_json_to_face_tensor(j):

    if not isinstance(j, dict):
        return np.zeros((FACE_POINTS, 3), dtype=np.float32)
    
    if "face" in j:
        return face_keypoints_to_478x3(j.get("face", []))
    
    people = j.get("people", None)
    p0 = None

    if isinstance(people, dict) and len(people) > 0:
        if "face_keypoints_2d" in people:
            p0 = people
        else:
            dict_items = [(k, v) for k, v in people.items() if isinstance(v, dict)]
            if dict_items:
                p0 = dict_items[0][1]
    
    elif isinstance(people, list) and len(people) > 0 and isinstance(people[0], dict):
        p0 = people[0]
    
    if not p0:
        return np.zeros((FACE_POINTS, 3), dtype=np.float32)
    
    face2d = p0.get("face_keypoints_2d", [])
    return face_keypoints_to_478x3(face2d)

def folder_to_sample(folder: Path):
    json_files = sorted(folder.glob("*_keypoints.json"))
    if not json_files:
        return None, None, 0
    
    frames_hand = []
    frames_face = []

    for fp in json_files:
        j = load_json(fp)

        iterable = j.get("frames") if isinstance(j, dict) and isinstance(j.get("frames"),list) else [j] # payload(frames배열)도 지원하게
        
        for fr in iterable:
            ft_hand = one_frame_json_to_tensor(fr)  # ✅ 여기 이름 정확히!
            ft_face = one_frame_json_to_face_tensor(fr)
        
            if ft_hand.sum() == 0 and ft_face.sum() == 0:
                continue

            frames_hand.append(ft_hand)
            frames_face.append(ft_face)

    received = len(frames_hand)
    if received == 0:
        return None, None, 0

    if received >= T:
        frames_hand = frames_hand[-T:]
        frames_face = frames_face[-T:]
    else:
        pad_n = T - received
        frames_hand += [np.zeros((2, POINTS, 3), dtype=np.float32) for _ in range(pad_n)]
        frames_face += [np.zeros((FACE_POINTS, 3), dtype=np.float32) for _ in range(pad_n)]
    
    x_hand = np.stack(frames_hand, axis=0)
    x_face = np.stack(frames_face, axis=0)
    return x_hand, x_face, received


def extract_word_id(folder_name: str):
    for part in folder_name.split("_"):
        if part.startswith("WORD"):
            return part
    return "UNKNOWN"

def main(): 
    ap = argparse.ArgumentParser()
    ap.add_argument("--in_dir", required=True)
    ap.add_argument("--out_dir", required=True)
    ap.add_argument("--max", type=int, default=3)
    args = ap.parse_args()

    in_dir = Path(args.in_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    folders = sorted([p for p in in_dir.iterdir() if p.is_dir()])

    done = 0
    for f in folders:
        x_hand, x_face, received = folder_to_sample(f)
        if x_hand is None:
            continue
                # dataset_raw 폴더는 어디서ㅏ 나는지 이건 내가 옵션 줄때 설정하는거 
        label = extract_word_id(f.name)
        label_dir = out_dir / label
        label_dir.mkdir(parents=True, exist_ok=True)

        np.save(label_dir / f"{f.name}.hand.npy", x_hand)
        np.save(label_dir / f"{f.name}_face.npy", x_face)
        print(f"[OK] {f.name} hand={x_hand.shape} face={x_face.shape} framesReceived={received}")

        done += 1
        if done >= args.max:
            break

    print("DONE:", done)

if __name__ == "__main__":
    main()

#keypoints.json(여러 프레임) → (30,2,21,3)으로 정리 → 라벨 폴더(WORD1501) 아래 npy 저장 이 느낌으로 생각
# 즉 이 코드는 제이슨 모양 통일, 저장, 재료 만들기라고 생각하면 됌 