import React from "react";
import { BOARD_TYPES } from "../../pages/board/BoardTypes";
import { Search } from "lucide-react";

export default function BoardHeader({ boardId, setBoardId, keyword, setKeyword, onSearch }) {
  return (
    <div className="board">
      <div className="max-w-5xl mx-auto px-6 py-14 relative">
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

        {/* 검색 */}
        <div className="mt-10 max-w-xl mx-auto flex gap-2">
          <input
            className="flex-1 border rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-200"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="검색어"
          />
          <button
            onClick={onSearch}
            className="px-4 rounded-xl bg-blue-600 text-white font-semibold flex items-center gap-2"
          >
            <Search size={18} />
            검색
          </button>
        </div>
      </div>
    </div>
  );
}
