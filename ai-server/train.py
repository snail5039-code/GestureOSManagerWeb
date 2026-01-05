# ai-server/train.py
# 손(Hands) ONLY 학습용 - 데이터 포맷 섞여있어도 안전하게 학습되도록 만든 버전
#
# ✅ 핵심
# 1) npy shape가 섞여있어도 "손-only (T,126)"로 변환 가능한 파일만 학습에 포함
# 2) (T,21,3) 한 손만 있으면 파일명(_L_hand/_R_hand)으로 좌/우 슬롯에 넣고 나머지는 0 패딩
# 3) (T,2,21,3) 양손이면 바로 126으로 flatten
# 4) (T,126) 이미 손-only면 그대로
# 5) 그 외 (예: 210 등) → 학습에서 스킵(제외)해서 batch stack 에러 방지
# 6) T 길이가 다르면 target_T로 자르거나 0 패딩해서 통일 (기본 30)
#
# 실행 예:
# python train.py --train_dir .\data\dataset_word_50\train --val_dir .\data\dataset_word_50\val --out_dir current --epochs 30 --batch_size 64 --lr 1e-3

import argparse
import json
import random
import re
from pathlib import Path
from typing import List, Tuple, Optional

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler


# =========================
# 모델(TCN)
# =========================
class TCNBlock(nn.Module):
    def __init__(self, in_ch, out_ch, k=3, dilation=1, dropout=0.1):
        super().__init__()
        pad = (k - 1) * dilation
        self.conv1 = nn.Conv1d(in_ch, out_ch, kernel_size=k, dilation=dilation, padding=pad)
        self.relu1 = nn.ReLU()
        self.drop1 = nn.Dropout(dropout)
        self.conv2 = nn.Conv1d(out_ch, out_ch, kernel_size=k, dilation=dilation, padding=pad)
        self.relu2 = nn.ReLU()
        self.drop2 = nn.Dropout(dropout)
        self.down = nn.Conv1d(in_ch, out_ch, kernel_size=1) if in_ch != out_ch else None

    def forward(self, x):
        y = self.conv1(x)
        y = y[..., : x.shape[-1]]
        y = self.relu1(y)
        y = self.drop1(y)
        y = self.conv2(y)
        y = y[..., : x.shape[-1]]
        y = self.relu2(y)
        y = self.drop2(y)
        res = x if self.down is None else self.down(x)
        return y + res


class TCNClassifier(nn.Module):
    def __init__(self, feat_dim, num_classes, channels=(128, 128, 128), dropout=0.1):
        super().__init__()
        layers = []
        in_ch = feat_dim
        for i, ch in enumerate(channels):
            layers.append(TCNBlock(in_ch, ch, k=3, dilation=2 ** i, dropout=dropout))
            in_ch = ch
        self.tcn = nn.Sequential(*layers)
        self.pool = nn.AdaptiveAvgPool1d(1)
        self.fc = nn.Linear(in_ch, num_classes)

    def forward(self, x):
        # (B,T,F)->(B,F,T)
        x = x.transpose(1, 2)
        y = self.tcn(x)
        y = self.pool(y).squeeze(-1)
        return self.fc(y)


# =========================
# 유틸
# =========================
WORD_RE = re.compile(r"(WORD\d{5})", re.IGNORECASE)

def seed_everything(seed: int):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)

def topk_acc(logits, y, k=1):
    with torch.no_grad():
        _, pred = torch.topk(logits, k=k, dim=1)
        correct = pred.eq(y.view(-1, 1)).sum().item()
        return correct / y.size(0)

def extract_label_from_path(p: Path) -> Optional[str]:
    # 1) 파일명에서 WORD00001 찾기
    m = WORD_RE.search(p.name)
    if m:
        return m.group(1).upper()
    # 2) 상위 폴더가 WORD00001이면 사용
    if WORD_RE.fullmatch(p.parent.name.upper() or ""):
        return p.parent.name.upper()
    return None

def normalize_T(x2: np.ndarray, target_T: int) -> np.ndarray:
    """
    x2: (T,126)
    - T가 크면 앞에서 target_T만큼 자름(가장 간단)
    - T가 작으면 0패딩
    """
    T = x2.shape[0]
    if T == target_T:
        return x2
    if T > target_T:
        return x2[:target_T]
    # pad
    pad = np.zeros((target_T - T, x2.shape[1]), dtype=x2.dtype)
    return np.concatenate([x2, pad], axis=0)

