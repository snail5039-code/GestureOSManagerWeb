import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import BoardHeader from "../../components/layout/BoardHeader";
import BoardWrite from "./BoardWrite";
import { BOARD_TYPES } from "./BoardTypes";
import { api } from "../../api/client";

export default function Board() {
  const [cPage, setCPage] = useState(1);
  const [boardId, setBoardId] = useState(2);
  const [boards, setBoards] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchType, setSearchType] = useState("title");

  const [pageInfo, setPageInfo] = useState({
    totalPagesCnt: 1,
    begin: 1,
    end: 1,
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const nav = useNavigate();

  const hhmm = (v) => {
    if (!v) return "-";
    const s = String(v);
    if (s.includes("T")) return s.split("T")[1].slice(0, 5);
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    return "-";
  };

  const title = useMemo(
    () => BOARD_TYPES.find((b) => b.id === boardId)?.name ?? "게시판",
    [boardId]
  );

  const fetchBoards = async () => {
    try {
      setLoading(true);
      setErrorMsg("");

      const res = await api.get("/boards", {
        params: { boardId, cPage, searchType, searchKeyword }
      });

      // 서버에서 보정해서 내려준 cPage로 상태 동기화
      if (res.data.cPage !== cPage) {
        setCPage(res.data.cPage);
      }

      setBoards(res.data.articles || []);
      setPageInfo({
        totalPagesCnt: res.data.totalPagesCnt,
        begin: res.data.begin,
        end: res.data.end,
      });
    } catch (e) {
      console.error(e);
      setErrorMsg("목록 로드 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoards();
  }, [boardId, cPage]);

  const handleSearch = () => setCPage(1);

  // ✅ 중요: 서버가 준 begin ~ end 만큼만 정확히 생성
  const pageNumbers = useMemo(() => {
    const pages = [];
    for (let i = pageInfo.begin; i <= pageInfo.end; i++) {
      pages.push(i);
    }
    return pages.length > 0 ? pages : [1];
  }, [pageInfo]);

  return (
    <>
      <BoardHeader boardId={boardId} setBoardId={setBoardId} title={title} />

      <div className="max-w-4xl mx-auto p-6">
        <BoardWrite boardId={boardId} onSuccess={fetchBoards} />

        <div className="flex gap-2 mb-4 justify-end">
          <select className="border p-2 rounded" value={searchType} onChange={(e) => setSearchType(e.target.value)}>
            <option value="title">제목</option>
            <option value="content">내용</option>
            <option value="title,content">제목+내용</option>
          </select>
          <input
            type="text"
            className="border p-2 rounded"
            placeholder="검색어 입력"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button className="bg-indigo-600 text-white px-4 py-2 rounded" onClick={handleSearch}>검색</button>
        </div>

        <ul className="border rounded-2xl divide-y bg-white">
          {loading ? (
            <li className="p-10 text-center">불러오는 중...</li>
          ) : boards.length === 0 ? (
            <li className="p-10 text-center text-gray-400">아직 글이 없음</li>
          ) : (
            boards.map((b) => (
              <li key={b.id} className="p-4 hover:bg-gray-50 cursor-pointer" onClick={() => nav(`/board/${b.id}`)}>
                <div className="font-medium">{b.title}</div>
                <div className="text-sm text-gray-500 flex gap-4 mt-1">
                  <span>작성자: {b.writerName || "익명"}</span>
                  <span>작성일: {hhmm(b.regDate)}</span>
                </div>
              </li>
            ))
          )}
        </ul>

        {/* 페이지네이션 */}
        <div className="flex justify-center mt-6 gap-2">
          <button className="px-3 py-1 border rounded disabled:opacity-30" onClick={() => setCPage(1)} disabled={cPage === 1}>&lt;&lt;</button>
          <button className="px-3 py-1 border rounded disabled:opacity-30" onClick={() => setCPage(Math.max(1, cPage - 1))} disabled={cPage === 1}>&lt;</button>

          {pageNumbers.map((p) => (
            <button
              key={p}
              className={`px-3 py-1 border rounded ${cPage === p ? "bg-indigo-600 text-white" : "hover:bg-gray-100"}`}
              onClick={() => setCPage(p)}
            >
              {p}
            </button>
          ))}

          <button className="px-3 py-1 border rounded disabled:opacity-30" onClick={() => setCPage(Math.min(pageInfo.totalPagesCnt, cPage + 1))} disabled={cPage >= pageInfo.totalPagesCnt}>&gt;</button>
          <button className="px-3 py-1 border rounded disabled:opacity-30" onClick={() => setCPage(pageInfo.totalPagesCnt)} disabled={cPage >= pageInfo.totalPagesCnt}>&gt;&gt;</button>
        </div>
      </div>
    </>
  );
}