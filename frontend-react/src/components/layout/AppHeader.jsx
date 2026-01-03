import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";

export default function AppHeader() {
  const { user, isAuthed, logout } = useAuth();
  const nav = useNavigate();

  const onLogout = async () => {
    await logout();
    nav("/");
  };

  return (
    <div className="sticky top-0 bg-white border-b z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/board" className="font-extrabold">게시판</Link>

        {!isAuthed ? (
          <div className="flex items-center gap-3">
            <Link to="/join" className="px-3 py-1 rounded-lg border">회원가입</Link>
            <Link to="/login" className="px-3 py-1 rounded-lg bg-black text-white">로그인</Link>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {user?.loginId ?? user?.name ?? "사용자"} 님
            </span>
            <Link to="/board" className="px-3 py-1 rounded-lg border">글 작성</Link>
            <button onClick={onLogout} className="px-3 py-1 rounded-lg bg-black text-white">
              로그아웃
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
