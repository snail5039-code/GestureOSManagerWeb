import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Hands } from "@mediapipe/hands";
import { FaceMesh } from "@mediapipe/face_mesh";

// =========================
// 설정
// =========================
const T = 30;                // 프레임 길이
const SAVE_FPS_MS = 100;     // 10fps 저장
const CDN = "https://cdn.jsdelivr.net/npm"; // mediapipe asset CDN

// =========================
// ZERO 텐서(패딩)
// =========================
const ZERO_PT = { x: 0, y: 0, z: 0 };
const ZERO_HAND21 = Array.from({ length: 21 }, () => ({ ...ZERO_PT }));
const ZERO_FACE70 = Array.from({ length: 70 }, () => ({ ...ZERO_PT }));

export default function Camera() {
  // =========================
  // Refs
  // =========================
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const handsRef = useRef(null);
  const faceRef = useRef(null);

  const latestHandsRef = useRef({ handsLm: [], handed: [] });
  const latestFacesRef = useRef([]);

  const bufferRef = useRef([]);
  const saveTimerRef = useRef(null);

  // =========================
  // UI State
  // =========================
  const [recording, setRecording] = useState(false);

  const [handDetected, setHandDetected] = useState(false);
  const [handCount, setHandCount] = useState(0);

  const [faceDetected, setFaceDetected] = useState(false);
  const [faceCount, setFaceCount] = useState(0);

  const [frameCount, setFrameCount] = useState(0);

  const [resultText, setResultText] = useState("");
  const [resultLabel, setResultLabel] = useState("");
  const [sentence, setSentence] = useState("");
  const [error, setError] = useState("");

  const [previewMode, setPreviewMode] = useState("summary"); // summary | raw
  const [previewJson, setPreviewJson] = useState("");

  // ============================================================
  // ✅ 얼굴 70개 = dlib68(68) + iris center 2개
  // ============================================================
  const MP_DLIB68 = useMemo(
    () => [
      162, 234, 93, 58, 172, 136, 149, 148, 152, 377, 378, 365, 397, 288, 323,
      454, 389,
      71, 63, 105, 66, 107, 336, 296, 334, 293, 300,
      168, 197, 5, 4, 75, 97, 2, 326, 305, 33,
      160, 158, 133, 153, 144, 362, 385, 387, 263, 373,
      61, 39, 37, 0, 267, 269, 291, 405,
      78, 191, 80, 81, 82, 13, 312, 311, 310, 415,
      95, 88, 178, 87, 14, 317, 402, 318, 324, 308,
    ],
    []
  );
  const MP_IRIS_CENTER_1 = 468;
  const MP_IRIS_CENTER_2 = 473;

  // ============================================================
  // ✅ 학습 파이프라인 맞춤 전처리
  // 1) 손: z는 학습에서 0으로 통일했음 -> 무조건 0
  // 2) 얼굴: AIHub/OpenPose는 score(0~1) 성격 -> 여기선 "있으면 1.0"로 통일
  // ============================================================
  const toPxHand = (p, W, H) => ({
    x: (p?.x ?? 0) * W,
    y: (p?.y ?? 0) * H,
    z: 0, // ✅ 손 z는 0 고정
  });

  const toPxFace = (p, W, H) => ({
    x: (p?.x ?? 0) * W,
    y: (p?.y ?? 0) * H,
    z: p ? 1.0 : 0.0, // ✅ 얼굴 z는 score처럼 사용(있으면 1)
  });

  const faceMeshToAIHub70 = (faceLm, W, H) => {
    if (!Array.isArray(faceLm) || faceLm.length < 468) return ZERO_FACE70;

    const dlib68 = MP_DLIB68.slice(0, 68);
    const out = dlib68.map((idx) => toPxFace(faceLm[idx], W, H));

    const iris1 = faceLm[MP_IRIS_CENTER_1];
    const iris2 = faceLm[MP_IRIS_CENTER_2];
    out.push(iris1 ? toPxFace(iris1, W, H) : { x: 0, y: 0, z: 0 });
    out.push(iris2 ? toPxFace(iris2, W, H) : { x: 0, y: 0, z: 0 });

    if (out.length < 70) while (out.length < 70) out.push({ x: 0, y: 0, z: 0 });
    if (out.length > 70) out.length = 70;
    return out;
  };

  // ============================================================
  // ✅ Hands 정리 (2슬롯: Right=0, Left=1)  ← 학습 파이프라인 전제와 동일
  // ============================================================
  const handsTo2Slots = (handsLm, handed, W, H) => {
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

    // 2) fallback: handedness 없을 때 x로 채우기
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

    // 화면 왼쪽=Left(slot1), 오른쪽=Right(slot0)로 넣어보기 (셀카/거울이면 반대일 수 있음)
    const iLeft = scored[0]?.i;
    const iRight = scored[1]?.i;

    if (!slot0Has && iRight != null) slots[0] = handsLm[iRight].map((p) => toPxHand(p, W, H));
    if (!slot1Has && iLeft != null) slots[1] = handsLm[iLeft].map((p) => toPxHand(p, W, H));

    // 손이 1개뿐인데 slot이 비었으면: 오른쪽으로 가정
    if (!slots[0].some((p) => p.x || p.y) && slots[1].some((p) => p.x || p.y)) {
      // 그대로 둠 (Left만 있는 상황)
    }
    if (!slots[1].some((p) => p.x || p.y) && slots[0].some((p) => p.x || p.y)) {
      // 그대로 둠 (Right만 있는 상황)
    }

    return slots;
  };

  // ============================================================
  // ✅ locateFile (mediapipe wasm/asset 로딩)
  // ============================================================
  const locateMP = (file) => {
    if (file.includes("face_mesh")) return `${CDN}/@mediapipe/face_mesh/${file}`;
    return `${CDN}/@mediapipe/hands/${file}`;
  };

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
      // Hands
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

      // FaceMesh
      const face = new FaceMesh({ locateFile: locateMP });
      face.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true, // 478
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      face.onResults((res) => {
        const faces = res?.multiFaceLandmarks ?? [];
        latestFacesRef.current = faces;
        setFaceDetected(faces.length > 0);
        setFaceCount(faces.length);
      });

      handsRef.current = hands;
      faceRef.current = face;
    };

    const loop = async () => {
      if (!alive) return;

      const v = videoRef.current;
      if (v && v.readyState >= 2) {
        try {
          await handsRef.current?.send({ image: v });
          await faceRef.current?.send({ image: v });
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
        faceRef.current?.close?.();
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
      const faces = latestFacesRef.current ?? [];
      const face0 = faces[0] ?? null;

      const hasHands = (handsLm?.length ?? 0) > 0;
      const hasFace = !!face0;

      // 학습 조건처럼 손+얼굴 다 있어야 저장 (일단 유지)
      if (!hasHands || !hasFace) return;

      const handsFixed = handsTo2Slots(handsLm, handed, W, H);
      const face70 = faceMeshToAIHub70(face0, W, H);

      const handsSlots =
        (handsFixed?.[0]?.some((p) => p.x || p.y) ? 1 : 0) +
        (handsFixed?.[1]?.some((p) => p.x || p.y) ? 1 : 0);

      const faceOk = face70?.some((p) => p.x || p.y) ? 1 : 0;
      if (!faceOk) return;

      const frame = { t: Date.now(), hands: handsFixed, face: face70, handsSlots };

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
                face: faceOk,
                hands0_sample_5: frame.hands?.[0]?.slice(0, 5) ?? [],
                hands1_sample_5: frame.hands?.[1]?.slice(0, 5) ?? [],
                face_sample_5: frame.face?.slice(0, 5) ?? [],
                hint: {
                  hands: "2x21",
                  face: "70",
                  z: "hand z=0, face z=1/0",
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
  }, [recording, previewMode]);

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
      setError(`프레임 부족: ${bufferRef.current.length}/${T} (손+얼굴 ✅일 때만 저장됨)`);
      return;
    }

    const frames = bufferRef.current.slice(-T);

    const hasHandFrame = frames.filter(
      (f) =>
        f.hands?.[0]?.some((p) => p.x || p.y) || f.hands?.[1]?.some((p) => p.x || p.y)
    ).length;

    const hasFaceFrame = frames.filter((f) => f.face?.some((p) => p.x || p.y)).length;

    if (hasHandFrame < Math.floor(T * 0.7)) {
      setError(`손 인식이 부족해서 번역 중단 (${hasHandFrame}/${T})`);
      return;
    }
    if (hasFaceFrame < Math.floor(T * 0.7)) {
      setError(`얼굴 인식이 부족해서 번역 중단 (${hasFaceFrame}/${T})`);
      return;
    }

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
          손/얼굴 인식 → 프레임 저장 → 서버 번역
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
            <div>얼굴: {faceDetected ? "✅" : "❌"} ({faceCount})</div>
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
          <div style={{ marginTop: 8 }}><b>WORD 라벨</b>: {resultLabel || "-"}</div>
          <div style={{ marginTop: 6 }}><b>한국어 텍스트</b>: {resultText || "-"}</div>
          <div style={{ marginTop: 6 }}><b>연속 문장</b>: {sentence || "-"}</div>

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
