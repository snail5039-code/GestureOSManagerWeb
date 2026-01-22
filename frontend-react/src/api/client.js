// src/api/client.js
import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

let _reqId = null;
let _resId = null;

export function attachInterceptors(getToken, onLogout, options = {}) {
  const {
    logoutOn401 = true,
    ignore401Paths = ["/auth/logout", "/auth/refresh", "/members/me"],
    debug = false,
  } = options;

  if (_reqId !== null) api.interceptors.request.eject(_reqId);
  if (_resId !== null) api.interceptors.response.eject(_resId);

  _reqId = api.interceptors.request.use((config) => {
    const t = getToken?.();
    config.headers = config.headers ?? {};

    // ✅ Axios v1: AxiosHeaders 인스턴스면 set 사용
    const isAxiosHeaders =
      typeof config.headers?.set === "function" &&
      typeof config.headers?.get === "function";

    if (t) {
      if (isAxiosHeaders) config.headers.set("Authorization", `Bearer ${t}`);
      else config.headers.Authorization = `Bearer ${t}`;
    } else {
      if (isAxiosHeaders) config.headers.delete("Authorization");
      else if (config.headers.Authorization) delete config.headers.Authorization;
    }

    // request interceptor 안 debug 부분만 이렇게
    if (debug) {
      const isAxiosHeaders =
        typeof config.headers?.set === "function" &&
        typeof config.headers?.get === "function";

      const auth = isAxiosHeaders
        ? config.headers.get("Authorization")
        : config.headers.Authorization;

      console.log("[REQ]", config.method, config.url, {
        hasToken: !!t,
        auth,
      });
    }


    return config;
  });

  _resId = api.interceptors.response.use(
    (res) => res,
    (err) => {
      const status = err?.response?.status;
      const url = err?.config?.url ?? "";
      const ignore = ignore401Paths.some((p) => url.includes(p));

      if (debug) console.log("[ERR]", status, url);

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
