import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Hands } from "@mediapipe/hands";

const T = 30;
const CAPTURE_MS = 100;     // mediapipe send 주기
const SAVE_MS = 100;        // 10fps 버퍼
const INFER_MS = 400;       // 번역 주기
const CDN = "https://cdn.jsdelivr.net/npm";

const ZERO_PT = { x: 0, y: 0, z: 0 };
const ZERO_HAND21 = Array.from({ length: 21 }, () => ({ ...ZERO_PT }));

const CONF_TH = 0.60;
const STABLE_N = 2;
const RECENT_HAND_MS = 600;

export default function CallRoom() {
  const { roomId } = useParams();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  const handsRef = useRef(null);
  const latestHandsRef = useRef({ handsLm: [] });

  const bufferRef = useRef([]);
  const captureTimerRef = useRef(null);
  const saveTimerRef = useRef(null);
  const inferTimerRef = useRef(null);

  const translatingRef = useRef(false);

  const stableWordRef = useRef("");
  const stableCountRef = useRef(0);
  const lastCommittedRef = useRef("");
  const lastHandSeenAtRef = useRef(0);

  const [handDetected, setHandDetected] = useState(false);
  const [frameCount, setFrameCount] = useState(0);

  const [top1Text, setTop1Text] = useState("대기중...");
  const [top1Conf, setTop1Conf] = useState(0);
  const [cands, setCands] = useState([]);
  const [sentence, setSentence] = useState("");

  const locateMP = (file) => `${CDN}/@mediapipe/hands/${file}`;

  const toPxHand = (p, W, H) => ({
    x: (p?.x ?? 0) * W,
    y: (p?.y ?? 0) * H,
    z: 0,
  });

  const resetStability = () => {
    stableWordRef.current = "";
    stableCountRef.current = 0;
  };

  const stopVision = () => {
    if (captureTimerRef.current) clearInterval(captureTimerRef.current);
    if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    if (inferTimerRef.current) clearInterval(inferTimerRef.current);
    captureTimerRef.current = null;
    saveTimerRef.current = null;
    inferTimerRef.current = null;

    if (handsRef.current) {
      try {
        handsRef.current.close();
      } catch {}
    }
    handsRef.current = null;

    latestHandsRef.current = { handsLm: [] };
    bufferRef.current = [];
    setFrameCount(0);

    translatingRef.current = false;
    resetStability();
    lastCommittedRef.current = "";
    lastHandSeenAtRef.current = 0;

    setHandDetected(false);
    setTop1Text("대기중...");
    setTop1Conf(0);
    setCands([]);
  };

  const stopRTC = () => {
    try {
      if (pcRef.current) pcRef.current.close();
    } catch {}
    pcRef.current = null;

    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    } catch {}
    localStreamRef.current = null;

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  };

  const stopAll = () => {
    stopVision();
    stopRTC();
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
    }
    wsRef.current = null;
  };

  useEffect(() => {
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================
  // WebSocket 연결
  // =========================
  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname}:8080/ws/call/${roomId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data);

      if (msg.type === "ready") {
        await ensurePeerConnection();
        if (localStreamRef.current && pcRef.current) {
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          ws.send(JSON.stringify({ type: "offer", sdp: pcRef.current.localDescription }));
        }
        return;
      }

      if (msg.type === "offer") {
        await ensurePeerConnection();
        await pcRef.current.setRemoteDescription(msg.sdp);
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: "answer", sdp: pcRef.current.localDescription }));
        return;
      }

      if (msg.type === "answer") {
        await pcRef.current.setRemoteDescription(msg.sdp);
        return;
      }

      if (msg.type === "ice") {
        try {
          await pcRef.current.addIceCandidate(msg.candidate);
        } catch {}
        return;
      }

      if (msg.type === "count") {
        if (msg.count === 2) {
          ws.send(JSON.stringify({ type: "ready" }));
        }
      }
    };

    return () => {
      try {
        ws.close();
      } catch {}
    };
  }, [roomId]);

  const ensurePeerConnection = async () => {
    if (pcRef.current) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcRef.current = pc;

    pc.onicecandidate = (ev) => {
      if (!ev.candidate || !wsRef.current) return;
      wsRef.current.send(JSON.stringify({ type: "ice", candidate: ev.candidate }));
    };

    pc.ontrack = (ev) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = ev.streams[0];
      }
      startVisionOnRemote(); // remote 영상에서 손 추출 시작
    };

    await tryStartLocalCameraAndAttachTracks();
  };

  const tryStartLocalCameraAndAttachTracks = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      stream.getTracks().forEach((track) => pcRef.current.addTrack(track, stream));
    } catch {
      // 수신전용 허용
    }
  };

  // =========================
  // Hands on remote
  // =========================
  const startVisionOnRemote = async () => {
    if (handsRef.current) return;

    const videoEl = remoteVideoRef.current;
    if (!videoEl) return;

    // ready wait
    for (let i = 0; i < 40; i++) {
      if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    const hands = new Hands({
      locateFile: locateMP,
    });
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
      if (has) lastHandSeenAtRef.current = Date.now();
    });

    handsRef.current = hands;

    // mediapipe send
    captureTimerRef.current = setInterval(async () => {
      try {
        await hands.send({ image: videoEl });
      } catch {}
    }, CAPTURE_MS);

    // 버퍼 저장(손 없어도 ZERO 저장)
    saveTimerRef.current = setInterval(() => {
      const latest = latestHandsRef.current;
      const handsLm = latest?.handsLm ?? [];

      const W = videoEl.videoWidth || 1;
      const H = videoEl.videoHeight || 1;

      // ✅ x정렬로 좌/우 고정
      const handsWithX = handsLm
        .filter((lm) => Array.isArray(lm) && lm.length === 21)
        .map((lm) => {
          const avgX = lm.reduce((s, p) => s + (p?.x ?? 0), 0) / lm.length;
          return { lm, avgX };
        })
        .sort((a, b) => a.avgX - b.avgX);

      const handsFixed = [ZERO_HAND21, ZERO_HAND21]; // [Right, Left]

      if (handsWithX.length === 1) {
        handsFixed[0] = handsWithX[0].lm.map((p) => toPxHand(p, W, H));
      } else if (handsWithX.length >= 2) {
        const leftLm = handsWithX[0].lm;
        const rightLm = handsWithX[1].lm;
        handsFixed[1] = leftLm.map((p) => toPxHand(p, W, H));
        handsFixed[0] = rightLm.map((p) => toPxHand(p, W, H));
      }

      bufferRef.current.push({ t: Date.now(), hands: handsFixed });
      while (bufferRef.current.length > T) bufferRef.current.shift();
      setFrameCount(bufferRef.current.length);

      const now = Date.now();
      if (now - lastHandSeenAtRef.current > RECENT_HAND_MS) {
        resetStability();
      }
    }, SAVE_MS);

    // 번역 주기
    inferTimerRef.current = setInterval(async () => {
      if (translatingRef.current) return;

      const now = Date.now();
      if (now - lastHandSeenAtRef.current > RECENT_HAND_MS) {
        return; // 최근 손 없으면 번역 안 함
      }

      const frames = bufferRef.current.map((f) => ({ hands: f.hands }));
      if (frames.length < 10) return;

      translatingRef.current = true;
      try {
        const res = await axios.post("/api/translate", { frames, topk: 5 });

        const word = (res.data?.text ?? "").trim();
        const conf = Number(res.data?.confidence ?? 0);
        const candidates = Array.isArray(res.data?.candidates) ? res.data.candidates : [];

        setTop1Text(word || "(empty)");
        setTop1Conf(conf);
        setCands(
          candidates.slice(0, 5).map((pair) => ({
            label: String(pair?.[0] ?? ""),
            prob: Number(pair?.[1] ?? 0),
          }))
        );

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
          resetStability();
        }
      } catch {
        // ignore
      } finally {
        translatingRef.current = false;
      }
    }, INFER_MS);
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>CallRoom (Hand Only / Top-5)</h2>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div>Local</div>
          <video
            ref={localVideoRef}
            playsInline
            autoPlay
            muted
            style={{ width: "100%", background: "#111" }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div>
            Remote / 손감지:{" "}
            <b style={{ color: handDetected ? "lime" : "tomato" }}>
              {handDetected ? "ON" : "OFF"}
            </b>{" "}
            | 버퍼 프레임: <b>{frameCount}</b>
          </div>
          <video
            ref={remoteVideoRef}
            playsInline
            autoPlay
            style={{ width: "100%", background: "#111" }}
          />
        </div>
      </div>

      <hr />
      <div>
        <div>
          <b>Top-1:</b> {top1Text} <span style={{ color: "#666" }}>(conf={top1Conf.toFixed(3)})</span>
        </div>

        <div style={{ marginTop: 8 }}>
          <b>Top-5 후보</b>
          <div style={{ fontFamily: "monospace", fontSize: 12, marginTop: 6 }}>
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

        <div style={{ marginTop: 8 }}>
          <b>확정 문장:</b> {sentence || "(empty)"}
        </div>

        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => {
              setSentence("");
              lastCommittedRef.current = "";
              resetStability();
            }}
          >
            문장 초기화
          </button>{" "}
          <button onClick={stopVision}>비전 정지</button>{" "}
          <button onClick={stopAll}>전체 정지</button>
        </div>

        <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
          확정 규칙: conf ≥ {CONF_TH} 또는 Top-1 연속 {STABLE_N}회 / 최근 손 감지 {RECENT_HAND_MS}ms
        </div>
      </div>
    </div>
  );
}
