"""
eval.py
============================================================
목적:
- train.py에서 학습한 모델(best_model.pth)을 dataset_split의 val 데이터로 평가한다.

✅ 이 eval.py는 "train.py와 동일한 방식"으로 입력을 구성하도록 맞춰둠
1) 모델 구조: TCNClassifier (backbone/head)  ← train.py와 동일 가정
2) 입력 로딩: *.hand.npy + (있으면) *_face.npy 를 붙여서 (T,F) 생성
3) 전처리:
   - face 좌표는 landmark[0]을 기준(anchor)으로 xy 상대좌표(translation 불변)
   - 전체 feature는 /1000 스케일 적용 (train/main과 일치시키기 위해)

4) feature dim(F) 자동 감지:
   - state_dict의 backbone.0.weight shape[1] = in_channels = feat_dim
   - feat_dim=126 -> 손만 사용 (2*21*3)
   - feat_dim=336 -> 손+얼굴70 사용 (손126 + 얼굴(70*3=210))

사용 예시:
  # dataset_split 구조: data_dir/val/WORD00001/*.hand.npy ...
  python .\eval.py --data_dir ".\dataset_split_word" --model ".\best_model_face.pth" --label_map ".\label_map.json" --topk 1 --show_misses 30

============================================================
"""

import argparse
import json
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import torch
import torch.nn as nn


# =========================
# 1) 모델 정의 (train.py와 동일 구조 가정)
# =========================
class TCNClassifier(nn.Module):
    """
    입력:  x (B, T, F)
    처리:  (B, F, T)로 transpose 후 Conv1d backbone
    풀링:  시간축 mean pooling
    출력:  logits (B, num_classes)
    """
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
            nn.Linear(128, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B,T,F) -> (B,F,T)
        x = x.transpose(1, 2)
        h = self.backbone(x)      # (B,128,T)
        h = h.mean(dim=2)         # (B,128)
        logits = self.head(h)     # (B,C)
        return logits


# =========================
# 2) label_map 로드 유틸
# =========================
def load_label_map(label_map_path: Path) -> Tuple[Dict[str, int], Dict[int, str]]:
    """
    label_map.json 포맷이 2가지 모두 올 수 있어서 둘 다 지원.

    케이스 A) {"WORD00001": 0, "WORD00002": 1, ...}  (label->idx)
    케이스 B) {"0": "WORD00001", "1": "WORD00002", ...} (idx->label)

    반환:
      label_to_idx: {"WORD00001": 0, ...}
      idx_to_label: {0: "WORD00001", ...}
    """
    data = json.loads(label_map_path.read_text(encoding="utf-8"))

    # A) label->idx
    if len(data) > 0 and isinstance(next(iter(data.values())), int):
        label_to_idx = {str(k): int(v) for k, v in data.items()}
        idx_to_label = {v: k for k, v in label_to_idx.items()}
        return label_to_idx, idx_to_label

    # B) idx->label
    if len(data) > 0 and isinstance(next(iter(data.values())), str):
        idx_to_label = {int(k): str(v) for k, v in data.items()}
        label_to_idx = {v: k for k, v in idx_to_label.items()}
        return label_to_idx, idx_to_label

    raise ValueError(f"Unknown label_map.json format: {label_map_path}")


# =========================
# 3) 데이터 수집: val 샘플 목록 만들기
# =========================
def collect_samples_from_dataset_split(
    data_dir: Path,
    label_to_idx: Dict[str, int],
    max_samples: int
) -> List[Tuple[Path, int, str]]:
    """
    data_dir은 "dataset_split 폴더(train/val 있는 곳)" 라고 가정.
    - 보통: data_dir/train/WORD****, data_dir/val/WORD****
    - 평가에서는 val을 우선 사용
    - val 폴더가 없으면 data_dir 자체에서 라벨 폴더를 찾음

    반환:
      samples: [(hand_path, y_idx, label_name), ...]
      - hand_path는 반드시 *.hand.npy만 수집
      - face는 hand_path로부터 hand_path.name.replace(".hand.npy","_face.npy")로 유도
    """
    val_dir = data_dir / "val"
    base = val_dir if val_dir.exists() else data_dir

    samples: List[Tuple[Path, int, str]] = []

    # 라벨 폴더(WORD****) 순회
    for label_dir in sorted([p for p in base.iterdir() if p.is_dir()]):
        label_name = label_dir.name
        if label_name not in label_to_idx:
            continue
        y_idx = label_to_idx[label_name]

        # *.hand.npy 수집
        for hand_path in sorted(label_dir.glob("*.hand.npy")):
            samples.append((hand_path, y_idx, label_name))
            if max_samples > 0 and len(samples) >= max_samples:
                return samples

    return samples


