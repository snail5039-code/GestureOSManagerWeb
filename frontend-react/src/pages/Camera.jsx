import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Hands } from "@mediapipe/hands";
import { Camera as MPCamera } from "@mediapipe/camera_utils";
import axios from "axios";

export default function Camera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [recording, setRecording] = useState(false);
  const bufferRef = useRef([]); //녹화 중 쌓이는 프레임 리스트임
  const latestLandmarksRef = useRef(null);
  const handsRef = useRef(null); // 손 인식 엔진 저장 상자
  const mpCameraRef = useRef(null); // 미디어 파이프 카메라 보관
  const [handDetected, setHandDetected] = useState(false); // 화면 표시용 손이 있나 없나 표시
  const [handCount, setHandCount] = useState(0);
  const [lrStatus, setLrStatus] = useState("없음");

  const [error, setError] = useState("");
  const [frameCount, setFrameCount] = useState(0);
  const [savedPayload, setSavedPayload] = useState(null);
  const [resultText, setResultText] = useState("");
  const [resultLabel, setResultLabel] = useState("");
  const [sentence, setSentence] = useState("");
  const [lastWord, setLastWord] = useState("");
  const [stableWord, setStableWord] = useState("");
  const [stableCount, setStableCount] = useState(0);

  useEffect(() => {
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        streamRef.current = stream; // 나중에 끄려고 저장해논거임 
        if (videoRef.current) {
          videoRef.current.srcObject = stream; //srcObject 카메라에서 받아온 영상 넣어주는거

          const hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`, //미디어 파일들 모델 가져올지 
          });
          // 손 찾는 옵션들 우선은 1개 + 정확도임
          hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
          // 손 감지용
          hands.onResults((results) => {
            const handsLm = results.multiHandLandmarks ?? [];
            const handed = results.multiHandedness ?? []; //손 좌우 정보 저장 
            const labels = handed
              .map(h => h?.label ?? h?.classification?.[0]?.label)
              .filter(Boolean)
              .map(l => (l === "Left" ? "Right" : "Left"));

            setLrStatus(labels.length ? labels.join(", ") : "없음");

            latestLandmarksRef.current = { handsLm, handed };
            setHandDetected(handsLm.length > 0);
            setHandCount(handsLm.length);
          });
          // 감지한 손 찍은거 저장하고 보내는거!
          const mpCam = new MPCamera(videoRef.current, {
            onFrame: async () => {
              await hands.send({ image: videoRef.current });
            },
            width: 480,
            height: 360,
          });
          mpCam.start();

          handsRef.current = hands;
          mpCameraRef.current = mpCam;
        }
      } catch (e) {
        setError("카메라 권한이 없거나 접근 실패: " + (e.message ?? e));
      }
    };

    start();

    // 페이지 나갈 때 카메라 끄기(중요)
    return () => {
      if (mpCameraRef.current) mpCameraRef.current.stop();
      if (handsRef.current) handsRef.current.close();

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!recording) return;

    const intervalId = setInterval(() => {
      const latest = latestLandmarksRef.current;
      if (!latest || !latest.handsLm || latest.handsLm.length === 0) return;

      const { handsLm, handed } = latest;
      // 항상 [Left, Right] 순서로 고정
      const handsFixed = [[], []]; // 1: Left, 0: Right
      for (let i = 0; i < handsLm.length; i++) {
        // mediapipe 버전에 따라 label 위치가 다를 수 있어서 안전하게 처리
        const label =
          handed?.[i]?.label ??
          handed?.[i]?.classification?.[0]?.label ??
          null;

        const idx = label === "Left" ? 1 : 0;

        // landmarks -> {x,y,z} 형태로 변환
        handsFixed[idx] = handsLm[i].map((p) => ({ x: p.x, y: p.y, z: p.z }));
      }

      const frame = { t: Date.now(), hands: handsFixed };

      bufferRef.current.push(frame);
      setFrameCount(bufferRef.current.length);
    }, 100);

    return () => clearInterval(intervalId);
  }, [recording]);

  const onStart = () => {
    bufferRef.current = [];
    setFrameCount(0);
    setSavedPayload(null);
    setRecording(true);
  };

  const onStop = async () => {
    setRecording(false);

    const payload = {
      startedAt: bufferRef.current[0]?.t ?? null,
      endedAt: bufferRef.current.at(-1)?.t ?? null,
      fps: 10,
      frames: bufferRef.current,
    };

    setSavedPayload(payload);

    const framesForServer = bufferRef.current
      .filter((f) => f.hands && f.hands.length > 0)
      .map((f) => ({
        t: f.t,
        hands: f.hands.map((hand) =>
          hand.map((p) => ({ x: p.x, y: p.y, z: p.z }))
        )
      }));

    try {
      const res = await axios.post("/api/translate", {
        frames: framesForServer,
      });
      console.log("서버 응답:", res.data);
      setResultText(res.data.text);
      setResultLabel(res.data.label ?? "");

      const word = res.data.text;
      const conf = Number(res.data.confidence ?? 0);

      if (!word || word === "번역 실패" || conf < 0.2) {
          setStableWord("");
          setStableCount(0);
          return;
        }

      if(word === stableWord) {
        const next = stableCount + 1;
        setStableCount(next);

        if(next >= 2 && word !== lastWord) {
          setSentence((prev) => {
            if(prev) return prev + " " + word;
            return word;
          });
          setLastWord(word);

          setStableWord("");
          setStableCount(0);
        }
      } else {
        setStableWord(word);
          setStableCount(1);
      }
    } catch (error) {
      console.error("전송 실패:", error);
    }
  };
  // 테스트임!! 샘플!!
  const sendSample = async () => {
  const sample = {
    frames: [
      {
        hands: [
          Array.from({ length: 21 }, () => ({ x: 0.1, y: 0.1, z: 0.0 }))
        ]
      }
    ]
  };

  try {
    const res = await axios.post("/api/translate", sample);
    console.log("샘플 응답:", res.data);

    setResultText(res.data.text);
    setResultLabel(res.data.label ?? "");

    // ✅ 여기서 너가 만든 안정화/누적 로직 그대로 실행되게 하면 됨
    // (지금 onStop에 있는 "word/conf/stableCount" 블록을 여기로 복붙)
  } catch (e) {
    console.error("샘플 전송 실패:", e);
  }
};

  return (
    <div>
      <h1>웹캠</h1>

      {error && <p>에러: {error}</p>}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: 480, background: "#000" }}
      />
      <div>
        <p>손 감지: {handDetected ? "✅ 감지됨" : "❌ 없음"}</p>
        <p>손 개수: {handCount}</p>
        <div>손 라벨: {lrStatus}</div>
        <p>한국어 텍스트:{resultText}</p>
        <p>WORD 라벨:{resultLabel}</p>
        <p>연속 한국어 번역 결과:{sentence || "(비어 있음)"}</p>
        <button onClick={() => { setSentence(""); setLastWord(""); }}>문장 초기화</button>
      </div>
      <div>
        <button onClick={sendSample}>샘플 전송(웹캠 없이 테스트)</button>
        <button onClick={onStart} disabled={recording}>
          시작(저장 시작)
        </button>

        <button onClick={onStop} disabled={!recording}>
          정지(저장 종료)
        </button>

        <p>상태: {recording ? "저장중..." : "대기중"}</p>
        <p>현재까지 저장된 프레임 수: {frameCount}</p>
      </div>

      {savedPayload && (
        <div>
          <h3>정지 후 저장된 데이터(미리보기)</h3>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(
              { ...savedPayload, frames: savedPayload.frames.slice(0, 5) },
              null,
              2
            )}
          </pre>
          <p>(frames는 너무 길어서 앞 5개만 보여주는 중)</p>
        </div>
      )}

      <p>
        <Link to="/home">← 메인으로</Link>
      </p>
    </div>
  );
}
