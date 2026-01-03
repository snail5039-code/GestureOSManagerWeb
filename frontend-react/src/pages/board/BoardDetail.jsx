import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { BOARD_TYPES } from "./BoardTypes"; 

export default function BoardDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [article, setArticle] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        setErrorMsg("");
        const res = await api.get(`/boards/${id}`);
        setArticle(res.data);
      } catch (e) {
        console.error(e);
        setErrorMsg("상세를 불러오지 못힘. 존재하지 않는 글일 수 있음");
      }
    })();
  }, [id]);

  // 게시판 이름 계산
  const boardName = useMemo(() => {
    const typeId = article?.boardId ?? article?.boardTypeId; // 백 응답 필드명에 맞추기
    return BOARD_TYPES.find((b) => b.id === Number(typeId))?.name ?? "게시판";
  }, [article]);

  if (errorMsg) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="border rounded-xl p-4 bg-red-50 text-red-700">
          {errorMsg}
        </div>
        <button className="mt-4 px-4 py-2 rounded-xl border" onClick={() => nav("/board")}>
          목록으로
        </button>
      </div>
    );
  }

  if (!article) return <div className="p-10 text-center">로딩중...</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white border rounded-2xl p-6">
        <h1 className="text-2xl font-extrabold">{article.title}</h1>

        {/* 게시판 + 작성자 + 날짜 */}
        <div className="text-sm text-gray-500 mt-2 flex flex-wrap gap-4">
          <span>게시판: {boardName}</span>
          <span>
            작성자: {article?.writerName ?? article.WriterName ?? "알 수 없음"}
          </span>
          <span>작성일: {article.regDate}</span>
          <span>수정일: {article.updateDate}</span>
        </div>

        <div className="mt-6 whitespace-pre-wrap">{article.content}</div>

        <button className="mt-6 px-4 py-2 rounded-xl border" onClick={() => nav("/board")}>
          목록
        </button>
        <button className="mt-6 px-4 py-2 rounded-xl border" onClick={() => nav(`/board/${id}/modify`)}>
          수정
        </button>
        <button
          className="mt-6 px-4 py-2 rounded-xl border"
          onClick={async () => {
            try {
             if (!confirm("정말 삭제?")) return;
               await api.delete(`/boards/${id}`);
               nav("/board");
            } catch (e) {
            console.error(e);
            alert(e?.response?.data?.message || "삭제 실패");
            }
          }}>
         삭제
        </button>
      </div>
    </div>
  );
}
