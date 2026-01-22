import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { useModal } from "../../context/ModalContext";
import { useTranslation } from "react-i18next";

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function BoardWrite() {
  const { t } = useTranslation("board");
  const [searchParams] = useSearchParams();
  const boardId = Number(searchParams.get("boardId")) || 2;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const nav = useNavigate();
  const { showModal } = useModal();

  const canSubmit = useMemo(() => {
    return title.trim().length > 0 && content.trim().length > 0 && !loading;
  }, [title, content, loading]);

  const handleSubmit = async (e) => {
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
      await api.post("/boards", { boardId, title: tt, content: cc });

      showModal({
        title: t("modal.writeSuccessTitle"),
        message: t("modal.writeSuccessMsg"),
        type: "success",
        onClose: () => nav("/board"),
      });
    } catch (e2) {
      console.error(e2);
      showModal({
        title: t("modal.writeFailTitle"),
        message: e2?.response?.data?.message || t("modal.writeFailMsg"),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[var(--bg)] text-[var(--text)]">
      {/* 라이트(홈) 톤 배경: 과한 다크 비네팅 제거, 은은한 하이라이트만 */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_0%,rgba(37,99,235,0.10),rgba(0,0,0,0))]" />
        <div className="absolute inset-0 bg-[radial-gradient(70%_70%_at_80%_20%,rgba(99,102,241,0.08),rgba(0,0,0,0))]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 py-10">
        {/* 상단 back */}
        <button
          onClick={() => nav(-1)}
          className={cn(
            "mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all",
            "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted)]",
            "hover:border-[var(--accent)] hover:text-[var(--text)]"
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          {t("writePage.back")}
        </button>

        {/* 메인 카드 */}
        <div
          className={cn(
            "rounded-[3rem] border p-10 md:p-12",
            "border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl",
            "shadow-[0_18px_45px_rgba(15,23,42,0.14)]"
          )}
        >
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--text-strong)]">
              {t("writePage.title")}
            </h1>
            <p className="mt-2 text-sm md:text-base font-semibold text-[var(--muted)]">
              {t("writePage.desc")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-7">
            {/* 제목 */}
            <div>
              <label className="block text-sm font-black mb-2 ml-1 text-[var(--text)]">
                {t("writePage.labelTitle")}
              </label>
              <input
                className={cn(
                  "w-full rounded-2xl border px-6 py-4 text-sm font-bold outline-none transition-all",
                  "bg-[var(--surface-soft)] border-[var(--border)] text-[var(--text)]",
                  "placeholder:text-[var(--muted)]",
                  "focus:ring-2 focus:ring-[var(--accent)]/25 focus:border-[var(--accent)]/40",
                  "disabled:opacity-60"
                )}
                placeholder={t("writePage.placeholderTitle")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={loading}
                autoComplete="off"
              />
            </div>

            {/* 내용 */}
            <div>
              <label className="block text-sm font-black mb-2 ml-1 text-[var(--text)]">
                {t("writePage.labelContent")}
              </label>
              <textarea
                className={cn(
                  "w-full rounded-2xl border px-6 py-4 text-sm font-bold outline-none transition-all resize-none",
                  "bg-[var(--surface-soft)] border-[var(--border)] text-[var(--text)]",
                  "placeholder:text-[var(--muted)]",
                  "focus:ring-2 focus:ring-[var(--accent)]/25 focus:border-[var(--accent)]/40",
                  "disabled:opacity-60",
                  "min-h-[420px] md:min-h-[520px]"
                )}
                placeholder={t("writePage.placeholderContent")}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={loading}
              />
              <div className="mt-2 text-xs text-[var(--muted)]">
                {t("writePage.hint", {
                  defaultValue: "작성 내용은 저장 후 게시글에서 확인할 수 있어요.",
                })}
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex flex-col md:flex-row gap-4 pt-2">
              <button
                type="button"
                onClick={() => nav(-1)}
                className={cn(
                  "md:flex-1 rounded-2xl py-5 font-black transition-all active:scale-[0.99]",
                  "border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted)]",
                  "hover:text-[var(--text)] hover:border-[var(--accent)]/40"
                )}
                disabled={loading}
              >
                {t("writePage.cancel")}
              </button>

              <button
                type="submit"
                disabled={!canSubmit}
                className={cn(
                  "md:flex-[2] rounded-2xl py-5 font-black transition-all active:scale-[0.99]",
                  "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]",
                  "shadow-[0_18px_55px_rgba(37,99,235,0.22)]",
                  "disabled:opacity-60 disabled:hover:bg-[var(--accent)]"
                )}
              >
                {loading ? t("writePage.submitting") : t("writePage.submit")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
