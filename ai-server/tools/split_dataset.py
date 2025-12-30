import argparse
import os
import random
import re
from pathlib import Path


def ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)


def ok(label_name: str, include_prefix: str | None) -> bool:
    if not include_prefix:
        return True
    prefixes = [x.strip() for x in include_prefix.split(",") if x.strip()]
    if not prefixes:
        return True
    return any(label_name.startswith(p) for p in prefixes)


def hardlink_or_copy(src: Path, dst: Path):
    """
    Windows에서 하드링크 우선.
    실패하면 최후에 copy로 fallback.
    """
    ensure_dir(dst.parent)
    if dst.exists():
        return
    try:
        os.link(src, dst)  # hard link
    except Exception:
        # fallback: copy (최후)
        import shutil
        shutil.copy2(src, dst)


def find_pairs(label_dir: Path):
    """
    확정 규칙:
      ..._X.hand.npy  <->  ..._X_face.npy
    (X는 D/F/L/R/U 같은 카메라 방향 코드)
    """
    hands = sorted(label_dir.glob("*.hand.npy"))
    pairs = []

    for h in hands:
        face_name = h.name.replace(".hand.npy", "_face.npy")
        f = h.with_name(face_name)
        if f.exists():
            pairs.append((h, f))

    return pairs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in_dir", required=True)
    ap.add_argument("--out_dir", required=True)
    ap.add_argument("--val_ratio", type=float, default=0.2)
    ap.add_argument("--include_prefix", default=None)  # "WORD" or "SEN" or "WORD,SEN"
    ap.add_argument("--max_n", type=int, default=None)  # 라벨 폴더 개수 제한 (정렬 후 앞에서부터)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    in_dir = Path(args.in_dir)
    out_dir = Path(args.out_dir)

    if not in_dir.exists():
        raise FileNotFoundError(f"in_dir not found: {in_dir}")

    random.seed(args.seed)

    # 라벨 폴더 선택
    label_dirs = [p for p in sorted(in_dir.iterdir()) if p.is_dir() and ok(p.name, args.include_prefix)]
    if args.max_n is not None:
        label_dirs = label_dirs[: args.max_n]

    if not label_dirs:
        print("[WARN] labels=0 (include_prefix/폴더 구조 확인 필요)")
        return

    train_root = out_dir / "train"
    val_root = out_dir / "val"
    ensure_dir(train_root)
    ensure_dir(val_root)

    total_labels = 0
    total_train_pairs = 0
    total_val_pairs = 0

    for label_dir in label_dirs:
        label = label_dir.name
        pairs = find_pairs(label_dir)
        if not pairs:
            print(f"[SKIP] {label}: no hand/face pairs")
            continue

        random.shuffle(pairs)

        n = len(pairs)
        n_val = int(round(n * args.val_ratio))

        val_pairs = pairs[:n_val]
        train_pairs = pairs[n_val:]

        # 라벨 폴더 만들기
        tr_label_dir = train_root / label
        va_label_dir = val_root / label
        ensure_dir(tr_label_dir)
        ensure_dir(va_label_dir)

        # 하드링크로 파일 생성 (복사 X)
        for h, f in train_pairs:
            hardlink_or_copy(h, tr_label_dir / h.name)
            hardlink_or_copy(f, tr_label_dir / f.name)

        for h, f in val_pairs:
            hardlink_or_copy(h, va_label_dir / h.name)
            hardlink_or_copy(f, va_label_dir / f.name)

        total_labels += 1
        total_train_pairs += len(train_pairs)
        total_val_pairs += len(val_pairs)

        print(f"[OK] {label}: pairs={n} train={len(train_pairs)} val={len(val_pairs)}")

    print(f"\nDONE labels={total_labels} train_pairs={total_train_pairs} val_pairs={total_val_pairs}")
    print(f"train_dir: {train_root}")
    print(f"val_dir:   {val_root}")


if __name__ == "__main__":
    main()
