import { useEffect, useMemo, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

const ZERO63 = Array(63).fill(0);
const ZERO126 = Array(126).fill(0);

// 손 연결선(네가 쓰던 것 그대로)
const HAND_CONNECTIONS = [
  [0, 1],[1, 2],[2, 3],[3, 4],
  [0, 5],[5, 6],[6, 7],[7, 8],
  [5, 9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[0,17],[17,18],[18,19],[19,20]
];

export default function TranslatorCam() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const landmarkerRef = useRef(null);

  const startedRef = useRef(false);
  const framesRef = useRef(0);

  // 서버 통신
  const apiUrl = useMemo(() => "/api/translate", []);
  const inFlightRef = useRef(false);
  const abortRef = useRef(null);

  // 레코딩
  const recordBufRef = useRef([]); // (T,126)
  const [label, setLabel] = useState("hello");
  const [isRecording, setIsRecording] = useState(false);
  const [targetFrames] = useState(30);
  const [sampleEvery] = useState(2);

  // UI
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [handsText, setHandsText] = useState("-");
  const [lastRes, setLastRes] = useState(null);

  const recordingRef = useRef(false);
  const labelRef = useRef(label);

  useEffect(() => {
    labelRef.current = label;
  }, [label]);

  const [debug, setDebug] = useState({
    featLen: 0,
    min: 0,
    max: 0,
    hasNaN: false,
    handsCount: 0,
    labels: "",
  });

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ensureLandmarker() {
    if (landmarkerRef.current) return landmarkerRef.current;

    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    const lm = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL },
      runningMode: "VIDEO",
      numHands: 2, // ✅ 양손
    });

    landmarkerRef.current = lm;
    return lm;
  }

  async function start() {
    if (running || startedRef.current) return;
    startedRef.current = true;

    setStatus("starting");
    setLastRes(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // 1) webcam
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    streamRef.current = stream;
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
    await video.play();

    // 2) landmarker
    const landmarker = await ensureLandmarker();

    setRunning(true);
    setStatus("running");

    const ctx = canvas.getContext("2d");

    const loop = async () => {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || !c) return;

      const w = v.videoWidth || 640;
      const h = v.videoHeight || 480;
      c.width = w;
      c.height = h;

      framesRef.current += 1;

      // detect
      const nowMs = performance.now();
      const res = landmarker.detectForVideo(v, nowMs);

      // draw overlay only (video는 <video>가 보여줌)
      ctx.clearRect(0, 0, w, h);

      const hands = res?.landmarks ?? [];
      const handednesses = res?.handednesses ?? [];

      // 1) 상태 표시
      const state = summarizeHands(handednesses);
      setHandsText(state);

      // 2) 그리기(두 손 모두)
      if (hands.length > 0) {
        for (const lm of hands) {
          drawHand(ctx, lm, w, h);
        }
      }

      // 3) feature 126 (Left63 + Right63)
      const feat126 = buildFrame126(hands, handednesses);

      // debug
      if (hands.length > 0) {
        const min = Math.min(...feat126);
        const max = Math.max(...feat126);
        const hasNaN = feat126.some((x) => Number.isNaN(x));
        const labels = handednesses
          .map((hs) => hs?.[0]?.categoryName || "")
          .join(",");

        setDebug({
          featLen: feat126.length,
          min,
          max,
          hasNaN,
          handsCount: hands.length,
          labels,
        });

        if (status === "no-hand") setStatus("running");
      } else {
        setDebug((d) => ({ ...d, featLen: 0, handsCount: 0, labels: "" }));
        if (!recordingRef.current) setStatus("no-hand");
      }

      // 4) Record 저장 (T,126)
      if (recordingRef.current && framesRef.current % sampleEvery === 0) {
        recordBufRef.current.push(feat126);
        setProgress(recordBufRef.current.length);

        if (recordBufRef.current.length >= targetFrames) {
          finishRecord();
        }
      }

      // 5) 서버 전송(녹화 아닐 때만) - 5프레임마다
      if (!recordingRef.current && framesRef.current % 5 === 0) {
        await sendToServer(feat126);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }

  async function stop() {
    setRunning(false);
    setStatus("stopped");
    setIsRecording(false);
    setProgress(0);
    recordBufRef.current = [];
    startedRef.current = false;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    try {
      abortRef.current?.abort?.();
    } catch {}
    abortRef.current = null;
    inFlightRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const v = videoRef.current;
    if (v) v.srcObject = null;

    try {
      landmarkerRef.current?.close?.();
    } catch {}
    landmarkerRef.current = null;
    recordingRef.current = false;
  }

  function startRecord() {
    if (!running) {
      alert("먼저 Start로 카메라 켜!");
      return;
    }
    if (!label.trim()) {
      alert("label(단어)부터 적어!");
      return;
    }
    recordBufRef.current = [];
    setProgress(0);
    recordingRef.current = true;
    setIsRecording(true);
    setStatus("recording");
  }

  function finishRecord() {
    recordingRef.current = false;
    setIsRecording(false);

    const seq = recordBufRef.current;
    recordBufRef.current = [];
    setProgress(0);

    const payload = {
        label: labelRef.current.trim(),
        frames: seq, // (T,126)
        featureDim: 126,
        order: "Left63+Right63",
        createdAt: Date.now(),
    };

    downloadJson(payload, `${payload.label}_${payload.createdAt}.json`);
    setStatus("saved");
  }

  async function sendToServer(features) {
    if (inFlightRef.current) return;
    if (!features || features.length === 0) return;

    inFlightRef.current = true;
    setStatus((s) => (s === "recording" ? s : "sending"));

    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
    }
    const ac = new AbortController();
    abortRef.current = ac;

    const payload = {
      features, // ✅ 126
      ts: Date.now(),
      framesReceived: framesRef.current,
      mode: "hands126",
    };

    try {
      const r = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ac.signal,
      });

      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();

      setLastRes(data);
      setStatus(data.mode || "ok");
    } catch (e) {
      if (e?.name !== "AbortError") {
        console.error("translate error", e);
        setStatus("server-error");
      }
    } finally {
      inFlightRef.current = false;
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, alignItems: "start" }}>
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <button onClick={start} disabled={running} style={btn}>Start</button>
          <button onClick={stop} disabled={!running} style={btn}>Stop</button>

          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="label(단어) 예: hello"
            style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ccc" }}
          />

          <button onClick={startRecord} disabled={!running || isRecording} style={btn}>
            {isRecording ? `Recording... (${progress}/${targetFrames})` : "Record (샘플 저장)"}
          </button>

          <span style={{ marginLeft: 8, opacity: 0.8 }}>
            status: {status} / hands: {handsText}
          </span>
        </div>

        <div style={{ position: "relative", width: 640, maxWidth: "100%" }}>
          <video
            ref={videoRef}
            style={{ width: "100%", borderRadius: 12, background: "#111" }}
            autoPlay
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: 12 }}
          />
        </div>
      </div>

      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
        <h3 style={{ marginTop: 0 }}>결과(더미)</h3>

        <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
          {lastRes?.text ?? "—"}
        </div>
        <div style={{ opacity: 0.85 }}>
          label: <b>{lastRes?.label ?? "—"}</b>
        </div>
        <div style={{ opacity: 0.85 }}>
          conf: <b>{typeof lastRes?.confidence === "number" ? lastRes.confidence.toFixed(3) : "—"}</b>
        </div>
        <div style={{ opacity: 0.85 }}>
          mode: <b>{lastRes?.mode ?? "—"}</b> / streak: <b>{lastRes?.streak ?? "—"}</b>
        </div>

        <hr style={{ margin: "12px 0" }} />

        <h4 style={{ margin: 0 }}>디버그</h4>
        <div style={{ fontFamily: "monospace", fontSize: 12, marginTop: 8 }}>
          handsCount: {debug.handsCount}<br />
          labels: {debug.labels || "-"}<br />
          featLen: {debug.featLen}<br />
          min/max: {debug.min.toFixed(4)} / {debug.max.toFixed(4)}<br />
          hasNaN: {String(debug.hasNaN)}
        </div>

        <hr style={{ margin: "12px 0" }} />
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          ✅ Record 누르면 (30프레임 × 126=Left63+Right63) json 다운로드됨.
        </div>
      </div>
    </div>
  );
}