def flatten_hand_only(x: np.ndarray, filename: str) -> np.ndarray:
    """
    어떤 npy든 손-only (T,126)로 변환 가능한 것만 변환.
    그 외는 예외 발생(학습에서 스킵용).

    허용:
    - (T,126)
    - (T,2,21,3)
    - (T,21,3) : 한 손만 → _L_hand/_R_hand 보고 좌/우 슬롯에 넣고 다른 손 0
    """
    # (T,126)
    if x.ndim == 2 and x.shape[1] == 126:
        return x.astype(np.float32)

    # (T,2,21,3)
    if x.ndim == 4 and x.shape[1:] == (2, 21, 3):
        T = x.shape[0]
        return x.reshape(T, 126).astype(np.float32)

    # (T,21,3) 한 손
    if x.ndim == 3 and x.shape[1:] == (21, 3):
        T = x.shape[0]
        right = np.zeros((T, 21, 3), dtype=np.float32)
        left  = np.zeros((T, 21, 3), dtype=np.float32)

        fname = filename.lower()
        if "_l_hand" in fname or "l_hand" in fname:
            left = x.astype(np.float32)
        elif "_r_hand" in fname or "r_hand" in fname:
            right = x.astype(np.float32)
        else:
            # 모르면 오른손으로 넣고 왼손 0
            right = x.astype(np.float32)

        both = np.stack([right, left], axis=1)  # (T,2,21,3)
        return both.reshape(T, 126).astype(np.float32)

    # 여기로 오면 손-only가 아님 (예: (T,70,3)->210 등)
    raise ValueError(f"NOT_HAND_ONLY shape={x.shape} file={filename}")


# =========================
# Dataset (스캔 단계에서 이상한 파일 스킵)
# =========================
class NpySeqDataset(Dataset):
    def __init__(self, root_dir: Path, label_map: dict, target_T: int):
        self.root_dir = Path(root_dir)
        self.label_map = label_map
        self.target_T = target_T

        self.items: List[Tuple[Path, int]] = []
        self.skipped = 0
        self.kept = 0

        for npy_path in sorted(self.root_dir.rglob("*.npy")):
            lab = extract_label_from_path(npy_path)
            if not lab:
                self.skipped += 1
                continue
            if lab not in self.label_map:
                self.skipped += 1
                continue

            # ✅ 미리 shape 확인해서 섞인 포맷은 제외
            try:
                x = np.load(npy_path)
                x2 = flatten_hand_only(x, npy_path.name)   # 여기서 NOT_HAND_ONLY면 제외
                if x2.ndim != 2 or x2.shape[1] != 126:
                    self.skipped += 1
                    continue
                # T 정규화도 가능해야 함
                _ = normalize_T(x2, self.target_T)
            except Exception:
                self.skipped += 1
                continue

            self.items.append((npy_path, self.label_map[lab]))
            self.kept += 1

    def __len__(self):
        return len(self.items)

    def __getitem__(self, idx):
        npy_path, y = self.items[idx]
        x = np.load(npy_path)
        x = flatten_hand_only(x, npy_path.name)
        x = normalize_T(x, self.target_T)

        # ✅ 학습/추론 통일 스케일
        x = x.astype(np.float32) / 1000.0

        return torch.from_numpy(x), torch.tensor(y, dtype=torch.long)


def build_label_map_from_train(train_dir: Path) -> dict:
    files = list(Path(train_dir).rglob("*.npy"))
    labels = []
    for f in files:
        lab = extract_label_from_path(f)
        if lab:
            labels.append(lab)
    labels = sorted(set(labels))
    return {lab: i for i, lab in enumerate(labels)}


def build_sampler(dataset: NpySeqDataset):
    # 라벨별 count
    counts = {}
    for _, y in dataset.items:
        counts[y] = counts.get(y, 0) + 1
    weights = [1.0 / counts[y] for _, y in dataset.items]
    return WeightedRandomSampler(torch.DoubleTensor(weights), num_samples=len(weights), replacement=True)


