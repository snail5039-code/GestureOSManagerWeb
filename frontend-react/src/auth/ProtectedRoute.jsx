export default function ProtectedRoute() {
  const { isAuthed, loading } = useAuth();
  const { pathname } = useLocation();

  const PUBLIC_PATHS = ["/login", "/oauth2/success", "/join"];

  if (loading) return null; // 유저 정보 조회 중에는 아무것도 안 보여줌

  // 공개 경로는 누구나 접근 가능
  if (PUBLIC_PATHS.includes(pathname)) {
    return <Outlet />;
  }

  // 로그인이 안 됐는데 비공개 경로(게시판 등)에 접근하면 로그인으로 쫓아냄
  if (!isAuthed) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}