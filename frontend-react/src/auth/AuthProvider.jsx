import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { api, attachInterceptors } from "../api/client";

const AuthCtx = createContext(null);

function safeDecode(token) {
  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
}

function isTokenExpiredOrNear(token, leewaySec = 30) {
  const decoded = safeDecode(token);
  if (!decoded?.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return decoded.exp <= now + leewaySec;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("accessToken"));
  const [user, setUser] = useState(() => (token ? safeDecode(token) : null));
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("accessToken");
  };

  const onLogout = async () => {
    try {
      await api.post("/api/members/logout");
    } catch {}
    logout();
  };

  const loginWithToken = (newToken) => {
    setToken(newToken);
    localStorage.setItem("accessToken", newToken);
    setUser(safeDecode(newToken));
  };

  // 앱 시작 시 1번: refresh 쿠키로 accessToken 재발급
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    (async () => {
      try {
        if (token && !isTokenExpiredOrNear(token)) return;

        const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
        const res = await fetch(`${BASE_URL}/api/auth/token`, {
          method: "POST",
          credentials: "include",
        });

        if (!res.ok) throw new Error(`refresh failed: ${res.status}`);

        const data = await res.json();
        const newToken = data.accessToken ?? data.token;
        if (newToken) loginWithToken(newToken);
      } catch {
        logout();
      } finally {
        setIsAuthLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // axios 인터셉터에 토큰 붙이기
  useEffect(() => {
    attachInterceptors(
      () => token,
      () => logout()
    );
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      loginWithToken,
      logout: onLogout,     // 서버 로그아웃까지 포함한 logout 제공
      isAuthLoading,
      isLoggedIn: !!token,
    }),
    [token, user, isAuthLoading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
