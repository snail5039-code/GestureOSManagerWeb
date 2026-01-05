# ai-server/predict.py
# -*- coding: utf-8 -*-

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn


# =========================
# 모델 (TCN)
# =========================
class TCNBlock(nn.Module):
    def __init__(self, in_ch: int, out_ch: int, k: int = 3, dilation: int = 1, dropout: float = 0.1):
        super().__init__()
        pad = (k - 1) * dilation
        self.conv1 = nn.Conv1d(in_ch, out_ch, kernel_size=k, dilation=dilation, padding=pad)
        self.relu1 = nn.ReLU()
        self.drop1 = nn.Dropout(dropout)
        self.conv2 = nn.Conv1d(out_ch, out_ch, kernel_size=k, dilation=dilation, padding=pad)
        self.relu2 = nn.ReLU()
        self.drop2 = nn.Dropout(dropout)

        self.down = nn.Conv1d(in_ch, out_ch, kernel_size=1) if in_ch != out_ch else None

    def forward(self, x: torch.Tensor) -> torch.Tensor:
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
    def __init__(self, feat_dim: int, num_classes: int, channels: List[int] = [128, 128, 128], dropout: float = 0.1):
        super().__init__()
        layers: List[nn.Module] = []
        in_ch = feat_dim
        for i, ch in enumerate(channels):
            layers.append(TCNBlock(in_ch, ch, k=3, dilation=2**i, dropout=dropout))
            in_ch = ch
        self.tcn = nn.Sequential(*layers)
        self.pool = nn.AdaptiveAvgPool1d(1)
        self.fc = nn.Linear(in_ch, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x.transpose(1, 2)  # (B,T,F)->(B,F,T)
        y = self.tcn(x)
        y = self.pool(y).squeeze(-1)
        return self.fc(y)


# =========================
# 손-only 전처리
# =========================
HAND_N = 21
FEAT_DIM = 2 * HAND_N * 3  # 126


def points_to_nx3(points: Any, n_expected: int) -> np.ndarray:
    out = np.zeros((n_expected, 3), dtype=np.float32)
    if not isinstance(points, list):
        return out
    m = min(len(points), n_expected)
    for i in range(m):
        p = points[i]
        if not isinstance(p, dict):
            continue
        out[i, 0] = float(p.get("x", 0.0) or 0.0)
        out[i, 1] = float(p.get("y", 0.0) or 0.0)
        out[i, 2] = float(p.get("z", 0.0) or 0.0)
    return out


def make_input(frames: List[Dict[str, Any]], *, T: int, mirrored: bool = False) -> Optional[np.ndarray]:
    if not frames or len(frames) < T:
        return None

    frames = frames[-T:]
    seq: List[np.ndarray] = []
    zero_frames = 0

    for f in frames:
        hands = f.get("hands", None)
        hand_list = hands if isinstance(hands, list) else []

        hR = np.zeros((HAND_N, 3), dtype=np.float32)
        hL = np.zeros((HAND_N, 3), dtype=np.float32)

        if len(hand_list) >= 1:
            hR = points_to_nx3(hand_list[0], HAND_N)
            if len(hand_list) >= 2:
                hL = points_to_nx3(hand_list[1], HAND_N)

        if mirrored:
            hR, hL = hL, hR

        hands_nonzero = bool(
            np.any(hR[:, 0] != 0) or np.any(hR[:, 1] != 0) or
            np.any(hL[:, 0] != 0) or np.any(hL[:, 1] != 0)
        )
        if not hands_nonzero:
            zero_frames += 1

        vec = np.concatenate([hR.reshape(-1), hL.reshape(-1)], axis=0)  # (126,)
        seq.append(vec)

    if zero_frames > int(T * 0.6):
        return None

    x = np.stack(seq, axis=0).astype(np.float32)  # (T,126)
    x = x / 1000.0  # ✅ 학습과 동일
    return x


class Predictor:
    def __init__(
        self,
        *,
        model_path: Path,
        label_map_path: Path,
        label_to_text_path: Optional[Path],
        T: int = 30,
        threshold: float = 0.6,
        mirrored: bool = False,
        device: Optional[str] = None,
    ):
        self.T = T
        self.threshold = threshold
        self.mirrored = mirrored

        self.device = torch.device(device) if device else torch.device("cuda" if torch.cuda.is_available() else "cpu")

        label_map = json.loads(label_map_path.read_text(encoding="utf-8"))
        self.idx_to_label: List[str] = [None] * len(label_map)
        for k, v in label_map.items():
            self.idx_to_label[int(v)] = k
        self.num_classes = len(self.idx_to_label)

        self.label_to_text = {}
        if label_to_text_path and label_to_text_path.exists():
            self.label_to_text = json.loads(label_to_text_path.read_text(encoding="utf-8"))

        self.model = TCNClassifier(FEAT_DIM, self.num_classes).to(self.device)
        state = torch.load(model_path, map_location="cpu")
        if isinstance(state, dict) and "state_dict" in state:
            state = state["state_dict"]
        self.model.load_state_dict(state, strict=True)
        self.model.eval()

    def predict(self, frames: List[Dict[str, Any]], topk: int = 5) -> Dict[str, Any]:
        x = make_input(frames, T=self.T, mirrored=self.mirrored)
        if x is None:
            return {
                "label": "",
                "text": "",
                "confidence": 0.0,
                "mode": "error",
                "streak": 0,
                "candidates": [],
            }

        xt = torch.from_numpy(x).unsqueeze(0).to(self.device)  # (1,T,126)
        with torch.no_grad():
            logits = self.model(xt)
            prob = torch.softmax(logits, dim=-1)[0]

        topk = max(1, min(int(topk), prob.shape[0]))
        vals, idxs = torch.topk(prob, k=topk)
        vals = vals.detach().cpu().numpy().tolist()
        idxs = idxs.detach().cpu().numpy().tolist()

        # ✅ Top-5 후보 항상 내려주기
        candidates = [(self.idx_to_label[int(i)], float(v)) for i, v in zip(idxs, vals)]

        top1_idx = int(idxs[0])
        top1_prob = float(vals[0])

        label = self.idx_to_label[top1_idx]
        text = self.label_to_text.get(label, label)

        mode = "final" if top1_prob >= self.threshold else "pending"

        return {
            "label": label,
            "text": text,
            "confidence": top1_prob,
            "mode": mode,
            "streak": 1 if mode == "final" else 0,
            "candidates": candidates,
        }
