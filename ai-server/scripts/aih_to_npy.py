"""
ai_to_npy.py
============================================================
목적:
- raw 폴더 안의 "*_keypoints.json" 파일들을 읽어서
- 학습에 쓰기 쉬운 npy 배열로 변환해 저장한다.

출력 형태:
- 손:  (T=30, 2, 21, 3)  -> "{샘플명}.hand.npy"
- 얼굴:(T=30, 478, 3)   -> "{샘플명}_face.npy"

지원하는 입력 JSON 형태(둘 다 지원):
1) 단일 프레임 dict 형태
   {
     "hands": [ [ {x,y,z}*21 ], [ {x,y,z}*21 ] ],
     "face":  [ {x,y,z}*478 ]
   }

2) payload 형태(프레임 배열)
   {
     "frames": [
        { "hands": [...], "face": [...] },
        ...
     ]
   }

또한 AIHub/오픈포즈 류 데이터도 지원:
- people 내부에 hand_left_keypoints_2d / hand_right_keypoints_2d
- face_keypoints_2d 등이 들어있는 케이스
============================================================
"""

import argparse
import json
from pathlib import Path
import numpy as np

# -----------------------------
# 고정 파라미터 (학습과 동일하게)
# -----------------------------
T = 30
HAND_POINTS = 21
FACE_POINTS = 478


# -----------------------------
# JSON 파일 로드
# -----------------------------
def load_json(p: Path):
    """JSON 읽기. 깨진 파일이면 None 반환."""
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[BAD JSON] {p} -> {type(e).__name__}: {e}")
        return None


# -----------------------------
# (구형) 2D keypoints 63개(=21*3) 형태를 21x3으로 변환
# - 보통 hand_*_keypoints_2d 같은 오픈포즈류가 여기에 해당
# - z는 없거나 의미 없을 수 있어, 일단 0으로 둠
# -----------------------------
def hand_keypoints_to_21x3(hand_kps):
    out = np.zeros((HAND_POINTS, 3), dtype=np.float32)
    if not isinstance(hand_kps, list) or len(hand_kps) < HAND_POINTS * 3:
        return out

    arr = np.array(hand_kps[:HAND_POINTS * 3], dtype=np.float32).reshape(HAND_POINTS, 3)
    out[:, 0] = arr[:, 0]  # x
    out[:, 1] = arr[:, 1]  # y
    out[:, 2] = arr[:, 2]  # (있으면) z / 없으면 보통 0 비슷
    return out


# -----------------------------
# mediapipe 스타일: [{x,y,z}, ...] -> (N,3)
# -----------------------------
def mp_points_to_nx3(points, n_points: int):
    out = np.zeros((n_points, 3), dtype=np.float32)

    if not isinstance(points, list) or len(points) == 0:
        return out
    if not isinstance(points[0], dict):
        # dict가 아니면 mediapipe 형식이 아니라고 보고 0 반환
        return out

    m = min(len(points), n_points)
    for i in range(m):
        p = points[i]
        out[i, 0] = float(p.get("x", 0.0))
        out[i, 1] = float(p.get("y", 0.0))
        out[i, 2] = float(p.get("z", 0.0))
    return out


# -----------------------------
# 얼굴: mediapipe dict 배열 or 숫자 배열 -> (478,3)
# -----------------------------
def face_keypoints_to_478x3(face_kps):
    out = np.zeros((FACE_POINTS, 3), dtype=np.float32)

    # 1) mediapipe dict 배열 케이스
    if isinstance(face_kps, list) and len(face_kps) > 0 and isinstance(face_kps[0], dict):
        m = min(len(face_kps), FACE_POINTS)
        for i in range(m):
            p = face_kps[i]
            out[i, 0] = float(p.get("x", 0.0))
            out[i, 1] = float(p.get("y", 0.0))
            out[i, 2] = float(p.get("z", 0.0))
        return out

    # 2) 숫자 배열 케이스(=478*3)
    if (
        isinstance(face_kps, list)
        and len(face_kps) >= FACE_POINTS * 3
        and all(isinstance(v, (int, float)) for v in face_kps[:6])
    ):
        arr = np.array(face_kps[:FACE_POINTS * 3], dtype=np.float32).reshape(FACE_POINTS, 3)
        out[:, :] = arr
        return out

    return out


