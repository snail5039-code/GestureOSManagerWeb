"""
ai_to_npy.py
============================================================
목적:
- raw 폴더 안의 "*_keypoints.json" 파일들을 읽어서
- 학습에 쓰기 쉬운 npy 배열로 변환해 저장한다.

출력 형태(고정 길이 T=30으로 패딩/자르기):
- 손:  (T=30, 2, 21, 3)   -> "{샘플명}.hand.npy"
        - 2: (0=오른손, 1=왼손) 고정
        - 21: 손 랜드마크 개수
        - 3: (x, y, z/score) 자리인데, 현재는 3번째 값을 0으로 통일(혼선 방지)

- 얼굴:(T=30, 70, 3)      -> "{샘플명}_face.npy"
        - 70: 얼굴 랜드마크 개수(오픈포즈/AIHub 쪽 face_keypoints_2d 기준)
        - 3: (x, y, z/score) 자리인데, 필요 시 3번째 값을 0으로 통일 가능
        - 참고: 68 포인트만 들어오면 70이 되도록 2포인트 패딩 지원

지원하는 입력 JSON 형태(둘 다 지원):
1) 단일 프레임 dict 형태 (MediaPipe 스타일)
   {
     "hands": [ [ {x,y,z}*21 ], [ {x,y,z}*21 ] ],
     "face":  [ {x,y,z}*N ]          # N이 FACE_POINTS(70) 이상이면 앞에서부터 사용
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
- face_keypoints_2d (보통 (x,y,score)*68 또는 *70)
============================================================
"""

import argparse
import json
from pathlib import Path
import numpy as np

def safe_float(v, default=0.0):
    """숫자/문자 섞여도 안전하게 float로 변환. 실패하면 default."""
    try:
        if v is None:
            return default
        if isinstance(v, str):
            vv = v.strip().lower()
            if vv in ("", "nan", "none", "null", "inf", "-inf"):
                return default
        return float(v)
    except Exception:
        return default


# -----------------------------
# 고정 파라미터 (학습/추론과 동일하게 맞춰야 함)
# -----------------------------
T = 30
HAND_POINTS = 21
FACE_POINTS = 70


# -----------------------------
# JSON 파일 로드
# - 깨진 숫자/문자 섞인 JSON도 최대한 살려 읽기
# -----------------------------
def load_json(p: Path):
    try:
        text = p.read_text(encoding="utf-8", errors="replace")
        return json.loads(
            text,
            parse_float=safe_float,
            parse_int=safe_float
        )
    except Exception as e:
        print(f"[BAD JSON] {p} -> {type(e).__name__}: {e}")
        return None


# -----------------------------
# (오픈포즈/AIHub) 1손 keypoints: (x,y,score)*21 -> (21,3)
# - 3번째 값(score)은 MediaPipe z와 의미가 달라 혼선이 생길 수 있어 0으로 통일
# -----------------------------
def hand_keypoints_to_21x3(hand_kps):
    out = np.zeros((HAND_POINTS, 3), dtype=np.float32)
    if not isinstance(hand_kps, list) or len(hand_kps) < HAND_POINTS * 3:
        return out

    vals = [safe_float(v) for v in hand_kps[:HAND_POINTS * 3]]
    arr = np.array(vals, dtype=np.float32).reshape(HAND_POINTS, 3)

    arr[:, 2] = 0.0  # score/z 혼선 방지: 3번째 채널 버림(0으로 통일)

    out[:, :] = arr
    return out


# -----------------------------
# (MediaPipe) dict 포인트 배열: [{x,y,z}, ...] -> (N,3)
# - 현재는 3번째(z)도 0으로 통일(학습 데이터의 score와 의미 혼선 방지)
# -----------------------------
def mp_points_to_nx3(points, n_points: int):
    out = np.zeros((n_points, 3), dtype=np.float32)

    if not isinstance(points, list) or len(points) == 0:
        return out
    if not isinstance(points[0], dict):
        return out

    m = min(len(points), n_points)
    for i in range(m):
        p = points[i]
        out[i, 0] = safe_float(p.get("x", 0.0))
        out[i, 1] = safe_float(p.get("y", 0.0))
        out[i, 2] = 0.0  # z도 버려서 통일(필요 시 사용하도록 변경 가능)
    return out


