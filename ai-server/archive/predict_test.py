# predict_test.py
# ============================================================
# ✅ 이 파일은 "학습"이 아니라 "시험"만 봄
#
# - train.py로 학습한 모델(.pth)을 불러온다
# - dataset_top50_split/val 로 검증을 돌린다
# - 아래 5가지를 출력한다:
#   (1) VAL FULL: val 전체 top1/top5 정확도
#   (2) Threshold Report: 확률이 높은 샘플만 자동 확정했을 때의 성능
#   (3) Streak Rule: 연속 예측 규칙으로 자동 확정했을 때의 성능(서비스용 아이디어)
#   (4) Random Samples: 랜덤 10개 top5 후보 출력(사람이 눈으로 확인)
#   (5) Label Stats: 라벨별 성적표 + 헷갈리는 라벨쌍
# ============================================================

import argparse
import json
import random
from pathlib import Path
from collections import Counter

import torch
from torch.utils.data import DataLoader

# ✅ train.py에 있는 Dataset/Model 클래스를 그대로 재사용
# - NpyDataset: (T,F) 텐서 + 라벨을 꺼내줌
# - TCNClassifier: (B,T,F) -> (B,C) 분류 모델
from train import NpyDataset, TCNClassifier


# ------------------------------------------------------------
# (A) label_map.json 로드
# ------------------------------------------------------------
def load_label_maps(label_map_path: Path):
    """
    label_map.json은 train.py에서 저장된 파일.
    내부 형태는 보통: {"0":"WORD0001", "1":"WORD0002", ...}
    근데 JSON은 key가 문자열(string)이라,
    우리가 쓰기 좋게 key를 int로 바꿔준다.

    반환:
    - label_to_idx: {"WORD0001":0, ...}  (Dataset에서 폴더->정수 라벨로 쓰기 편함)
    - idx_to_label: {0:"WORD0001", ...}  (출력할 때 정수->라벨로 쓰기 편함)
    """
    idx_to_label = json.load(open(label_map_path, "r", encoding="utf-8"))
    idx_to_label = {int(k): v for k, v in idx_to_label.items()}
    label_to_idx = {v: k for k, v in idx_to_label.items()}
    return label_to_idx, idx_to_label


# ------------------------------------------------------------
# (B) val 전체 정확도 계산
# ------------------------------------------------------------
@torch.no_grad()  # ✅ 평가에서는 gradient 필요없으니 꺼버림(빠르고 메모리 절약)
def eval_full_val(model, loader, device, topk=5):
    """
    val 전체를 돌면서 정확도 계산.
    - acc1: top1 정답률
    - acck: topk 안에 정답 포함률

    + 추가로 "라벨별 성적표"도 만든다.
    - per_label_total: 라벨별 val 샘플 개수
    - per_label_correct: 라벨별 맞춘 개수
    - confusions: (GT라벨, Pred1라벨) 조합이 몇 번 틀렸는지
      예) WORD0007 -> WORD0046 : 9회
    """
    model.eval()

    total = 0
    correct1 = 0
    correctk = 0

    per_label_total = Counter()
    per_label_correct = Counter()
    confusions = Counter()

    # loader가 val 데이터를 배치로 줌
    for x, y in loader:
        # x: (B, T, F) / y: (B,)
        x = x.to(device)
        y = y.to(device)

        logits = model(x)  # (B, C)  C=클래스 수(여기선 50)
        probs = torch.softmax(logits, dim=1)  # 확률로 변환

        pred1 = probs.argmax(dim=1)  # (B,) top1 예측

        # topk: (B,k)
        k = min(topk, probs.size(1))  # 클래스 수보다 k가 크면 안됨
        topk_idx = probs.topk(k, dim=1).indices

        # top1 정답 여부
        correct1_batch = (pred1 == y)
        correct1 += correct1_batch.sum().item()

        # topk 안에 정답이 들어있는지
        correctk_batch = (topk_idx == y.unsqueeze(1)).any(dim=1)
        correctk += correctk_batch.sum().item()

        # 라벨별 성적표/혼동표 업데이트
        for gt, p1, ok in zip(y.tolist(), pred1.tolist(), correct1_batch.tolist()):
            per_label_total[int(gt)] += 1
            if ok:
                per_label_correct[int(gt)] += 1
            else:
                confusions[(int(gt), int(p1))] += 1

        total += y.size(0)

    acc1 = correct1 / max(1, total)
    acck = correctk / max(1, total)
    return acc1, acck, per_label_total, per_label_correct, confusions


