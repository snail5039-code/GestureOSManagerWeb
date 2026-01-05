import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Hands } from "@mediapipe/hands";

const T = 30;                 // 버퍼 길이(학습과 맞추기)
const SAVE_FPS_MS = 100;      // 10fps
const CDN = "https://cdn.jsdelivr.net/npm";

const ZERO_PT = { x: 0, y: 0, z: 0 };
const ZERO_HAND21 = Array.from({ length: 21 }, () => ({ ...ZERO_PT }));

// ✅ 확정 규칙(필요하면 숫자만 조절)
const CONF_TH = 0.60;     // conf 이 이상이면 바로 확정
const STABLE_N = 2;       // 동일 Top-1 연속 N번이면 확정
const RECENT_HAND_MS = 600; // 최근 손 감지(이내) 없으면 번역 막기(버퍼 stale 방지)

export default function Camera() {
  const videoRef = useRef(null);

  const handsRef = useRef(null);
  const latestHandsRef = useRef({ handsLm: [] });

  const bufferRef = useRef([]);
  const saveTimerRef = useRef(null);

  const translatingRef = useRef(false);

  // 안정화 상태
  const stableWordRef = useRef("");
  const stableCountRef = useRef(0);
  const lastCommittedRef = useRef("");

  const lastHandSeenAtRef = useRef(0);

  const [recording, setRecording] = useState(false);

  const [handDetected, setHandDetected] = useState(false);
  const [handCount, setHandCount] = useState(0);
  const [frameCount, setFrameCount] = useState(0);

  const [top1Text, setTop1Text] = useState("대기중...");
  const [top1Conf, setTop1Conf] = useState(0);

  const [cands, setCands] = useState([]); // [{label, prob}]
  const [sentence, setSentence] = useState("");

  const locateMP = (file) => `${CDN}/@mediapipe/hands/${file}`;

  // normalized(0~1) -> px
  const toPxHand = (p, W, H) => ({
    x: (p?.x ?? 0) * W,
    y: (p?.y ?? 0) * H,
    z: 0,
  });

  const resetStability = () => {
    stableWordRef.current = "";
    stableCountRef.current = 0;
  };

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
    resetStability();
    lastCommittedRef.current = "";
    lastHandSeenAtRef.current = 0;

    setHandDetected(false);
    setHandCount(0);

    setTop1Text("대기중...");
    setTop1Conf(0);
    setCands([]);
  };

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    if (recording) return;
    setRecording(true);

    bufferRef.current = [];
    setFrameCount(0);
    resetStability();
    lastCommittedRef.current = "";
    lastHandSeenAtRef.current = 0;

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
      latestHandsRef.current = { handsLm };

      const has = handsLm.length > 0;
      setHandDetected(has);
      setHandCount(handsLm.length);

      if (has) lastHandSeenAtRef.current = Date.now();
    });

    handsRef.current = hands;

    // ✅ 10fps로 프레임 저장 (손 없어도 ZERO 프레임 저장해서 stale 방지)
    saveTimerRef.current = setInterval(async () => {
      try {
        if (!videoEl || videoEl.readyState < 2) return;

        await hands.send({ image: videoEl });

        const latest = latestHandsRef.current;
        const handsLm = latest?.handsLm ?? [];

        const W = videoEl.videoWidth || 1;
        const H = videoEl.videoHeight || 1;

        // ✅ 좌/우 슬롯 고정: handedness 믿지 말고 x평균으로 정렬
        const handsWithX = handsLm
          .filter((lm) => Array.isArray(lm) && lm.length === 21)
          .map((lm) => {
            const avgX = lm.reduce((s, p) => s + (p?.x ?? 0), 0) / lm.length; // normalized x
            return { lm, avgX };
          })
          .sort((a, b) => a.avgX - b.avgX);

        // handsFixed: [Right, Left] 고정
        const handsFixed = [ZERO_HAND21, ZERO_HAND21];

        if (handsWithX.length === 1) {
          // 하나면 오른손 슬롯(0)에 넣는 정책
          handsFixed[0] = handsWithX[0].lm.map((p) => toPxHand(p, W, H));
        } else if (handsWithX.length >= 2) {
          const leftLm = handsWithX[0].lm;
          const rightLm = handsWithX[1].lm;
          handsFixed[1] = leftLm.map((p) => toPxHand(p, W, H));   // Left
          handsFixed[0] = rightLm.map((p) => toPxHand(p, W, H));  // Right
        }

        bufferRef.current.push({ t: Date.now(), hands: handsFixed });
        while (bufferRef.current.length > T) bufferRef.current.shift();
        setFrameCount(bufferRef.current.length);

        // 손이 오래 안 보이면 안정화 리셋(고정 체감 감소)
        const now = Date.now();
        if (now - lastHandSeenAtRef.current > RECENT_HAND_MS) {
          resetStability();
        }
      } catch {
        // ignore
      }
    }, SAVE_FPS_MS);
  };

  const translateTop5 = async () => {
    if (translatingRef.current) return;

    const now = Date.now();
    if (now - lastHandSeenAtRef.current > RECENT_HAND_MS) {
      setTop1Text("손 감지될 때만 번역");
      setTop1Conf(0);
      setCands([]);
      return;
    }

    const frames = bufferRef.current.map((f) => ({ hands: f.hands }));
    if (frames.length < 10) {
      setTop1Text("프레임 부족");
      setTop1Conf(0);
      setCands([]);
      return;
    }

    translatingRef.current = true;
    try {
      const res = await axios.post("/api/translate", { frames, topk: 5 });

      const word = (res.data?.text ?? "").trim();
      const conf = Number(res.data?.confidence ?? 0);
      const candidates = Array.isArray(res.data?.candidates) ? res.data.candidates : [];

      setTop1Text(word || "(empty)");
      setTop1Conf(conf);

      // candidates 형태: [[label, prob], ...]
      setCands(
        candidates.slice(0, 5).map((pair) => ({
          label: String(pair?.[0] ?? ""),
          prob: Number(pair?.[1] ?? 0),
        }))
      );

      if (!word) return;

      // ✅ 안정화(연속/임계치)
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
        resetStability();
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
      <h2>Camera Test (Top-5) - Hand Only</h2>

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <video ref={videoRef} playsInline muted style={{ width: "100%", background: "#111" }} />
          <div style={{ marginTop: 8 }}>
            감지:{" "}
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
                resetStability();
              }}
            >
              문장 초기화
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
            확정 규칙: conf ≥ {CONF_TH} 또는 Top-1 연속 {STABLE_N}회 / 최근 손 감지 {RECENT_HAND_MS}ms
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
            <div style={{ marginTop: 6, color: "#999" }}>conf: {top1Conf.toFixed(3)}</div>
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
        </div>
      </div>
    </div>
  );
}
