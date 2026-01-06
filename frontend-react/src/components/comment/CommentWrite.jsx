import React, { useState } from "react";
import { api } from "../../api/client";

export default function CommentWrite({ relTypeCode, relId, parentId = null, onSuccess, onCancel = null }) {
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim()) return;

        try {
            setLoading(true);
            await api.post(`/comments/${relTypeCode}/${relId}`, {
                content,
                parentId,
            });
            setContent("");
            if (onSuccess) onSuccess();
        } catch (e) {
            console.error(e);
            alert(e?.response?.data?.message || "댓글 작성 실패");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="mt-4">
            <div className="flex flex-col gap-2">
                <textarea
                    className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                    rows={parentId ? 2 : 3}
                    placeholder={parentId ? "답글을 입력하세요..." : "댓글을 입력하세요..."}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                        >
                            취소
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={loading || !content.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                    >
                        {loading ? "작성 중..." : parentId ? "답글 등록" : "댓글 등록"}
                    </button>
                </div>
            </div>
        </form>
    );
}
