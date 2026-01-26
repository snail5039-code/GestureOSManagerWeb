import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { api, attachInterceptors } from "../api/client";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function readTokenFromStorage() {
  return (
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("accessToken") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ UI 리렌더용 state
  const [token, setTokenState] = useState(() => readTokenFromStorage());
  // ✅ 즉시 반영(레이스 방지)용 ref
  const tokenRef = useRef(readTokenFromStorage());

  const applyAxiosAuth = useCallback((t) => {
    if (t) api.defaults.headers.common.Authorization = `Bearer ${t}`;
    else delete api.defaults.headers.common.Authorization;
  }, []);

  // ✅ setToken은 "ref 먼저" 갱신해서 그 순간부터 요청에 토큰이 붙게 한다
  const setToken = useCallback(
    (t) => {
      const v = String(t || "");

      tokenRef.current = v;     // ✅ 즉시 반영
      setTokenState(v);         // UI 반영

      if (v) localStorage.setItem("accessToken", v);
      else localStorage.removeItem("accessToken");

      // (기존에 쓰던 다른 키들 정리)
      if (!v) {
        localStorage.removeItem("token");
        sessionStorage.removeItem("accessToken");
        sessionStorage.removeItem("token");
      }

      applyAxiosAuth(v);
    },
    [applyAxiosAuth]
  );

  // ✅ 인터셉터가 참조할 토큰은 ref 기반으로 제공
  const getToken = useCallback(() => tokenRef.current, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout", null, { withCredentials: true });
    } catch (e) {
      console.warn("logout api failed", e);
    } finally {
      setToken("");
      setUser(null);
    }
  }, [setToken]);

  // ✅ 앱 부팅 시: 저장소 토큰을 axios defaults에 먼저 반영
  useEffect(() => {
    const t = tokenRef.current;
    applyAxiosAuth(t);
  }, [applyAxiosAuth]);

  // ✅ 인터셉터는 최대한 빠르게 장착
  useLayoutEffect(() => {
    const detach = attachInterceptors(getToken, logout, {
      debug: true, // 확인 끝나면 false로
      logoutOn401: true,
      // /members/me는 로그인 직후 최초 조회라 401이면 logout이 과하게 동작할 수 있어서 제외해둠
      ignore401Paths: ["/auth/logout", "/auth/refresh", "/members/me"],
    });
    return detach;
  }, [getToken, logout]);

  // ✅ 앱 시작 시: 토큰 있으면 내 정보 로딩
  useEffect(() => {
    const boot = async () => {
      const t = getToken();
      if (!t) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get("/members/me");
        setUser(res.data.user);
      } catch (e) {
        await logout();
      } finally {
        setLoading(false);
      }
    };
    boot();
  }, [getToken, logout]);

  // ✅ 로그인 성공 시 호출
  // - ref에 즉시 토큰 반영(setToken)
  // - /members/me는 혹시라도 인터셉터/타이밍 영향 없도록 토큰을 "명시적으로" 헤더로도 한번 더 보장
  const loginWithToken = useCallback(
    async (t) => {
      setToken(t);

      const res = await api.get("/members/me", {
        headers: { Authorization: `Bearer ${String(t || "")}` },
      });

      setUser(res.data.user);
    },
    [setToken]
  );

  const value = useMemo(
    () => ({
      user,
      setUser,
      loading,
      isAuthed: !!user,
      token,
      loginWithToken,
      setAccessToken: setToken,
      logout,
    }),
    [user, loading, token, loginWithToken, setToken, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