const btn = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #ccc",
  background: "white",
  cursor: "pointer",
};

// ====== drawing ======
function drawHand(ctx, lm, w, h) {
  // lines
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 2;
  for (const [a, b] of HAND_CONNECTIONS) {
    const p1 = lm[a], p2 = lm[b];
    ctx.beginPath();
    ctx.moveTo(p1.x * w, p1.y * h);
    ctx.lineTo(p2.x * w, p2.y * h);
    ctx.stroke();
  }
  // points
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  for (const p of lm) {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ====== handedness 요약 ======
function summarizeHands(handednesses) {
  let hasL = false, hasR = false;
  for (let i = 0; i < handednesses.length; i++) {
    const name = handednesses?.[i]?.[0]?.categoryName || "";
    const s = String(name).toLowerCase();
    if (s === "left") hasL = true;
    if (s === "right") hasR = true;
  }
  if (hasL && hasR) return "Both";
  if (hasL) return "Left";
  if (hasR) return "Right";
  return "-";
}

// ====== feature 126 만들기 (Left63 + Right63) ======
function buildFrame126(hands, handednesses) {
  if (!hands || hands.length === 0) return ZERO126;

  let left63 = null;
  let right63 = null;

  for (let i = 0; i < hands.length; i++) {
    const lm = hands[i];
    const name = handednesses?.[i]?.[0]?.categoryName || "";
    const s = String(name).toLowerCase();

    if (s === "left" && !left63) left63 = normalizeTo63(lm, "Left");
    if (s === "right" && !right63) right63 = normalizeTo63(lm, "Right");
  }

  if (!left63) left63 = ZERO63;
  if (!right63) right63 = ZERO63;

  return [...left63, ...right63]; // 126
}

// 21점 xyz => 63 (wrist 기준 / scale 정규화, 왼손 x 미러링)
function normalizeTo63(landmarks, handedness) {
  const w = landmarks[0];
  const m = landmarks[9]; // 중지 MCP
  const scale =
    Math.hypot(m.x - w.x, m.y - w.y, m.z - w.z) || 1;

  const isLeft = String(handedness).toLowerCase() === "left";
  const out = [];

  for (const p of landmarks) {
    let x = (p.x - w.x) / scale;
    let y = (p.y - w.y) / scale;
    let z = (p.z - w.z) / scale;
    if (isLeft) x = -x; // ✅ 왼손 미러링
    out.push(round6(x), round6(y), round6(z));
  }
  return out;
}

function round6(v) {
  return Math.round(v * 1e6) / 1e6;
}

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
