import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import SocialLoginButtons from "./SocialLoginButtons";


export default function Login() {
  const [username, setUsername] = useState(""); // 아이디
  const [password, setPassword] = useState(""); // 비번
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const { loginWithToken } = useAuth();
  const nav = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    const u = username.trim();
    const p = password.trim();

    if (!u) return setErrorMsg("아이디 입력");
    if (!p) return setErrorMsg("비밀번호 입력해");

    try {
      setLoading(true);

      // 엔드포인트/필드명은 백에 맞춰서 수정
      const res = await api.post("/api/members/login", {
        username: u,
        password: p,
      });

      // 예: { accessToken: "..." }
      loginWithToken(res.data.accessToken);

      nav("/board"); // 로그인 후 이동할 페이지
    } catch (e2) {
      const status = e2?.response?.status;
      if (status === 401) setErrorMsg("아이디/비밀번호가 틀렸어.");
      else setErrorMsg(e2?.response?.data?.message || "로그인 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm bg-white border rounded-2xl p-6 shadow-sm">
        <h1 className="text-xl font-semibold">로그인</h1>
        <p className="text-sm text-gray-500 mt-1">
          아이디와 비밀번호만 입력
        </p>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="text-sm text-gray-700">아이디</label>
            <input
              className="mt-1 w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-200"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="아이디"
              disabled={loading}
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm text-gray-700">비밀번호</label>
            <input
              className="mt-1 w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-200"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              type="password"
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
