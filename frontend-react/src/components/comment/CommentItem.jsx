import React, { useMemo, useState } from "react";
import { api } from "../../api/client";
import { useTranslation } from "react-i18next";
import defaultAvatar from "../../assets/default-avatar.png";
import CommentWrite from "./CommentWrite";

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

// ✅ 중요: 이미지/파일은 보통 "백엔드(8080)"에서 서빙됨.
// 개발환경이면 .env.development에 VITE_API_ORIGIN=http://localhost:8080 꼭 넣어줘.
const API_ORIGIN =
  import.meta.env?.VITE_API_ORIGIN ||
  import.meta.env?.VITE_BACKEND_ORIGIN ||
  "";

function resolveProfileSrc(rawUrl, bust = "") {
  if (!rawUrl) return defaultAvatar;

  // 공백/따옴표 제거
  const cleaned = String(rawUrl).trim().replace(/^"+|"+$/g, "");
  if (!cleaned) return defaultAvatar;

  const isAbsolute = /^https?:\/\//i.test(cleaned);
  let full = cleaned;

  if (!isAbsolute) {
    const normalized = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;

    // ✅ 백엔드 오리진을 아는 경우(권장)
    if (API_ORIGIN) full = `${API_ORIGIN}${normalized}`;
    // ✅ 모르면 일단 현재 오리진(프론트)로…(하지만 dev에선 5173이라 이미지 안 뜰 수 있음)
    else full = `${window.location.origin}${normalized}`;
  }

  if (!bust) return full;
  const sep = full.includes("?") ? "&" : "?";
  return `${full}${sep}v=${encodeURIComponent(bust)}`;
}

