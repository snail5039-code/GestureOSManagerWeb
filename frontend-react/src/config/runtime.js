// src/config/runtime.js
export function getRuntimeConfig() {
  const w = typeof window !== "undefined" ? window : null;
  const loc = w?.location;

  const isFile = !!loc && loc.protocol === "file:";
  const runtime = w?.__RUNTIME__ || {};

  // Vite env (개발용)
  const envApiOrigin =
    import.meta.env?.VITE_API_ORIGIN || import.meta.env?.VITE_API_URL || "";
  const envAuthOrigin =
    import.meta.env?.VITE_AUTH_ORIGIN || import.meta.env?.VITE_AUTH_URL || "";

  // 브라우저 origin
  const pageOrigin = loc?.origin || "";

  // ✅ file:// 인 경우: runtime > env > localhost fallback
  const apiOrigin = isFile
    ? runtime.API_ORIGIN || envApiOrigin || "http://127.0.0.1:8080"
    : runtime.API_ORIGIN || ""; // 웹에서는 기본적으로 상대경로(/api) 쓰는 게 제일 안전

  const authOrigin = isFile
    ? runtime.AUTH_ORIGIN || envAuthOrigin || runtime.API_ORIGIN || "http://127.0.0.1:8082"
    : runtime.AUTH_ORIGIN || runtime.API_ORIGIN || ""; // 웹도 보통 /api로 해결

  // ✅ HTTP API base
  // - 웹 배포: 기본은 "/api"
  // - file://: "http://34.47.71.230/api" 같은 절대경로
  const apiBase = isFile ? `${apiOrigin}/api` : "/api";
  const authBase = isFile ? `${authOrigin}/api` : "/api";

  // ✅ WebSocket origin
  // - runtime.WS_ORIGIN 지정 우선
  // - 없으면 apiOrigin/pageOrigin 기반으로 ws/wss 자동 계산
  const wsOrigin = (() => {
    if (runtime.WS_ORIGIN) return runtime.WS_ORIGIN;

    const base = isFile ? (apiOrigin || authOrigin) : (runtime.API_ORIGIN || pageOrigin);
    if (!base) {
      // 최후 fallback
      const proto = loc?.protocol === "https:" ? "wss:" : "ws:";
      return `${proto}//${loc?.host}`;
    }

    // http(s)://host -> ws(s)://host
    if (base.startsWith("https://")) return "wss://" + base.slice("https://".length);
    if (base.startsWith("http://")) return "ws://" + base.slice("http://".length);

    // 이미 ws/wss면 그대로
    if (base.startsWith("ws://") || base.startsWith("wss://")) return base;

    // 기타는 host로 간주
    const proto = loc?.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${base}`;
  })();

  return { isFile, apiBase, authBase, wsOrigin };
}
