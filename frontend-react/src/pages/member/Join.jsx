import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../api/client";
import { useModal } from "../../context/ModalContext";
import { useTranslation } from "react-i18next";

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function Join() {
  const nav = useNavigate();
  const { showModal } = useModal();
  const { t } = useTranslation(["member", "common"]);

  const [countries, setCountries] = useState([]);
  const [form, setForm] = useState({
    loginId: "",
    loginPw: "",
    loginPw2: "",
    name: "",
    email: "",
    nickname: "",
    countryId: "",
  });

  const [loginIdMsg, setLoginIdMsg] = useState({ text: "", color: "" });
  const [isLoginIdChecked, setIsLoginIdChecked] = useState(false);

  const [nicknameMsg, setNicknameMsg] = useState({ text: "", color: "" });
  const [isNicknameChecked, setIsNicknameChecked] = useState(false);

  // ✅ 비번 메시지: 6자리 미만 경고 + 일치/불일치
  const [pwMsg, setPwMsg] = useState({ text: "", color: "" });

  const [loading, setLoading] = useState(false);

  const [verificationCode, setVerificationCode] = useState("");
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [emailMsg, setEmailMsg] = useState({ text: "", color: "" });

  useEffect(() => {
    api
      .get("/members/countries")
      .then((res) => setCountries(res.data))
      .catch((e) => console.error("Failed to fetch countries", e));
  }, []);

  // ✅ 비밀번호 helper (6자리 미만이면 경고 우선)
  const computePwMsg = (pw, pw2) => {
    const a = (pw ?? "").trim();
    const b = (pw2 ?? "").trim();

    if (!a && !b) return { text: "", color: "" };

    // 1) 길이 경고가 최우선
    if (a && a.length > 0 && a.length < 6) {
      return {
        text: t("member:join.pw.tooShort"),
        color: "text-amber-400",
      };
    }

    // 2) 길이 OK일 때만 일치/불일치 판단
    if (a && b) {
      if (a === b) return { text: t("member:join.pw.match"), color: "text-emerald-400" };
      return { text: t("member:join.pw.mismatch"), color: "text-rose-400" };
    }

    return { text: "", color: "" };
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    const newForm = { ...form, [name]: value };
    setForm(newForm);

    if (name === "loginId") {
      setIsLoginIdChecked(false);
      setLoginIdMsg({ text: "", color: "" });
    }

    if (name === "nickname") {
      setIsNicknameChecked(false);
      setNicknameMsg({ text: "", color: "" });
    }

    if (name === "email") {
      setIsEmailVerified(false);
      setEmailMsg({ text: "", color: "" });
    }

    if (name === "loginPw" || name === "loginPw2") {
      setPwMsg(computePwMsg(newForm.loginPw, newForm.loginPw2));
    }
  };

  const handleLoginIdBlur = async () => {
    const loginId = form.loginId.trim();
    if (!loginId) return;

    try {
      const res = await api.get(`/members/checkLoginId?loginId=${encodeURIComponent(loginId)}`);

      if (res.data.result === "fail") {
        setLoginIdMsg({ text: t("member:join.msg.loginId.taken"), color: "text-rose-400" });
        setIsLoginIdChecked(false);
      } else {
        setLoginIdMsg({ text: t("member:join.msg.loginId.available"), color: "text-emerald-400" });
        setIsLoginIdChecked(true);
      }
    } catch (e) {
      setLoginIdMsg({ text: t("member:join.msg.loginId.error"), color: "text-rose-400" });
    }
  };

  const handleNicknameBlur = async () => {
    const nickname = form.nickname.trim();
    if (!nickname) return;

    try {
      const res = await api.get(`/members/checkNickname?nickname=${encodeURIComponent(nickname)}`);

      if (res.data.result === "fail") {
        setNicknameMsg({ text: t("member:join.msg.nickname.taken"), color: "text-rose-400" });
        setIsNicknameChecked(false);
      } else {
        setNicknameMsg({ text: t("member:join.msg.nickname.available"), color: "text-emerald-400" });
        setIsNicknameChecked(true);
      }
    } catch (e) {
      setNicknameMsg({ text: t("member:join.msg.nickname.error"), color: "text-rose-400" });
    }
  };

  const handleSendCode = async () => {
    if (!form.email.trim()) {
      showModal({
        title: t("member:join.modal.inputError"),
        message: t("member:join.modal.need.email"),
        type: "warning",
      });
      return;
    }

    setIsSendingCode(true);

    try {
      await api.post("/members/sendVerificationCode", { email: form.email.trim() });

      showModal({
        title: t("member:join.modal.sendOkTitle"),
        message: t("member:join.modal.sendOkBody"),
        type: "success",
      });

      setEmailMsg({ text: t("member:join.msg.email.sent"), color: "text-[var(--accent)]" });
    } catch (e) {
      showModal({
        title: t("member:join.modal.sendFailTitle"),
        message: e.response?.data?.message ?? t("member:join.modal.sendFailTitle"),
        type: "error",
      });
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      showModal({
        title: t("member:join.modal.inputError"),
        message: t("member:join.modal.need.code"),
        type: "warning",
      });
      return;
    }

    setIsVerifyingCode(true);

    try {
      await api.post("/members/verifyCode", {
        email: form.email.trim(),
        code: verificationCode.trim(),
      });

      showModal({
        title: t("member:join.modal.verifyOkTitle"),
        message: t("member:join.modal.verifyOkBody"),
        type: "success",
      });

      setIsEmailVerified(true);
      setEmailMsg({ text: t("member:join.msg.email.verified"), color: "text-emerald-400" });
    } catch (e) {
      showModal({
        title: t("member:join.modal.verifyFailTitle"),
        message: e.response?.data?.message ?? t("member:join.modal.verifyFailTitle"),
        type: "error",
      });
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const submit = async () => {
    if (!form.loginId.trim())
      return showModal({
        title: t("member:join.modal.inputError"),
        message: t("member:join.modal.need.loginId"),
        type: "warning",
      });

    if (!isLoginIdChecked)
      return showModal({
        title: t("member:join.modal.inputError"),
        message: t("member:join.modal.need.loginIdCheck"),
        type: "warning",
      });

    if (!form.loginPw.trim())
      return showModal({
        title: t("member:join.modal.inputError"),
        message: t("member:join.modal.need.password"),
        type: "warning",
      });

    // ✅ 6자리 이상 프론트에서도 즉시 차단
    if (form.loginPw.trim().length < 6)
      return showModal({
        title: t("member:join.modal.inputError"),
        message: t("member:join.pw.tooShort"),
        type: "warning",
      });

    if (form.loginPw !== form.loginPw2)
      return showModal({
        title: t("member:join.modal.inputError"),
        message: t("member:join.modal.need.passwordMismatch"),
        type: "warning",
      });

    if (!form.name.trim())
      return showModal({
        title: t("member:join.modal.inputError"),
        message: t("member:join.modal.need.name"),
        type: "warning",
      });

    if (!form.email.trim())
      return showModal({
        title: t("member:join.modal.inputError"),
        message: t("member:join.modal.need.email"),
        type: "warning",
      });

    if (!isEmailVerified)
      return showModal({
        title: t("member:join.modal.inputError"),
        message: t("member:join.modal.need.emailVerify"),
        type: "warning",
      });

    if (!form.nickname.trim())
      return showModal({
        title: t("member:join.modal.inputError"),
        message: t("member:join.modal.need.nickname"),
        type: "warning",
      });

    if (!isNicknameChecked)
      return showModal({
        title: t("member:join.modal.inputError"),
        message: t("member:join.modal.need.nicknameCheck"),
        type: "warning",
      });

    if (!form.countryId)
      return showModal({
        title: t("member:join.modal.inputError"),
        message: t("member:join.modal.need.country"),
        type: "warning",
      });

    setLoading(true);

    try {
      await api.post("/members/join", {
        loginId: form.loginId.trim(),
        loginPw: form.loginPw.trim(),
        name: form.name.trim(),
        email: form.email.trim(),
        nickname: form.nickname.trim(),
        countryId: Number(form.countryId),
      });

      showModal({
        title: t("member:join.modal.joinOkTitle"),
        message: t("member:join.modal.joinOkBody"),
        type: "success",
        onClose: () => nav("/login"),
      });
    } catch (e) {
      showModal({
        title: t("member:join.modal.joinFailTitle"),
        message: e.response?.data?.message ?? t("member:join.modal.joinFailBody"),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ 글자색만 라이트에서도 잘 보이게 var(--text)로 교체
  const inputCls =
    "w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-5 py-3 text-sm text-[color:var(--text)] " +
    "placeholder:text-[var(--muted)] outline-none transition-all " +
    "focus:ring-2 focus:ring-[var(--accent)]/35 focus:border-[var(--accent)]/40";

  const labelCls = "mb-2 ml-1 block text-xs font-semibold text-[var(--muted)]";
  const helperCls = "text-xs ml-2 mt-2 font-semibold";

  return (
    <div className="min-h-screen px-4 py-16 text-[var(--text)]">
      <div className="fixed inset-0 -z-10 bg-[var(--bg)]" />
      <div className="fixed inset-0 -z-10 opacity-70 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.25),transparent_55%),radial-gradient(circle_at_70%_30%,rgba(16,185,129,0.12),transparent_55%),radial-gradient(circle_at_40%_80%,rgba(124,58,237,0.18),transparent_60%)]" />

      <div className="mx-auto w-full max-w-2xl">
        <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-8 sm:p-12 shadow-[0_18px_40px_rgba(6,12,26,0.45)]">
          <div className="mb-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => nav("/home")}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 text-xs text-[color:var(--muted)] hover:text-[color:var(--text)] hover:border-[var(--accent)]/35 transition-colors"
            >
              <span aria-hidden>←</span>
              <span className="text-[color:var(--text)]">{t("common:nav.home")}</span>
            </button>
            <div />
          </div>

          <div className="text-center mb-10">
            <div className="mx-auto mb-5 h-16 w-16 rounded-3xl border border-[var(--border)] bg-[var(--surface-soft)] flex items-center justify-center">
              <div className="h-10 w-10 rounded-2xl bg-[var(--accent)]/20 ring-1 ring-[var(--accent)]/30 flex items-center justify-center">
                <svg className="h-6 w-6 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                  />
                </svg>
              </div>
            </div>

            {/* ✅ title 흰색 제거 → var 토큰 */}
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[color:var(--text-strong)]">
              {t("member:join.title")}
            </h1>
            <p className="mt-3 text-sm text-[var(--muted)]">{t("member:join.subtitle")}</p>
          </div>

          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className={labelCls}>{t("member:join.field.loginId")}</label>
                <input
                  className={inputCls}
                  name="loginId"
                  placeholder={t("member:join.placeholder.loginId")}
                  value={form.loginId}
                  onChange={onChange}
                  onBlur={handleLoginIdBlur}
                />
                {loginIdMsg.text && <p className={cn(helperCls, loginIdMsg.color)}>{loginIdMsg.text}</p>}
              </div>

              <div>
                <label className={labelCls}>{t("member:join.field.password")}</label>
                <input
                  className={inputCls}
                  name="loginPw"
                  type="password"
                  placeholder={t("member:join.placeholder.password")}
                  value={form.loginPw}
                  onChange={onChange}
                />
              </div>

              <div>
                <label className={labelCls}>{t("member:join.field.password2")}</label>
                <input
                  className={inputCls}
                  name="loginPw2"
                  type="password"
                  placeholder={t("member:join.placeholder.password2")}
                  value={form.loginPw2}
                  onChange={onChange}
                />
              </div>

              {pwMsg.text && (
                <p className={cn("md:col-span-2 -mt-2", helperCls, pwMsg.color)}>{pwMsg.text}</p>
              )}

              <div>
                <label className={labelCls}>{t("member:join.field.name")}</label>
                <input
                  className={inputCls}
                  name="name"
                  placeholder={t("member:join.placeholder.name")}
                  value={form.name}
                  onChange={onChange}
                />
              </div>

              <div>
                <label className={labelCls}>{t("member:join.field.nickname")}</label>
                <input
                  className={inputCls}
                  name="nickname"
                  placeholder={t("member:join.placeholder.nickname")}
                  value={form.nickname}
                  onChange={onChange}
                  onBlur={handleNicknameBlur}
                />
                {nicknameMsg.text && <p className={cn(helperCls, nicknameMsg.color)}>{nicknameMsg.text}</p>}
              </div>

              <div className="md:col-span-2 space-y-3">
                <label className={labelCls}>{t("member:join.field.emailVerify")}</label>

                <div className="flex gap-3">
                  <input
                    className={cn(inputCls, "flex-1")}
                    name="email"
                    type="email"
                    placeholder={t("member:join.placeholder.email")}
                    value={form.email}
                    onChange={onChange}
                    disabled={isEmailVerified}
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={isSendingCode || isEmailVerified}
                    className="shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-5 py-3 text-xs font-semibold text-[color:var(--text)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface)] transition-all disabled:opacity-50"
                  >
                    {isSendingCode ? t("member:join.btn.sending") : t("member:join.btn.sendCode")}
                  </button>
                </div>

                {!isEmailVerified && (
                  <div className="flex gap-3">
                    <input
                      className={cn(inputCls, "flex-1")}
                      placeholder={t("member:join.placeholder.code")}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleVerifyCode}
                      disabled={isVerifyingCode}
                      className="shrink-0 rounded-2xl bg-[var(--accent)] px-5 py-3 text-xs font-semibold text-white hover:bg-[var(--accent-strong)] transition-all disabled:opacity-50"
                    >
                      {isVerifyingCode ? t("member:join.btn.verifying") : t("member:join.btn.verify")}
                    </button>
                  </div>
                )}

                {emailMsg.text && <p className={cn("ml-2 text-xs font-semibold", emailMsg.color)}>{emailMsg.text}</p>}
              </div>

              <div className="md:col-span-2">
                <label className={labelCls}>{t("member:join.field.country")}</label>
                <select
                  className={cn(
                    inputCls,
                    "appearance-none",
                    // ✅ 선택 전에는 muted, 선택 후에는 text로 (흰색 제거)
                    form.countryId ? "text-[color:var(--text)]" : "text-[var(--muted)]"
                  )}
                  name="countryId"
                  value={form.countryId}
                  onChange={onChange}
                >
                  <option value="">{t("member:join.placeholder.country")}</option>
                  {countries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {t(`member:country.${country.id}`, { defaultValue: country.countryName })}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={submit}
                disabled={loading}
                className="w-full rounded-2xl bg-[var(--accent)] py-4 text-sm font-semibold text-white shadow-[0_18px_35px_rgba(59,130,246,0.28)] hover:bg-[var(--accent-strong)] transition-all disabled:opacity-60 active:scale-[0.99]"
              >
                {loading ? t("member:join.btn.submitting") : t("member:join.btn.submit")}
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-[var(--muted)]">
                {t("member:join.hint.already")}{" "}
                <Link
                  to="/login"
                  className="ml-1 text-[var(--accent)] hover:text-[color:var(--text)] transition-colors"
                >
                  {t("member:join.hint.loginLink")}
                </Link>
              </p>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--muted)]">Gesture OS Manager · Join</p>
      </div>
    </div>
  );
}
