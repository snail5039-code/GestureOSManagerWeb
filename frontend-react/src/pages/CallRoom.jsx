import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Hands } from "@mediapipe/hands";
import { FaceMesh } from "@mediapipe/face_mesh";
import axios from "axios";

/**
 * ✅ 이 파일이 하는 일(초간단)
 * - WebSocket(WS) = "연결하자" 신호 전달(offer/answer/ice/ready/caption)
 * - WebRTC(PC)   = 실제 영상 연결(상대 영상 Remote로 출력)
 */
export default function CallRoom() {
  // ----------------------------
  // ✅ 추가(1): liveMeta + 번역로그 상태 (UI에서 사용)
  // ----------------------------
  const [liveMeta, setLiveMeta] = useState({
    mode: "init",     // init | remote | running | idle
    frames: 0,        // buffer 길이
    sendFrames: 0,    // 서버로 전송한 프레임 수
    conf: 0,          // confidence
    inFlight: false,  // 요청중 여부
    err: "",          // 에러 메시지
  });

  const [translationLogText, setTranslationLogText] = useState(""); // ✅ 추가(3)
  const translationEndRef = useRef(null);                   // ✅ 추가(3)

  // 번역 표시
  const [translatedText, setTranslatedText] = useState("번역 대기중...");

  const handsRef = useRef(null);
  const faceMeshRef = useRef(null);
  const latestLandmarksRef = useRef(null);
  const latestFaceLandmarksRef = useRef(null);
  const bufferRef = useRef([]);
  const captureTimerRef = useRef(null);
  const inferTimerRef = useRef(null);
  const translatingRef = useRef(false);
  const frameTimerRef = useRef(null);
  const stableWordRef = useRef("");
  const stableCountRef = useRef(0);
  const lastWordRef = useRef("");
  const [liveMeta, setLiveMeta] = useState({
    mode: "idle",
    frames: 0,
    sendFrames: 0,
    conf: 0,
    inFlight: false,
    err: "",
  });

  // ✅ 번역 확정 로그(채팅처럼 쌓는 용)
  const [translationLog, setTranslationLog] = useState([]);

  // ✅ 로그 자동 스크롤용
  const translationEndRef = useRef(null);

  // 선택 (디버그용)
  const [handDetected, setHandDetected] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);

  // 안정화/누적 로직(네 기존)
  const [resultText, setResultText] = useState("");
  const [lastWord, setLastWord] = useState("");
  const [stableWord, setStableWord] = useState("");
  const [stableCount, setStableCount] = useState(0);
  const [sentence, setSentence] = useState("");

  // URL 파라미터: /call/:roomId
  const { roomId } = useParams();

  // 화면에 붙일 <video> DOM 참조
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // 로컬 카메라 스트림 저장(있으면)
  const localStreamRef = useRef(null);

  // WebRTC 연결 객체(전화기) 저장
  const pcRef = useRef(null);

  // WebSocket(무전기) 저장
  const wsRef = useRef(null);

  // 화면에 상태 표시용(디버깅)
  const [wsStatus, setWsStatus] = useState("ws_init");
  const [mediaStatus, setMediaStatus] = useState("init");
  const [roomCount, setRoomCount] = useState(0);
  const faceReadyRef = useRef(false);

  // 캡션 테스트용
  const [lastWsMsg, setLastWsMsg] = useState("");
  const [sendText, setSendText] = useState("");
  const [recvCaption, setRecvCaption] = useState("");

  /**
   * ✅ React state는 ws.onmessage 안에서 "옛값(closure)"이 될 수 있음
   * 그래서 ws/pc 흐름 제어는 ref로 한다.
   */
  const wsOpenRef = useRef(false); // WS가 열렸는지
  const hasLocalMediaRef = useRef(false); // 카메라(송신 트랙) 있는지

  // ✅ ready/offer 중복 방지용
  const readySentRef = useRef(false);
  const readyReceivedRef = useRef(false);

  /**
   * offerLockedRef = "나는 더 이상 offer 만들면 안 됨"
   */
  const offerLockedRef = useRef(false);

  // ----------------------------
  // ✅ 샘플 프레임 제작 + 샘플 번역 버튼용
  // ----------------------------
  const makeSampleFrames = (n = 12) => {
    const makeHand21 = (dx = 0, dy = 0) =>
      Array.from({ length: 21 }, (_, i) => ({
        x: 0.3 + dx + i * 0.001,
        y: 0.4 + dy + i * 0.001,
        z: 0,
      }));

    const baseT = Date.now();

    return Array.from({ length: n }, (_, k) => ({
      t: baseT + k * 100,
      hands: [makeHand21(k * 0.002, 0), []],
      face: [],
    }));
  };

  const testTranslateSample = async () => {
    try {
      const frames = makeSampleFrames(12);

      setLiveMeta((m) => ({ ...m, inFlight: true, sendFrames: frames.length, err: "" }));

      const res = await axios.post(`/api/translate`, { frames });
      const word = res.data?.text ?? "(no text)";
      const conf = Number(res.data?.confidence ?? 0);

      setLiveMeta((m) => ({ ...m, inFlight: false, conf, mode: "running", err: "" }));
      setTranslatedText(`[SAMPLE] ${word} (conf=${conf.toFixed(2)})`);
    } catch (e) {
      console.error(e);
      setLiveMeta((m) => ({ ...m, inFlight: false, err: "sample fail" }));
      setTranslatedText("[SAMPLE] 요청 실패 (콘솔 확인)");
    }
  };

  // ----------------------------
  // ✅ stopVision (엔진/타이머 정리)
  // ----------------------------
  const stopVision = () => {
    if (captureTimerRef.current) clearInterval(captureTimerRef.current);
    if (frameTimerRef.current) clearInterval(frameTimerRef.current);
    if (inferTimerRef.current) clearInterval(inferTimerRef.current);

    captureTimerRef.current = null;
    frameTimerRef.current = null;
    inferTimerRef.current = null;

    if (handsRef.current) handsRef.current.close();
    if (faceMeshRef.current) faceMeshRef.current.close();

    handsRef.current = null;
    faceMeshRef.current = null;

    latestLandmarksRef.current = null;
    latestFaceLandmarksRef.current = null;
    bufferRef.current = [];

    translatingRef.current = false;

    stableWordRef.current = "";
    stableCountRef.current = 0;
    lastWordRef.current = "";

    setHandDetected(false);
    setFaceDetected(false);
  };

  useEffect(() => {
    return () => {
      stopVision();
    };
  }, []);

  // ----------------------------
  // ✅ Remote video에 대해 MediaPipe + 번역 파이프라인 시작
  // ----------------------------
  const startVisionOnRemote = async (videoEl) => {
    if (!videoEl) return;
    if (handsRef.current || faceMeshRef.current) return;

    const waitReady = async () => {
      for (let i = 0; i < 30; i++) {
        if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) return true;
        await new Promise((r) => setTimeout(r, 100));
      }
      return false;
    };

    const ok = await waitReady();
    if (!ok) return;

    // ✅ meta: remote 시작
    setLiveMeta((m) => ({ ...m, mode: "remote", frames: 0, sendFrames: 0, conf: 0, inFlight: false, err: "" }));

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

    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    faceMesh.onResults((results) => {
      const faces = results.multiFaceLandmarks ?? [];
      latestFaceLandmarksRef.current = faces;
      setFaceDetected(faces.length > 0);
    });

    handsRef.current = hands;
    faceMeshRef.current = faceMesh;

    // 10fps로 비디오 프레임 → 미디어파이프
    captureTimerRef.current = setInterval(async () => {
      try {
        if (!videoEl || videoEl.readyState < 2) return;
        await hands.send({ image: videoEl });
        await faceMesh.send({ image: videoEl });
      } catch (e) {
        // remote 끊기면 조용히 무시
      }
    }, 100);

    // 10fps로 최신 랜드마크를 frame으로 쌓기
    const T = 30;
    const pushFrame = () => {
      const latest = latestLandmarksRef.current;
      const faces = latestFaceLandmarksRef.current ?? [];
      const face0 = faces[0] ?? null;

      const face = face0 ? face0.map((p) => ({ x: p.x, y: p.y, z: p.z })) : [];

      const hasHands = (latest?.handsLm?.length ?? 0) > 0;
      if (!hasHands) return;

      const handsFixed = [[], []];
      const { handsLm, handed } = latest;

      for (let i = 0; i < handsLm.length; i++) {
        const label =
          handed?.[i]?.label ?? handed?.[i]?.classification?.[0]?.label ?? null;

        const idx = label === "Left" ? 1 : 0;
        handsFixed[idx] = handsLm[i].map((p) => ({ x: p.x, y: p.y, z: p.z }));
      }

      bufferRef.current.push({ t: Date.now(), hands: handsFixed, face });

      while (bufferRef.current.length > T) bufferRef.current.shift();

      // ✅ meta: frames 업데이트
      setLiveMeta((m) => ({ ...m, mode: "running", frames: bufferRef.current.length }));
    };

    frameTimerRef.current = setInterval(pushFrame, 100);

    // 0.4초마다 서버 번역 요청
    inferTimerRef.current = setInterval(async () => {
      if (translatingRef.current) return;
      if (bufferRef.current.length < 10) return;

      const framesForServer = bufferRef.current
        .filter((f) => f.hands?.some((h) => h?.length > 0))
        .map((f) => ({
          t: f.t,
          hands: (f.hands ?? [[], []]).map((hand) =>
            (hand ?? []).map((p) => ({ x: p.x, y: p.y, z: p.z }))
          ),
          face: (f.face ?? []).map((p) => ({ x: p.x, y: p.y, z: p.z })),
        }));

      if (framesForServer.length < 10) return;

      translatingRef.current = true;

      // ✅ meta: 요청 시작
      setLiveMeta((m) => ({
        ...m,
        inFlight: true,
        sendFrames: framesForServer.length,
        err: "",
      }));

      try {
        const res = await axios.post(`/api/translate`, { frames: framesForServer });
        const word = res.data?.text ?? "";
        const conf = Number(res.data?.confidence ?? 0);

        setResultText(word);

        // ✅ meta: 응답 반영
        setLiveMeta((m) => ({ ...m, inFlight: false, conf, err: "" }));

        // 안정화 로직(네 코드 유지)
        if (!word || word === "번역 실패" || conf < 0.2) {
          stableWordRef.current = "";
          stableCountRef.current = 0;
          lastWordRef.current = "";

          setStableWord("");
          setStableCount(0);
          setLastWord("");
          setTranslatedText("번역 대기중...");
          return;
        }

        if (word === stableWordRef.current) {
          const next = stableCountRef.current + 1;
          stableCountRef.current = next;
          setStableCount(next);

          if (next >= 2 && word !== lastWordRef.current) {
            lastWordRef.current = word;
            setLastWord(word);

            setSentence((prev) => (prev ? prev + " " + word : word));

            // ✅ 추가(4): 확정 단어 로그 누적
            const ts = Date.now();
            setTranslationLogText((prev) =>
              (prev ? prev + "\n" : "") + `${ts}|${word}|${conf}`
          );

            stableWordRef.current = "";
            stableCountRef.current = 0;

            setStableWord("");
            setStableCount(0);
          }
        } else {
          stableWordRef.current = word;
          stableCountRef.current = 1;

          setStableWord(word);
          setStableCount(1);
        }

        setTranslatedText(word);
      } catch (e) {
        setLiveMeta((m) => ({ ...m, inFlight: false, err: "translate fail" }));
      } finally {
        translatingRef.current = false;
        setLiveMeta((m) => ({ ...m, inFlight: false }));
      }
    }, 400);
  };

  // ✅ 로그 추가되면 스크롤 내리기
  useEffect(() => {
    translationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [translationLogText]);

  // ✅ roomId 바뀌면 상태 초기화
  useEffect(() => {
    setRoomCount(0);
    setRecvCaption("");
    setLastWsMsg("");

    readySentRef.current = false;
    readyReceivedRef.current = false;
    offerLockedRef.current = false;

    stopVision();
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    // ✅ meta 초기화
    setLiveMeta({
      mode: "init",
      frames: 0,
      sendFrames: 0,
      conf: 0,
      inFlight: false,
      err: "",
    });

    // ✅ 로그 초기화(원하면 유지 가능)
    setTranslationLogText("");
    setTranslatedText("번역 대기중...");
  }, [roomId]);

  /**
   * 1) 로컬 미디어 시작
   */
  useEffect(() => {
    let mounted = true;

    const startLocal = async () => {
      try {
        setMediaStatus("loading");

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("getUserMedia unsupported (need HTTPS or localhost)");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        hasLocalMediaRef.current = true;
        setMediaStatus("ready");

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          await localVideoRef.current.play().catch(() => {});
        }

        const pc = ensurePeerConnection();
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        maybeStartOffer();
      } catch (err) {
        console.warn("[MEDIA] recv-only mode:", err);
        hasLocalMediaRef.current = false;
        setMediaStatus("recv-only");
      }
    };

    startLocal();

    return () => {
      mounted = false;
      const s = localStreamRef.current;
      if (s) s.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
  }, []);

  /**
   * 2) WebSocket 연결
   */
  useEffect(() => {
    const WS_URL = `ws://${window.location.hostname}:8080/ws`;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      wsOpenRef.current = true;
      setWsStatus("ws_open");

      ensurePeerConnection();

      ws.send(JSON.stringify({ type: "join", roomId }));
      console.log("[WS] open -> join sent:", roomId);
    };

    ws.onmessage = async (e) => {
      const data = e.data;
      setLastWsMsg(data);

      let msg;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }

      if (msg.type === "room_info") {
        setRoomCount(msg.count);

        if (msg.count === 2 && !readySentRef.current) {
          readySentRef.current = true;
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: "ready" }));
          }
        }

        if (msg.count === 2) {
          maybeStartOffer();
        }
      }

      if (msg.type === "ready") {
        readyReceivedRef.current = true;
        maybeStartOffer();
      }

      if (msg.type === "caption") {
        const t = msg.text || "";
        if (!t) return;
        const ts = msg.ts ?? Date.now();
        setRecvCaption((prev) => (prev ? prev + "\n" : "") + `peer|${ts}|${t}`);
      }

      if (msg.type === "offer") {
        offerLockedRef.current = true;

        const pc = ensurePeerConnection();
        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: "offer", sdp: msg.sdp })
        );

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: "answer", sdp: answer.sdp }));
        }
      }

      if (msg.type === "answer") {
        const pc = ensurePeerConnection();
        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: "answer", sdp: msg.sdp })
        );
      }

      if (msg.type === "ice" && msg.candidate) {
        const pc = ensurePeerConnection();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch (err) {
          console.warn("[PC] ICE add failed:", err);
        }
      }
    };

    ws.onerror = (e) => {
      console.error("[WS] error", e);
      setWsStatus("ws_error");
    };

    ws.onclose = () => {
      wsOpenRef.current = false;
      setWsStatus("ws_closed");
    };

    return () => {
      try {
        ws.close();
      } catch {}
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [roomId]);

  /**
   * 캡션 보내기
   */
  const sendCaption = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) return;

    const now = Date.now();
    setRecvCaption((prev) => (prev ? prev + "\n" : "") + `me|${now}|${sendText}`);
    ws.send(JSON.stringify({ type: "caption", text: sendText }));
    setSendText("");
  };

  /**
   * ✅ offer 시작 조건
   */
  const maybeStartOffer = async () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) return;
    if (!wsOpenRef.current) return;
    if (offerLockedRef.current) return;
    if (!hasLocalMediaRef.current) return;

    offerLockedRef.current = true;
    await sendOffer();
  };

  const sendOffer = async () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) return;

    const pc = ensurePeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    ws.send(JSON.stringify({ type: "offer", sdp: offer.sdp }));
  };

  function ensurePeerConnection() {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const ws = wsRef.current;
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "ice", candidate: e.candidate }));
      }
    };

    pc.ontrack = (e) => {
      const v = remoteVideoRef.current;
      const stream = e.streams && e.streams[0] ? e.streams[0] : null;

      if (v && stream) {
        v.srcObject = stream;
        v.play().catch(() => {});
        startVisionOnRemote(v);
      }
    };

    pcRef.current = pc;
    return pc;
  }

  const leaveRoom = () => {
    window.history.back();
  };

  // UI
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto max-w-6xl px-6 pt-8 pb-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500">영상통화 방</div>
            <div className="text-sm hidden text-slate-600">media: {mediaStatus}</div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{roomId}</h1>
            <div className="mt-1 text-sm text-slate-600">
              상태: <span className="font-semibold">{wsStatus}</span>
              <span className="mx-2 text-slate-300">|</span>
              <span className="text-slate-500">상대 연결되면 화면 표시</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setRecvCaption("")}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              채팅 비우기
            </button>

            <button
              onClick={testTranslateSample}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              샘플 번역 테스트
            </button>

            <button
              onClick={leaveRoom}
              className="rounded-xl border border-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              나가기
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-10">
        <div className="flex gap-6">
          <section className="flex-1">
            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">상대방</span>
                <span className="text-xs text-slate-500">Remote</span>
              </div>

              <div className="p-4 min-h-[120px]">
                {/* ✅ meta 표시(에러 안 남) */}
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full border px-2 py-1">
                    mode: <b>{liveMeta.mode}</b>
                  </span>
                  <span className="rounded-full border px-2 py-1">
                    frames: <b>{liveMeta.frames}</b>
                  </span>
                  <span className="rounded-full border px-2 py-1">
                    send: <b>{liveMeta.sendFrames}</b>
                  </span>
                  <span className="rounded-full border px-2 py-1">
                    hand: <b>{handDetected ? "✅" : "❌"}</b>
                  </span>
                  <span className="rounded-full border px-2 py-1">
                    face: <b>{faceDetected ? "✅" : "❌"}</b>
                  </span>
                  <span className="rounded-full border px-2 py-1">
                    conf: <b>{Number(liveMeta.conf ?? 0).toFixed(2)}</b>
                  </span>
                  <span
                    className={`rounded-full border px-2 py-1 ${liveMeta.inFlight ? "bg-yellow-50" : ""
                      }`}
                  >
                    inFlight: <b>{liveMeta.inFlight ? "ON" : "OFF"}</b>
                  </span>
                  {liveMeta.err && (
                    <span className="rounded-full border px-2 py-1 bg-red-50">
                      err: <b>{liveMeta.err}</b>
                    </span>
                  )}
                </div>
              </div>

              <div className="aspect-video bg-black">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">
                  실시간 수어 번역
                </span>
                <span className="text-xs text-slate-500">Live</span>
              </div>

              <div className="p-4">
                <div className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-900">
                  {translatedText}
                </div>
                <div className="h-[180px] overflow-auto rounded-lg border bg-white p-3">
  {!translationLogText ? (
    <div className="text-sm text-slate-400">확정된 단어가 아직 없어요.</div>
  ) : (
    <ul className="space-y-2">
      {translationLogText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((line, i) => {
          const parts = line.split("|");
          const tsStr = parts[0];
          const confStr = parts[parts.length - 1];
          const text = parts.slice(1, -1).join("|"); // ✅ 혹시 단어에 | 들어가도 안전

          const ts = Number(tsStr);
          const conf = Number(confStr);

          const time = Number.isFinite(ts)
            ? new Date(ts).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
            : "";

          return (
            <li key={tsStr + "-" + i} className="rounded-xl bg-slate-100 px-3 py-2">
              <div className="flex items-end justify-between gap-3">
                <span className="text-sm text-slate-900">{text}</span>
                <span className="text-xs text-slate-500">
                  {time}
                  {Number.isFinite(conf) ? ` (${conf.toFixed(2)})` : ""}
                </span>
              </div>
            </li>
          );
        })}
    </ul>
  )}
  <div ref={translationEndRef} />
