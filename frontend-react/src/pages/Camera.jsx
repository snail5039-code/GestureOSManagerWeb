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
const ZERO_HAND = ZERO_HAND21; // alias
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
  //    (너 pasted.txt에 있던 MP_DLIB68 그대로 사용)
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
  console.log("MP_DLIB68.length =", MP_DLIB68.length);
  const MP_IRIS_CENTER_1 = 468;
  const MP_IRIS_CENTER_2 = 473;

  // ============================================================
  // ✅ 포인트 변환 (x,y는 픽셀 / z는 confidence처럼 사용)
  //    - 값 있으면 z=1.0, 없으면 0
  // ============================================================
  const toPxConf = (p, W, H) => ({
    x: (p?.x ?? 0) * W,
    y: (p?.y ?? 0) * H,
    z: (p?.z ?? 0) * W,   // ✅ 여기! 1.0 고정 금지
  });

  const faceMeshToAIHub70 = (faceLm, W, H) => {
    if (!Array.isArray(faceLm) || faceLm.length < 468) return ZERO_FACE70;

    // ✅ 혹시 MP_DLIB68 길이가 틀려도 앞 68개만 사용
    const dlib68 = MP_DLIB68.slice(0, 68);

    const out = dlib68.map((idx) => toPxConf(faceLm[idx], W, H)); // 68개

    const iris1 = faceLm[MP_IRIS_CENTER_1];
    const iris2 = faceLm[MP_IRIS_CENTER_2];

    out.push(iris1 ? toPxConf(iris1, W, H) : { x: 0, y: 0, z: 0 });
    out.push(iris2 ? toPxConf(iris2, W, H) : { x: 0, y: 0, z: 0 });

    // ✅ 길이 강제 보정 (혹시라도 이상하면)
    if (out.length < 70) {
      while (out.length < 70) out.push({ x: 0, y: 0, z: 0 });
    } else if (out.length > 70) {
      out.length = 70;
    }

    return out;
  };


  // ============================================================
  // ✅ Hands 정리 (2슬롯: Right=0, Left=1)
  // ============================================================
  const handsTo2Slots = (handsLm, handed, W, H) => {
    const slots = [ZERO_HAND21.map(p => ({ ...p })), ZERO_HAND21.map(p => ({ ...p }))];

    // 손이 없으면 그대로 0
    if (!handsLm || handsLm.length === 0) return slots;

    // ✅ 1) 손이 1개면 무조건 slot0에 고정
    if (handsLm.length === 1) {
      const lm = handsLm[0];
      if (Array.isArray(lm) && lm.length === 21) {
        slots[0] = lm.map((p) => toPxConf(p, W, H));
      }
      return slots;
    }

    // ✅ 2) 손이 2개 이상이면 "화면에서 x가 더 작은 손을 slot0"으로 고정
    const scored = handsLm
      .map((lm, i) => {
        if (!Array.isArray(lm) || lm.length !== 21) return null;
        const xs = lm.map(p => p?.x ?? 0);
        const meanX = xs.reduce((a, b) => a + b, 0) / xs.length; // 0~1
        return { i, meanX };
      })
      .filter(Boolean)
      .sort((a, b) => a.meanX - b.meanX);

    const i0 = scored[0]?.i;
    const i1 = scored[1]?.i;

    if (i0 != null) slots[0] = handsLm[i0].map((p) => toPxConf(p, W, H));
    if (i1 != null) slots[1] = handsLm[i1].map((p) => toPxConf(p, W, H));

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
      // 기존 스트림 정리
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
        refineLandmarks: true, // 478 환경
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      face.onResults((res) => {
        const faces = res?.multiFaceLandmarks ?? [];
        latestFacesRef.current = faces;

        setFaceDetected(faces.length > 0);
        setFaceCount(faces.length);

        // ✅ 디버깅 로그(필요하면 켜라)
        //if (faces[0]) {
        //console.log("hasFace", true, "faceLmLen", faces[0].length);
        //console.log("face0_468", faces[0][468]);
        //}
      });

      handsRef.current = hands;
      faceRef.current = face;
    };

    const loop = async () => {
      if (!alive) return;

      const v = videoRef.current;
      if (v && v.readyState >= 2) {
        try {
          // 같은 프레임을 hands/face 둘 다 처리
          await handsRef.current?.send({ image: v });
          await faceRef.current?.send({ image: v });
        } catch (e) {
          // mediapipe 내부 에러는 일단 무시(스팸방지)
        }
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
      } catch { }
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

      // ✅ W/H 안잡히면 저장하지 마
      if (W <= 1 || H <= 1) return;

      const { handsLm, handed } = latestHandsRef.current ?? { handsLm: [], handed: [] };
      const faces = latestFacesRef.current ?? [];
      const face0 = faces[0] ?? null;

      const hasHands = (handsLm?.length ?? 0) > 0;
      const hasFace = !!face0;

      // ✅ 손 + 얼굴 둘 다 잡힐 때만 저장 (학습 데이터와 동일 조건)
      if (!hasHands || !hasFace) return;

      const handsFixed = handsTo2Slots(handsLm, handed, W, H);
      const face70 = faceMeshToAIHub70(face0, W, H);

      // ✅ face70 진짜 0인지 체크 (x/y 기준)
      const faceNonZero = face70.some((p) => p.x || p.y);
      if (!faceNonZero) {
        console.warn("FACE70 ALL ZERO", {
          W,
          H,
          face0len: face0?.length,
          sample: face70.slice(0, 3),
        });
      }

      const frame = { t: Date.now(), hands: handsFixed, face: face70 };

      bufferRef.current.push(frame);
      setFrameCount(bufferRef.current.length);

      // 프리뷰는 5프레임마다 업데이트(콘솔/렌더 스팸 방지)
      if (bufferRef.current.length % 5 === 0) {
        if (previewMode === "raw") {
          setPreviewJson(JSON.stringify(frame, null, 2));
        } else {
          const nonZeroSlots =
            frame.hands?.filter((h) => h?.some((p) => p.x || p.y)).length ?? 0;

          const hasFace2 = frame.face?.some((p) => p.x || p.y) ? 1 : 0;

          setPreviewJson(
            JSON.stringify(
              {
                t: frame.t,
                handsSlots: nonZeroSlots,
                face: hasFace2,
                hands0_sample_5: frame.hands?.[0]?.slice(0, 5) ?? [],
                hands1_sample_5: frame.hands?.[1]?.slice(0, 5) ?? [],
                face_sample_5: frame.face?.slice(0, 5) ?? [],
                hint: { hands: "2x21", face: "70", dims: "x,y,conf(z)" },
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

    // ✅ 여기 추가!!
    const hasHandFrame = frames.filter(
      (f) =>
      (f.hands?.[0]?.some((p) => p.x || p.y) ||
        f.hands?.[1]?.some((p) => p.x || p.y))
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
    console.log("SEND frames =", frames.length, frames[0]);
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

  // =========================
  // UI
  // =========================
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