# =========================
# main
# =========================
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--train_dir", required=True)
    ap.add_argument("--val_dir", required=True)
    ap.add_argument("--out_dir", default="current")
    ap.add_argument("--epochs", type=int, default=30)
    ap.add_argument("--batch_size", type=int, default=64)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--target_T", type=int, default=30, help="시퀀스 길이 고정 (기본 30)")
    args = ap.parse_args()

    seed_everything(args.seed)

    train_dir = Path(args.train_dir)
    val_dir = Path(args.val_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    label_map = build_label_map_from_train(train_dir)
    if not label_map:
        raise RuntimeError("train_dir에서 WORD00001 라벨을 못 찾음. 파일명에 WORDxxxxx가 있는지 확인!")

    (out_dir / "label_map.json").write_text(
        json.dumps(label_map, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    train_ds = NpySeqDataset(train_dir, label_map, target_T=args.target_T)
    val_ds = NpySeqDataset(val_dir, label_map, target_T=args.target_T)

    if len(train_ds) == 0:
        raise RuntimeError("train 데이터가 0개임. npy가 있고 손-only로 변환 가능한지 확인!")

    sample_x, _ = train_ds[0]
    T, feat_dim = sample_x.shape
    num_classes = len(label_map)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("[INFO] device:", device)
    print("[INFO] train:", len(train_ds), "val:", len(val_ds), "num_classes:", num_classes)
    print("[INFO] sample shape:", (T, feat_dim))
    print("[INFO] train kept/skipped:", train_ds.kept, "/", train_ds.skipped)
    print("[INFO] val kept/skipped:", val_ds.kept, "/", val_ds.skipped)

    model = TCNClassifier(feat_dim, num_classes).to(device)
    optim = torch.optim.Adam(model.parameters(), lr=args.lr)
    crit = nn.CrossEntropyLoss()

    sampler = build_sampler(train_ds)
    train_loader = DataLoader(train_ds, batch_size=args.batch_size, sampler=sampler, drop_last=False)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False, drop_last=False)

    best_acc1 = 0.0

    for epoch in range(1, args.epochs + 1):
        # ---- train ----
        model.train()
        tr_loss = tr_acc1 = tr_acc5 = 0.0
        n_tr = 0

        for x, y in train_loader:
            x, y = x.to(device), y.to(device)

            optim.zero_grad()
            logits = model(x)
            loss = crit(logits, y)
            loss.backward()
            optim.step()

            bs = y.size(0)
            tr_loss += loss.item() * bs
            tr_acc1 += topk_acc(logits, y, k=1) * bs
            tr_acc5 += topk_acc(logits, y, k=min(5, num_classes)) * bs
            n_tr += bs

        tr_loss /= max(1, n_tr)
        tr_acc1 /= max(1, n_tr)
        tr_acc5 /= max(1, n_tr)

        # ---- val ----
        model.eval()
        va_loss = va_acc1 = va_acc5 = 0.0
        n_va = 0

        with torch.no_grad():
            for x, y in val_loader:
                x, y = x.to(device), y.to(device)
                logits = model(x)
                loss = crit(logits, y)

                bs = y.size(0)
                va_loss += loss.item() * bs
                va_acc1 += topk_acc(logits, y, k=1) * bs
                va_acc5 += topk_acc(logits, y, k=min(5, num_classes)) * bs
                n_va += bs

        va_loss /= max(1, n_va)
        va_acc1 /= max(1, n_va)
        va_acc5 /= max(1, n_va)

        print(
            f"[{epoch:03d}] "
            f"train loss={tr_loss:.4f} acc1={tr_acc1:.3f} acc5={tr_acc5:.3f} | "
            f"val loss={va_loss:.4f} acc1={va_acc1:.3f} acc5={va_acc5:.3f}"
        )

        torch.save(model.state_dict(), out_dir / "model.pth")

        if va_acc1 > best_acc1:
            best_acc1 = va_acc1
            torch.save(model.state_dict(), out_dir / "best_model_top1.pth")
            print(f"  -> best_model_top1.pth saved! (acc1={best_acc1:.3f})")

    print("[DONE] best_acc1 =", best_acc1)


if __name__ == "__main__":
    main()
