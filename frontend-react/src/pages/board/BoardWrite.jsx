import React, { useState } from "react";
import { api } from "../../api/client";

export default function BoardWrite({ boardId, onSuccess }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async () => {
    const t = title.trim();
    const c = content.trim();

    // 공백 검증
    if (!t) return setErrorMsg("제목을 입력.");
    if (!c) return setErrorMsg("내용을 입력.");
    if (t.length < 2) return setErrorMsg("제목은 2글자 이상!");
    if (c.length < 5) return setErrorMsg("내용은 5글자 이상!");

    try {
      setLoading(true);
      setErrorMsg("");

      // axios.post -> api.post (토큰 자동 첨부)
      await api.post("/boards", {
        boardId: Number(boardId),
        title: t,
        content: c,
      });

      setTitle("");
      setContent("");
      onSuccess?.();
    } catch (e) {
      console.log("✅ status:", e.response?.status);
      console.log("✅ data:", e.response?.data);
      console.log("✅ payload:", { boardId, title: t, content: c });
      console.log("✅ full error:", e);

      if (e?.response?.status === 401) {
        setErrorMsg("로그인이 필요합니다.");
      } else if (e?.response?.status === 403) {
        setErrorMsg("권한이 없습니다(ROLE 확인).");
      } else {
        setErrorMsg(e?.response?.data?.message || "글 등록 실패");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-2xl p-5 mt-6 bg-white">
      <input
        className="w-full border p-3 mb-3 rounded-xl"
        placeholder="제목"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={loading}
      />

      <textarea
        className="w-full border p-3 mb-3 rounded-xl min-h-[120px]"
        placeholder="내용"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={loading}
      />

      {errorMsg && (
        <div className="mb-3 text-sm text-red-600">{errorMsg}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded-xl disabled:opacity-60"
      >
        {loading ? "등록 중..." : "글 등록"}
      </button>
    </div>
  );
}
