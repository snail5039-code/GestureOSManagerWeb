import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Hands } from "@mediapipe/hands";

// =========================
// 설정
// =========================
const T = 30; // 프레임 길이
const SAVE_FPS_MS = 100; // 10fps 저장
const CDN = "https://cdn.jsdelivr.net/npm"; // mediapipe asset CDN

// =========================
// ZERO 텐서(패딩)
// =========================
const ZERO_PT = { x: 0, y: 0, z: 0 };
const ZERO_HAND21 = Array.from({ length: 21 }, () => ({ ...ZERO_PT }));

export default function Camera() {
  // =========================
  // Refs
  // =========================
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const handsRef = useRef(null);
  const latestHandsRef = useRef({ handsLm: [], handed: [] });

  const bufferRef = useRef([]);
  const saveTimerRef = useRef(null);

  // =========================
  // UI State
  // =========================
  const [recording, setRecording] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [handCount, setHandCount] = useState(0);
  const [frameCount, setFrameCount] = useState(0);

  const [resultText, setResultText] = useState("");
  const [resultLabel, setResultLabel] = useState("");
  const [sentence, setSentence] = useState("");
  const [error, setError] = useState("");

  const [previewMode, setPreviewMode] = useState("summary"); // summary | raw
  const [previewJson, setPreviewJson] = useState("");

  // ============================================================
  // ✅ 학습 파이프라인 맞춤 전처리(손만)
  // - x,y를 픽셀로 바꾸고
  // - z는 학습과 통일(0)
  // ============================================================
  const toPxHand = (p, W, H) => ({
    x: (p?.x ?? 0) * W,
    y: (p?.y ?? 0) * H,
    z: 0,
  });

  // ============================================================
  // ✅ Hands 정리 (2슬롯: Right=0, Left=1)
  // - 추론 서버(ai-server/main.py)가 이 순서를 전제로 입력을 만든다.
  // ============================================================
  const handsTo2Slots = useMemo(() => {
    return (handsLm, handed, W, H) => {
      const slots = [
        ZERO_HAND21.map((p) => ({ ...p })), // slot0 = Right
        ZERO_HAND21.map((p) => ({ ...p })), // slot1 = Left
      ];
      if (!Array.isArray(handsLm) || handsLm.length === 0) return slots;

      const labels = Array.isArray(handed)
        ? handed.map((h) => h?.label || h?.classification?.[0]?.label || "")
        : [];

      // 1) handedness 우선 배치
      for (let i = 0; i < Math.min(handsLm.length, 2); i++) {
        const lm = handsLm[i];
        if (!Array.isArray(lm) || lm.length !== 21) continue;
        const lab = labels[i];
        if (lab === "Right") slots[0] = lm.map((p) => toPxHand(p, W, H));
        else if (lab === "Left") slots[1] = lm.map((p) => toPxHand(p, W, H));
      }

      // 2) fallback: handedness 없으면 화면 x로 대충 배치
      const slot0Has = slots[0].some((p) => p.x || p.y);
      const slot1Has = slots[1].some((p) => p.x || p.y);
      if (slot0Has && slot1Has) return slots;

      const scored = handsLm
        .map((lm, i) => {
          if (!Array.isArray(lm) || lm.length !== 21) return null;
          const meanX = lm.reduce((sum, p) => sum + (p?.x ?? 0), 0) / 21; // 0~1
          return { i, meanX };
        })
        .filter(Boolean)
        .sort((a, b) => a.meanX - b.meanX);

      // 화면 왼쪽=Left(slot1), 오른쪽=Right(slot0)로 넣어보기
      const iLeft = scored[0]?.i;
      const iRight = scored[1]?.i;
      if (!slot0Has && iRight != null) slots[0] = handsLm[iRight].map((p) => toPxHand(p, W, H));
      if (!slot1Has && iLeft != null) slots[1] = handsLm[iLeft].map((p) => toPxHand(p, W, H));

      return slots;
    };
  }, []);

  // ============================================================
  // ✅ locateFile (mediapipe wasm/asset 로딩)
  // ============================================================
  const locateMP = (file) => `${CDN}/@mediapipe/hands/${file}`;

  // ============================================================
  // (1) 카메라 + mediapipe 초기화
  // ============================================================
  useEffect(() => {
    let alive = true;

    const startCamera = async () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });

      streamRef.current = stream;

      const v = videoRef.current;
      if (!v) return;

      v.srcObject = stream;
      v.muted = true;
      v.playsInline = true;
      v.autoplay = true;
      await v.play();
    };

    const initMediapipe = async () => {
      const hands = new Hands({ locateFile: locateMP });
      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      hands.onResults((res) => {
        const handsLm = res?.multiHandLandmarks ?? [];
        const handed = res?.multiHandedness ?? [];
        latestHandsRef.current = { handsLm, handed };
        setHandDetected(handsLm.length > 0);
        setHandCount(handsLm.length);
      });

      handsRef.current = hands;
    };

    const loop = async () => {
      if (!alive) return;
      const v = videoRef.current;
      if (v && v.readyState >= 2) {
        try {
          await handsRef.current?.send({ image: v });
        } catch {}
      }
      requestAnimationFrame(loop);
    };

    (async () => {
      try {
        await startCamera();
        await initMediapipe();
        loop();
      } catch (e) {
        setError("카메라/mediapipe 초기화 실패: " + (e?.message ?? e));
      }
    })();

    return () => {
      alive = false;
      try {
        handsRef.current?.close?.();
      } catch {}
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // ============================================================
  // (2) 저장 루프: recording일 때만 10fps로 프레임 저장
  // ============================================================
  useEffect(() => {
    if (!recording) {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
      saveTimerRef.current = null;
      return;
    }

    saveTimerRef.current = setInterval(() => {
      const v = videoRef.current;
      const W = v?.videoWidth || 1;
      const H = v?.videoHeight || 1;
      if (W <= 1 || H <= 1) return;

      const { handsLm, handed } = latestHandsRef.current ?? { handsLm: [], handed: [] };
      const hasHands = (handsLm?.length ?? 0) > 0;
      if (!hasHands) return;

      const handsFixed = handsTo2Slots(handsLm, handed, W, H);
      const handsSlots =
        (handsFixed?.[0]?.some((p) => p.x || p.y) ? 1 : 0) +
        (handsFixed?.[1]?.some((p) => p.x || p.y) ? 1 : 0);
      if (!handsSlots) return;

      // ✅ 손만 서버로 보낼 데이터
      // NOTE: ai-server는 USE_FACE=0으로 실행해야 함
      const frame = { t: Date.now(), hands: handsFixed, handsSlots };
      bufferRef.current.push(frame);
      setFrameCount(bufferRef.current.length);

      if (bufferRef.current.length % 5 === 0) {
        if (previewMode === "raw") {
          setPreviewJson(JSON.stringify(frame, null, 2));
        } else {
          setPreviewJson(
            JSON.stringify(
              {
                t: frame.t,
                handsSlots,
                hands0_sample_5: frame.hands?.[0]?.slice(0, 5) ?? [],
                hands1_sample_5: frame.hands?.[1]?.slice(0, 5) ?? [],
                hint: {
                  hands: "2x21",
                  z: "hand z=0",
                },
              },
              null,
              2
            )
          );
        }
      }
    }, SAVE_FPS_MS);

    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
      saveTimerRef.current = null;
    };
  }, [recording, previewMode, handsTo2Slots]);

  // ============================================================
  // (3) Start/Stop
  // ============================================================
  const onStart = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setError("");
    setResultText("");
    setResultLabel("");
    bufferRef.current = [];
    setFrameCount(0);
    setRecording(true);
  };

  const onStop = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    setRecording(false);

    if (bufferRef.current.length < T) {
      setError(`프레임 부족: ${bufferRef.current.length}/${T} (손 ✅일 때만 저장됨)`);
      return;
    }

    const frames = bufferRef.current.slice(-T);
    const hasHandFrame = frames.filter(
      (f) => f.hands?.[0]?.some((p) => p.x || p.y) || f.hands?.[1]?.some((p) => p.x || p.y)
    ).length;

    if (hasHandFrame < Math.floor(T * 0.7)) {
      setError(`손 인식이 부족해서 번역 중단 (${hasHandFrame}/${T})`);
      return;
    }

    console.log("send frames:", bufferRef.current.length, bufferRef.current[0]);
    try {
      const res = await axios.post("/api/translate", { frames });
      const { text, label } = res.data ?? {};
      setResultText(text ?? "");
      setResultLabel(label ?? "");
      if (text) setSentence((prev) => (prev ? `${prev} ${text}` : text));
    } catch (err) {
      setError("서버 전송/번역 실패: " + (err?.message ?? err));
      setResultText("(전송 실패)");
      setResultLabel("");
    }
  };

  const onResetSentence = () => setSentence("");

  return (
    <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <h2 style={{ margin: 0 }}>웹캠</h2>
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
          손 인식 → 프레임 저장 → 서버 번역 (손만)
        </div>

        <div style={{ position: "relative", marginTop: 12 }}>
          <video
            ref={videoRef}
            style={{ width: "100%", borderRadius: 12, background: "#111" }}
            playsInline
            muted
            autoPlay
          />
          <div
            style={{
              position: "absolute",
              left: 10,
              top: 10,
              background: "rgba(0,0,0,0.55)",
              color: "white",
              padding: "6px 8px",
              borderRadius: 10,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <div>손: {handDetected ? "✅" : "❌"} ({handCount})</div>
            <div>프레임: {frameCount}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            onClick={onStart}
            disabled={recording}
            style={{
              flex: 1,
              padding: "12px 10px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: recording ? "#eee" : "#111827",
              color: recording ? "#666" : "white",
              fontWeight: 700,
            }}
          >
            시작
          </button>
          <button
            onClick={onStop}
            disabled={!recording}
            style={{
              flex: 1,
              padding: "12px 10px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: !recording ? "#eee" : "#fee2e2",
              color: !recording ? "#666" : "#991b1b",
              fontWeight: 700,
            }}
          >
            정지
          </button>
        </div>

        {error ? (
          <div style={{ marginTop: 10, color: "#b91c1c", fontSize: 13, whiteSpace: "pre-wrap" }}>
            {error}
          </div>
        ) : null}
      </div>

      <div>
        <h2 style={{ margin: 0 }}>번역 결과</h2>
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.7 }}>서버 응답</div>
          <div style={{ marginTop: 8 }}>
            <b>WORD 라벨</b>: {resultLabel || "-"}
          </div>
          <div style={{ marginTop: 6 }}>
            <b>한국어 텍스트</b>: {resultText || "-"}
          </div>
          <div style={{ marginTop: 6 }}>
            <b>연속 문장</b>: {sentence || "-"}
          </div>

          <button
            onClick={onResetSentence}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "10px 10px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "white",
              fontWeight: 700,
            }}
          >
            문장 초기화
          </button>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
          <b>프리뷰 모드</b>
          <select value={previewMode} onChange={(e) => setPreviewMode(e.target.value)}>
            <option value="summary">summary</option>
            <option value="raw">raw</option>
          </select>
        </div>

        <pre
          style={{
            marginTop: 10,
            height: 360,
            overflow: "auto",
            background: "#0b1220",
            color: "#dbeafe",
            padding: 12,
            borderRadius: 12,
            fontSize: 12,
          }}
        >
          {previewJson || "(대기중... 시작을 눌러봐)"}
        </pre>
      </div>
    </div>
  );
}
