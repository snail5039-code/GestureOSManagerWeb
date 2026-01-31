import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export default function Test() {
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const callServer = async () => {
    setResult("");
    setError("");

    try {
      const res = await api.post("/translate", { text: "hello" });
      setResult(res.data?.text ?? JSON.stringify(res.data));
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  };

  return (
    <div>
      <h1>서버 연결 테스트</h1>

      <button onClick={callServer}>서버 호출</button>

      {error && <p>에러: {error}</p>}
      {result && <p>결과: {result}</p>}

      <p>
        <Link to="/">← 메인으로</Link>
      </p>
    </div>
  );
}
