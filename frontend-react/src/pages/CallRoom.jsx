import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Hands } from "@mediapipe/hands";
import axios from "axios";

const T = 30;
const ZERO_HAND = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));

const toPxHand = (p, W, H) => ({
  x: (p?.x ?? 0) * W,
  y: (p?.y ?? 0) * H,
  z: 0,
});

// ✅ 확정 조건
const CONF_TH = 0.60;
const STABLE_N = 2;

export default function CallRoom() {
  const { roomId } = useParams();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  const handsRef = useRef(null);
  const latestLandmarksRef = useRef(null);

  const bufferRef = useRef([]);
  const captureTimerRef = useRef(null);
  const frameTimerRef = useRef(null);
  const inferTimerRef = useRef(null);

  const translatingRef = useRef(false);

  // 안정화용
  const stableWordRef = useRef("");
  const stableCountRef = useRef(0);
  const lastCommittedRef = useRef("");

  const [handDetected, setHandDetected] = useState(false);
  const [translatedText, setTranslatedText] = useState("번역 대기중...");
  const [cands, setCands] = useState([]); // [{label,prob,text}]
  const [sentence, setSentence] = useState("");

  const stopVision = () => {
    if (captureTimerRef.current) clearInterval(captureTimerRef.current);
    if (frameTimerRef.current) clearInterval(frameTimerRef.current);
    if (inferTimerRef.current) clearInterval(inferTimerRef.current);
    captureTimerRef.current = null;
    frameTimerRef.current = null;
    inferTimerRef.current = null;

    if (handsRef.current) handsRef.current.close();
    handsRef.current = null;

    latestLandmarksRef.current = null;
    bufferRef.current = [];

    translatingRef.current = false;
    stableWordRef.current = "";
    stableCountRef.current = 0;
    lastCommittedRef.current = "";

    setHandDetected(false);
    setTranslatedText("번역 대기중...");
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
      startVisionOnRemote();
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
    for (let i = 0; i < 30; i++) {
      if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    hands.onResults((results) => {
      const handsLm = results.multiHandLandmarks ?? [];
      const handed = results.multiHandedness ?? [];
      latestLandmarksRef.current = { handsLm, handed };
      setHandDetected(handsLm.length > 0);
    });
    handsRef.current = hands;

    captureTimerRef.current = setInterval(async () => {
      try {
        await hands.send({ image: videoEl });
      } catch {}
    }, 100);

    // 10fps buffer
    frameTimerRef.current = setInterval(() => {
      const latest = latestLandmarksRef.current;
      const hasHands = (latest?.handsLm?.length ?? 0) > 0;
      if (!hasHands) return;

      const W = videoEl.videoWidth || 1;
      const H = videoEl.videoHeight || 1;

      const handsFixed = [ZERO_HAND, ZERO_HAND];
      const handsLm = latest?.handsLm ?? [];
      const handed = latest?.handed ?? [];

      for (let i = 0; i < handsLm.length; i++) {
        const label = handed?.[i]?.label ?? handed?.[i]?.classification?.[0]?.label ?? null;
        const slot = label === "Left" ? 1 : 0;
        const lm = handsLm[i];
        if (Array.isArray(lm) && lm.length === 21) {
          handsFixed[slot] = lm.map((p) => toPxHand(p, W, H));
        }
      }

      bufferRef.current.push({ t: Date.now(), hands: handsFixed });
      while (bufferRef.current.length > T) bufferRef.current.shift();
    }, 100);

    // infer 0.4s
    inferTimerRef.current = setInterval(async () => {
      if (translatingRef.current) return;
      if (!bufferRef.current.length) return;

      const framesForServer = bufferRef.current
        .filter((f) => f.hands?.some((h) => (h?.length ?? 0) > 0))
        .map((f) => ({
          hands: (f.hands ?? [[], []]).map((hand) =>
            Array.isArray(hand) && hand.length === 21 ? hand : ZERO_HAND
          ),
        }));

      if (framesForServer.length < 10) return;

      translatingRef.current = true;
      try {
        // ✅ python이 candidates를 내려주면 spring도 그대로 넘기도록(혹은 직접 python 호출)
        const res = await axios.post(`/api/translate`, { frames: framesForServer, topk: 5 });

        const word = (res.data?.text ?? "").trim();
        const conf = Number(res.data?.confidence ?? 0);
        const candidates = Array.isArray(res.data?.candidates) ? res.data.candidates : [];

        // 후보 UI용
        const candView = candidates.slice(0, 5).map(([lab, p]) => ({
          label: lab,
          prob: Number(p ?? 0),
          text: lab, // label_to_text가 spring에서 text로 매핑되면 여기 확장 가능
        }));
        setCands(candView);

        if (!word) {
          setTranslatedText("...");
          stableWordRef.current = "";
          stableCountRef.current = 0;
          return;
        }

        setTranslatedText(`${word} (conf=${conf.toFixed(2)})`);

        // ✅ Top-1 확정 조건: conf 충분 OR 연속 STABLE_N
        if (stableWordRef.current === word) stableCountRef.current += 1;
        else {
          stableWordRef.current = word;
          stableCountRef.current = 1;
        }

        const stableOk = stableCountRef.current >= STABLE_N;
        const confOk = conf >= CONF_TH;

        if ((confOk || stableOk) && word !== lastCommittedRef.current) {
          lastCommittedRef.current = word;
          setSentence((prev) => (prev ? prev + " " + word : word));
          stableWordRef.current = "";
          stableCountRef.current = 0;
        }
      } catch (e) {
        console.log("[translate error]", e);
      } finally {
        translatingRef.current = false;
      }
    }, 400);
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>CallRoom (Top-5)</h2>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div>Local</div>
          <video ref={localVideoRef} playsInline autoPlay muted style={{ width: "100%", background: "#111" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div>
            Remote / 손감지:{" "}
            <b style={{ color: handDetected ? "lime" : "tomato" }}>{handDetected ? "ON" : "OFF"}</b>
          </div>
          <video ref={remoteVideoRef} playsInline autoPlay style={{ width: "100%", background: "#111" }} />
        </div>
      </div>

      <hr />
      <div>
        <div><b>Top-1:</b> {translatedText}</div>
        <div style={{ marginTop: 8 }}>
          <b>Top-5 후보</b>
          <div style={{ fontFamily: "monospace", fontSize: 12, marginTop: 6 }}>
            {cands.length === 0 ? "(none)" : cands.map((c, i) => (
              <div key={i}>{i + 1}. {c.label} ({c.prob.toFixed(3)})</div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 8 }}><b>확정 문장:</b> {sentence}</div>

        <div style={{ marginTop: 10 }}>
          <button onClick={() => setSentence("")}>문장 초기화</button>{" "}
          <button onClick={stopVision}>비전 정지</button>{" "}
          <button onClick={stopAll}>전체 정지</button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
          확정 규칙: conf ≥ {CONF_TH} 또는 Top-1 연속 {STABLE_N}회
        </div>
      </div>
    </div>
  );
}
