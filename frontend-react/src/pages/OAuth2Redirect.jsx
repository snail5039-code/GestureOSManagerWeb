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

      // 1. 쿼리 스트링 또는 해시에서 토큰 추출
      if (!accessToken && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
        accessToken = hashParams.get("accessToken");
      }

      if (!accessToken) {
        console.error("토큰이 없어 로그인 페이지로 리다이렉트합니다.");
        nav("/login", { replace: true });
        return;
      }

      // 2. AuthProvider를 통해 토큰 저장
      // (이때 내부적으로 localStorage.setItem("accessToken", ...)이 실행되어야 함)
      await setAccessToken(accessToken); 

      // 3. 메인으로 이동
      // 만약 여기서 계속 뱅글뱅글 돈다면 nav 대신 window.location.href = "/" 를 써야 합니다.
      nav("/", { replace: true });
    };

    run();
  }, [params, nav, setAccessToken]);

  return <div className="p-6">로그인 처리 중...</div>;
}