</div>

          
              </div>
            </section>
          </section>

          <aside className="w-[340px] flex flex-col gap-6">
            <section className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">내 화면</span>
                <span className="text-xs text-slate-500">Local</span>
              </div>

              <div className="aspect-video bg-black">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 overflow-hidden flex flex-col h-[420px]">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">채팅</span>
                <span className="text-xs text-slate-500">Caption</span>
              </div>

              <div className="flex-1 overflow-auto px-3 py-3">
                <ul className="space-y-2">
                  {(recvCaption || "")
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((line, i) => {
                      const [who, tsStr, ...rest] = line.split("|");
                      const text = rest.join("|");
                      const ts = Number(tsStr);
                      const time = Number.isFinite(ts)
                        ? new Date(ts).toLocaleTimeString("ko-KR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                        : "";

                      const isMe = who === "me";

                      return (
                        <li
                          key={i}
                          className={[
                            "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                            isMe
                              ? "ml-auto bg-slate-900 text-white"
                              : "mr-auto bg-slate-100 text-slate-900",
                          ].join(" ")}
                        >
                          <div className="flex items-end justify-between gap-3">
                            <span>{text}</span>
                            {time && (
                              <span
                                className={
                                  isMe
                                    ? "text-xs text-white/70"
                                    : "text-xs text-slate-500"
                                }
                              >
                                {time}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                </ul>
              </div>

              <div className="border-t border-slate-200 p-3">
                <div className="flex gap-2">
                  <input
                    value={sendText}
                    onChange={(e) => setSendText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendCaption()}
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="메시지 입력..."
                  />
                  <button
                    onClick={sendCaption}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 active:scale-[0.99]"
                  >
                    전송
                  </button>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
