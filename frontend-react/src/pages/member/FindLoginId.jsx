import React, { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../api/client";
import { useModal } from "../../context/ModalContext";
import { useTranslation } from "react-i18next";

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function FindLoginId() {
  const navigate = useNavigate();
  const { showModal } = useModal();
  const { t } = useTranslation(["member"]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const ui = useMemo(() => {
    const page =
      "min-h-screen w-full flex items-center justify-center px-6 py-16 " +
      "bg-slate-950 text-slate-100 " +
      "bg-[radial-gradient(1200px_700px_at_20%_10%,rgba(16,185,129,0.12),transparent_60%),radial-gradient(900px_520px_at_80%_0%,rgba(34,211,238,0.10),transparent_55%),radial-gradient(900px_520px_at_50%_100%,rgba(99,102,241,0.08),transparent_55%)]";

    const card =
      "w-full max-w-xl rounded-2xl border border-slate-700/40 " +
      "bg-slate-900/60 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.55)] " +
      "px-10 py-10";

    const badge =
      "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs " +
      "border border-emerald-400/25 bg-emerald-400/10 text-emerald-200";

    const title = "text-3xl font-extrabold tracking-tight text-slate-50";
    const subtitle = "mt-2 text-sm text-slate-300/85";

    const label = "mb-2 ml-0.5 block text-sm font-semibold text-slate-200/90";

    const input =
      "w-full rounded-xl bg-slate-950/40 border border-slate-700/60 " +
      "px-4 py-3.5 text-slate-100 placeholder:text-slate-500 " +
      "outline-none transition " +
      "focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/25";

    const primaryBtn =
      "w-full rounded-xl py-3.5 font-extrabold tracking-wide " +
      "bg-emerald-500 text-slate-950 " +
      "shadow-[0_10px_30px_rgba(16,185,129,0.15)] " +
      "hover:bg-emerald-400 active:scale-[0.99] transition " +
      "disabled:opacity-60 disabled:cursor-not-allowed";

    const secondaryBtn =
      "w-full rounded-xl py-3.5 font-bold " +
      "bg-slate-900/40 border border-slate-700/60 text-slate-200 " +
      "hover:bg-slate-900/70 active:scale-[0.99] transition";

    const link =
      "text-sm font-semibold text-slate-200/85 underline-offset-4 " +
      "hover:text-emerald-200 hover:underline transition";

    const dividerDot = "h-1 w-1 rounded-full bg-slate-600/70";

    return {
      page,
      card,
      badge,
      title,
      subtitle,
      label,
      input,
      primaryBtn,
      secondaryBtn,
      link,
      dividerDot,
    };
  }, []);

  const handleFindLoginId = async () => {
    if (!name.trim()) {
      return showModal({
        title: t("member:findLoginId.modal.inputError"),
        message: t("member:findLoginId.modal.needName"),
        type: "warning",
      });
    }

    if (!email.trim()) {
      return showModal({
        title: t("member:findLoginId.modal.inputError"),
        message: t("member:findLoginId.modal.needEmail"),
        type: "warning",
      });
    }

    setLoading(true);
    try {
      // 서버 응답에 loginId가 와도 "이메일로 안내 전송"만 안내
      await api.post("/members/findLoginId", { name, email });

      showModal({
        title: t("member:findLoginId.modal.successTitle"),
        message: "입력하신 이메일로 안내를 전송했습니다.",
        type: "success",
        onClose: () => navigate("/login"),
      });
    } catch (error) {
      console.error(error);
      showModal({
        title: t("member:findLoginId.modal.failTitle"),
        message:
          error.response?.data?.message ||
          t("member:findLoginId.modal.failDefault"),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={ui.page}>
      <div className={ui.card}>
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link
            to="/login"
            className="text-xs font-semibold text-slate-300/85 hover:text-slate-100 transition"
          >
            ← 로그인으로
          </Link>

          <span className={ui.badge}>
            <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.85)]" />
            Secure Access
          </span>
        </div>

        <div className="mb-10">
          <h1 className={ui.title}>{t("member:findLoginId.title")}</h1>
          <p className={ui.subtitle}>{t("member:findLoginId.subtitle")}</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className={ui.label}>{t("member:findLoginId.field.name")}</label>
            <input
              type="text"
              placeholder={t("member:findLoginId.placeholder.name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={ui.input}
              autoComplete="name"
            />
          </div>

          <div>
            <label className={ui.label}>
              {t("member:findLoginId.field.email")}
            </label>
            <input
              type="email"
              placeholder={t("member:findLoginId.placeholder.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={ui.input}
              autoComplete="email"
            />
          </div>

          <div className="pt-2 space-y-3">
            <button
              onClick={handleFindLoginId}
              disabled={loading}
              className={ui.primaryBtn}
            >
              {loading
                ? t("member:findLoginId.btn.loading")
                : t("member:findLoginId.btn.submit")}
            </button>

            <button onClick={() => navigate(-1)} className={ui.secondaryBtn}>
              {t("member:findLoginId.btn.back")}
            </button>
          </div>

          <div className="pt-2 flex items-center justify-center gap-5">
            <Link to="/findLoginPw" className={ui.link}>
              {t("member:findLoginId.link.findPw")}
            </Link>
            <span className={ui.dividerDot} />
            <Link to="/login" className={ui.link}>
              {t("member:findLoginId.link.login")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
