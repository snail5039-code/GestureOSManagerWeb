import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, attachInterceptors } from "../api/client";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const getToken = () => localStorage.getItem("accessToken");

  const logout = async () => {
    try {
      await api.post("/auth/logout", null, {
        withCredentials: true, // ⭐ 쿠키 보내기
      });
    } catch (e) {
      console.warn("logout api failed", e);
    } finally {
      localStorage.removeItem("accessToken");
      setUser(null);
    }
  };


  // 인터셉터 1회 장착
  useEffect(() => {
    attachInterceptors(getToken, logout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 앱 시작 시: 토큰 있으면 내 정보 로딩
  useEffect(() => {
    const boot = async () => {
      const token = getToken();
      if (!token) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 로그인 성공 시 호출할 함수
  const loginWithToken = async (token) => {
    localStorage.setItem("accessToken", token);
    const res = await api.get("/members/me"); // 토큰으로 내 정보 가져오기
    setUser(res.data.user);
  };

  const value = useMemo(
    () => ({
      user,
      setUser,
      loading,
      isAuthed: !!user,
      token: getToken(),
      loginWithToken,
      setAccessToken: (t) => localStorage.setItem("accessToken", t),
      logout,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}