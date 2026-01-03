# train.py
# ============================================================
# 목적:
# - dataset_split/train, dataset_split/val 안의 .npy(손/얼굴 좌표)를 읽어서
# - 라벨(WORDxxxx 등)을 맞추는 분류 모델을 학습한다.
# - 결과로:
#    1) model.pth         : 마지막 epoch 모델 가중치
#    2) best_model.pth    : val_acc1(Top-1) 기준 가장 좋았던 모델 가중치 (핵심!)
#    3) label_map.json    : idx -> label 매핑 저장
#
# ✅ 이번 버전에서 추가된 핵심 3개 (도르마무 끊기)
# 1) --use_face 0/1 : 손만 / 손+얼굴 스위치 (얼굴이 도움이냐 방해냐 바로 판단)
# 2) WeightedRandomSampler : 라벨 불균형(특정 라벨만 많이 나옴) 방지
# 3) best_model 저장 : 중간에 성능 좋았다가 마지막에 떨어져도 "좋은 모델" 보존
# ============================================================

import argparse
import json
import random
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler


# ------------------------------------------------------------
# 0) 재현성(같은 조건이면 결과 비슷하게)
# ------------------------------------------------------------
def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    # GPU도 쓰면 GPU 시드도 맞춰줌
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


# ------------------------------------------------------------
# 1) Dataset 클래스: 폴더에서 npy를 읽어오는 역할
# ------------------------------------------------------------
class NpyDataset(Dataset):
    """
    root_dir 구조 예시 (너가 만든 구조):
      dataset_top50_split/
        train/
          WORD0001/
            NIA_...D.hand.npy
            NIA_...D_face.npy
          WORD0002/
            ...
        val/
          WORD0001/
          WORD0002/
          ...

    파일명 규칙(너가 맞춘 규칙):
      xxx.hand.npy  <->  xxx_face.npy
    """

    def __init__(self, root_dir, label_to_idx, use_face: bool = True):
        # root_dir가 str로 들어와도 Path로 변환 (Path / 연산 위해)
        root_dir = Path(root_dir)

        # label_to_idx가 json 경로로 들어오든 dict로 들어오든 안전하게 처리
        if isinstance(label_to_idx, (str, Path)):
            label_to_idx = json.load(open(label_to_idx, "r", encoding="utf-8"))

        self.use_face = use_face
        self.samples = []  # (hand_npy_path, label_idx) 목록

        # label_to_idx에 있는 라벨 폴더들을 순회하면서 *.hand.npy를 모은다
        # -> face는 __getitem__에서 hand 파일명 기반으로 찾아서 붙임
        for label_name, label_idx in label_to_idx.items():
            label_folder = root_dir / label_name
            if not label_folder.exists():
                continue

            # ✅ 손 파일만 먼저 모음
            for npy_path in sorted(label_folder.glob("*.hand.npy")):
                self.samples.append((npy_path, int(label_idx)))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, i):
        hand_path, y = self.samples[i]

        # ------------------------------------------------------------
        # (A) 손 데이터 로드
        # - 손 파일 shape 예시: (T, 2, 21, 3)
        #   T=30프레임
        #   2 = 양손(또는 손 구분)
        #   21 = 손 랜드마크 개수
        #   3 = x,y,z
        # ------------------------------------------------------------
        hand = np.load(hand_path).astype(np.float32)
        T = hand.shape[0]             # 프레임 수
        hand = hand.reshape(T, -1)    # (T, 2, 21, 3) -> (T, 126)

        # 기본 입력은 "손" (얼굴을 쓸지 말지는 아래 옵션에 따라)
        x = hand.astype(np.float32)

        # ------------------------------------------------------------
        # (B) 얼굴 데이터 (선택)
        # - use_face=True 일 때만 얼굴을 읽어서 붙임
        # - 파일명 규칙: xxx.hand.npy -> xxx_face.npy
        # ------------------------------------------------------------
        if self.use_face:
            face_path = hand_path.with_name(hand_path.name.replace(".hand.npy", "_face.npy"))

            if face_path.exists():
                face = np.load(face_path).astype(np.float32)

                # 얼굴 상대좌표(선택):
                # (T, P, 3)에서 x,y만 0번 점을 기준으로 빼서
                # 카메라 위치 흔들림 영향을 줄임
                if face.ndim == 3 and face.shape[-1] >= 2:
                    anchor = face[:, 0:1, :2]      # (T,1,2)
                    face[:, :, :2] -= anchor       # x,y에 대해 기준점 상대좌표화

                # (T, 478, 3) -> (T, 1434)
                face = face.reshape(T, -1)

                # 최종 입력: (T, 126 + 1434) = (T, 1560)
                x = np.concatenate([hand, face], axis=1).astype(np.float32)
            else:
                # 얼굴 파일이 없으면 손만 사용 (데이터가 완벽히 안 맞아도 학습은 진행되게)
                x = hand.astype(np.float32)

        # ------------------------------------------------------------
        # (C) torch 텐서로 변환 + 스케일링
        # x: (T, F)  ← TCN이 원하는 형태!
        # ------------------------------------------------------------
        x = torch.from_numpy(x).float()

        # ✅ 값 범위가 너무 크면 학습이 불안정해질 수 있어서 스케일링
        x = x / 1000.0

        y = torch.tensor(y, dtype=torch.long)
        return x, y


