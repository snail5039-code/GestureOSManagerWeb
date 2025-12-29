import React from "react";
import { BOARD_TYPES } from "../../pages/board/BoardTypes";
import { Search } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider"; // ✅ 추가 (경로 맞게)

export default function BoardHeader({ boardId, setBoardId, keyword, setKeyword, onSearch }) {
  const { logout, token } = useAuth();

  return (
    <div className="board">
      <div className="max-w-5xl mx-auto px-6 py-14 relative">
        {/* ✅ 오른쪽 위 로그아웃 */}
        {token && (
          <button
            onClick={logout}
            className="absolute right-6 top-6 px-4 py-2 rounded-xl border bg-white hover:bg-gray-50"
          >
            로그아웃
          </button>
        )}

        <h1 className="text-4xl font-extrabold text-center">게시판</h1>

        {/* 칩(탭) */}
        <div className="mt-10 flex justify-center gap-6 flex-wrap">
          {BOARD_TYPES.map((b) => {
            const active = b.id === boardId;

            return (
              <button
                key={b.id}
                onClick={() => setBoardId(b.id)}
                className="flex flex-col items-center gap-2"
              >
                <div
                  className={[
                    "w-20 h-20 rounded-2xl border flex items-center justify-center transition",
                    active ? "bg-blue-600 border-blue-600" : "bg-white border-gray-200 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <span className={active ? "text-white font-bold" : "text-blue-600 font-bold"}>
                    {b.name.slice(0, 2)}
                  </span>
                </div>
                <div className={active ? "text-sm font-semibold" : "text-sm text-gray-700"}>
                  {b.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
