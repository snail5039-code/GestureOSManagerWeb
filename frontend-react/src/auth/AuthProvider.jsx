import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useCallback,
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

  // ✅ 토큰을 state로 들고 간다 (항상 최신)
  const [token, setTokenState] = useState(() => readTokenFromStorage());

  const setToken = useCallback((t) => {
    const v = String(t || "");
    setTokenState(v);

    // 저장소에도 동기화 (네 프로젝트 방식대로 localStorage 유지)
    if (v) localStorage.setItem("accessToken", v);
    else localStorage.removeItem("accessToken");

    // ✅ axios 기본 헤더에도 즉시 반영 (첫 요청부터 안전)
    if (v) api.defaults.headers.common.Authorization = `Bearer ${v}`;
    else delete api.defaults.headers.common.Authorization;
  }, []);

  // 초기 토큰이 있으면 defaults에 박아두기
  useEffect(() => {
    if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
    else delete api.defaults.headers.common.Authorization;
  }, [token]);

  const getToken = useCallback(() => token, [token]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout", null, { withCredentials: true });
    } catch (e) {
      console.warn("logout api failed", e);
    } finally {
      setToken("");
      localStorage.removeItem("token");
      sessionStorage.removeItem("accessToken");
      sessionStorage.removeItem("token");
      setUser(null);
    }
  }, [setToken]);

  // ✅ 인터셉터는 렌더 직후 최대한 빨리
  useLayoutEffect(() => {
    const detach = attachInterceptors(getToken, logout, {
      debug: true, // 확인 끝나면 false로
      logoutOn401: true,
      ignore401Paths: ["/auth/logout", "/auth/refresh", "/members/me"],
    });
    return detach;
  }, [getToken, logout]);

  // 앱 시작 시: 토큰 있으면 내 정보 로딩
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

  // 로그인 성공 시 호출할 함수
  const loginWithToken = useCallback(
    async (t) => {
      setToken(t);
      const res = await api.get("/members/me");
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
