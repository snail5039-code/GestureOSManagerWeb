import React, { useState } from "react";
import { api } from "../../api/client";
import { useTranslation } from "react-i18next";

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function CommentWrite({
  relTypeCode,
  relId,
  parentId = null,
  onSuccess,
  onCancel = null,
}) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation("board");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      setLoading(true);

      try {
        await api.post(`/comments/${relTypeCode}/${relId}`, { content, parentId });
      } catch (e1) {
        // ✅ 이제 백엔드가 body로도 받게 고쳐놔서 이 fallback도 정상 동작
        await api.post(`/comments`, { relTypeCode, relId, content, parentId });
      }

      setContent("");
      if (onSuccess) onSuccess();
      if (onCancel) onCancel();
    } catch (e) {
      console.error(e);
      alert(
        e?.response?.data?.message ||
          t("comment.writeFail", { defaultValue: "댓글 등록 실패" })
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("mt-4", parentId && "mt-3")}>
      <div className="space-y-2">
        <textarea
          className={cn(
            "w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--text)]",
            "placeholder:text-[var(--muted)] outline-none resize-none transition-all",
            "focus:ring-2 focus:ring-[var(--accent)]/35 focus:border-[var(--accent)]/40"
          )}
          rows={parentId ? 2 : 3}
          placeholder={
            parentId
              ? t("comment.placeholderReply", { defaultValue: "답글을 입력하세요..." })
              : t("comment.placeholderComment", { defaultValue: "댓글을 입력하세요..." })
          }
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        <div className="flex justify-end gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-[var(--border)] bg-transparent px-4 py-2 text-xs text-[var(--muted)] hover:text-[var(--text-strong)] hover:border-[var(--accent)]/40 transition-all"
            >
              {t("comment.cancel", { defaultValue: "취소" })}
            </button>
          )}

          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-strong)] transition-all disabled:opacity-50"
          >
            {loading
              ? t("comment.submitting", { defaultValue: "등록 중..." })
              : parentId
              ? t("comment.submitReply", { defaultValue: "답글 등록" })
              : t("comment.submitComment", { defaultValue: "댓글 등록" })}
          </button>
        </div>
      </div>
    </form>
  );
}
