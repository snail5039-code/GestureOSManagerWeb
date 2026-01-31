// public/runtime.js
// 배포 웹(http/https)에서는 비워둬도 됨 (상대경로 /api, /ws 사용)
// Electron(file://) 설치본에서 원격 서버로 붙이고 싶으면 ORIGIN만 지정
// 예: ORIGIN: "http://34.47.71.230"

window.__RUNTIME_CONFIG__ = {
  // 공통 백엔드 오리진(원격 서버로 붙일 때)
  ORIGIN: "",

  // 필요하면 개별 override도 가능
  // API_BASE: "http://34.47.71.230/api",
  // AUTH_BASE: "http://34.47.71.230/api",
  // WS_BASE: "ws://34.47.71.230",
};