# ------------------------------------------------------------
# (C) 랜덤 샘플 몇 개를 "사람이 눈으로" 보기
# ------------------------------------------------------------
def print_random_samples(model, ds, idx_to_label, device, n=10, topk=5, seed=42):
    """
    val에서 랜덤으로 n개 뽑아서,
    GT(정답 라벨)과 top-k 후보를 출력한다.

    목적:
    - 숫자(accuracy)만 보면 감이 잘 안 오니까
    - 실제로 뭘 헷갈리는지 눈으로 확인하는 용도
    """
    random.seed(seed)

    n = min(n, len(ds))
    idxs = random.sample(range(len(ds)), n)

    model.eval()
    for i in idxs:
        x, y = ds[i]  # x:(T,F), y:정수라벨
        x = x.unsqueeze(0).to(device)  # (1,T,F)로 배치 차원 추가
        gt_label = idx_to_label[int(y)]

        with torch.no_grad():
            logits = model(x)[0]  # (C,)
            probs = torch.softmax(logits, dim=0)

            k = min(topk, probs.numel())
            top = torch.topk(probs, k=k)

        print(f"\n[{i}] GT: {gt_label}")
        for rank, (p, idx) in enumerate(zip(top.values.tolist(), top.indices.tolist()), start=1):
            print(f"  top{rank}: {idx_to_label[int(idx)]}  prob={p:.3f}")


# ------------------------------------------------------------
# (D) Threshold Report
# ------------------------------------------------------------
@torch.no_grad()
def eval_with_threshold(model, loader, device, thresholds=(0.3, 0.4, 0.5, 0.6, 0.7), topk=5):
    """
    ✅ 서비스용 아이디어 1: "확신할 때만 자동 확정"

    - 모델이 top1 확률(max_prob)이 threshold 이상이면
      -> '확정'(auto-decide)했다고 가정
    - threshold별로:
      coverage  = 확정된 비율 (얼마나 자주 자동으로 말해줄 수 있냐)
      precision = 확정한 것만 봤을 때 정확도(신뢰도)
    """
    model.eval()

    stats = {
        th: {"decided": 0, "correct_decided": 0, "total": 0, "topk_correct": 0}
        for th in thresholds
    }

    for x, y in loader:
        x = x.to(device)
        y = y.to(device)

        logits = model(x)                # (B, C)
        probs = torch.softmax(logits, 1) # (B, C)

        max_prob, pred1 = probs.max(dim=1)  # top1 확률과 top1 클래스
        k = min(topk, probs.size(1))
        topk_idx = probs.topk(k, dim=1).indices
        topk_ok = (topk_idx == y.unsqueeze(1)).any(dim=1)

        for th in thresholds:
            st = stats[th]
            st["total"] += y.size(0)
            st["topk_correct"] += topk_ok.sum().item()

            # ✅ threshold 이상이면 확정
            decided_mask = (max_prob >= th)
            st["decided"] += decided_mask.sum().item()

            # 확정한 것들 중 맞춘 개수
            if decided_mask.any():
                st["correct_decided"] += (pred1[decided_mask] == y[decided_mask]).sum().item()

    print("\n[Threshold Report] (auto-decide when top1_prob >= threshold)")
    for th in thresholds:
        st = stats[th]
        decided = st["decided"]
        total = st["total"]

        coverage = decided / max(1, total)
        precision = st["correct_decided"] / max(1, decided)
        topk_acc = st["topk_correct"] / max(1, total)

        print(f"  th={th:.2f} | coverage={coverage:.3f} | precision={precision:.3f} | val_top{topk}_acc={topk_acc:.3f}")


# ------------------------------------------------------------
# (E) Streak Rule (연속 확정)
# ------------------------------------------------------------
@torch.no_grad()
def eval_streak_rule(model, loader, device, base_th=0.5, streak=2):
    """
    ✅ 서비스용 아이디어 2: "연속으로 같은 예측이 나오면 확정"

    - base_th 미만이면 "확신 없음"으로 보고 연속 카운트 끊음
    - top1이 streak번 연속으로 같으면 "확정"했다고 가정
    결과:
      coverage  = 확정된 비율
      precision = 확정한 것만의 정확도

    참고:
    - 이 코드는 val 샘플 순서를 '연속'이라고 가정한 간단 시뮬레이션.
    - 진짜 실시간에서는 "시간 순서(프레임/클립 순서)"로 streak를 적용하면 더 의미가 큼.
    """
    model.eval()

    decided = 0
    correct_decided = 0
    total = 0

    last_pred = None
    streak_cnt = 0

    for x, y in loader:
        x = x.to(device)
        y = y.to(device)

        probs = torch.softmax(model(x), dim=1)  # (B, C)
        max_prob, pred1 = probs.max(dim=1)      # (B,), (B,)

        # 배치 안의 샘플을 하나씩 처리 (연속 규칙 때문에)
        for p, pred, gt in zip(max_prob.tolist(), pred1.tolist(), y.tolist()):
            total += 1

            # 확신 부족하면 streak 끊기
            if p < base_th:
                last_pred = None
                streak_cnt = 0
                continue

            # 연속 체크
            if last_pred == pred:
                streak_cnt += 1
            else:
                last_pred = pred
                streak_cnt = 1

            # streak 번 연속이면 확정했다고 가정
            if streak_cnt >= streak:
                decided += 1
                if pred == gt:
                    correct_decided += 1

                # 확정 후 초기화(다음 확정을 위해)
                last_pred = None
                streak_cnt = 0

    coverage = decided / max(1, total)
    precision = correct_decided / max(1, decided)

    print(f"\n[Streak Rule] base_th={base_th:.2f}, streak={streak}")
    print(f"  coverage={coverage:.3f} | precision={precision:.3f} | decided={decided}/{total}")


