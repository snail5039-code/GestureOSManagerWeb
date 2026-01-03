import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export default function OAuth2Success() {
  const [searchParams] = useSearchParams();  // query params 가져오기
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // URL에서 accessToken 추출
    const token = searchParams.get("accessToken");

    if (token) {
      localStorage.setItem("accessToken", token);  // accessToken 저장
      navigate("/home", { replace: true });  // 메인 페이지로 리디렉션
    } else {
      navigate("/login", { replace: true });  // 토큰 없으면 로그인 페이지로 리디렉션
    }
  }, [searchParams, navigate]);  // searchParams, navigate를 의존성에 추가

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>소셜 로그인 처리 중...</p>
    </div>
  );
}
