import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import SocialLoginButtons from "./SocialLoginButtons";

export default function Login() {
  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const { loginWithToken } = useAuth();
  const nav = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    const i = loginId.trim();
    const p = loginPw.trim();

    if (!i) return setErrorMsg("아이디 입력");
    if (!p) return setErrorMsg("비밀번호 입력");

    try {
      setLoading(true);
      
      const res = await api.post("/members/login", {
        loginId: i,
        loginPw: p,
      });

      // 백엔드 응답 키: accessToken
      const token = res?.data?.accessToken;
    
      if (!token) throw new Error("NO_TOKEN");

    // 로그인 후, JWT 토큰을 localStorage에 저장
    localStorage.setItem('accessToken', token);
    nav("/home", { replace: true });  // 메인 화면으로 리디렉션
  } catch (e2) {
    console.log("LOGIN_ERR:", e2?.response?.status, e2?.response?.data, e2);

    if (e2.message === "NO_TOKEN") setErrorMsg("로그인 실패(토큰 없음)");
    else if (e2?.response?.status === 401) setErrorMsg("아이디/비밀번호가 틀림");
    else setErrorMsg(e2?.response?.data?.message || "로그인 실패");
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm bg-white border rounded-2xl p-6 shadow-sm">
        <h1 className="text-xl font-semibold">로그인</h1>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="text-sm text-gray-700">아이디</label>
            <input
              className="mt-1 w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-200"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="아이디"
              disabled={loading}
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm text-gray-700">비밀번호</label>
            <input
              className="mt-1 w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-200"
              value={loginPw}
              onChange={(e) => setLoginPw(e.target.value)}
              placeholder="비밀번호"
              type="password"
              name="password"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {errorMsg && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl disabled:opacity-60"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-gray-500">아이디가 없으면</span>
            <Link to="/join" className="text-blue-600 hover:underline font-medium">
              회원가입
            </Link>
          </div>

          <hr className="my-5" />
          <SocialLoginButtons />
        </form>
      </div>
    </div>
  );
}