# -----------------------------
# 얼굴 포인트 변환:
# - MediaPipe dict 배열 또는 OpenPose/AIHub 숫자 배열을 받아 (FACE_POINTS,3)로 변환
# - OpenPose는 (x,y,score)*N 이므로, 68이면 70이 되도록 패딩 지원
# -----------------------------
def face_keypoints_to_nx3(face_kps):
    out = np.zeros((FACE_POINTS, 3), dtype=np.float32)

    # 1) MediaPipe dict 배열: [{x,y,z}, ...]
    if isinstance(face_kps, list) and len(face_kps) > 0 and isinstance(face_kps[0], dict):
        m = min(len(face_kps), FACE_POINTS)
        for i in range(m):
            p = face_kps[i]
            out[i, 0] = safe_float(p.get("x", 0.0))
            out[i, 1] = safe_float(p.get("y", 0.0))
            out[i, 2] = safe_float(p.get("z", 0.0))  # 필요하면 0.0으로 통일 가능
        return out

    # 2) OpenPose/AIHub 숫자 배열: (x,y,score)*N
    if isinstance(face_kps, list):
        # 68 포인트만 들어오면 70이 되도록 2포인트(=6값) 패딩
        if FACE_POINTS == 70 and len(face_kps) == 68 * 3:
            face_kps = face_kps + [0.0, 0.0, 0.0] * 2

        if len(face_kps) >= FACE_POINTS * 3:
            try:
                vals = [safe_float(v) for v in face_kps[: FACE_POINTS * 3]]
                arr = np.array(vals, dtype=np.float32).reshape(FACE_POINTS, 3)
                out[:, :] = arr
            except Exception:
                pass

    return out


# -----------------------------
# 프레임 1개 -> 손 텐서 (2,21,3)
# - MediaPipe: frame_dict["hands"] 사용
# - AIHub/OpenPose: frame_dict["people"] 내부 hand_*_keypoints_2d 사용
# -----------------------------
def one_frame_json_to_hand_tensor(frame_dict):
    hand_frame = np.zeros((2, HAND_POINTS, 3), dtype=np.float32)

    if not isinstance(frame_dict, dict):
        return hand_frame

    # 1) MediaPipe 방식: {"hands": [hand0, hand1]}
    if "hands" in frame_dict and isinstance(frame_dict["hands"], list):
        hands = frame_dict.get("hands") or []
        if len(hands) > 0:
            hand_frame[0] = mp_points_to_nx3(hands[0], HAND_POINTS)
        if len(hands) > 1:
            hand_frame[1] = mp_points_to_nx3(hands[1], HAND_POINTS)
        return hand_frame

    # 2) AIHub/OpenPose 방식: people 안에 keypoints_2d
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

    # (c) people이 {"0": person0, ...} 같은 dict인 경우
    elif isinstance(people, dict) and len(people) > 0:
        dict_items = [(k, v) for k, v in people.items() if isinstance(v, dict)]
        if dict_items:
            try:
                k0 = sorted([k for k, _ in dict_items], key=lambda x: int(str(x)))[0]
                p0 = people[k0]
            except Exception:
                p0 = dict_items[0][1]

    if not isinstance(p0, dict):
        return hand_frame

    left = p0.get("hand_left_keypoints_2d", [])
    right = p0.get("hand_right_keypoints_2d", [])

    # 관례적으로 오른손을 0, 왼손을 1로 고정(기존 파이프라인과 동일)
    hand_frame[0] = hand_keypoints_to_21x3(right)
    hand_frame[1] = hand_keypoints_to_21x3(left)
    return hand_frame


