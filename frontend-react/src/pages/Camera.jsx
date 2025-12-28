import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Hands } from "@mediapipe/hands";
import { FaceMesh } from "@mediapipe/face_mesh";
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
  const faceMeshRef = useRef(null);              // 얼굴 인식 엔진 저장
  const latestFaceLandmarksRef = useRef(null);   // 최신 얼굴 랜드마크 저장
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
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceCount, setFaceCount] = useState(0);

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
            locateFile: (file) =>
              `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`, //미디어 파일들 모델 가져올지
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
              .map((h) => h?.label ?? h?.classification?.[0]?.label)
              .filter(Boolean)
              .map((l) => (l === "Left" ? "Right" : "Left"));

            setLrStatus(labels.length ? labels.join(", ") : "없음");

            latestLandmarksRef.current = { handsLm, handed };
            setHandDetected(handsLm.length > 0);
            setHandCount(handsLm.length);
          });

          const faceMesh = new FaceMesh({
            locateFile: (file) =>
              `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
          });

          faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });

          faceMesh.onResults((results) => {
            const faces = results.multiFaceLandmarks ?? [];
            latestFaceLandmarksRef.current = faces; //faces[0] 얼굴1개 랜드마크

            setFaceDetected(faces.length > 0);
            setFaceCount(faces.length);
          });

          faceMeshRef.current = faceMesh;

          // 감지한 손 찍은거 저장하고 보내는거!
          const mpCam = new MPCamera(videoRef.current, {
            onFrame: async () => {
              const image = videoRef.current;
              await hands.send({image});
              
              if (faceMeshRef.current) {
                await faceMeshRef.current.send({image});
              }
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
      if (faceMeshRef.current) faceMeshRef.current.close(); // 끌때 페이스메시도 클로즈 해주기추가

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!recording) return;

    const intervalId = setInterval(() => {
      const latest = latestLandmarksRef.current;
      const faces = latestFaceLandmarksRef.current ?? [];
      const face0 = faces[0] ?? null; // 얼굴 1개만 쓸거면 0번만
      
      const face = face0 ? face0.map((p) => ({ x: p.x, y: p.y, z: p.z})) : [];

      const hasFace = face.length > 0;
      const hasHands = (latest?.handsLm?.length ?? 0) > 0; // hasHands 변수 추가해버림
      
      if (!hasHands) return;

      // const { handsLm, handed } = latest;

      // if (latest?.handsLm?.length) {
      //   const {handsLm, handed} = latest;
      // }
      // 항상 [Left, Right] 순서로 고정
      const handsFixed = [[], []]; // 1: Right, 0: Left

      if (hasHands) {
        const {handsLm, handed} = latest;

        for (let i = 0; i < handsLm.length; i++) {
           // mediapipe 버전에 따라 label 위치가 다를 수 있어서 안전하게 처리
          const label = handed?.[i]?.label ?? handed?.[i]?.classification?.[0]?.label ?? null;
           
          const idx = label === "Left" ? 1 : 0;
          
          // landmarks -> {x,y,z} 형태로 변환
          handsFixed[idx] = handsLm[i].map((p) => ({ x: p.x, y: p.y, z: p.z}));
        }
      }
      
      const frame = { t: Date.now(), hands: handsFixed, face }; // face 추가!!!
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
      
      //.filter((f) => f.hands && f.hands.length > 0 || (f.face && f.face.length > 0))
      .filter((f) => (f.hands?.some((h) => h?.length > 0 )))
      .map((f) => ({
        t: f.t,
        hands: (f.hands ?? [[], []]).map((hand) =>
          (hand ?? []).map((p) => ({ x: p.x, y: p.y, z: p.z }))
        ),
        face: (f.face ?? []).map((p) => ({ x: p.x, y: p.y, z:p.z})),
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

      if (word === stableWord) {
        const next = stableCount + 1;
        setStableCount(next);

        if (next >= 2 && word !== lastWord) {
          setSentence((prev) => {
            if (prev) return prev + " " + word;
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
      frames: [{
        hands: [
          Array.from({ length: 21 }, () => ({ x: 0.1, y: 0.1, z: 0.0})),
          [],
        ],
        face: []
      }]
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* 상단 타이틀 */}
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">
              웹캠
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              손 인식 → 프레임 저장 → 서버 번역
            </p>
          </div>

          <p className="text-sm">
            <Link
              to="/home"
              className="rounded-xl px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100"
            >
              ← 메인으로
            </Link>
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-800 ring-1 ring-rose-200">
            에러: {error}
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {/* 왼쪽: 카메라 */}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">
                카메라 화면
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${recording
                    ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                    : "bg-slate-50 text-slate-700 ring-1 ring-slate-200"
                  }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${recording ? "bg-rose-500" : "bg-slate-400"
                    }`}
                />
                상태: {recording ? "저장중..." : "대기중"}
              </span>
            </div>

            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full max-w-[480px] rounded-2xl bg-black shadow-sm ring-1 ring-slate-200"
            />

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                onClick={sendSample}
                className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-200 active:scale-[0.99]"
              >
                샘플 전송(웹캠 없이 테스트)
              </button>

              <button
                onClick={onStart}
                disabled={recording}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
              >
                시작(저장 시작)
              </button>

              <button
                onClick={onStop}
                disabled={!recording}
                className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
              >
                정지(저장 종료)
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="text-xs font-semibold text-slate-500">
                  현재까지 저장된 프레임 수
                </p>
                <p className="mt-1 text-lg font-black text-slate-900">
                  {frameCount}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="mt-1 text-lg font-black text-slate-900">
                  <p>손 감지: <span>{handDetected ? "✅ 감지됨" : "❌ 없음"}</span></p>
                </p>
                <p className="text-sm">얼굴 감지: <span className="font-semibold">{faceDetected? "✅ 감지됨" : "❌ 없음"}</span></p>
                <p className="text-sm">얼굴 개수: <span className="font-semibold">{faceCount}</span></p>
              </div>
            </div>
          </div>

          {/* 오른쪽: 결과 */}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 text-sm font-semibold text-slate-900">
              번역 결과
            </div>

            <div className="space-y-2 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <p className="text-sm">
                손 감지: <span className="font-semibold">{handDetected ? "✅ 감지됨" : "❌ 없음"}</span>
              </p>
              <p className="text-sm">
                손 개수: <span className="font-semibold">{handCount}</span>
              </p>
              <div className="text-sm">
                손 라벨: <span className="font-semibold">{lrStatus}</span>
              </div>
              <p className="text-sm">
                한국어 텍스트: <span className="font-semibold">{resultText}</span>
              </p>
              <p className="text-sm">
                WORD 라벨: <span className="font-semibold">{resultLabel}</span>
              </p>
              <p className="text-sm">
                연속 한국어 번역 결과:{" "}
                <span className="font-semibold">{sentence || "(비어 있음)"}</span>
              </p>

              <button
                onClick={() => {
                  setSentence("");
                  setLastWord("");
                  setStableWord("");
                  setStableCount(0);
                }}
                className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-100 active:scale-[0.99]"
              >
                문장 초기화
              </button>
            </div>
          </div>
        </div>

        {savedPayload && (
          <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">
              정지 후 저장된 데이터(미리보기)
            </h3>
            <pre className="mt-3 max-h-72 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
              {JSON.stringify(
                { ...savedPayload, frames: savedPayload.frames.slice(0, 5).map((f) => ({
                  t: f.t,
                  hands: f.hands,

                  faceLen: f.face?.length ?? 0,
                  faceSample: (f.face ?? []).slice(0, 10),
                })) 
              },
                null,
                2
              )}
            </pre>
            <p className="mt-2 text-xs text-slate-500">
              (frames는 너무 길어서 앞 5개만, face는 샘플 10개만)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
