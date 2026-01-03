import { useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function Logout() {
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        await axios.post("/api/members/logout");
      } catch (e) {
        // 실패해도 일단 화면은 보냄
      } finally {
        nav("/");
      }
    })();
  }, [nav]);

  return (
    <div className="max-w-md mx-auto mt-16 p-6 border rounded-xl bg-white text-center">
      로그아웃 중...
    </div>
  );
}
