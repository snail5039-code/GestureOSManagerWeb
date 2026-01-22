import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { useModal } from "../../context/ModalContext";
import { useTranslation } from "react-i18next";

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function BoardModify() {
  const { t } = useTranslation("board");
  const { id } = useParams();
  const nav = useNavigate();
  const { showModal } = useModal();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get(`/boards/${id}`)
      .then((res) => {
        setTitle(res.data.title ?? "");
        setContent(res.data.content ?? "");
      })
      .catch((err) => {
        console.error(err);
        showModal({
          title: t("modal.errorTitle"),
          message: t("modal.detailFail"),
          type: "error",
          onClose: () => nav("/board"),
        });
      });
  }, [id, nav, showModal, t]);

  const onSave = async (e) => {
    e.preventDefault();

    const tt = title.trim();
    const cc = content.trim();

    if (!tt || !cc) {
      showModal({
        title: t("modal.inputErrorTitle"),
        message: t("modal.inputErrorMsg"),
        type: "warning",
      });
      return;
    }

    try {
      setLoading(true);
      await api.put(`/boards/${id}`, { title: tt, content: cc });

      showModal({
        title: t("modal.modifySuccessTitle"),
        message: t("modal.modifySuccessMsg"),
        type: "success",
        onClose: () => nav(`/board/${id}`),
      });
    } catch (e2) {
      console.error(e2);
      showModal({
        title: t("modal.modifyFailTitle"),
        message: e2?.response?.data?.message || t("modal.modifyFailMsg"),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-[var(--text)] bg-[var(--bg)]">
      <div className="mx-auto max-w-[980px] px-4 py-10">
        {/* back */}
        <button
          onClick={() => nav(-1)}
          className={cn(
            "mb-6 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-all",
            "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted)]",
            "hover:text-[var(--text)] hover:border-[var(--accent)]"
          )}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          {t("modify.back")}
        </button>

        {/* card */}
        <div
          className={cn(
            "rounded-[2rem] border p-6 sm:p-10",
            "border-[var(--border)] bg-[var(--glass-bg)] backdrop-blur-xl",
            "shadow-[0_18px_45px_rgba(15,23,42,0.14)]"
          )}
        >
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-strong)]">
              {t("modify.title")}
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">{t("modify.desc")}</p>
          </div>

          <form onSubmit={onSave} className="space-y-6">
            <div>
              <label className="mb-2 ml-1 block text-xs font-semibold text-[var(--muted)]">
                {t("modify.labelTitle")}
              </label>
              <input
                className={cn(
                  "w-full rounded-2xl border px-5 py-3 text-sm outline-none transition-all",
                  "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text)]",
                  "placeholder:text-[var(--muted)]",
                  "focus:ring-2 focus:ring-[var(--accent)]/25 focus:border-[var(--accent)]/40",
                  loading && "opacity-70"
                )}
                placeholder={t("modify.placeholderTitle")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="mb-2 ml-1 block text-xs font-semibold text-[var(--muted)]">
                {t("modify.labelContent")}
              </label>
              <textarea
                className={cn(
                  "w-full min-h-[420px] rounded-2xl border px-5 py-4 text-sm outline-none transition-all resize-none",
                  "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text)]",
                  "placeholder:text-[var(--muted)]",
                  "focus:ring-2 focus:ring-[var(--accent)]/25 focus:border-[var(--accent)]/40",
                  loading && "opacity-70"
                )}
                placeholder={t("modify.placeholderContent")}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => nav(-1)}
                className={cn(
                  "flex-1 rounded-2xl border py-3 text-sm transition-all active:scale-[0.99]",
                  "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted)]",
                  "hover:text-[var(--text)] hover:border-[var(--accent)]/40"
                )}
              >
                {t("modify.cancel")}
              </button>
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "flex-[2] rounded-2xl py-3 text-sm font-semibold transition-all active:scale-[0.99]",
                  "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]",
                  "shadow-[0_18px_35px_rgba(37,99,235,0.22)]",
                  "disabled:opacity-60"
                )}
              >
                {loading ? t("modify.saving") : t("modify.save")}
              </button>
            </div>
          </form>

          {/* 
            NOTE:
            이 컴포넌트 아래에 댓글/추가 섹션이 렌더링돼도
            이제 card 내부 기본 텍스트가 text-white로 죽지 않고 var(--text)로 살아있어서
            “댓글 색 안 보임”이 같이 해결되는 쪽으로 가게 됨.
          */}
        </div>
      </div>
    </div>
  );
}
