// App.jsx
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Test from "./pages/Test.jsx";
import MotionGuide from "./pages/MotionGuide.jsx";
import About from "./pages/About.jsx";
import Download from "./pages/Download.jsx";

import Board from "./pages/board/Board.jsx";
import BoardDetail from "./pages/board/BoardDetail.jsx";
import BoardWrite from "./pages/board/BoardWrite.jsx";
import BoardModify from "./pages/board/BoardModify.jsx";

import Join from "./pages/member/Join.jsx";
import Login from "./pages/member/Login.jsx";
import Logout from "./pages/member/Logout.jsx";
import FindLoginId from "./pages/member/FindLoginId.jsx";
import FindLoginPw from "./pages/member/FindLoginPw.jsx";
import MyPage from "./pages/member/MyPage.jsx";

import { useAuth } from "./auth/AuthProvider";
import Layout from "./components/layout/Layout.jsx";
import OAuth2Redirect from "./pages/OAuth2Redirect.jsx";

import { useTheme } from "./components/theme/ThemeProvider"; // ✅ 그대로 유지

export default function App() {
  const { loading } = useAuth();

  // ✅ 반드시 early return 전에 호출 (여기서 theme를 쓰든 안 쓰든 상관없음)
  useTheme();

  if (loading) return null;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/test" element={<Test />} />
        <Route path="/motionGuide" element={<MotionGuide />} />
        <Route path="/about" element={<About />} />
        <Route path="/download" element={<Download />} />

        <Route path="/board" element={<Board />} />
        <Route path="/board/write" element={<BoardWrite />} />
        <Route path="/board/:id" element={<BoardDetail />} />
        <Route path="/board/:id/modify" element={<BoardModify />} />

        <Route path="/mypage" element={<MyPage />} />
      </Route>

      <Route path="/join" element={<Join />} />
      <Route path="/login" element={<Login />} />
      <Route path="/logout" element={<Logout />} />
      <Route path="/findLoginId" element={<FindLoginId />} />
      <Route path="/findLoginPw" element={<FindLoginPw />} />
      <Route path="/oauth2/success" element={<OAuth2Redirect />} />

      <Route path="*" element={<div>페이지가 없습니다</div>} />
    </Routes>
  );
}
