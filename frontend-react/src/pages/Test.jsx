import { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

export default function Test() {
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const callServer = async () => {
    setResult("");
    setError("");

    try {
      const res = await axios.post("http://localhost:8080/api/translate", {
        text: "hello",
      });
      setResult(res.data.text ?? JSON.stringify(res.data));
    } catch (e) {
      setError(e.message);
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
