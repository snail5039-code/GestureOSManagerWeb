import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

export default function Camera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState("");

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
        }
      } catch (e) {
        setError("카메라 권한이 없거나 접근 실패: " + (e.message ?? e));
      }
    };

    start();

    // 페이지 나갈 때 카메라 끄기(중요)
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

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

      <p>
        <Link to="/home">← 메인으로</Link>
      </p>
    </div>
  );
}