# ------------------------------------------------------------
# 2) 모델: TCN(시간 축을 보는 Conv1D)
# ------------------------------------------------------------
class TCNClassifier(nn.Module):
    """
    입력 x 모양: (B, T, F)
      - B: 배치
      - T: 프레임(30)
      - F: 특징(손만이면 126 / 손+얼굴이면 1560)

    Conv1d는 (B, C, L)을 원함:
      - C=특징(F)
      - L=시간(T)
    그래서 (B,T,F) -> (B,F,T)로 바꿔서 처리
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
            nn.Linear(128, num_classes)
        )

    def forward(self, x):
        # x: (B, T, F) -> (B, F, T)
        x = x.transpose(1, 2)

        # h: (B, 128, T)
        h = self.backbone(x)

        # 시간축 평균으로 (B, 128)
        h = h.mean(dim=2)

        # (B, num_classes)
        return self.head(h)


# ------------------------------------------------------------
# 3) 폴더에서 라벨 목록 만들기
# ------------------------------------------------------------
def build_label_map(train_dir: Path):
    # train 폴더 안의 "서브폴더 이름(라벨)"을 라벨 목록으로 사용
    labels = sorted([p.name for p in train_dir.iterdir() if p.is_dir()])
    label_to_idx = {name: i for i, name in enumerate(labels)}
    idx_to_label = {i: name for name, i in label_to_idx.items()}
    return label_to_idx, idx_to_label


# ------------------------------------------------------------
# 4) 정확도 계산 (top1 / top5)
# ------------------------------------------------------------
@torch.no_grad()
def evaluate(model, loader, device):
    model.eval()

    total = 0
    correct1 = 0
    correct5 = 0

    for x, y in loader:
        x = x.to(device)  # (B, T, F)
        y = y.to(device)  # (B,)

        logits = model(x)  # (B, num_classes)

        # Top-1
        pred1 = logits.argmax(dim=1)
        correct1 += (pred1 == y).sum().item()

        # Top-5
        k = min(5, logits.size(1))
        topk_idx = logits.topk(k, dim=1).indices  # (B, k)
        correct5 += (topk_idx == y.unsqueeze(1)).any(dim=1).sum().item()

        total += y.size(0)

    acc1 = correct1 / max(1, total)
    acc5 = correct5 / max(1, total)
    return acc1, acc5


def main():
    ap = argparse.ArgumentParser()

    # 데이터 / 학습 기본 옵션
    ap.add_argument("--data_dir", default="dataset_split", help="dataset_split 폴더 경로")
    ap.add_argument("--epochs", type=int, default=30)
    ap.add_argument("--batch_size", type=int, default=64)
    ap.add_argument("--lr", type=float, default=1e-3)

    # ✅ 핵심: 손만/손+얼굴 토글 (0이면 손만, 1이면 손+얼굴)
    ap.add_argument("--use_face", type=int, default=1, help="1=손+얼굴, 0=손만")

    # ✅ 핵심: best 모델 저장할지 여부
    ap.add_argument("--save_best", type=int, default=1, help="1=best_model 저장, 0=저장 안함")

    # 학습 안정화용(선택): gradient clipping
    ap.add_argument("--grad_clip", type=float, default=1.0, help="0이면 미사용, >0이면 grad clip 적용")

    # 재현성 / DataLoader 옵션
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--num_workers", type=int, default=0)  # 윈도우에서 꼬이면 0이 안전
    ap.add_argument("--pretrained", type=str, default="", help="pretrained .pth (warm start, classifier auto-skip)")

    args = ap.parse_args()

    # int -> bool로 변환 (사용하기 편하게)
    args.use_face = bool(args.use_face)
    args.save_best = bool(args.save_best)

    # 재현성 시드 고정
    set_seed(args.seed)

    data_dir = Path(args.data_dir)
    train_dir = data_dir / "train"
    val_dir = data_dir / "val"

    if not train_dir.exists():
        raise RuntimeError(f"train 폴더 없음: {train_dir}")
    if not val_dir.exists():
        raise RuntimeError(f"val 폴더 없음: {val_dir}")

    # ------------------------------------------------------------
    # (1) 라벨 맵 만들기 (train 폴더 안의 라벨 폴더명 기준)
    # ------------------------------------------------------------
    label_to_idx, idx_to_label = build_label_map(train_dir)

    if len(label_to_idx) < 2:
        raise RuntimeError("라벨 폴더가 2개 이상 있어야 분류 학습이 됨")

    print("labels:", label_to_idx)
    print(f"use_face={args.use_face}  (True면 손+얼굴 / False면 손만)")

    # ------------------------------------------------------------
    # (2) Dataset 생성
    # ------------------------------------------------------------
    train_ds = NpyDataset(train_dir, label_to_idx, use_face=args.use_face)
    val_ds = NpyDataset(val_dir, label_to_idx, use_face=args.use_face)

    print("train samples:", len(train_ds))
    print("val samples:  ", len(val_ds))

    # ------------------------------------------------------------
    # (3) device 설정
    # ------------------------------------------------------------
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("device:", device)

    # ✅ 샘플 하나 꺼내서 (T,F) 확인
    x0, _ = train_ds[0]
    print("sample x0 shape:", tuple(x0.shape))  # 예: (30, 1560) 또는 (30, 126)

    # ------------------------------------------------------------
    # (4) 모델 생성
    # ------------------------------------------------------------
    feat_dim = int(x0.shape[1])
    model = TCNClassifier(feat_dim, num_classes=len(label_to_idx)).to(device)

    # --- model 생성 직후 ---
    if args.pretrained:
        print(f"[pretrained] loading: {args.pretrained}")
        ckpt = torch.load(args.pretrained, map_location="cpu")

        # 너는 torch.save(model.state_dict())로 저장하니까 ckpt 자체가 state_dict일 확률이 큼
        pretrained_sd = ckpt

        model_sd = model.state_dict()
        loaded, skipped = 0, 0

        # shape 맞는 키만 로드 (분류층은 클래스 수 달라서 shape 안 맞아 자동 스킵됨)
        filtered = {}
        for k, v in pretrained_sd.items():
            if k in model_sd and hasattr(v, "shape") and v.shape == model_sd[k].shape:
                filtered[k] = v
                loaded += 1
            else:
                skipped += 1

        model_sd.update(filtered)
        model.load_state_dict(model_sd)

        print(f"[pretrained] loaded keys: {loaded}, skipped(keys/shape mismatch): {skipped}")


    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)

    # ------------------------------------------------------------
    # (5) ✅ 라벨 균등 샘플링(WeightedRandomSampler)
    #     - 라벨마다 데이터 개수가 다르면
    #       "많은 라벨만 계속 맞추는" 현상이 생겨서 체감 성능이 박살남
    #     - sampler로 학습 배치가 라벨 균형 있게 나오게 함
    # ------------------------------------------------------------
    counts = np.zeros(len(label_to_idx), dtype=np.int64)
    for _, y in train_ds.samples:
        counts[y] += 1

    # 각 클래스의 가중치 = 1 / count
    class_weights = 1.0 / np.maximum(counts, 1)
    sample_weights = [class_weights[y] for _, y in train_ds.samples]

    sampler = WeightedRandomSampler(
        weights=torch.DoubleTensor(sample_weights),
        num_samples=len(sample_weights),
        replacement=True
    )

    train_loader = DataLoader(
        train_ds,
        batch_size=args.batch_size,
        sampler=sampler,            # ✅ shuffle 대신 sampler 사용
        num_workers=args.num_workers,
        pin_memory=torch.cuda.is_available(),
    )

    val_loader = DataLoader(
        val_ds,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.num_workers,
        pin_memory=torch.cuda.is_available(),
    )

    # ------------------------------------------------------------
    # (6) 학습 루프 + ✅ best 모델 저장
    # ------------------------------------------------------------
    best_acc1 = -1.0
    best_acc5 = -1.0

    best_path_top1 = Path("best_model_top1.pth")
    best_path_top5 = Path("best_model_top5.pth")

    for epoch in range(1, args.epochs + 1):
        model.train()

        total_loss = 0.0
        total = 0

        for x, y in train_loader:
            x = x.to(device)
            y = y.to(device)

            optimizer.zero_grad()
            logits = model(x)
            loss = criterion(logits, y)
            loss.backward()

            # (선택) 학습 흔들릴 때 grad clip이 안정에 도움될 수 있음
            if args.grad_clip and args.grad_clip > 0:
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=args.grad_clip)

            optimizer.step()

            total_loss += loss.item() * y.size(0)
            total += y.size(0)

        avg_loss = total_loss / max(1, total)

        # ✅ validation은 val_loader로 평가
        val_acc1, val_acc5 = evaluate(model, val_loader, device)

        print(
            f"epoch {epoch}/{args.epochs} | "
            f"loss={avg_loss:.4f} | "
            f"val_acc1={val_acc1:.4f} | val_acc5={val_acc5:.4f}"
        )

        # ✅ 핵심: best 모델 저장 (top1 / top5 각각 따로 저장)
        if args.save_best and val_acc1 > best_acc1:
            best_acc1 = val_acc1
            torch.save(model.state_dict(), best_path_top1)
            print(f"✅ saved best top1: {best_path_top1} (val_acc1={best_acc1:.4f})")

        if args.save_best and val_acc5 > best_acc5:
            best_acc5 = val_acc5
            torch.save(model.state_dict(), best_path_top5)
            print(f"✅ saved best top5: {best_path_top5} (val_acc5={best_acc5:.4f})")

    # ------------------------------------------------------------
    # (7) 저장: 마지막 모델 + 라벨 맵
    # ------------------------------------------------------------
    out_model = Path("model.pth")
    out_map = Path("label_map.json")

    torch.save(model.state_dict(), out_model)

    # label_map.json은 "idx -> label" 형태로 저장(너가 기존에 쓰던 방식 유지)
    out_map.write_text(json.dumps(idx_to_label, ensure_ascii=False, indent=2), encoding="utf-8")

    print("saved:", out_model)
    print("saved:", out_map)
    if args.save_best:
        print("saved:", best_path_top1)
        print("saved:", best_path_top5)


if __name__ == "__main__":
    main()