function formatDateSafe(raw) {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw).slice(0, 10);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export default function CommentItem({
  comment,
  relTypeCode,
  relId,
  avatarBust,
  onChanged,
  depth = 0,
}) {
  const { t } = useTranslation("board");

  const [menuOpen, setMenuOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment?.content || "");
  const [saving, setSaving] = useState(false);

  const isReply = depth > 0 || comment?.parentId != null;

  const displayName = useMemo(() => {
    return (
      comment?.writerNickname ||
      comment?.writerName ||
      comment?.nickname ||
      comment?.writer?.nickname ||
      comment?.writer?.name ||
      "User"
    );
  }, [comment]);

  // ✅ 필드명 흔들려도 최대한 줍기
  const profileRaw = useMemo(() => {
    return (
      comment?.writerProfileImageUrl ||
      comment?.profileImageUrl ||
      comment?.profileImg ||
      comment?.profileImage ||
      comment?.writer?.profileImageUrl ||
      comment?.writer?.profileImg ||
      ""
    );
  }, [comment]);

  const profileSrc = useMemo(
    () => resolveProfileSrc(profileRaw, avatarBust),
    [profileRaw, avatarBust]
  );

  const dateText = useMemo(() => {
    return formatDateSafe(
      comment?.regDate ||
        comment?.createDate ||
        comment?.createdAt ||
        comment?.updateDate
    );
  }, [comment]);

  // ✅ 서버 필드 흔들려도 인식
  const canEdit = Boolean(comment?.canEdit ?? comment?.canModify);
  const canDelete = Boolean(comment?.canDelete);

  // ✅ 들여쓰기 폭 강화
  const indent = Math.min(depth, 6) * 28;

  const handleDelete = async () => {
    if (!confirm(t("comment.confirmDelete", { defaultValue: "삭제할까요?" })))
      return;
    try {
      await api.delete(`/comments/${comment.id}`);
      onChanged?.();
    } catch (e) {
      console.error(e);
      alert(
        e?.response?.data?.message ||
          t("comment.deleteFail", { defaultValue: "삭제 실패" })
      );
    }
  };

  const startEdit = () => {
    setMenuOpen(false);
    setEditing(true);
    setEditText(comment?.content || "");
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditText(comment?.content || "");
  };

  const submitEdit = async () => {
    if (!editText.trim())
      return alert(
        t("comment.needContent", { defaultValue: "내용을 입력해 주세요." })
      );
    try {
      setSaving(true);
      await api.put(`/comments/${comment.id}`, { content: editText });
      setEditing(false);
      onChanged?.();
    } catch (e) {
      console.error(e);
      alert(
        e?.response?.data?.message ||
          t("comment.editFail", { defaultValue: "수정 실패" })
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative" style={{ marginLeft: indent }}>
      {/* ✅ 대댓글 스레드 라인(세로줄 + ㄴ자) */}
      {isReply && (
        <>
          <span
            className="absolute left-[-18px] top-0 bottom-0 w-px bg-[var(--line)]"
            aria-hidden="true"
          />
          <span
            className="absolute left-[-18px] top-[22px] w-[18px] h-px bg-[var(--line)]"
            aria-hidden="true"
          />
          <span
            className="absolute left-[-20px] top-[20px] w-2 h-2 rounded-full bg-[var(--line)]"
            aria-hidden="true"
          />
        </>
      )}

      <div
        className={cn(
          "rounded-3xl border border-[var(--border)] p-4",
          "bg-[var(--surface-soft)]/50",
          isReply && "bg-[var(--surface)]/35 border-[var(--accent)]/20"
        )}
      >
        <div className="flex items-start gap-3">
          {/* ✅ 프로필 */}
          <div className="h-10 w-10 rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--surface)]/60 shrink-0">
            <img
              src={profileSrc}
              alt={displayName}
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = defaultAvatar;
              }}
              draggable={false}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-black text-[var(--text-strong)] truncate">
                    {displayName}
                  </div>

                  {isReply && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] text-[var(--text)] bg-[var(--surface)]/60 border border-[var(--border)]">
                      답글
                    </span>
                  )}

                  {dateText && (
                    <div className="text-xs text-[var(--muted)]">{dateText}</div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReplyOpen((v) => !v)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/40 px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--text-strong)] transition-all"
                >
                  {replyOpen
                    ? t("comment.hideReply", { defaultValue: "답글 닫기" })
                    : t("comment.reply", { defaultValue: "답글" })}
                </button>

                {(canEdit || canDelete) && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuOpen((v) => !v)}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/40 px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--text-strong)] transition-all"
                    >
                      {t("comment.menu", { defaultValue: "메뉴" })}
                    </button>

                    {menuOpen && (
                      <div className="absolute right-0 mt-2 w-32 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-2 shadow-[0_18px_40px_rgba(6,12,26,0.55)] z-50">
                        {canEdit && (
                          <button
                            type="button"
                            className="w-full rounded-xl px-3 py-2 text-left text-xs text-[var(--muted)] hover:text-[var(--text-strong)] hover:bg-[rgba(59,130,246,0.15)] transition-all"
                            onClick={startEdit}
                          >
                            {t("comment.edit", { defaultValue: "수정" })}
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="w-full rounded-xl px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-500/15 transition-all"
                            onClick={handleDelete}
                          >
                            {t("comment.delete", { defaultValue: "삭제" })}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 본문 / 수정모드 */}
            {!editing ? (
              <div className="mt-2 text-sm text-[var(--text)] whitespace-pre-wrap break-words">
                {comment?.content}
              </div>
            ) : (
              <div className="mt-3">
                <textarea
                  className={cn(
                    "w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--text)]",
                    "placeholder:text-[var(--muted)] outline-none resize-none transition-all",
                    "focus:ring-2 focus:ring-[var(--accent)]/35 focus:border-[var(--accent)]/40"
                  )}
                  rows={3}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-xl border border-[var(--border)] bg-transparent px-4 py-2 text-xs text-[var(--muted)] hover:text-[var(--text-strong)] hover:border-[var(--accent)]/40 transition-all"
                  >
                    {t("comment.cancel", { defaultValue: "취소" })}
                  </button>
                  <button
                    type="button"
                    disabled={saving || !editText.trim()}
                    onClick={submitEdit}
                    className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-strong)] transition-all disabled:opacity-50"
                  >
                    {saving
                      ? t("comment.saving", { defaultValue: "저장 중..." })
                      : t("comment.save", { defaultValue: "저장" })}
                  </button>
                </div>
              </div>
            )}

            {/* 답글 작성 */}
            {replyOpen && (
              <CommentWrite
                relTypeCode={relTypeCode}
                relId={relId}
                parentId={comment.id}
                onSuccess={onChanged}
                onCancel={() => setReplyOpen(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* ✅ 자식(대댓글) 렌더링 */}
      {Array.isArray(comment?.children) && comment.children.length > 0 && (
        <div className="mt-3 space-y-3">
          {comment.children.map((child) => (
            <CommentItem
              key={child.id}
              comment={child}
              relTypeCode={relTypeCode}
              relId={relId}
              avatarBust={avatarBust}
              onChanged={onChanged}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
