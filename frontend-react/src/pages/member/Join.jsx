import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../api/client";
import { useModal } from "../../context/ModalContext";
import { useTranslation } from "react-i18next";

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
      if (newForm.loginPw && newForm.loginPw2) {
        if (newForm.loginPw === newForm.loginPw2) {
          setPwMsg({ text: t("member:join.pw.match"), color: "text-emerald-500" });
        } else {
          setPwMsg({ text: t("member:join.pw.mismatch"), color: "text-rose-500" });
        }
      } else {
        setPwMsg({ text: "", color: "" });
      }
    }
  };

  const handleLoginIdBlur = async () => {
    const loginId = form.loginId.trim();
    if (!loginId) return;

    try {
      const res = await api.get(
        `/members/checkLoginId?loginId=${encodeURIComponent(loginId)}`
      );

      if (res.data.result === "fail") {
        setLoginIdMsg({
          text: t("member:join.msg.loginId.taken"),
          color: "text-rose-500",
        });
        setIsLoginIdChecked(false);
      } else {
        setLoginIdMsg({
          text: t("member:join.msg.loginId.available"),
          color: "text-emerald-500",
        });
        setIsLoginIdChecked(true);
      }
    } catch (e) {
      setLoginIdMsg({
        text: t("member:join.msg.loginId.error"),
        color: "text-rose-500",
      });
    }
  };

  const handleNicknameBlur = async () => {
    const nickname = form.nickname.trim();
    if (!nickname) return;

    try {
      const res = await api.get(
        `/members/checkNickname?nickname=${encodeURIComponent(nickname)}`
      );

      if (res.data.result === "fail") {
        setNicknameMsg({
          text: t("member:join.msg.nickname.taken"),
          color: "text-rose-500",
        });
        setIsNicknameChecked(false);
      } else {
        setNicknameMsg({
          text: t("member:join.msg.nickname.available"),
          color: "text-emerald-500",
        });
        setIsNicknameChecked(true);
      }
    } catch (e) {
      setNicknameMsg({
        text: t("member:join.msg.nickname.error"),
        color: "text-rose-500",
      });
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
      await api.post("/members/sendVerificationCode", {
        email: form.email.trim(),
      });

      showModal({
        title: t("member:join.modal.sendOkTitle"),
        message: t("member:join.modal.sendOkBody"),
        type: "success",
      });

      setEmailMsg({
        text: t("member:join.msg.email.sent"),
        color: "text-indigo-500",
      });
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
      setEmailMsg({
        text: t("member:join.msg.email.verified"),
        color: "text-emerald-500",
      });
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

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center py-20 px-6">
      <div className="w-full max-w-2xl bg-white rounded-[3rem] p-12 shadow-2xl border border-slate-100 animate-scale-in">
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-100 -rotate-3">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
          </div>

          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            {t("member:join.title")}
          </h1>
          <p className="text-slate-400 mt-3 font-bold">
            {t("member:join.subtitle")}
          </p>
        </div>

        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="md:col-span-2">
              <label className="block text-sm font-black text-slate-700 mb-2 ml-1">
                {t("member:join.field.loginId")}
              </label>
              <input
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all placeholder-slate-300 font-bold"
                name="loginId"
                placeholder={t("member:join.placeholder.loginId")}
                value={form.loginId}
                onChange={onChange}
                onBlur={handleLoginIdBlur}
              />
              {loginIdMsg.text && (
                <p className={`text-xs ml-2 mt-2 font-black ${loginIdMsg.color}`}>
                  {loginIdMsg.text}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 ml-1">
                {t("member:join.field.password")}
              </label>
              <input
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all placeholder-slate-300 font-bold"
                name="loginPw"
                type="password"
                placeholder={t("member:join.placeholder.password")}
                value={form.loginPw}
                onChange={onChange}
              />
            </div>

            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 ml-1">
                {t("member:join.field.password2")}
              </label>
              <input
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all placeholder-slate-300 font-bold"
                name="loginPw2"
                type="password"
                placeholder={t("member:join.placeholder.password2")}
                value={form.loginPw2}
                onChange={onChange}
              />
            </div>

            {pwMsg.text && (
              <p className={`md:col-span-2 text-xs ml-2 -mt-4 font-black ${pwMsg.color}`}>
                {pwMsg.text}
              </p>
            )}

            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 ml-1">
                {t("member:join.field.name")}
              </label>
              <input
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all placeholder-slate-300 font-bold"
                name="name"
                placeholder={t("member:join.placeholder.name")}
                value={form.name}
                onChange={onChange}
              />
            </div>

            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 ml-1">
                {t("member:join.field.nickname")}
              </label>
              <input
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all placeholder-slate-300 font-bold"
                name="nickname"
                placeholder={t("member:join.placeholder.nickname")}
                value={form.nickname}
                onChange={onChange}
                onBlur={handleNicknameBlur}
              />
              {nicknameMsg.text && (
                <p className={`text-xs ml-2 mt-2 font-black ${nicknameMsg.color}`}>
                  {nicknameMsg.text}
                </p>
              )}
            </div>

            <div className="md:col-span-2 space-y-4">
              <label className="block text-sm font-black text-slate-700 mb-1 ml-1">
                {t("member:join.field.emailVerify")}
              </label>

              <div className="flex gap-3">
                <input
                  className="flex-1 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all placeholder-slate-300 font-bold"
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
                  className="px-8 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 disabled:opacity-50 transition-all whitespace-nowrap shadow-lg"
                >
                  {isSendingCode
                    ? t("member:join.btn.sending")
                    : t("member:join.btn.sendCode")}
                </button>
              </div>

              {!isEmailVerified && (
                <div className="flex gap-3 animate-slide-in-bottom">
                  <input
                    className="flex-1 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all placeholder-slate-300 font-bold"
                    placeholder={t("member:join.placeholder.code")}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyCode}
                    disabled={isVerifyingCode}
                    className="px-8 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 disabled:opacity-50 transition-all whitespace-nowrap shadow-lg"
                  >
                    {isVerifyingCode
                      ? t("member:join.btn.verifying")
                      : t("member:join.btn.verify")}
                  </button>
                </div>
              )}

              {emailMsg.text && (
                <p className={`text-xs ml-2 font-black ${emailMsg.color}`}>
                  {emailMsg.text}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-black text-slate-700 mb-2 ml-1">
                {t("member:join.field.country")}
              </label>
              <select
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-bold text-slate-700 appearance-none"
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

          <div className="pt-6">
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all disabled:opacity-60 active:scale-95"
            >
              {loading
                ? t("member:join.btn.submitting")
                : t("member:join.btn.submit")}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-slate-400 font-bold">
              {t("member:join.hint.already")}{" "}
              <Link
                to="/login"
                className="text-indigo-600 hover:text-indigo-500 ml-2"
              >
                {t("member:join.hint.loginLink")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
