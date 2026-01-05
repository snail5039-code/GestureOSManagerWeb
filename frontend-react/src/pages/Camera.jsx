import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Hands } from "@mediapipe/hands";

const T = 30;                 // 버퍼 길이
const SAVE_FPS_MS = 100;      // 10fps
const CDN = "https://cdn.jsdelivr.net/npm";

const ZERO_PT = { x: 0, y: 0, z: 0 };
const ZERO_HAND21 = Array.from({ length: 21 }, () => ({ ...ZERO_PT }));

// ✅ 확정 규칙(원하면 숫자만 바꿔)
const CONF_TH = 0.60;     // confidence 이 이상이면 바로 확정
const STABLE_N = 2;       // 동일 Top-1 연속 N번이면 확정

export default function Camera() {
  const videoRef = useRef(null);

  const handsRef = useRef(null);
  const latestHandsRef = useRef({ handsLm: [], handed: [] });

  const bufferRef = useRef([]);
  const saveTimerRef = useRef(null);

  const translatingRef = useRef(false);

  // 안정화 상태
  const stableWordRef = useRef("");
  const stableCountRef = useRef(0);
  const lastCommittedRef = useRef("");

  const [recording, setRecording] = useState(false);

  const [handDetected, setHandDetected] = useState(false);
  const [handCount, setHandCount] = useState(0);
  const [frameCount, setFrameCount] = useState(0);

  const [top1Text, setTop1Text] = useState("대기중...");
  const [top1Conf, setTop1Conf] = useState(0);

  const [cands, setCands] = useState([]); // [{label, prob}]
  const [sentence, setSentence] = useState("");

  // 0~1 -> px, z=0 고정
  const toPxHand = (p, W, H) => ({
    x: (p?.x ?? 0) * W,
    y: (p?.y ?? 0) * H,
    z: 0,
  });

  const locateMP = (file) => `${CDN}/@mediapipe/hands/${file}`;

  const stop = async () => {
    setRecording(false);

    if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    saveTimerRef.current = null;

    if (handsRef.current) {
      try {
        handsRef.current.close();
      } catch {}
    }
    handsRef.current = null;

    const videoEl = videoRef.current;
    if (videoEl?.srcObject) {
      try {
        videoEl.srcObject.getTracks().forEach((t) => t.stop());
      } catch {}
    }
    if (videoEl) videoEl.srcObject = null;

    bufferRef.current = [];
    setFrameCount(0);

    translatingRef.current = false;
    stableWordRef.current = "";
    stableCountRef.current = 0;
    lastCommittedRef.current = "";

    setHandDetected(false);
    setHandCount(0);

    setTop1Text("대기중...");
    setTop1Conf(0);
    setCands([]);
  };

  useEffect(() => {
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    if (recording) return;
    setRecording(true);

    bufferRef.current = [];
    setFrameCount(0);

    const videoEl = videoRef.current;
    if (!videoEl) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    videoEl.srcObject = stream;
    await videoEl.play();

    const hands = new Hands({ locateFile: locateMP });
    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((res) => {
      const handsLm = res.multiHandLandmarks ?? [];
      const handed = res.multiHandedness ?? [];
      latestHandsRef.current = { handsLm, handed };

      setHandDetected(handsLm.length > 0);
      setHandCount(handsLm.length);
    });

    handsRef.current = hands;

    // 10fps로 프레임 저장
    saveTimerRef.current = setInterval(async () => {
      try {
        if (!videoEl || videoEl.readyState < 2) return;

        await hands.send({ image: videoEl });

        const latest = latestHandsRef.current;
        const handsLm = latest?.handsLm ?? [];
        const handed = latest?.handed ?? [];

        // 손 없으면 저장 안 함(노이즈↓)
        if (!handsLm.length) return;

        const W = videoEl.videoWidth || 1;
        const H = videoEl.videoHeight || 1;

        // handsFixed: [Right, Left] 고정
        const handsFixed = [ZERO_HAND21, ZERO_HAND21];

        for (let i = 0; i < handsLm.length; i++) {
          const label =
            handed?.[i]?.label ??
            handed?.[i]?.classification?.[0]?.label ??
            null;

          // Right=0, Left=1
          const slot = label === "Left" ? 1 : 0;

          const lm = handsLm[i];
          if (Array.isArray(lm) && lm.length === 21) {
            handsFixed[slot] = lm.map((p) => toPxHand(p, W, H));
          }
        }

        bufferRef.current.push({ t: Date.now(), hands: handsFixed });
        while (bufferRef.current.length > T) bufferRef.current.shift();

        setFrameCount(bufferRef.current.length);
      } catch (e) {
        // ignore
      }
    }, SAVE_FPS_MS);
  };

  // ✅ Top-5 번역 요청
  const translateTop5 = async () => {
    if (translatingRef.current) return;
    const frames = bufferRef.current.map((f) => ({ hands: f.hands }));

    if (frames.length < 10) {
      setTop1Text("프레임 부족(손 동작 더 보여줘)");
      setTop1Conf(0);
      setCands([]);
      return;
    }

    translatingRef.current = true;
    try {
      // Spring이 python /predict로 프록시하는 엔드포인트
      // ✅ candidates가 응답에 포함되도록 Spring DTO도 필드가 있어야 함
      const res = await axios.post("/api/translate", { frames, topk: 5 });

      const word = (res.data?.text ?? "").trim();
      const conf = Number(res.data?.confidence ?? 0);
      const candidates = Array.isArray(res.data?.candidates) ? res.data.candidates : [];

      setTop1Text(word || "(empty)");
      setTop1Conf(conf);

      setCands(
        candidates.slice(0, 5).map(([lab, p]) => ({
          label: lab,
          prob: Number(p ?? 0),
        }))
      );

      // ✅ 확정 규칙
      if (!word) return;

      if (stableWordRef.current === word) stableCountRef.current += 1;
      else {
        stableWordRef.current = word;
        stableCountRef.current = 1;
      }

      const confOk = conf >= CONF_TH;
      const stableOk = stableCountRef.current >= STABLE_N;

      if ((confOk || stableOk) && word !== lastCommittedRef.current) {
        lastCommittedRef.current = word;
        setSentence((prev) => (prev ? prev + " " + word : word));
        stableWordRef.current = "";
        stableCountRef.current = 0;
      }
    } catch (e) {
      setTop1Text("translate error");
      setTop1Conf(0);
      setCands([]);
    } finally {
      translatingRef.current = false;
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Camera Test (Top-5)</h2>

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: "100%", background: "#111" }}
          />
          <div style={{ marginTop: 8 }}>
            손 감지:{" "}
            <b style={{ color: handDetected ? "lime" : "tomato" }}>
              {handDetected ? "ON" : "OFF"}
            </b>{" "}
            | 손 개수: <b>{handCount}</b> | 버퍼 프레임: <b>{frameCount}</b>
          </div>

          <div style={{ marginTop: 10 }}>
            {!recording ? (
              <button onClick={start}>Start</button>
            ) : (
              <button onClick={stop}>Stop</button>
            )}{" "}
            <button onClick={translateTop5} disabled={!recording}>
              Translate (Top-5)
            </button>{" "}
            <button
              onClick={() => {
                setSentence("");
                lastCommittedRef.current = "";
              }}
            >
              문장 초기화
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
            확정 규칙: conf ≥ {CONF_TH} 또는 Top-1 연속 {STABLE_N}회
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 6 }}>
            <b>Top-1</b>
          </div>
          <div
            style={{
              border: "1px solid #444",
              padding: 12,
              minHeight: 90,
              background: "#0b0b0b",
              color: "#eee",
            }}
          >
            <div style={{ fontSize: 24 }}>{top1Text}</div>
            <div style={{ marginTop: 6, color: "#999" }}>
              conf: {top1Conf.toFixed(3)}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <b>Top-5 후보</b>
            <div
              style={{
                marginTop: 6,
                border: "1px solid #444",
                padding: 10,
                background: "#0b0b0b",
                color: "#eee",
                fontFamily: "monospace",
                fontSize: 12,
                minHeight: 120,
              }}
            >
              {cands.length === 0 ? (
                <div>(none)</div>
              ) : (
                cands.map((c, i) => (
                  <div key={i}>
                    {i + 1}. {c.label} ({c.prob.toFixed(3)})
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <b>확정 문장</b>
            <div
              style={{
                marginTop: 6,
                border: "1px solid #444",
                padding: 10,
                background: "#0b0b0b",
                color: "#eee",
                minHeight: 60,
              }}
            >
              {sentence || "(empty)"}
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
            * candidates가 안 보이면: Spring 응답 DTO에 candidates 필드가 없어서 버리는 중일 가능성 높음.
          </div>
        </div>
      </div>
    </div>
  );
}
