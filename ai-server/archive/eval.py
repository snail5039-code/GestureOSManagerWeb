"""
eval.py
-------------------------
목적:
- 학습된 model.pth + label_map.json을 이용해서
- dataset_split_xxx/val 폴더 전체를 평가한다.
- Top-1 / Top-5 accuracy 출력
- 오답 샘플 몇 개도 같이 출력 (디버깅용)

실행 예시:
python .\eval.py --data_dir ".\dataset_split_small" --model ".\model.pth" --label_map ".\label_map.json"
"""

import argparse
import json
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn


# -------------------------
# 1) 학습 때 쓴 모델 구조와 "완전히 동일"해야 함
# -------------------------
class SimpleClassifier(nn.Module):
    def __init__(self, num_classes: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Flatten(),
            nn.Linear(30 * 2 * 21 * 3, 256),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(256, num_classes),
        )

    def forward(self, x):
        return self.net(x)


# -------------------------
# 2) label_map.json 로드 (WORD->IDX / IDX->WORD 둘 다 대응)
# -------------------------
def load_label_map(label_map_path: Path):
    d = json.loads(label_map_path.read_text(encoding="utf-8"))
    sample_key = next(iter(d.keys()))

    # 케이스 A) {"0":"WORD0001", "1":"WORD0002", ...}  (IDX->WORD)  <= 너 지금 이거
    if str(sample_key).isdigit():
        idx_to_label = {int(k): v for k, v in d.items()}
        label_to_idx = {v: int(k) for k, v in d.items()}
        return label_to_idx, idx_to_label

    # 케이스 B) {"WORD0001":0, "WORD0002":1, ...}  (WORD->IDX)
    label_to_idx = {k: int(v) for k, v in d.items()}
    idx_to_label = {int(v): k for k, v in d.items()}
    return label_to_idx, idx_to_label


# -------------------------
# 3) 전처리: 학습 때 했던 것과 동일하게!
#    - 손목(0번)을 기준으로 상대좌표로 만들기
#    - /500 스케일링
# -------------------------
def preprocess_like_train(x: np.ndarray) -> np.ndarray:
    x = x.astype(np.float32)

    # 손목 좌표 (30,2,1,2)
    wrist = x[:, :, 0:1, :2]
    # 상대좌표
    x[..., :2] = x[..., :2] - wrist

    # 스케일링 (학습 때랑 동일해야 함)
    x[..., 0] /= 500.0
    x[..., 1] /= 500.0

    return x


# -------------------------
# 4) val 폴더에서 (npy경로, 정답라벨WORD) 목록 만들기
#    data_dir/val/WORD0001/*.npy 형태를 가정
# -------------------------
def collect_val_samples(data_dir: Path):
    val_root = data_dir / "val"
    if not val_root.exists():
        raise FileNotFoundError(f"val folder not found: {val_root}")

    samples = []
    for label_dir in sorted([p for p in val_root.iterdir() if p.is_dir()]):
        label_name = label_dir.name  # 예: WORD0001
        for npy_path in sorted(label_dir.glob("*.npy")):
            samples.append((npy_path, label_name))

    return samples


@torch.no_grad()
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data_dir", required=True, help="dataset_split 폴더 (train/val 있는 곳)")
    ap.add_argument("--model", default="model.pth", help="model.pth 경로")
    ap.add_argument("--label_map", default="label_map.json", help="label_map.json 경로")
    ap.add_argument("--batch_size", type=int, default=32, help="평가 배치 크기")
    ap.add_argument("--topk", type=int, default=5, help="Top-K 정확도")
    ap.add_argument("--max_samples", type=int, default=0, help="0이면 전체, 아니면 앞에서 N개만 평가")
    ap.add_argument("--show_misses", type=int, default=10, help="오답 몇 개 출력할지")
    args = ap.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print("device:", device)

    data_dir = Path(args.data_dir)
    model_path = Path(args.model)
    label_map_path = Path(args.label_map)

    label_to_idx, idx_to_label = load_label_map(label_map_path)
    num_classes = len(label_to_idx)
    print("num_classes:", num_classes)

    # 모델 로드
    model = SimpleClassifier(num_classes=num_classes).to(device)
    state = torch.load(model_path, map_location=device)
    model.load_state_dict(state)
    model.eval()

    # val 샘플 수집
    samples = collect_val_samples(data_dir)
    if args.max_samples and args.max_samples > 0:
        samples = samples[: args.max_samples]

    print("val samples found:", len(samples))

    # label_map에 없는 라벨이면 평가 못하므로 스킵
    filtered = []
    skipped = 0
    for npy_path, gt_label in samples:
        if gt_label not in label_to_idx:
            skipped += 1
            continue
        filtered.append((npy_path, gt_label))

    if skipped > 0:
        print(f"[WARN] skipped {skipped} samples because label not in label_map.json")

    samples = filtered
    if not samples:
        raise RuntimeError("No valid samples to evaluate (check label_map.json vs val folder labels)")

    # 평가 루프
    top1_correct = 0
    topk_correct = 0
    total = 0

    misses = []  # 오답 저장 (파일, 정답, 예측 top1, top5)

    bs = args.batch_size
    K = args.topk

    for i in range(0, len(samples), bs):
        batch = samples[i:i+bs]

        xs = []
        ys = []
        paths = []
        gts = []

        for npy_path, gt_label in batch:
            x = np.load(npy_path)          # (30,2,21,3)
            x = preprocess_like_train(x)   # 전처리
            xs.append(x)
            ys.append(label_to_idx[gt_label])
            paths.append(str(npy_path))
            gts.append(gt_label)

        x_t = torch.from_numpy(np.stack(xs, axis=0)).to(device)  # (B,30,2,21,3)
        y_t = torch.tensor(ys, dtype=torch.long).to(device)      # (B,)

        logits = model(x_t)  # (B, C)
        probs = torch.softmax(logits, dim=1)

        # topk 인덱스
        topk_idx = torch.topk(probs, k=min(K, probs.shape[1]), dim=1).indices  # (B,K)

        # top1
        pred1 = topk_idx[:, 0]

        # top1 정확도
        top1_correct += (pred1 == y_t).sum().item()

        # topk 정확도: 정답이 topk 안에 있으면 OK
        in_topk = (topk_idx == y_t.unsqueeze(1)).any(dim=1)
        topk_correct += in_topk.sum().item()

        # 오답 모으기
        for bi in range(len(batch)):
            total += 1
            if pred1[bi].item() != y_t[bi].item() and len(misses) < args.show_misses:
                pred1_label = idx_to_label.get(int(pred1[bi].item()), f"IDX_{pred1[bi].item()}")
                topk_labels = [idx_to_label.get(int(x), f"IDX_{x}") for x in topk_idx[bi].tolist()]
                misses.append((paths[bi], gts[bi], pred1_label, topk_labels))

    # 결과 출력
    top1_acc = top1_correct / total
    topk_acc = topk_correct / total
    print("\n===== EVAL RESULT =====")
    print(f"total: {total}")
    print(f"top1_acc: {top1_acc:.4f}")
    print(f"top{K}_acc: {topk_acc:.4f}")

    # 오답 출력
    if misses:
        print("\n===== SAMPLE MISSES (some) =====")
        for path, gt, pred1, topk_labels in misses:
            print(f"- file: {path}")
            print(f"  gt:   {gt}")
            print(f"  pred: {pred1}")
            print(f"  top{K}: {topk_labels}\n")


if __name__ == "__main__":
    main()