# -----------------------------
# 프레임 1개 -> 손 텐서 (2,21,3)
# -----------------------------
def one_frame_json_to_hand_tensor(frame_dict):
    hand_frame = np.zeros((2, HAND_POINTS, 3), dtype=np.float32)

    if not isinstance(frame_dict, dict):
        return hand_frame

    # ✅ 1) mediapipe 방식: {"hands": [hand0, hand1]}
    if "hands" in frame_dict and isinstance(frame_dict["hands"], list):
        hands = frame_dict.get("hands") or []
        if len(hands) > 0:
            hand_frame[0] = mp_points_to_nx3(hands[0], HAND_POINTS)
        if len(hands) > 1:
            hand_frame[1] = mp_points_to_nx3(hands[1], HAND_POINTS)
        return hand_frame

    # ✅ 2) AIHub/오픈포즈 방식: people 안에 keypoints_2d
    people = frame_dict.get("people", None)
    p0 = None

    # (a) people이 dict이고 바로 keypoints가 있는 경우
    if isinstance(people, dict) and (
        "hand_left_keypoints_2d" in people or "hand_right_keypoints_2d" in people
    ):
        p0 = people

    # (b) people이 list인 경우 [person0, person1...]
    elif isinstance(people, list) and len(people) > 0 and isinstance(people[0], dict):
        p0 = people[0]

    # (c) people이 {"0": person0, "1": person1} 같은 dict인 경우
    elif isinstance(people, dict) and len(people) > 0:
        dict_items = [(k, v) for k, v in people.items() if isinstance(v, dict)]
        if dict_items:
            # 숫자키 우선 시도
            try:
                k0 = sorted([k for k, _ in dict_items], key=lambda x: int(str(x)))[0]
                p0 = people[k0]
            except Exception:
                p0 = dict_items[0][1]

    if not isinstance(p0, dict):
        return hand_frame

    left = p0.get("hand_left_keypoints_2d", [])
    right = p0.get("hand_right_keypoints_2d", [])

    # 관례적으로 오른손을 0, 왼손을 1로 넣음(너가 기존에 그렇게 했음)
    hand_frame[0] = hand_keypoints_to_21x3(right)
    hand_frame[1] = hand_keypoints_to_21x3(left)
    return hand_frame


# -----------------------------
# 프레임 1개 -> 얼굴 텐서 (478,3)
# -----------------------------
def one_frame_json_to_face_tensor(frame_dict):
    if not isinstance(frame_dict, dict):
        return np.zeros((FACE_POINTS, 3), dtype=np.float32)

    # ✅ 1) mediapipe 방식: {"face": [...]}
    if "face" in frame_dict:
        return face_keypoints_to_478x3(frame_dict.get("face", []))

    # ✅ 2) AIHub/오픈포즈 방식: people 안의 face_keypoints_2d
    people = frame_dict.get("people", None)
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

    if not isinstance(p0, dict):
        return np.zeros((FACE_POINTS, 3), dtype=np.float32)

    face2d = p0.get("face_keypoints_2d", [])
    return face_keypoints_to_478x3(face2d)


# -----------------------------
# 폴더(샘플 1개) -> (손, 얼굴, 받은프레임수)
# -----------------------------
def folder_to_sample(folder: Path):
    json_files = sorted(folder.glob("*_keypoints.json"))
    if not json_files:
        return None, None, 0

    frames_hand = []
    frames_face = []

    for fp in json_files:
        j = load_json(fp)
        if j is None:
            continue

        # ✅ payload(frames 배열)도 지원
        if isinstance(j, dict) and isinstance(j.get("frames"), list):
            iterable = j["frames"]
        else:
            iterable = [j]  # 단일 프레임 dict로 취급

        for fr in iterable:
            hand = one_frame_json_to_hand_tensor(fr)
            face = one_frame_json_to_face_tensor(fr)

            # 둘 다 완전 0이면 학습 의미 없으니 스킵
            if hand.sum() == 0 and face.sum() == 0:
                continue

            frames_hand.append(hand)
            frames_face.append(face)

    received = len(frames_hand)
    if received == 0:
        return None, None, 0

    # 길이 T=30 맞추기(앞/뒤 선택 정책: "마지막 30프레임" 유지)
    if received >= T:
        frames_hand = frames_hand[-T:]
        frames_face = frames_face[-T:]
    else:
        pad_n = T - received
        frames_hand += [np.zeros((2, HAND_POINTS, 3), dtype=np.float32) for _ in range(pad_n)]
        frames_face += [np.zeros((FACE_POINTS, 3), dtype=np.float32) for _ in range(pad_n)]

    x_hand = np.stack(frames_hand, axis=0)  # (30,2,21,3)
    x_face = np.stack(frames_face, axis=0)  # (30,478,3)
    return x_hand, x_face, received


# -----------------------------
# 폴더명에서 WORD**** / SEN**** 라벨 추출
# -----------------------------
def extract_word_id(folder_name: str):
    for part in folder_name.split("_"):
        if part.startswith("WORD") or part.startswith("SEN"):
            return part
    return "UNKNOWN"


# -----------------------------
# main
# -----------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in_dir", required=True, help="입력 폴더(샘플 폴더들이 들어있는 상위 폴더)")
    ap.add_argument("--out_dir", required=True, help="출력 폴더(npy가 저장될 곳)")
    ap.add_argument("--max", type=int, default=3, help="최대 몇 개 샘플만 변환할지(테스트용)")
    args = ap.parse_args()

    in_dir = Path(args.in_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # in_dir 바로 아래의 폴더들을 샘플 단위로 처리
    folders = sorted([p for p in in_dir.iterdir() if p.is_dir()])

    done = 0
    for f in folders:
        x_hand, x_face, received = folder_to_sample(f)
        if x_hand is None:
            continue

        label = extract_word_id(f.name)
        label_dir = out_dir / label
        label_dir.mkdir(parents=True, exist_ok=True)

        # 저장 파일명 규칙:
        #  - hand: "{샘플명}.hand.npy"
        #  - face: "{샘플명}_face.npy"
        np.save(label_dir / f"{f.name}.hand.npy", x_hand)
        np.save(label_dir / f"{f.name}_face.npy", x_face)

        print(f"[OK] {f.name} hand={x_hand.shape} face={x_face.shape} framesReceived={received}")

        done += 1
        if done >= args.max:
            break

    print("DONE:", done)


if __name__ == "__main__":
    main()
