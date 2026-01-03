import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";

export default function BoardModify() {
  const { id } = useParams();
  const nav = useNavigate();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // api 인스턴스는 baseURL=/api 라서 /boards로 호출해야 함
    api.get(`/boards/${id}`).then((res) => {
      setTitle(res.data.title ?? "");
      setContent(res.data.content ?? "");
    });
  }, [id]);

  const onSave = async () => {
    try {
      setLoading(true);
      await api.put(`/boards/${id}`, { title, content }); // 토큰 자동 첨부(인터셉터)
      nav(`/board/${id}`);
    } catch (e) {
      console.error(e);
      if (e?.response?.status === 401) alert("로그인이 필요합니다.");
      else alert("수정 실패. 백엔드 확인");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-white border rounded-2xl p-6">
          <h1 className="text-xl font-extrabold">글 수정</h1>

          <input
            className="w-full border rounded-xl p-3 mt-4 outline-none focus:ring-2 focus:ring-blue-200"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
          />

          <textarea
            className="w-full border rounded-xl p-3 mt-3 min-h-[220px] outline-none focus:ring-2 focus:ring-blue-200"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={loading}
          />

          <div className="mt-6 flex gap-3">
            <button
              onClick={onSave}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-60"
            >
              저장
            </button>
            <button
              onClick={() => nav(-1)}
              disabled={loading}
              className="px-4 py-2 rounded-xl border hover:bg-gray-100 disabled:opacity-60"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
