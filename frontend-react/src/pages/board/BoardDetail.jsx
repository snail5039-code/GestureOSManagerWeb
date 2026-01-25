import React, { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useModal } from "../../context/ModalContext";
import LikeButton from "../../components/common/LikeButton";
import CommentSection from "../../components/comment/CommentSection";
import { useTranslation } from "react-i18next";
import { formatDateTimeMinute } from "../../utils/datetime";

import defaultAvatar from "../../assets/default-avatar.png";

const BOARD_TYPES = [
  { id: 1, key: "notice" },
  { id: 2, key: "free" },
  { id: 3, key: "qna" },
  { id: 4, key: "error" },
];

// ✅ QnA boardId
const QNA_BOARD_ID = 3;

// ✅ 서버 오리진 (Vite 기준)
const API_ORIGIN =
  import.meta.env?.VITE_API_ORIGIN ||
  import.meta.env?.VITE_API_URL ||
  window.location.origin;

/**
 * profileImageUrl 이
 * - "" / null -> default
 * - "/uploads/..." -> API_ORIGIN 붙여서
 * - "http..." -> 그대로
 */
function resolveProfileSrc(rawUrl, bust = "") {
  if (!rawUrl) return defaultAvatar;

  const isAbsolute = /^https?:\/\//i.test(rawUrl);
  const normalized = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  const full = isAbsolute ? rawUrl : `${API_ORIGIN}${normalized}`;

  if (!bust) return full;

  const sep = full.includes("?") ? "&" : "?";
  return `${full}${sep}v=${encodeURIComponent(bust)}`;
}

// ✅ pinned 필드 호환
const getPinnedFlag = (a) => Boolean(a?.isPinned ?? a?.is_pinned ?? false);
const getPinnedOrder = (a) => {
  const v = a?.pinnedOrder ?? a?.pinned_order ?? null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

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
          onClose: () => nav("/board", { replace: true }),
        });
      }
    })();
  }, [id, nav, showModal, t]);

  const boardName = useMemo(() => {
    const typeId = article?.boardId ?? article?.boardTypeId;
    const key = BOARD_TYPES.find((b) => b.id === Number(typeId))?.key;
    return key ? t(`board.types.${key}`) : t("board.default");
  }, [article, t]);

  // ✅ 작성자 프로필 URL 후보들 전부 커버
  const rawWriterProfileUrl =
    article?.writerProfileImageUrl ??
    article?.writer?.profileImageUrl ??
    article?.writerProfileUrl ??
    article?.profileImageUrl ??
    article?.memberProfileImageUrl ??
    article?.member?.profileImageUrl ??
    article?.writerProfileImage ??
    article?.writerProfile ??
    "";

  const writerAvatarSrc = useMemo(() => {
    const bust = String(article?.updateDate || article?.regDate || "");
    return resolveProfileSrc(rawWriterProfileUrl, bust);
  }, [rawWriterProfileUrl, article?.updateDate, article?.regDate]);

  const isPinned = getPinnedFlag(article);
  const pinnedOrder = getPinnedOrder(article);
  const isQnaPinned = (article?.boardId ?? article?.boardTypeId) === QNA_BOARD_ID && isPinned;

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
                  type: "success",
                });
              } catch (e) {
                showModal({
                  title: t("modal.deleteFailTitle"),
                  message: e?.response?.data?.message || t("modal.deleteFailMsg"),
                  type: "error",
                });
              }
            }}
            className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black hover:bg-rose-700 transition-all shadow-lg shadow-rose-100"
          >
            {t("modal.deleteAction")}
          </button>
        </div>
      ),
    });
  };

  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] p-8 text-[var(--text)]">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => nav("/board")}
          className="mb-8 flex items-center gap-2 font-black transition-colors group text-[var(--muted)] hover:text-[var(--accent)]"
        >
          <svg
            className="w-5 h-5 transition-transform group-hover:-translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          {t("backToList")}
        </button>

        <div className="rounded-[3rem] overflow-hidden border border-[var(--border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-2xl animate-fade-in">
          <div className="p-12">
            <div className="flex items-center gap-3 mb-6">
              <span className="px-4 py-1.5 bg-[var(--accent)]/15 text-[var(--accent)] text-xs font-black rounded-full border border-[var(--accent)]/30 uppercase tracking-widest">
                {boardName}
              </span>

              {/* ✅ QnA 고정글 표시 */}
              {isQnaPinned && (
                <span className="px-4 py-1.5 bg-[var(--accent)]/15 text-[var(--accent)] text-xs font-black rounded-full border border-[var(--accent)]/25 uppercase tracking-widest">
                  PIN{pinnedOrder ? ` #${pinnedOrder}` : ""}
                </span>
              )}

              <span className="text-sm font-bold text-[var(--muted)]">#{article.id}</span>
            </div>

            <h1 className="text-4xl font-black text-[var(--text-strong)] tracking-tight mb-8 leading-tight">
              {article.title}
            </h1>

            <div className="flex items-center justify-between pb-8 border-b border-[var(--border)] mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--surface-soft)] shrink-0">
                  <img
                    src={writerAvatarSrc}
                    alt="writer profile"
                    className="h-full w-full object-cover"
                    draggable={false}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = defaultAvatar;
                    }}
                  />
                </div>

                <div>
                  <div className="text-base font-black text-[var(--text-strong)]">
                    {article.writerName || t("anonymous")}
                  </div>
                  <div className="text-xs font-bold text-[var(--muted)]">
                    {formatDateTimeMinute(article.regDate)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-xs font-black text-[var(--muted)] uppercase tracking-widest mb-1">
                    {t("viewsLabel")}
                  </div>
                  <div className="text-lg font-black text-[var(--text-strong)]">{article.hit || 0}</div>
                </div>
              </div>
            </div>

            {/* ✅ QnA는 줄바꿈이 중요하니까 pre-line(줄바꿈 유지) */}
            <div className="max-w-none min-h-[300px] font-bold leading-relaxed whitespace-pre-line text-[var(--text)]">
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
                    className="px-6 py-3 bg-[var(--surface-soft)] border border-[var(--border)] text-[var(--text)] rounded-2xl font-black hover:bg-[var(--surface)] transition-all shadow-sm active:scale-95"
                  >
                    {t("modify.title")}
                  </button>
                )}
                {article.canDelete && (
                  <button
                    onClick={handleDelete}
                    className="px-6 py-3 bg-rose-500/10 text-rose-600 border border-rose-500/25 rounded-2xl font-black hover:bg-rose-500/15 transition-all shadow-sm active:scale-95"
                  >
                    {t("modal.deleteAction")}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-[var(--surface-soft)] p-12 border-t border-[var(--border)] text-[var(--text)]">
            <CommentSection relTypeCode="article" relId={id} />
          </div>
        </div>
      </div>
    </div>
  );
}
