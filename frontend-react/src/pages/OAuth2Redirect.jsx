import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export default function OAuth2Redirect() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { setAccessToken } = useAuth();

  useEffect(() => {
    const run = async () => {
      let accessToken = params.get("accessToken");

      // 만약 쿼리 스트링에 accessToken이 없다면, 해시에서 찾기
      if (!accessToken && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
        accessToken = hashParams.get("accessToken");
      }

      if (!accessToken) {
        nav("/login", { replace: true });  // 토큰이 없다면 로그인 페이지로 리디렉션
        return;
      }

      setAccessToken(accessToken);  // 토큰을 localStorage에 저장
      nav("/board", { replace: true });  // 로그인 후 대시보드로 리디렉션
    };

    run();
  }, [params, nav, setAccessToken]);

  return <div className="p-6">로그인 처리 중...</div>;
}