# ------------------------------------------------------------
# (F) main: 전체 시험 실행
# ------------------------------------------------------------
def main():
    # ✅ 커맨드 옵션 받기
    # 예:
    # python predict_test.py --model_path best_model_face.pth --use_face 1
    ap = argparse.ArgumentParser()

    ap.add_argument("--data_dir", type=str, default=r".\dataset_top50_split", help="split 데이터 폴더")
    ap.add_argument("--model_path", type=str, default=r".\best_model.pth", help="불러올 모델 가중치")
    ap.add_argument("--label_map_path", type=str, default=r".\label_map.json", help="idx<->label 맵 json")

    # ✅ train 때와 동일한 설정이어야 함 (손+얼굴이면 use_face=1)
    ap.add_argument("--use_face", type=int, default=1, help="1=손+얼굴, 0=손만 (train할 때랑 동일해야 함)")

    # 평가 옵션
    ap.add_argument("--batch_size", type=int, default=128)
    ap.add_argument("--topk", type=int, default=5)
    ap.add_argument("--print_n", type=int, default=10)
    ap.add_argument("--seed", type=int, default=42)

    ap.add_argument("--show_label_stats", type=int, default=1, help="1=라벨별 정답률/혼동 출력")

    args = ap.parse_args()

    data_dir = Path(args.data_dir)
    model_path = Path(args.model_path)
    label_map_path = Path(args.label_map_path)
    use_face = bool(args.use_face)

    # ✅ GPU 있으면 GPU 사용
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("device:", device)

    # (1) 라벨 맵 로드
    label_to_idx, idx_to_label = load_label_maps(label_map_path)
    num_classes = len(label_to_idx)
    print("num_classes:", num_classes)
    print("use_face:", use_face)

    # (2) val dataset / loader 준비
    ds = NpyDataset(data_dir / "val", label_to_idx, use_face=use_face)
    loader = DataLoader(ds, batch_size=args.batch_size, shuffle=False)

    # (3) 입력 차원 확인 후 모델 생성
    # - ds[0]은 (T,F)라서 F를 보고 모델을 맞춘다
    x0, _ = ds[0]
    T, F = x0.shape
    print("sample shape:", (T, F))

    model = TCNClassifier(F, num_classes=num_classes).to(device)

    # (4) 모델 가중치 로드
    if not model_path.exists():
        raise FileNotFoundError(f"model not found: {model_path}")

    state = torch.load(model_path, map_location=device)
    model.load_state_dict(state)
    model.eval()

    # --------------------------------------------------------
    # 시험 1) VAL FULL 성능표
    # --------------------------------------------------------
    acc1, acck, per_total, per_correct, confusions = eval_full_val(
        model, loader, device, topk=args.topk
    )
    print(f"\n[VAL FULL] acc1={acc1:.4f} | acc{args.topk}={acck:.4f}  (model={model_path.name})")

    # --------------------------------------------------------
    # 시험 2) 확신(확률) 기준 자동 확정 성능
    # --------------------------------------------------------
    eval_with_threshold(model, loader, device, thresholds=(0.3,0.4,0.5,0.6,0.7), topk=args.topk)

    # --------------------------------------------------------
    # 시험 3) 연속 규칙 성능(서비스 아이디어)
    # --------------------------------------------------------
    eval_streak_rule(model, loader, device, base_th=0.5, streak=2)
    eval_streak_rule(model, loader, device, base_th=0.5, streak=3)

    # --------------------------------------------------------
    # 시험 4) 랜덤 샘플 top-k 출력
    # --------------------------------------------------------
    print("\n[Random Samples]")
    print_random_samples(
        model, ds, idx_to_label, device,
        n=args.print_n, topk=args.topk, seed=args.seed
    )

    # --------------------------------------------------------
    # 시험 5) 라벨별 성적표 + 헷갈리는 라벨쌍
    # --------------------------------------------------------
    if args.show_label_stats:
        print("\n[Label Accuracy: Worst 10]")
        label_acc = []
        for k in per_total.keys():
            total = per_total[k]
            corr = per_correct[k]
            acc = corr / max(1, total)
            label_acc.append((acc, total, k))

        # 낮은 순(못하는 라벨)
        label_acc.sort(key=lambda x: x[0])
        for acc, total, k in label_acc[:10]:
            print(f"  {idx_to_label[k]}  acc={acc:.3f}  (n={total})")

        print("\n[Label Accuracy: Best 10]")
        # 높은 순(잘하는 라벨)
        label_acc.sort(key=lambda x: x[0], reverse=True)
        for acc, total, k in label_acc[:10]:
            print(f"  {idx_to_label[k]}  acc={acc:.3f}  (n={total})")

        print("\n[Top Confusions: 많이 틀리는 (GT -> Pred1) 상위 10]")
        for (gt, pred), cnt in confusions.most_common(10):
            print(f"  {idx_to_label[gt]} -> {idx_to_label[pred]} : {cnt}회")


if __name__ == "__main__":
    main()
