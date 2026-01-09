import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Hands } from "@mediapipe/hands";
import { FaceMesh } from "@mediapipe/face_mesh";
import axios from "axios";

/**
 * ✅ 이 파일이 하는 일(초간단)
 * - WebSocket(WS) = "연결하자" 신호 전달(offer/answer/ice/ready/caption)
 * - WebRTC(PC)   = 실제 영상 연결(상대 영상 Remote로 출력)
 *
 * ✅ 목표
 * - A(카메라 있음): 방에 2명 되면 offer 생성 → 전송
 * - B(카메라 없음/권한없음): offer 받으면 answer 생성 → 전송 → remote 재생
 * - ICE는 candidate를 "통째로" 주고받음 (깨질 확률 ↓)
 * - WS 주소는 window.location.hostname 사용 (PC 2대 테스트 OK)
 * - ready는 카메라 유무 상관없이 count==2면 무조건 보냄 (수신 전용도 참여 가능)
 */
export default function CallRoom() {

  // 임시 샘플 프레임 제작
  const makeSampleFrames = (n = 12) => {
    // mediapipe 손 랜드마크는 21개라 가정 (일반적으로 21)
    const makeHand21 = (dx = 0, dy = 0) =>
      Array.from({ length: 21 }, (_, i) => ({
        x: 0.3 + dx + i * 0.001,
        y: 0.4 + dy + i * 0.001,
        z: 0,
      }));

    const baseT = Date.now();

    return Array.from({ length: n }, (_, k) => ({
      t: baseT + k * 100,
      hands: [
        makeHand21(k * 0.002, 0), // 0번(Left로 쓰든 Right로 쓰든) 랜덤 이동
        [],                       // 다른 손은 비움
      ],
      face: [], // face는 일단 빈 배열로 테스트
    }));
  };

  // 테스트용 번역 샘플
  const testTranslateSample = async () => {
    try {
      const frames = makeSampleFrames(12);
      const res = await axios.post(`/api/translate`, { frames });
      const word = res.data?.text ?? "(no text)";
      const conf = Number(res.data?.confidence ?? 0);
      setTranslatedText(`[SAMPLE] ${word} (conf=${conf.toFixed(2)})`);
    } catch (e) {
      console.error(e);
      setTranslatedText("[SAMPLE] 요청 실패 (콘솔 확인)");
    }
  };
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

  // 안정화/누적 로직
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
  // ✅ 이거 저장 안 하면 나중에 send() 할 때 "무전기 어디감?" 상태가 돼서 망함
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
  const readySentRef = useRef(false); // 내가 ready 보냈는지
  const readyReceivedRef = useRef(false); // 서버에서 ready를 받았는지(참고용)

  /**
   * offerLockedRef = "나는 더 이상 offer 만들면 안 됨"
   * - 내가 offer를 이미 보냈으면 다시 보내면 안 됨
   * - 또는 내가 offer를 받은 쪽(answerer)이 되면 offer 만들면 충돌(glare) 발생
   */
  const offerLockedRef = useRef(false);

  const stopVision = () => {
    // 타이머 클리어
    if (captureTimerRef.current) clearInterval(captureTimerRef.current);  // remote 영상 프레임을 미디어파이프에 넣는 루프
    if (frameTimerRef.current) clearInterval(frameTimerRef.current);   // latestLandmarks를 bufferRef에 프레임으로 쌓는 루프
    if (inferTimerRef.current) clearInterval(inferTimerRef.current);    // 버퍼 모아서 요청 보내는 루프 (0.4)초마다

    // 레퍼넌스 비워줘서 "현재 실행중이 아님" 상태로 만듦
    captureTimerRef.current = null;
    frameTimerRef.current = null;
    inferTimerRef.current = null;

    // 미디어파이프 엔진 종료
    if (handsRef.current) handsRef.current.close();
    if (faceMeshRef.current) faceMeshRef.current.close();

    handsRef.current = null;
    faceMeshRef.current = null;

    // 최신 인식 결과/버퍼 초기화
    latestLandmarksRef.current = null;
    latestFaceLandmarksRef.current = null;
    bufferRef.current = [];

    translatingRef.current = false;  // 번역 요청 중복방지 락 풀기

    // 안정화 (같은 단어 연속 감지같은) 상태 초기화
    stableWordRef.current = "";
    stableCountRef.current = 0;
    lastWordRef.current = "";
  };

  useEffect(() => {
    return () => {
      stopVision();
    };
  }, []); // 

  const startVisionOnRemote = async (videoEl) => {
    if (!videoEl) return;  // 비디오 없으면 종료

    // 이미 돌고 있으면 중복 시작 방지
    if (handsRef.current || faceMeshRef.current) return;

    // remote video가 재생 가능 상태 될 때까지 살짝 기다리기
    const waitReady = async () => {
      for (let i = 0; i < 30; i++) {
        if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) return true;
        await new Promise((r) => setTimeout(r, 100));
      }
      return false;
    };
    const ok = await waitReady();
    if (!ok) return;

    // 미디어파이프 엔진 2개 만든다
    // 손쪽 엔진 생성 + 옵션 + 결과 콜백
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

    // 페이스메시도 동일하게!
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

    // 타이머 3개로 실시간 파이프라인 돌릴거임
    // 10fps로 비디오 프레임 미디어파이프에 넣음
    captureTimerRef.current = setInterval(async () => {
      try {
        if (!videoEl || videoEl.readyState < 2) return;
        await hands.send({ image: videoEl });
        await faceMesh.send({ image: videoEl });
      } catch (e) {
        // remote stream 끊기면 여기서 에러날 수 있음
        // 너무 시끄럽게 안 찍고 조용히 무시
      }
    }, 100);

    // 10fps로 "최신 랜드마크"를 frame으로 쌓기 (손 없으면 skip) ======
    const T = 30; // 최근 30프레임만 유지 (3초)
    const fps = 10;

    const pushFrame = () => {
      const latest = latestLandmarksRef.current;
      const faces = latestFaceLandmarksRef.current ?? [];
      const face0 = faces[0] ?? null;

      const face = face0 ? face0.map((p) => ({ x: p.x, y: p.y, z: p.z })) : [];

      const hasHands = (latest?.handsLm?.length ?? 0) > 0;
      if (!hasHands) return;

      // 항상 [Left, Right] 순서 고정 (Camera랑 동일)
      const handsFixed = [[], []]; // 0: Left, 1: Right (네 코드 기준으로 맞춤)

      const { handsLm, handed } = latest;

      for (let i = 0; i < handsLm.length; i++) {
        const label =
          handed?.[i]?.label ?? handed?.[i]?.classification?.[0]?.label ?? null;

        // 여기서 Left/Right 뒤집는 건 Camera 코드와 동일하게 유지
        // 만약 번역이 좌우 때문에 계속 틀리면 이 줄만 바꿔보면 됨
        const idx = label === "Left" ? 1 : 0;

        handsFixed[idx] = handsLm[i].map((p) => ({ x: p.x, y: p.y, z: p.z }));
      }

      bufferRef.current.push({ t: Date.now(), hands: handsFixed, face });

      // rolling window 유지
      while (bufferRef.current.length > T) bufferRef.current.shift();
    };

    // 10fps로 최신 랜드마크 버퍼에 쌓음
    frameTimerRef.current = setInterval(pushFrame, 100);

    // // stopVision에서 같이 정리되도록 합쳐두기
    // const oldStop = stopVision;
    // stopVision = () => {
    //   clearInterval(frameTimer);
    //   oldStop();
    // };

    // 0.4초마다 서버 번역 요청
    inferTimerRef.current = setInterval(async () => {
      if (translatingRef.current) return;
      if (bufferRef.current.length < 10) return; // 최소 프레임

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
      try {
        const res = await axios.post(`/api/translate`, { frames: framesForServer });
        const word = res.data?.text ?? "";
        const conf = Number(res.data?.confidence ?? 0);

        setResultText(word);

        // Camera 안정화 로직 그대로
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

        // 안정화
        if (word === stableWordRef.current) {
          const next = stableCountRef.current + 1;  // 안정화 카운트 계산
          stableCountRef.current = next;
          setStableCount(next);

          if (next >= 2 && word !== lastWordRef.current) {
            lastWordRef.current = word;
            setLastWord(word);

            setSentence((prev) => (prev ? prev + " " + word : word));
            setTranslationLog((prev) => [
              ...prev,
              { ts: Date.now(), text: word, conf },
            ]);

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
        // 서버 끊기면 무시
      } finally {
        translatingRef.current = false;
      }
    }, 400);
  };


  // ✅ roomId가 바뀌면(다른 방 들어가면) 상태 초기화
  useEffect(() => {
    setRoomCount(0);
    setRecvCaption("");
    setLastWsMsg("");

    readySentRef.current = false;
    readyReceivedRef.current = false;
    offerLockedRef.current = false;

    stopVision();
    // remote 화면 초기화(이전 방 영상 잔상 제거)
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, [roomId]);

  /**
   * 1) 로컬 미디어 시작
   * - 카메라 있으면 local에 붙이고, WebRTC(pc)에 트랙 추가
   * - 카메라 없거나 권한 막히면 recv-only(수신 전용)로 둔다
   */
  useEffect(() => {
    let mounted = true;

    const startLocal = async () => {
      try {
        setMediaStatus("loading");

        // 브라우저 정책상 http+IP 접속이면 getUserMedia가 막히는 경우가 있음
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("getUserMedia unsupported (need HTTPS or localhost)");
        }

        // 카메라/마이크 요청
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false, // 지금은 음성 안 씀
        });

        // 컴포넌트 unmount 된 뒤면 카메라 트랙 정리
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // 로컬 스트림 저장
        localStreamRef.current = stream;
        hasLocalMediaRef.current = true;
        setMediaStatus("ready");

        // local video에 내 카메라 영상 출력
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          await localVideoRef.current.play().catch(() => { });
        }

        // ✅ WebRTC PC 만들고(전화기) 로컬 트랙을 PC에 꽂아줌(내 영상 송신 준비)
        const pc = ensurePeerConnection();
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        console.log(
          "[MEDIA] local tracks added:",
          stream.getTracks().map((t) => t.kind)
        );

        // 혹시 이미 상대가 준비돼서 offer를 보내야 하는 상황이면 시도
        maybeStartOffer();
      } catch (err) {
        // 카메라가 없거나 권한 막혔으면 "수신 전용"
        console.warn("[MEDIA] recv-only mode:", err);
        hasLocalMediaRef.current = false;
        setMediaStatus("recv-only");
        // ✅ 카메라 없어도 상대 영상(REMOTE) 받는 건 가능
      }
    };

    startLocal();

    // 정리
    return () => {
      mounted = false;
      const s = localStreamRef.current;
      if (s) s.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
  }, []);

  /**
   * 2) WebSocket 연결
   * - offer/answer/ice/ready/caption 같은 "신호"는 WS로 주고받는다
   * - 실제 영상은 WebRTC(pc)가 처리
   */
  useEffect(() => {
    // ✅ 2대 테스트: B에서 접속해도 hostname이 A_IP가 되므로 ws://A_IP:8080/ws로 자동 연결
    const WS_URL = `ws://${window.location.hostname}:8080/ws`;
    const ws = new WebSocket(WS_URL);

    // ✅ 핵심: wsRef에 저장(나중에 sendCaption, ICE 전송 등에서 wsRef.current 사용)
    wsRef.current = ws;

    ws.onopen = () => {
      wsOpenRef.current = true;
      setWsStatus("ws_open");

      // ✅ 카메라 없어도 offer를 "받고" answer를 만들려면 PC는 반드시 있어야 함
      ensurePeerConnection();

      // 서버에 방 참가 알림
      ws.send(JSON.stringify({ type: "join", roomId }));
      console.log("[WS] open -> join sent:", roomId);
    };

    // 서버에서 오는 메시지 처리
    ws.onmessage = async (e) => {
      const data = e.data;
      setLastWsMsg(data);
      console.log("[WS] recv raw:", data);

      let msg;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }

      /**
       * room_info: 방 인원수
       * - count==2면 서로 연결 시작 가능
       */
      if (msg.type === "room_info") {
        setRoomCount(msg.count);

        // ✅ count==2 되면 "나 준비됨" 신호(ready)를 무조건 보낸다
        //    (카메라 없어도 수신 전용으로 참여하려면 ready는 보내야 함)
        if (msg.count === 2 && !readySentRef.current) {
          readySentRef.current = true;
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: "ready" }));
            console.log("[WS] ready sent");
          }
        }

        // ✅ 카메라 있는 쪽(A)은 count==2 시점에 offer 시도
        //    서버가 ready 브로드캐스트를 실수로 안 하더라도 붙게끔 보험
        if (msg.count === 2) {
          maybeStartOffer();
        }
      }

      /**
       * ready: 서버가 "상대도 준비됐어"라고 알려주는 신호(서버 구현에 따라 다름)
       * - 받으면 offer 시도(카메라 있는 쪽만)
       */
      if (msg.type === "ready") {
        readyReceivedRef.current = true;
        console.log("[WS] ready received");
        maybeStartOffer();
      }

      // caption: 채팅처럼 테스트하는 데이터
      if (msg.type === "caption") {
        const t = msg.text || "";
        if (!t) return;

        const ts = msg.ts ?? Date.now();
        setRecvCaption((prev) => (prev ? prev + "\n" : "") + `peer|${ts}|${t}`);
        console.log("[WS] caption received:", msg.text);
      }

      /**
       * offer: 상대가 보낸 "연결 계약서"
       * - 받은 쪽은 answer를 만들어 돌려줘야 함
       */
      if (msg.type === "offer") {
        console.log("[WS] got offer");

        // ✅ 나는 이제 answerer(받는 쪽) 확정 → 절대 offer 만들면 안 됨(충돌 방지)
        offerLockedRef.current = true;

        const pc = ensurePeerConnection();

        // 상대 offer를 pc에 세팅(상대가 어떤 트랙/코덱으로 보낼지 정보)
        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: "offer", sdp: msg.sdp })
        );

        // answer 만들기(수락 계약서)
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // 서버 통해 상대에게 answer 전달
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: "answer", sdp: answer.sdp }));
          console.log("[WS] answer sent");
        }
      }

      /**
       * answer: 내가 보낸 offer에 대한 상대의 수락 계약서
       * - 받으면 pc에 세팅해서 계약 완성
       */
      if (msg.type === "answer") {
        console.log("[WS] got answer");
        const pc = ensurePeerConnection();
        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: "answer", sdp: msg.sdp })
        );
      }

      /**
       * ice: "연결할 수 있는 길(주소/포트) 후보" = candidate
       * - 이걸 주고받아야 실제로 영상 통로가 뚫림
       */
      if (msg.type === "ice" && msg.candidate) {
        const pc = ensurePeerConnection();
        try {
          // ✅ 통째로 받은 candidate를 WebRTC 형식으로 복원해서 추가
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          console.log("[PC] ICE added");
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
      console.warn("[WS] closed");
    };

    // 정리
    return () => {
      try {
        ws.close();
      } catch { }
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [roomId]);

  /**
   * 캡션 보내기(WS 테스트)
   * - wsRef.current로 send 하는 이유: onopen 밖에서도 어디서든 보내려고
   */
  const sendCaption = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) {
      console.warn("[WS] caption blocked: ws not open");
      return;
    }
    const now = Date.now();
    setRecvCaption(
      (prev) => (prev ? prev + "\n" : "") + `me|${now}|${sendText}`
    );
    ws.send(JSON.stringify({ type: "caption", text: sendText }));
    setSendText("");
    console.log("[WS] caption sent:", sendText);
  };

  /**
   * ✅ offer 시작 조건(핵심)
   * - WS 연결되어 있고
   * - 아직 offer를 만들면 안 되는 상태가 아니고
   * - "카메라 있는 쪽만" offer를 만든다 (송신자 1명만)
   */
  const maybeStartOffer = async () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) return; // WS 아직이면 못 보냄
    if (!wsOpenRef.current) return; // open 체크
    if (offerLockedRef.current) return; // 이미 offer 보냈거나, offer 받은 answerer면 금지

    // ✅ 카메라(송신 트랙) 있는 쪽만 offer 생성
    if (!hasLocalMediaRef.current) return;

    // 이제부터 나는 offerer 확정(중복 생성 방지)
    offerLockedRef.current = true;
    await sendOffer();
  };

  /**
   * offer 생성 → pc에 세팅 → WS로 상대에게 전송
   */
  const sendOffer = async () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) return;

    const pc = ensurePeerConnection();

    // 연결 제안서(offer) 만들고 로컬로 세팅
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // 상대에게 offer 전송
    ws.send(JSON.stringify({ type: "offer", sdp: offer.sdp }));
    console.log("[PC] offer sent");
  };

  /**
   * WebRTC PeerConnection 생성(없으면 새로 만들고 있으면 재사용)
   * - 여기서 ICE 후보 전송(onicecandidate)
   * - 여기서 상대 트랙 수신(ontrack)
   */
  function ensurePeerConnection() {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection({
      // STUN 서버: 서로 NAT 환경에서도 연결 경로를 찾게 도와줌(기본)
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    console.log("[PC] created");

    /**
     * ICE candidate가 생길 때마다 상대에게 보내야 함
     * - 이게 "통로(길)" 뚫는 정보
     * - ✅ 통째로 보내면(객체 그대로) 깨질 확률이 낮음
     */
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const ws = wsRef.current;
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "ice", candidate: e.candidate }));
        console.log("[WS] ICE sent");
      }
    };

    /**
     * 상대 트랙(영상)이 도착했을 때
     * - remoteVideoRef에 붙여주면 화면에 뜸
     */
    pc.ontrack = (e) => {
      console.log("[PC] ontrack remote arrived", e.streams);

      const v = remoteVideoRef.current;
      const stream = e.streams && e.streams[0] ? e.streams[0] : null;

      if (v && stream) {
        v.srcObject = stream;
        v.play().catch(() => { });

        startVisionOnRemote(v); // 추가!
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("[PC] connectionState:", pc.connectionState);
    };

    pcRef.current = pc;
    return pc;
  }

  const leaveRoom = () => {
    // 그냥 홈으로 보내기 (네 라우트에 맞게 바꿔)
    window.history.back();
  };

  // UI
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* 상단 헤더 */}
      <header className="h-20 bg-white/90 backdrop-blur-xl border-b border-slate-200/50 px-8 flex items-center justify-between z-40">
        <div className="flex items-center gap-4">
          <button onClick={leaveRoom} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">영상통화</h1>
          <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black border border-indigo-100">
            ROOM: {roomId}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-black uppercase tracking-widest">{wsStatus}</span>
          </div>
          <button
            onClick={testTranslateSample}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-sm font-black hover:bg-slate-50 transition-all shadow-sm"
          >
            샘플 테스트
          </button>
          <button
            onClick={leaveRoom}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-slate-800 transition-all shadow-lg active:scale-95"
          >
            통화 종료
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* 왼쪽: 메인 영상 및 번역 로그 */}
        <main className="flex-1 p-8 flex flex-col gap-8 overflow-y-auto">
          {/* 영상 영역 */}
          <div className="relative flex-1 glass rounded-[3rem] overflow-hidden border-slate-100 shadow-2xl">
            {/* 상대방 화면 (Full) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover bg-slate-900"
            />

            {/* 내 화면 (PIP) */}
            <div className="absolute bottom-8 right-8 w-72 aspect-video glass rounded-3xl overflow-hidden border-2 border-white/50 shadow-2xl animate-fade-in">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover bg-slate-800"
              />
              <div className="absolute top-3 left-3 px-2 py-1 bg-black/40 backdrop-blur-md rounded-lg text-[10px] font-black text-white uppercase tracking-widest">
                ME
              </div>
            </div>

            {/* 상태 오버레이 */}
            <div className="absolute top-8 left-8 flex flex-col gap-2">
              <div className="glass px-4 py-2 rounded-2xl flex items-center gap-3 border-white/30">
                <div className={`w-2 h-2 rounded-full ${handDetected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                <span className="text-xs font-black text-slate-700">HAND DETECTION</span>
              </div>
              <div className="glass px-4 py-2 rounded-2xl flex items-center gap-3 border-white/30">
                <div className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                <span className="text-xs font-black text-slate-700">FACE MESH</span>
              </div>
            </div>
          </div>

          {/* 수어 번역 로그 영역 */}
          <section className="h-64 glass rounded-[2.5rem] p-8 flex flex-col border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                수어 번역
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] font-black rounded-full uppercase tracking-widest">REAL-TIME</span>
              </h2>
              <button
                onClick={() => setTranslationLog([])}
                className="text-xs font-black text-slate-400 hover:text-indigo-600 transition-colors"
              >
                로그 비우기
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
              {translationLog.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-300 font-bold italic">
                  번역된 단어가 여기에 표시됩니다...
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {translationLog.map((m, i) => (
                    <div
                      key={m.ts + "-" + i}
                      className="px-5 py-3 bg-white border border-slate-100 rounded-2xl shadow-sm animate-scale-in flex items-center gap-3"
                    >
                      <span className="text-base font-black text-slate-700">{m.text}</span>
                      <span className="text-[10px] font-black text-slate-300">
                        {new Date(m.ts).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                  <div ref={translationEndRef} />
                </div>
              )}
            </div>
          </section>
        </main>

        {/* 오른쪽: 실시간 채팅 사이드바 */}
        <aside className="w-[400px] bg-white border-l border-slate-200 flex flex-col">
          <div className="p-8 border-b border-slate-100">
            <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center justify-between">
              실시간 채팅
              <span className="text-[10px] font-black bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">LIVE</span>
            </h2>
          </div>

          {/* 채팅 메시지 리스트 */}
          <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
            {(recvCaption || "")
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
              .map((line, i) => {
                const [who, tsStr, ...rest] = line.split("|");
                const text = rest.join("|");
                const ts = Number(tsStr);
                const time = Number.isFinite(ts)
                  ? new Date(ts).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
                  : "";
                const isMe = who === "me";

                return (
                  <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[90%] p-4 rounded-2xl font-bold text-sm shadow-sm ${isMe
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-100 text-slate-700 rounded-tl-none'
                      }`}>
                      {text}
                    </div>
                    <span className="text-[10px] font-black text-slate-300 mt-1 px-1">{time}</span>
                  </div>
                );
              })}
          </div>

          {/* 채팅 입력창 */}
          <div className="p-8 border-t border-slate-100">
            <div className="relative">
              <input
                value={sendText}
                onChange={(e) => setSendText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendCaption()}
                placeholder="메시지를 입력하세요..."
                className="w-full pl-6 pr-16 py-5 bg-slate-100 border-none rounded-[2rem] font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
              <button
                onClick={sendCaption}
                className="absolute right-2 top-2 bottom-2 w-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