# =========================
# 4) train.py와 동일한 방식으로 입력(T,F) 만들기
# =========================
def load_one_sample_TF(hand_path: Path, feat_dim_expected: int) -> np.ndarray:
    """
    hand_path: ...*.hand.npy
    feat_dim_expected:
      - 126 -> 손만 (T,2,21,3) -> flatten => (T,126)
      - 336 -> 손+얼굴70 (손126 + 얼굴(70*3=210) => (T,336))

    반환:
      x: (T,F) float32
      - 최종적으로 /1000 스케일 적용(학습/서버와 분포 맞추기)
    """
    # ---- 1) 손 로드 ----
    hand = np.load(hand_path).astype(np.float32)  # (T,2,21,3)
    T = hand.shape[0]
    hand_flat = hand.reshape(T, -1)               # (T,126)

    # 손만 기대하면 여기서 끝
    if feat_dim_expected == hand_flat.shape[1]:
        return (hand_flat / 1000.0).astype(np.float32)

    # ---- 2) 얼굴 로드(있으면) + 전처리 ----
    face_path = hand_path.with_name(hand_path.name.replace(".hand.npy", "_face.npy"))

    # ✅ 모델이 기대하는 F에서 손(126)을 뺀 나머지를 "얼굴로 채운다"
    need_face_dim = feat_dim_expected - hand_flat.shape[1]
    if need_face_dim < 0:
        # 비정상 모델 방어(손보다 작은 입력을 기대하는 경우)
        need_face_dim = 0

    if face_path.exists():
        face = np.load(face_path).astype(np.float32)  # (T,70,3) 기대

        # 얼굴은 "랜드마크 0번"을 anchor로 잡고 xy만 상대좌표로 변경
        # -> 위치 이동(translation)에 덜 민감하게 만들기 (train과 일치 목적)
        if face.ndim == 3 and face.shape[-1] >= 2:
            anchor = face[:, 0:1, :2]     # (T,1,2)
            face[:, :, :2] -= anchor      # xy 상대좌표

        face_flat = face.reshape(T, -1)  # (T,210) 기대
    else:
        # 얼굴 파일이 없으면 필요한 만큼 0으로 채움
        face_flat = np.zeros((T, need_face_dim), dtype=np.float32)

    # ---- 3) concat ----
    x = np.concatenate([hand_flat, face_flat], axis=1).astype(np.float32)

    # ---- 4) 기대 dim과 안 맞으면 차원 맞추기(방어)
    # (예: 얼굴이 68포인트로 저장되어 204가 들어오는 등)
    if x.shape[1] != feat_dim_expected:
        if x.shape[1] > feat_dim_expected:
            x = x[:, :feat_dim_expected]
        else:
            pad = np.zeros((T, feat_dim_expected - x.shape[1]), dtype=np.float32)
            x = np.concatenate([x, pad], axis=1)

    return (x / 1000.0).astype(np.float32)


# =========================
# 5) 평가 루프
# =========================
@torch.no_grad()
def evaluate(
    model: nn.Module,
    samples: List[Tuple[Path, int, str]],
    device: str,
    batch_size: int,
    topk: int,
    feat_dim_expected: int,
    show_misses: int,
    idx_to_label: Dict[int, str],
):
    """
    samples: (hand_path, y_idx, label_name)
    topk: Top-K 정확도 계산
    show_misses: 틀린 예시 몇 개 출력할지 (0이면 출력 안함)
    """
    model.eval()

    total = 0
    correct_topk = 0
    misses_printed = 0

    for i in range(0, len(samples), batch_size):
        batch = samples[i:i + batch_size]

        # 배치 입력 생성
        xs = []
        ys = []
        for hand_path, y_idx, _label in batch:
            x = load_one_sample_TF(hand_path, feat_dim_expected)  # (T,F)
            xs.append(x)
            ys.append(y_idx)

        x_np = np.stack(xs, axis=0)  # (B,T,F)
        y_np = np.array(ys, dtype=np.int64)

        x_t = torch.from_numpy(x_np).to(device)
        y_t = torch.from_numpy(y_np).to(device)

        logits = model(x_t)  # (B,C)

        k = max(1, int(topk))
        _, pred_topk = torch.topk(logits, k=k, dim=1)            # (B,k)

        match = (pred_topk == y_t.unsqueeze(1)).any(dim=1)       # (B,)
        correct_topk += int(match.sum().item())
        total += y_t.size(0)

        # ---- 오답 예시 출력(옵션) ----
        if show_misses > 0 and misses_printed < show_misses:
            pred1 = torch.argmax(logits, dim=1)                  # (B,)
            for b in range(len(batch)):
                if misses_printed >= show_misses:
                    break
                if int(pred1[b].item()) != int(y_t[b].item()):
                    hand_path, true_idx, true_label = batch[b]
                    pred_idx = int(pred1[b].item())
                    pred_label = idx_to_label.get(pred_idx, str(pred_idx))
                    print(f"[MISS] file={hand_path.name}  true={true_label}({true_idx})  pred={pred_label}({pred_idx})")
                    misses_printed += 1

    acc = (correct_topk / total) if total > 0 else 0.0
    return acc, total


