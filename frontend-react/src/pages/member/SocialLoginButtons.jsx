import React from "react";
import { getRuntimeConfig } from "../../config/runtime";

export default function SocialLoginButtons() {
  const { isFile } = getRuntimeConfig();

  // ✅ 웹 배포: 같은 origin으로 /oauth2/... 요청
  // ✅ 설치형: runtime.AUTH_ORIGIN(/api 프록시 있는 서버)로 보냄
  const runtime = typeof window !== "undefined" ? (window.__RUNTIME__ || {}) : {};
  const AUTH_ORIGIN = isFile
    ? (runtime.AUTH_ORIGIN || runtime.API_ORIGIN || "http://127.0.0.1:8082")
    : window.location.origin;

  const googleLogin = () => {
    window.location.href = `${AUTH_ORIGIN}/oauth2/authorization/google`;
  };

  const kakaoLogin = () => {
    window.location.href = `${AUTH_ORIGIN}/oauth2/authorization/kakao`;
  };

  const naverLogin = () => {
    window.location.href = `${AUTH_ORIGIN}/oauth2/authorization/naver`;
  };

  return (
    <div style={{ display: "flex", gap: 12 }}>
      <button onClick={googleLogin}>Google</button>
      <button onClick={kakaoLogin}>Kakao</button>
      <button onClick={naverLogin}>Naver</button>
    </div>
  );
}
