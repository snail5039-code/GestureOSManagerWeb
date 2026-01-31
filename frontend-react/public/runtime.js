// public/runtime.js
// ✅ 런타임 환경설정 (웹/설치형 공용)
// - 웹 배포(nginx 같은 origin)면 굳이 안 건드려도 됨.
// - 설치형(file://)에서는 여기 값을 "서버"로 넣어야 localhost 안 찍음.

window.__RUNTIME__ = window.__RUNTIME__ || {
  // ✅ 설치형에서 서버로 붙이고 싶으면 아래를 실제 서버로 세팅
  API_ORIGIN: "http://34.47.71.230",
  AUTH_ORIGIN: "http://34.47.71.230",
  // WS_ORIGIN 안 주면 API_ORIGIN 기반으로 ws:// 자동 생성함
  // WS_ORIGIN: "ws://34.47.71.230",
};
