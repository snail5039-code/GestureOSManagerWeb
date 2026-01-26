import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { useModal } from "../../context/ModalContext";
import SocialLoginButtons from "./SocialLoginButtons";
import { useTranslation } from "react-i18next";

export default function Login() {
  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [loading, setLoading] = useState(false);

  const { t } = useTranslation(["member", "common"]);
  const { loginWithToken } = useAuth();
  const { showModal } = useModal();
  const nav = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();

    const i = loginId.trim();
    const p = loginPw.trim();

    if (!i || !p) {
      showModal({
        title: t("member:login.modal.inputError"),
        message: t("member:login.modal.needBoth"),
        type: "warning",
      });
      return;
    }

    try {
      setLoading(true);

      const res = await api.post("/members/login", { loginId: i, loginPw: p });

      if (!res || res.status < 200 || res.status >= 300) {
        const e = new Error("HTTP_ERROR");
        e.response = res;
        throw e;
      }

      const token =
        res?.data?.accessToken ??
        res?.data?.token ??
        res?.data?.data?.accessToken ??
        res?.headers?.authorization?.replace(/^Bearer\s+/i, "");

      if (!token) {
        const e = new Error("NO_TOKEN");
        e.response = res;
        throw e;
      }

      // ✅ 핵심: 토큰 저장 + /members/me까지 안정적으로 로드
      await loginWithToken(token);

      showModal({
        title: t("member:login.modal.successTitle"),
        message: t("member:login.modal.successWelcome", { name: res?.data?.name || i }),
        type: "success",
        onClose: () => nav("/home", { replace: true }),
      });
    } catch (err) {
      console.error("LOGIN_ERR:", err);

      const status = err?.response?.status;

      const errorMsg =
        status === 401
          ? t("member:login.modal.fail401")
          : err?.message === "NO_TOKEN"
            ? t("member:login.modal.failDefault")
            : err?.response?.data?.message || t("member:login.modal.failDefault");

      showModal({
        title: t("member:login.modal.failTitle"),
        message: errorMsg,
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(30,58,138,0.35),_transparent_50%),linear-gradient(180deg,_var(--bg)_0%,_var(--bg-deep)_100%)] p-6">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--surface)] p-10 shadow-[0_20px_45px_rgba(6,12,26,0.55)]">
            <div className="mb-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => nav("/home")}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 text-xs text-[var(--muted)] hover:text-[color:var(--text)] hover:border-[var(--accent)]/35 transition-colors"
              >
                <span aria-hidden>←</span>
                <span className="text-[color:var(--text)]">{t("common:nav.home")}</span>
              </button>
              <div />
            </div>

            <div className="mb-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                {t("member:login.badge")}
              </div>
              <h1 className="text-3xl tracking-tight text-[color:var(--text-strong)]">
                {t("member:login.title")}
              </h1>
              <p className="mt-2 text-sm text-[var(--muted)]">{t("member:login.subtitle")}</p>
            </div>

            <form className="space-y-6" onSubmit={onSubmit}>
              <div>
                <label className="block text-xs text-[var(--muted)]">
                  {t("member:login.field.loginId")}
                </label>
                <input
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text)] outline-none focus:border-[var(--accent)]"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder={t("member:login.placeholder.loginId")}
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--muted)]">
                  {t("member:login.field.password")}
                </label>
                <input
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text)] outline-none focus:border-[var(--accent)]"
                  value={loginPw}
                  onChange={(e) => setLoginPw(e.target.value)}
                  placeholder={t("member:login.placeholder.password")}
                  type="password"
                  disabled={loading}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                <div className="flex gap-3">
                  <Link to="/findLoginId" className="hover:text-[color:var(--text)] transition-colors">
                    {t("member:login.link.findId")}
                  </Link>
                  <Link to="/findLoginPw" className="hover:text-[color:var(--text)] transition-colors">
                    {t("member:login.link.findPw")}
                  </Link>
                </div>
                <Link to="/join" className="text-[var(--accent)] hover:text-[color:var(--text)] transition-colors">
                  {t("member:login.link.join")}
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[var(--accent)] py-3 text-sm text-white shadow-[0_16px_30px_rgba(59,130,246,0.35)] hover:bg-[var(--accent-strong)] transition-all disabled:opacity-60"
              >
                {loading ? t("member:login.btn.submitting") : t("member:login.btn.submit")}
              </button>
            </form>
          </div>

          <div className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--surface)] p-10 shadow-[0_20px_45px_rgba(6,12,26,0.55)]">
            <div className="mb-6">
              <h2 className="text-lg text-[color:var(--text-strong)]">{t("member:social.title")}</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">{t("member:social.subtitle")}</p>
            </div>

            <SocialLoginButtons />

            <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-4 text-xs text-[var(--muted)]">
              {t("member:social.hint")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
