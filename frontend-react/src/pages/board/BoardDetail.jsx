import React, { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useModal } from "../../context/ModalContext";
import LikeButton from "../../components/common/LikeButton";
import CommentSection from "../../components/comment/CommentSection";
import { useTranslation } from "react-i18next";

const BOARD_TYPES = [
  { id: 1, key: "notice" },
  { id: 2, key: "free" },
  { id: 3, key: "qna" },
  { id: 4, key: "error" }
];

export default function BoardDetail() {
  const { t } = useTranslation("board");
  const { id } = useParams();
  const nav = useNavigate();
  const { showModal } = useModal();

  const [article, setArticle] = useState(null);
  const lastHitIdRef = useRef(null);

  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        const res = await api.get(`/boards/${id}`);
        setArticle(res.data);

        if (lastHitIdRef.current !== id) {
          lastHitIdRef.current = id;
          try {
            const hitRes = await api.patch(`/boards/${id}/hit`);
            if (hitRes?.data?.hit != null) {
              setArticle((prev) => (prev ? { ...prev, hit: hitRes.data.hit } : prev));
            } else {
              setArticle((prev) => (prev ? { ...prev, hit: (prev.hit || 0) + 1 } : prev));
            }
          } catch (hitErr) {
            console.warn("View count update failed", hitErr);
          }
        }
      } catch (e) {
        console.error(e);
        const status = e?.response?.status;
        const message = status === 404 ? t("modal.notFound") : t("modal.detailFail");

        showModal({
          title: t("modal.errorTitle"),
          message,
          type: "error",
          onClose: () => nav("/board", { replace: true })
        });
      }
    })();
  }, [id, nav, showModal, t]);

  const boardName = useMemo(() => {
    const typeId = article?.boardId ?? article?.boardTypeId;
    const key = BOARD_TYPES.find((b) => b.id === Number(typeId))?.key;
    return key ? t(`board.types.${key}`) : t("board.default");
  }, [article, t]);

  const handleDelete = () => {
    showModal({
      title: t("modal.deleteTitle"),
      message: t("modal.deleteConfirm"),
      type: "warning",
      children: (
        <div className="flex gap-3">
          <button
            onClick={async () => {
              try {
                await api.delete(`/boards/${id}`);
                nav("/board", { replace: true });
                showModal({
                  title: t("modal.deleteSuccessTitle"),
                  message: t("modal.deleteSuccessMsg"),
                  type: "success"
                });
              } catch (e) {
                showModal({
                  title: t("modal.deleteFailTitle"),
                  message: e?.response?.data?.message || t("modal.deleteFailMsg"),
                  type: "error"
                });
              }
            }}
            className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black hover:bg-rose-700 transition-all shadow-lg shadow-rose-100"
          >
            {t("modal.deleteAction")}
          </button>
        </div>
      )
    });
  };

  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] p-8 text-[var(--text)]">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => nav("/board")}
          className="mb-8 flex items-center gap-2 text-slate-300 font-black hover:text-[var(--accent)] transition-colors group"
        >
          <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          {t("backToList")}
        </button>

        <div className="rounded-[3rem] overflow-hidden border border-[var(--border)] bg-[rgba(18,27,47,0.94)] shadow-2xl animate-fade-in">
          <div className="p-12">
            <div className="flex items-center gap-3 mb-6">
              <span className="px-4 py-1.5 bg-[var(--accent)]/20 text-[var(--accent)] text-xs font-black rounded-full border border-[rgba(59,130,246,0.35)] uppercase tracking-widest">
                {boardName}
              </span>
              <span className="text-sm font-bold text-slate-300">#{article.id}</span>
            </div>

            <h1 className="text-4xl font-black text-slate-100 tracking-tight mb-8 leading-tight">
              {article.title}
            </h1>

            <div className="flex items-center justify-between pb-8 border-b border-[var(--border)] mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[var(--surface-soft)] rounded-2xl flex items-center justify-center text-slate-300">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-base font-black text-slate-100">
                    {article.writerName || t("anonymous")}
                  </div>
                  <div className="text-xs font-bold text-slate-400">{article.regDate}</div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-xs font-black text-slate-300 uppercase tracking-widest mb-1">
                    {t("viewsLabel")}
                  </div>
                  <div className="text-lg font-black text-slate-100">{article.hit || 0}</div>
                </div>
              </div>
            </div>

            <div className="prose prose-invert max-w-none min-h-[300px] text-slate-100 font-bold leading-relaxed whitespace-pre-wrap">
              {article.content}
            </div>

            <div className="mt-12 pt-12 border-t border-[var(--border)] flex items-center justify-between">
              <LikeButton
                targetId={id}
                targetType="article"
                initialLiked={article.isLiked}
                initialCount={article.likeCount}
              />

              <div className="flex gap-3">
                {article.canModify && (
                  <button
                    onClick={() => nav(`/board/${id}/modify`)}
                    className="px-6 py-3 bg-[var(--surface-soft)] border border-[var(--border)] text-slate-100 rounded-2xl font-black hover:bg-[var(--surface)] transition-all shadow-sm active:scale-95"
                  >
                    {t("modify.title")}
                  </button>
                )}
                {article.canDelete && (
                  <button
                    onClick={handleDelete}
                    className="px-6 py-3 bg-rose-500/10 text-rose-300 border border-rose-500/30 rounded-2xl font-black hover:bg-rose-500/20 transition-all shadow-sm active:scale-95"
                  >
                    {t("modal.deleteAction")}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-[var(--surface-soft)] p-12 border-t border-[var(--border)]">
            <CommentSection relTypeCode="article" relId={id} />
          </div>
        </div>
      </div>
    </div>
  );
}
