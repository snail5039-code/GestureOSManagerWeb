# ai-server/main.py
# -*- coding: utf-8 -*-

import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import FastAPI
from pydantic import BaseModel

from predict import Predictor

T = int(os.getenv("T", "30"))
THRESHOLD = float(os.getenv("THRESHOLD", "0.60"))
TOPK = int(os.getenv("TOPK", "5"))
MIRRORED = bool(int(os.getenv("MIRRORED", "0")))

BASE_DIR = Path(__file__).resolve().parent
CURRENT_DIR = BASE_DIR / "current"

MODEL_PATH = Path(os.getenv("MODEL_PATH", str(CURRENT_DIR / "best_model_top1.pth")))
LABEL_MAP_PATH = Path(os.getenv("LABEL_MAP_PATH", str(CURRENT_DIR / "label_map.json")))
LABEL_TO_TEXT_PATH = Path(os.getenv("LABEL_TO_TEXT_PATH", str(CURRENT_DIR / "label_to_text.json")))

app = FastAPI()

predictor = Predictor(
    model_path=MODEL_PATH,
    label_map_path=LABEL_MAP_PATH,
    label_to_text_path=LABEL_TO_TEXT_PATH,
    T=T,
    threshold=THRESHOLD,
    mirrored=MIRRORED,
)


class PredictRequest(BaseModel):
    frames: List[Dict[str, Any]]
    topk: Optional[int] = None


class PredictResponse(BaseModel):
    label: str = ""
    text: str = ""
    confidence: float = 0.0
    mode: str = "pending"  # pending|final|error
    streak: int = 0
    candidates: List[Tuple[str, float]] = []


@app.get("/health")
def health():
    return {
        "ok": True,
        "t": T,
        "threshold": THRESHOLD,
        "topk": TOPK,
        "mirrored": MIRRORED,
        "model": str(MODEL_PATH),
        "num_classes": predictor.num_classes,
        "device": str(predictor.device),
    }


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    k = req.topk if req.topk is not None else TOPK
    out = predictor.predict(req.frames or [], topk=k)
    return PredictResponse(**out)