# -----------------------------
# 프레임 1개 -> 얼굴 텐서 (FACE_POINTS,3) = (70,3)
# - MediaPipe: frame_dict["face"] 사용
# - AIHub/OpenPose: frame_dict["people"] 내부 face_keypoints_2d 사용
# -----------------------------
def one_frame_json_to_face_tensor(frame_dict):
    if not isinstance(frame_dict, dict):
        return np.zeros((FACE_POINTS, 3), dtype=np.float32)

    # 1) MediaPipe 방식: {"face": [...]}
    if "face" in frame_dict:
        return face_keypoints_to_nx3(frame_dict.get("face", []))  # ✅ 함수명 통일(기존 478 이름 제거)

    # 2) AIHub/OpenPose 방식: people 안의 face_keypoints_2d
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
    return face_keypoints_to_nx3(face2d)


# -----------------------------
# 폴더(샘플 1개) -> (손, 얼굴, 받은프레임수)
# - 여러 *_keypoints.json을 시간순으로 읽어서 프레임을 누적
# - 전부 0인 프레임은 스킵
# - 최종 길이를 T=30으로 맞춤(마지막 30프레임 유지)
# -----------------------------
def folder_to_sample(folder: Path):
    json_files = sorted(folder.glob("*.json"))
    if not json_files:
        return None, None, 0

    frames_hand = []
    frames_face = []

    for fp in json_files:
        j = load_json(fp)
        if j is None:
            continue

        # payload(frames 배열)도 지원
        if isinstance(j, dict) and isinstance(j.get("frames"), list):
            iterable = j["frames"]
        else:
            iterable = [j]  # 단일 프레임 dict로 취급

        for fr in iterable:
            try:
                hand = one_frame_json_to_hand_tensor(fr)
                face = one_frame_json_to_face_tensor(fr)
            except Exception as e:
                print(f"[BAD FRAME] {fp} -> {type(e).__name__}: {e}")
                continue

            # 둘 다 완전 0이면 학습 의미 없으니 스킵
            if hand.sum() == 0 and face.sum() == 0:
                continue

            frames_hand.append(hand)
            frames_face.append(face)

    received = len(frames_hand)
    if received == 0:
        return None, None, 0

    # 길이 T=30 맞추기: "마지막 30프레임" 정책
    if received >= T:
        frames_hand = frames_hand[-T:]
        frames_face = frames_face[-T:]
    else:
        pad_n = T - received
        frames_hand += [np.zeros((2, HAND_POINTS, 3), dtype=np.float32) for _ in range(pad_n)]
        frames_face += [np.zeros((FACE_POINTS, 3), dtype=np.float32) for _ in range(pad_n)]

    x_hand = np.stack(frames_hand, axis=0)  # (30,2,21,3)
    x_face = np.stack(frames_face, axis=0)  # (30,70,3)
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
# - in_dir 아래 샘플 폴더들을 순회하며 변환
# - out_dir/라벨/ 아래에 npy 저장
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

    folders = sorted([p for p in in_dir.iterdir() if p.is_dir()])

    done = 0
    for f in folders:
        try:
            x_hand, x_face, received = folder_to_sample(f)
        except Exception as e:
            print(f"[BAD SAMPLE] {f} -> {type(e).__name__}: {e}")
            continue

        if x_hand is None or x_face is None:
            print(f"[SKIP] {f.name} (no valid frames)")
            continue

        label = extract_word_id(f.name)
        label_dir = out_dir / label
        label_dir.mkdir(parents=True, exist_ok=True)

        hand_out = label_dir / f"{f.name}.hand.npy"
        face_out = label_dir / f"{f.name}_face.npy"

        # 이미 변환된 건 스킵(재시작/재개용)
        if hand_out.exists() and face_out.exists():
            continue

        np.save(hand_out, x_hand)
        np.save(face_out, x_face)

        print(f"[OK] {f.name} hand={x_hand.shape} face={x_face.shape} framesReceived={received}")

        done += 1
        if done >= args.max:
            break

    print("DONE:", done)


if __name__ == "__main__":
    main()
