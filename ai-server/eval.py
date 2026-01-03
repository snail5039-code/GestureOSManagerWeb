"""
eval.py
- train.py에서 학습한 모델(best_model.pth)을 dataset_split 폴더(val)로 평가한다.

✅ 이 eval.py는 "train.py와 동일한 방식"으로 동작하게 맞춰놨음
1) 모델 구조: TCNClassifier (backbone/head)  ← train.py와 동일
2) 입력 로딩: *.hand.npy + (있으면) *_face.npy 붙여서 (T,F) 만들기
3) 전처리: face 좌표는 landmark[0]을 기준으로 상대좌표(앞 2축만), 전체 /1000 스케일
4) feature dim 자동 감지:
   - state_dict의 backbone.0.weight shape[1] = in_channels = feat_dim
   - feat_dim=126 -> 손만 사용
   - feat_dim=1560 -> 손+얼굴 사용

사용 예시:
python .\eval.py --data_dir ".\dataset_split_word" --model ".\artifacts\word_run_xxx\best_model.pth" --label_map ".\artifacts\word_run_xxx\label_map.json" --topk 1 --show_misses 30
"""

import argparse
import json
from pathlib import Path
from typing import Dict, List, Tuple, Optional

import numpy as np
import torch
import torch.nn as nn


# =========================
# 1) 모델 정의 (train.py와 동일)
# =========================
class TCNClassifier(nn.Module):
    """
    train.py에서 쓰는 것과 같은 구조.
    입력:  x (B, T, F)
    처리:  (B, F, T)로 바꿔서 Conv1d backbone 통과
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
        h = self.backbone(x)         # (B,128,T)
        h = h.mean(dim=2)            # (B,128)
        logits = self.head(h)        # (B,C)
        return logits


# =========================
# 2) label_map 로드 유틸
# =========================
def load_label_map(label_map_path: Path) -> Tuple[Dict[str, int], Dict[int, str]]:
    """
    label_map.json 형태가 프로젝트마다 다를 수 있어서 유연하게 처리.

    보통 너희는 이렇게 저장됨:
      {"WORD0001": 0, "WORD0002": 1, ...}  (label->idx)

    혹시라도 반대로 저장된 경우( idx->label )도 방어.
    """
    data = json.loads(label_map_path.read_text(encoding="utf-8"))

    # 케이스 A) {"WORD0001": 0, ...} (label->idx)
    if len(data) > 0 and isinstance(next(iter(data.values())), int):
        label_to_idx = {str(k): int(v) for k, v in data.items()}
        idx_to_label = {v: k for k, v in label_to_idx.items()}
        return label_to_idx, idx_to_label

    # 케이스 B) {"0": "WORD0001", ...} (idx->label)
    if len(data) > 0 and isinstance(next(iter(data.values())), str):
        idx_to_label = {int(k): str(v) for k, v in data.items()}
        label_to_idx = {v: k for k, v in idx_to_label.items()}
        return label_to_idx, idx_to_label

    raise ValueError(f"Unknown label_map.json format: {label_map_path}")


# =========================
# 3) 데이터 수집: val 샘플 목록 만들기
# =========================
def collect_samples_from_dataset_split(data_dir: Path, label_to_idx: Dict[str, int], max_samples: int) -> List[Tuple[Path, int, str]]:
    """
    data_dir은 "dataset_split 폴더(train/val 있는 곳)" 라고 가정
    - 보통: dataset_split_word/train/..., dataset_split_word/val/...
    - 평가에서는 val을 우선 사용
    - 만약 val 폴더가 없으면 data_dir 자체에서 라벨 폴더를 찾음

    반환:
      samples: [(hand_path, y_idx, label_name), ...]
      hand_path는 반드시 *.hand.npy만 수집 (face는 hand_path로부터 유도)
    """
    # 1) val 폴더가 있으면 그걸 사용
    val_dir = data_dir / "val"
    base = val_dir if val_dir.exists() else data_dir

    samples: List[Tuple[Path, int, str]] = []

    # 라벨 폴더(WORD0001 같은)만 훑기
    for label_dir in sorted([p for p in base.iterdir() if p.is_dir()]):
        label_name = label_dir.name

        # label_map에 없는 폴더면 스킵 (데이터 폴더가 섞여있을 때 방어)
        if label_name not in label_to_idx:
            continue

        y_idx = label_to_idx[label_name]

        # ✅ hand 파일만 수집 (face 파일은 여기서 직접 평가 대상으로 잡으면 꼬임)
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
      - 126  -> 손만 (30,2,21,3) -> (30,126)
      - 1560 -> 손+얼굴 (손126 + 얼굴1434) -> (30,1560)

    반환:
      x: (T,F) float32, /1000 스케일 적용
    """
    # ---- 1) 손 로드 ----
    hand = np.load(hand_path).astype(np.float32)  # (T,2,21,3)
    T = hand.shape[0]
    hand_flat = hand.reshape(T, -1)               # (T,126)

    # 손만 기대하면 여기서 끝
    if feat_dim_expected == hand_flat.shape[1]:
        return (hand_flat / 1000.0).astype(np.float32)

    # ---- 2) 얼굴 로드(있으면) + 전처리 ----
    # hand 파일명 규칙: xxx.hand.npy
    # face 파일명 규칙: xxx_face.npy  (너희 변환 스크립트 기준)
    face_path = hand_path.with_name(hand_path.name.replace(".hand.npy", "_face.npy"))

    if face_path.exists():
        face = np.load(face_path).astype(np.float32)  # (T,478,3)

        # train.py에서 하던 것처럼 landmark0 기준 상대좌표(앞 2축만)
        # (얼굴 xyz 중 xy만 기준점 빼주고, z는 그대로 둠)
        if face.ndim == 3 and face.shape[-1] >= 2:
            anchor = face[:, 0:1, :2]          # (T,1,2)
            face[:, :, :2] -= anchor           # xy 상대좌표

        face_flat = face.reshape(T, -1)        # (T,1434)

    else:
        # 얼굴 파일이 없는 경우: 기대 dim을 맞추기 위해 0으로 패딩
        # (이 상황이 많으면 데이터 생성/변환 쪽을 다시 확인해야 함)
        face_flat = np.zeros((T, 478 * 3), dtype=np.float32)

    x = np.concatenate([hand_flat, face_flat], axis=1).astype(np.float32)  # (T,1560)

    # 만약 기대 dim이 1560이 아닌데도 들어왔다면 차원 맞춰 방어
    if x.shape[1] != feat_dim_expected:
        # 크면 잘라내고, 작으면 패딩
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
    topk: Top-K accuracy 계산
    show_misses: 틀린 예시 몇 개 출력할지 (0이면 출력 안함)
    """
    model.eval()

    total = 0
    correct_topk = 0

    misses_printed = 0

    # 배치 단위로 쪼개서 평가
    for i in range(0, len(samples), batch_size):
        batch = samples[i:i + batch_size]

        xs = []
        ys = []

        # ---- 배치 로딩 ----
        for hand_path, y_idx, _label_name in batch:
            x = load_one_sample_TF(hand_path, feat_dim_expected)  # (T,F)
            xs.append(x)
            ys.append(y_idx)

        x_t = torch.from_numpy(np.stack(xs, axis=0)).to(device)      # (B,T,F)
        y_t = torch.tensor(ys, dtype=torch.long, device=device)      # (B,)

        # ---- 추론 ----
        logits = model(x_t)                                          # (B,C)

        # ---- TopK 계산 ----
        # topk=1이면 그냥 argmax와 동일
        k = max(1, int(topk))
        _, pred_topk = torch.topk(logits, k=k, dim=1)                # (B,k)

        # 정답이 topk 안에 있으면 정답 처리
        match = (pred_topk == y_t.unsqueeze(1)).any(dim=1)           # (B,)
        correct_topk += int(match.sum().item())
        total += y_t.size(0)

        # ---- 틀린 예시 출력(옵션) ----
        if show_misses > 0 and misses_printed < show_misses:
            pred1 = torch.argmax(logits, dim=1)                      # (B,)
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


def infer_feat_dim_from_weights(model_path: Path) -> int:
    """
    state_dict를 열어서 'backbone.0.weight' shape으로 입력 feature dim(F)을 자동 추정.
    backbone.0.weight: (out_channels, in_channels, kernel)
    in_channels == feat_dim_expected

    - 손만: 126
    - 손+얼굴: 1560  (126 + 1434)
    """
    state = torch.load(model_path, map_location="cpu")
    if not isinstance(state, dict):
        raise ValueError("best_model.pth should be a state_dict(dict).")

    key = "backbone.0.weight"
    if key not in state:
        # 혹시 저장 키가 다르면 전체 키를 찍어서 확인해야 함
        raise KeyError(f"Cannot find '{key}' in state_dict keys. keys sample={list(state.keys())[:20]}")

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

    # ---- 모델 입력 차원(feat_dim) 자동 추정 ----
    feat_dim_expected = infer_feat_dim_from_weights(model_path)

    # ---- 디바이스 선택 ----
    device = "cuda" if torch.cuda.is_available() else "cpu"

    # ---- 샘플 수집 ----
    samples = collect_samples_from_dataset_split(
        data_dir=data_dir,
        label_to_idx=label_to_idx,
        max_samples=args.max_samples,
    )

    print(f"device: {device}")
    print(f"num_classes: {num_classes}")
    print(f"feat_dim_expected: {feat_dim_expected}  (126=hand only, 1560=hand+face)")
    print(f"num_samples: {len(samples)} (from {'val' if (data_dir/'val').exists() else 'data_dir'})")

    if len(samples) == 0:
        print("[ERROR] No samples found. Check data_dir structure and label_map.")
        return

    # ---- 모델 생성 + 가중치 로드 ----
    model = TCNClassifier(feat_dim=feat_dim_expected, num_classes=num_classes).to(device)
    state = torch.load(model_path, map_location=device)
    model.load_state_dict(state)
    model.eval()

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