# =========================
# 6) 모델 입력 차원(F) 자동 추정
# =========================
def infer_feat_dim_from_weights(model_path: Path) -> int:
    """
    state_dict를 열어서 'backbone.0.weight' shape으로 입력 feature dim(F)을 추정.
    backbone.0.weight: (out_channels, in_channels, kernel)
    -> in_channels == feat_dim

    ✅ 이 값이 126이면 손-only 모델
    ✅ 이 값이 336이면 손+얼굴70 모델
    """
    ckpt = torch.load(model_path, map_location="cpu")

    # 체크포인트 포맷이 다양할 수 있어 방어적으로 처리
    if isinstance(ckpt, dict) and "state_dict" in ckpt and isinstance(ckpt["state_dict"], dict):
        state = ckpt["state_dict"]
    elif isinstance(ckpt, dict) and "model_state_dict" in ckpt and isinstance(ckpt["model_state_dict"], dict):
        state = ckpt["model_state_dict"]
    elif isinstance(ckpt, dict):
        # 그냥 state_dict 자체일 수도 있음
        state = ckpt
    else:
        raise ValueError("Unknown checkpoint format")

    key = "backbone.0.weight"
    if key not in state:
        raise KeyError(f"Cannot find '{key}' in state_dict. keys sample={list(state.keys())[:20]}")

    w = state[key]
    feat_dim = int(w.shape[1])
    return feat_dim


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data_dir", required=True, help="dataset_split 폴더(train/val 있는 곳)")
    parser.add_argument("--model", required=True, help="best_model.pth 경로")
    parser.add_argument("--label_map", required=True, help="label_map.json 경로")
    parser.add_argument("--batch_size", type=int, default=64, help="평가 배치 크기")
    parser.add_argument("--topk", type=int, default=1, help="Top-K 정확도")
    parser.add_argument("--max_samples", type=int, default=0, help="0이면 전체, 아니면 앞에서 N개만 평가")
    parser.add_argument("--show_misses", type=int, default=0, help="오답 몇 개 출력할지 (0이면 출력 안함)")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    model_path = Path(args.model)
    label_map_path = Path(args.label_map)

    # ---- label_map 로드 ----
    label_to_idx, idx_to_label = load_label_map(label_map_path)
    num_classes = len(label_to_idx)

    # ---- 평가 샘플 수집 ----
    samples = collect_samples_from_dataset_split(data_dir, label_to_idx, args.max_samples)
    if len(samples) == 0:
        raise RuntimeError(f"No samples found under: {data_dir} (val 폴더 구조/경로 확인)")

    # ---- 모델 입력 차원(feat_dim) 자동 추정 ----
    feat_dim_expected = infer_feat_dim_from_weights(model_path)
    print(f"feat_dim_expected: {feat_dim_expected}  (126=hand only, 336=hand+face70)")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print("device:", device)

    # ---- 모델 생성 & weight 로드 ----
    model = TCNClassifier(feat_dim=feat_dim_expected, num_classes=num_classes).to(device)

    ckpt = torch.load(model_path, map_location="cpu")
    if isinstance(ckpt, dict) and "state_dict" in ckpt:
        state = ckpt["state_dict"]
    elif isinstance(ckpt, dict) and "model_state_dict" in ckpt:
        state = ckpt["model_state_dict"]
    elif isinstance(ckpt, dict):
        state = ckpt
    else:
        raise ValueError("Unknown checkpoint format")

    model.load_state_dict(state, strict=True)

    # ---- 평가 ----
    acc, total = evaluate(
        model=model,
        samples=samples,
        device=device,
        batch_size=args.batch_size,
        topk=args.topk,
        feat_dim_expected=feat_dim_expected,
        show_misses=args.show_misses,
        idx_to_label=idx_to_label,
    )

    print(f"[RESULT] top{args.topk} acc = {acc:.4f}  ({acc*100:.2f}%)  total={total}")


if __name__ == "__main__":
    main()
