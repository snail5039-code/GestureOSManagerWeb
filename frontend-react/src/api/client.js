// src/api/client.js
import axios from "axios";

const isBrowser = typeof window !== "undefined";
const isFile = isBrowser && window.location.protocol === "file:";

// runtime.js에서 주입 (없으면 {})
const RUNTIME = isBrowser ? window.__RUNTIME_CONFIG__ || {} : {};

// -------------------------
// Base URL 결정 규칙
// -------------------------
// 1) 웹(http/https): 무조건 상대경로 사용 => "/api"
// 2) Electron(file://):
//    - runtime.js에 ORIGIN/API_BASE/AUTH_BASE가 있으면 그걸 사용
//    - 없으면 로컬(127.0.0.1:8080, 8082) 사용
const API_BASE = !isFile
  ? "/api"
  : (RUNTIME.API_BASE ||
      (RUNTIME.ORIGIN ? `${RUNTIME.ORIGIN.replace(/\/$/, "")}/api` : "http://127.0.0.1:8080/api"));

const AUTH_BASE = !isFile
  ? "/api"
  : (RUNTIME.AUTH_BASE ||
      (RUNTIME.ORIGIN ? `${RUNTIME.ORIGIN.replace(/\/$/, "")}/api` : "http://127.0.0.1:8082/api"));

function _isAuthPath(url) {
  const u = String(url || "");
  return (
    u.startsWith("/auth/") ||
    u.startsWith("auth/") ||
    u.startsWith("/oauth2/") ||
    u.startsWith("oauth2/") ||
    u.startsWith("/login") ||
    u.startsWith("login") ||
    u.startsWith("/logout") ||
    u.startsWith("logout")
  );
}

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

let _reqId = null;
let _resId = null;

// refresh 중복 호출 방지(동시 401 여러개 들어올 때)
let _refreshPromise = null;

async function _refreshAccessToken({ setToken, debug }) {
  if (typeof setToken !== "function") return "";
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      // ✅ api 인스턴스 말고 "axios"를 써서 인터셉터 루프를 피함
      // 웹(http)에서는 nginx 통해 /api/auth/token
      // file:// 에서는 AUTH_BASE 사용
      const url = isFile ? `${AUTH_BASE}/auth/token` : "/api/auth/token";

      const r = await axios.post(url, null, {
        withCredentials: true,
        headers: { Accept: "application/json" },
      });

      const newToken =
        r?.data?.accessToken ??
        r?.data?.token ??
        r?.data?.data?.accessToken ??
        "";

      if (debug) console.log("[REFRESH_OK]", { hasToken: !!newToken });

      if (newToken) setToken(String(newToken));
      return String(newToken || "");
    } catch (e) {
      if (debug) console.log("[REFRESH_FAIL]", e);
      return "";
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

function _setAuthHeader(headers, token) {
  const h = headers ?? {};
  const isAxiosHeaders =
    typeof h?.set === "function" && typeof h?.get === "function";

  if (token) {
    if (isAxiosHeaders) h.set("Authorization", `Bearer ${token}`);
    else h.Authorization = `Bearer ${token}`;
  } else {
    if (isAxiosHeaders) h.delete("Authorization");
    else if (h.Authorization) delete h.Authorization;
  }
  return h;
}

export function attachInterceptors(getToken, onLogout, options = {}) {
  const {
    logoutOn401 = true,
    ignore401Paths = ["/auth/logout", "/auth/refresh", "/auth/token", "/members/me"],
    debug = false,
    // ✅ AuthProvider에서 주입해줄 것(토큰 재발급 성공 시 반영)
    setToken = null,
  } = options;

  if (_reqId !== null) api.interceptors.request.eject(_reqId);
  if (_resId !== null) api.interceptors.response.eject(_resId);

  _reqId = api.interceptors.request.use((config) => {
    // file:// 빌드에서는 엔드포인트별 라우팅(그래도 runtime 우선)
    if (isFile && config) {
      config.baseURL = _isAuthPath(config.url) ? AUTH_BASE : API_BASE;
    }

    const t = getToken?.();
    config.headers = _setAuthHeader(config.headers, t);

    if (debug) {
      const h = config.headers ?? {};
      const isAxiosHeaders =
        typeof h?.set === "function" && typeof h?.get === "function";
      const auth = isAxiosHeaders ? h.get("Authorization") : h.Authorization;

      console.log("[REQ]", config.method, config.baseURL, config.url, { hasToken: !!t, auth });
    }

    return config;
  });

  _resId = api.interceptors.response.use(
    (res) => res,
    async (err) => {
      const status = err?.response?.status;
      const url = err?.config?.url ?? "";
      const ignore = ignore401Paths.some((p) => url.includes(p));
      const original = err?.config;

      if (debug) console.log("[ERR]", status, url);

      // ✅ 401이면: refreshToken 쿠키로 accessToken 재발급 → 원요청 1회 재시도
      if (
        status === 401 &&
        !ignore &&
        original &&
        !original._retry &&
        !original._skipAuthRefresh &&
        typeof setToken === "function"
      ) {
        original._retry = true;

        const newToken = await _refreshAccessToken({ setToken, debug });

        if (newToken) {
          original.headers = _setAuthHeader(original.headers, newToken);
          if (debug) console.log("[RETRY]", original.method, original.url);
          return api(original);
        }
      }

      // ✅ refresh 실패/불가하면 기존 로직대로 logout 처리
      if (logoutOn401 && status === 401 && !ignore) {
        const t = getToken?.();
        if (t) onLogout?.();
      }

      return Promise.reject(err);
    }
  );

  return () => {
    if (_reqId !== null) api.interceptors.request.eject(_reqId);
    if (_resId !== null) api.interceptors.response.eject(_resId);
    _reqId = null;
    _resId = null;
  };
}
