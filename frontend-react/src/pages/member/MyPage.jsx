import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { useModal } from "../../context/ModalContext";
import { useTranslation } from "react-i18next";

export default function MyPage() {
  const { t } = useTranslation("member");
  const { logout, isAuthed, loading: authLoading } = useAuth();
  const { showModal } = useModal();
  const nav = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [countries, setCountries] = useState([]);
  const [activeTab, setActiveTab] = useState("articles");
  const [isEditing, setIsEditing] = useState(false);

  const [editForm, setEditForm] = useState({
    loginPw: "",
    loginPwConfirm: "",
    email: "",
    nickname: "",
    countryId: "",
  });

  const [nicknameMsg, setNicknameMsg] = useState({ text: "", color: "" });
  const [isNicknameChecked, setIsNicknameChecked] = useState(true);
  const [pwMsg, setPwMsg] = useState({ text: "", color: "" });

  const [verificationCode, setVerificationCode] = useState("");
  const [isEmailVerified, setIsEmailVerified] = useState(true);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [emailMsg, setEmailMsg] = useState({ text: "", color: "" });

  useEffect(() => {
    if (!authLoading && !isAuthed) nav("/login");
  }, [isAuthed, authLoading, nav]);

  const fetchCountries = useCallback(async () => {
    try {
      const res = await api.get("/members/countries");
      setCountries(res.data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!isAuthed) return;
    try {
      setLoading(true);
      const res = await api.get("/members/mypage");

      // 세션만료로 HTML 내려오는 경우 방어
      if (typeof res.data === "string" && res.data.includes("<!DOCTYPE html>")) {
        showModal({
          title: t("mypage.modal.sessionExpiredTitle"),
          message: t("mypage.modal.sessionExpiredMsg"),
          type: "error",
          onClose: () => logout(),
        });
        return;
      }

      if (res.data?.member) {
        setData(res.data);
        setEditForm({
          loginPw: "",
          loginPwConfirm: "",
          email: res.data.member.email || "",
          nickname: res.data.member.nickname || "",
          countryId: String(res.data.member.countryId || ""),
        });
        setIsNicknameChecked(true);
        setIsEmailVerified(true);
      }
    } catch (e) {
      console.error(e);
      showModal({
        title: t("mypage.modal.loadFailTitle"),
        message: t("mypage.modal.loadFailMsg"),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [isAuthed, logout, showModal, t]);

  useEffect(() => {
    if (!isAuthed) return;
    fetchData();
    fetchCountries();
  }, [isAuthed, fetchData, fetchCountries]);

  const handleEditToggle = () => {
    if (isEditing && data?.member) {
      setEditForm({
        loginPw: "",
        loginPwConfirm: "",
        email: data.member.email || "",
        nickname: data.member.nickname || "",
        countryId: String(data.member.countryId || ""),
      });
      setIsNicknameChecked(true);
      setIsEmailVerified(true);
      setNicknameMsg({ text: "", color: "" });
      setPwMsg({ text: "", color: "" });
      setEmailMsg({ text: "", color: "" });
      setVerificationCode("");
    }
    setIsEditing((v) => !v);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const newForm = { ...editForm, [name]: value };
    setEditForm(newForm);

    if (!data?.member) return;

    if (name === "nickname") {
      setIsNicknameChecked(value === (data.member.nickname || ""));
      setNicknameMsg({ text: "", color: "" });
    }

    if (name === "email") {
      const same = value === (data.member.email || "");
      setIsEmailVerified(same);
      setEmailMsg({ text: "", color: "" });
      if (same) setVerificationCode("");
    }

    if (name === "loginPw" || name === "loginPwConfirm") {
      if (newForm.loginPw || newForm.loginPwConfirm) {
        if (newForm.loginPw === newForm.loginPwConfirm) {
          setPwMsg({ text: t("mypage.passwordMatch"), color: "text-emerald-500" });
        } else {
          setPwMsg({ text: t("mypage.passwordNotMatch"), color: "text-rose-500" });
        }
      } else {
        setPwMsg({ text: "", color: "" });
      }
    }
  };

  const handleNicknameBlur = async () => {
    if (!data?.member) return;

    const nickname = editForm.nickname.trim();
    if (!nickname || nickname === (data.member.nickname || "")) return;

    try {
      const res = await api.get(
        `/members/checkNickname?nickname=${encodeURIComponent(nickname)}`
      );
      if (res.data?.result === "fail") {
        setNicknameMsg({ text: t("mypage.nicknameDuplicate"), color: "text-rose-500" });
        setIsNicknameChecked(false);
      } else {
        setNicknameMsg({ text: t("mypage.nicknameAvailable"), color: "text-emerald-500" });
        setIsNicknameChecked(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendCode = async () => {
    const email = editForm.email.trim();
    if (!email) {
      showModal({
        title: t("mypage.modal.inputErrorTitle"),
        message: t("mypage.errors.emailRequired"),
        type: "warning",
      });
      return;
    }

    setIsSendingCode(true);
    try {
      await api.post("/members/sendVerificationCode", { email });
      showModal({
        title: t("mypage.modal.codeSentTitle"),
        message: t("mypage.modal.codeSentMsg"),
        type: "success",
      });
      setEmailMsg({ text: t("mypage.verificationSent"), color: "text-indigo-500" });
      setIsEmailVerified(false);
    } catch (e) {
      showModal({
        title: t("mypage.modal.sendFailTitle"),
        message: e.response?.data?.message ?? t("mypage.errors.sendFail"),
        type: "error",
      });
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    const code = verificationCode.trim();
    const email = editForm.email.trim();

    if (!code) {
      showModal({
        title: t("mypage.modal.inputErrorTitle"),
        message: t("mypage.errors.codeRequired"),
        type: "warning",
      });
      return;
    }

    setIsVerifyingCode(true);
    try {
      await api.post("/members/verifyCode", { email, code });
      showModal({
        title: t("mypage.modal.verifiedTitle"),
        message: t("mypage.modal.verifiedMsg"),
        type: "success",
      });
      setIsEmailVerified(true);
      setEmailMsg({ text: t("mypage.emailVerified"), color: "text-emerald-500" });
    } catch (e) {
      showModal({
        title: t("mypage.modal.verifyFailTitle"),
        message: e.response?.data?.message ?? t("mypage.errors.verifyFail"),
        type: "error",
      });
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!data?.member) return;

    if (editForm.loginPw && editForm.loginPw !== editForm.loginPwConfirm) {
      showModal({
        title: t("mypage.modal.inputErrorTitle"),
        message: t("mypage.errors.passwordNotMatch"),
        type: "warning",
      });
      return;
    }

    if (editForm.email !== (data.member.email || "") && !isEmailVerified) {
      showModal({
        title: t("mypage.modal.verifyNeededTitle"),
        message: t("mypage.errors.emailVerifyRequired"),
        type: "warning",
      });
      return;
    }

    if (!isNicknameChecked && editForm.nickname !== (data.member.nickname || "")) {
      showModal({
        title: t("mypage.modal.inputErrorTitle"),
        message: t("mypage.errors.nicknameCheckRequired"),
        type: "warning",
      });
      return;
    }

    if (editForm.nickname !== (data.member.nickname || "") && !data.nicknameChangeAllowed) {
      showModal({
        title: t("mypage.modal.inputErrorTitle"),
        message: `${t("mypage.nicknameLimit")}\n${t("mypage.nextChangeDate")}: ${data.nextNicknameChangeDate}`,
        type: "warning",
      });
      return;
    }

    try {
      const updateData = {
        ...data.member,
        email: editForm.email,
        nickname: editForm.nickname,
        countryId: Number(editForm.countryId),
      };
      if (editForm.loginPw) updateData.loginPw = editForm.loginPw;

      await api.put(`/members/modify/${data.member.id}`, updateData);

      showModal({
        title: t("mypage.modal.updatedTitle"),
        message: t("mypage.modal.updatedMsg"),
        type: "success",
      });

      setIsEditing(false);
      fetchData();
    } catch (e) {
      showModal({
        title: t("mypage.modal.updateFailTitle"),
        message: e.response?.data?.message || t("mypage.errors.updateFail"),
        type: "error",
      });
    }
  };

  if (authLoading || (loading && isAuthed)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthed || !data) return null;

  const { member, stats, myArticles, myComments, likedArticles } = data;

  return (
    <div className="min-h-screen bg-[var(--bg)] py-12 px-6 text-[var(--text)]">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-black text-slate-100 tracking-tight">
            {t("mypage.title")}
          </h1>

          <button
            onClick={handleEditToggle}
            className={`px-8 py-4 rounded-2xl font-black transition-all shadow-xl ${
              isEditing
                ? "bg-[var(--surface)] border border-[var(--border)] text-slate-200 hover:bg-[var(--surface-soft)]"
                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
            }`}
          >
            {isEditing ? t("mypage.cancelEdit") : t("mypage.editProfile")}
          </button>
        </div>

        <div className="glass rounded-[3rem] p-12 border-[var(--border)] shadow-2xl animate-fade-in">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="w-32 h-32 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-5xl shadow-2xl shadow-indigo-100 rotate-3">
              <span className="-rotate-3">ME</span>
            </div>

            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-wrap items-center gap-4 justify-center md:justify-start mb-4">
                <h2 className="text-4xl font-black text-slate-100">{member.name}</h2>
                <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-black rounded-full border border-indigo-100 uppercase tracking-widest">
                  {member.role}
                </span>
              </div>

              <p className="text-xl font-bold text-slate-300 mb-6">{member.email}</p>

              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <div className="px-5 py-2 bg-[var(--surface-soft)] rounded-2xl text-sm font-black text-slate-200 border border-[var(--border)]">
                  {t("mypage.labels.id")}: {member.loginId}
                </div>

                <div className="px-5 py-2 bg-[var(--surface-soft)] rounded-2xl text-sm font-black text-slate-200 border border-[var(--border)]">
                  {t("mypage.labels.joined")}: {member.regDate?.split("T")[0]}
                </div>

                {member.nickname && (
                  <div className="px-5 py-2 bg-emerald-500/10 rounded-2xl text-sm font-black text-emerald-300 border border-emerald-500/30">
                    {t("mypage.labels.nickname")}: {member.nickname}
                  </div>
                )}
              </div>
            </div>
          </div>

          {isEditing && (
            <form
              onSubmit={handleSubmit}
              className="mt-12 pt-12 border-t border-[var(--border)] space-y-8 animate-scale-in"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {!member.provider && (
                  <>
                    <div>
                      <label className="block text-sm font-black text-slate-200 mb-2 ml-1">
                        {t("mypage.form.newPassword")}
                      </label>
                      <input
                        type="password"
                        name="loginPw"
                        value={editForm.loginPw}
                        onChange={handleInputChange}
                        placeholder={t("mypage.form.passwordPlaceholder")}
                        className="w-full px-6 py-4 bg-[var(--surface-soft)] border border-[var(--border)] rounded-2xl focus:ring-2 focus:ring-[var(--accent)] focus:bg-[var(--surface)] outline-none transition-all font-bold text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-black text-slate-200 mb-2 ml-1">
                        {t("mypage.form.passwordConfirm")}
                      </label>
                      <input
                        type="password"
                        name="loginPwConfirm"
                        value={editForm.loginPwConfirm}
                        onChange={handleInputChange}
                        placeholder={t("mypage.form.passwordConfirmPlaceholder")}
                        className="w-full px-6 py-4 bg-[var(--surface-soft)] border border-[var(--border)] rounded-2xl focus:ring-2 focus:ring-[var(--accent)] focus:bg-[var(--surface)] outline-none transition-all font-bold text-slate-100"
                      />
                      {pwMsg.text && (
                        <p className={`text-xs ml-2 mt-2 font-black ${pwMsg.color}`}>
                          {pwMsg.text}
                        </p>
                      )}
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-black text-slate-200 mb-2 ml-1">
                    {t("mypage.form.email")}
                  </label>

                  <div className="flex gap-3">
                    <input
                      type="email"
                      name="email"
                      value={editForm.email}
                      onChange={handleInputChange}
                      className="flex-1 px-6 py-4 bg-[var(--surface-soft)] border border-[var(--border)] rounded-2xl focus:ring-2 focus:ring-[var(--accent)] focus:bg-[var(--surface)] outline-none transition-all font-bold text-slate-100"
                    />

                    {editForm.email !== data.member.email && !isEmailVerified && (
                      <button
                        type="button"
                        onClick={handleSendCode}
                        disabled={isSendingCode}
                        className="px-6 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg"
                      >
                        {isSendingCode ? t("mypage.email.sending") : t("mypage.email.sendCode")}
                      </button>
                    )}
                  </div>

                  {editForm.email !== data.member.email && !isEmailVerified && (
                    <div className="flex gap-3 mt-3 animate-slide-in-bottom">
                      <input
                        type="text"
                        placeholder={t("mypage.email.codePlaceholder")}
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        className="flex-1 px-6 py-4 bg-[var(--surface-soft)] border border-[var(--border)] rounded-2xl focus:ring-2 focus:ring-[var(--accent)] focus:bg-[var(--surface)] outline-none transition-all font-bold text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyCode}
                        disabled={isVerifyingCode}
                        className="px-6 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg"
                      >
                        {isVerifyingCode ? t("mypage.email.verifying") : t("mypage.email.verify")}
                      </button>
                    </div>
                  )}

                  {emailMsg.text && (
                    <p className={`text-xs ml-2 mt-2 font-black ${emailMsg.color}`}>
                      {emailMsg.text}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-black text-slate-200 mb-2 ml-1">
                    {t("mypage.form.country")}
                  </label>

                  <select
                    name="countryId"
                    value={editForm.countryId}
                    onChange={handleInputChange}
                    className="w-full px-6 py-4 bg-[var(--surface-soft)] border border-[var(--border)] rounded-2xl focus:ring-2 focus:ring-[var(--accent)] focus:bg-[var(--surface)] outline-none transition-all font-bold text-slate-100 appearance-none"
                  >
                    <option value="">{t("mypage.form.countrySelect")}</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>
                        {t(`country.${c.id}`, { defaultValue: c.countryName })}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-black text-slate-200 mb-2 ml-1">
                    {t("mypage.form.nickname")}
                  </label>

                  <input
                    type="text"
                    name="nickname"
                    value={editForm.nickname}
                    onChange={handleInputChange}
                    onBlur={handleNicknameBlur}
                    className="w-full px-6 py-4 bg-[var(--surface-soft)] border border-[var(--border)] rounded-2xl focus:ring-2 focus:ring-[var(--accent)] focus:bg-[var(--surface)] outline-none transition-all font-bold text-slate-100"
                  />

                  {nicknameMsg.text && (
                    <p className={`text-xs ml-2 mt-2 font-black ${nicknameMsg.color}`}>
                      {nicknameMsg.text}
                    </p>
                  )}

                  {!data.nicknameChangeAllowed && (
                    <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs font-black text-rose-300 flex items-center gap-3">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {t("mypage.nicknameLimit")} ({t("mypage.nextChangeDate")}: {data.nextNicknameChangeDate})
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all active:scale-95"
                >
                  {t("mypage.saveChanges")}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            { label: t("mypage.stats.articles"), value: stats?.articleCount ?? 0, icon: "POST" },
            { label: t("mypage.stats.comments"), value: stats?.commentCount ?? 0, icon: "CMT" },
            { label: t("mypage.stats.likes"), value: stats?.likeCount ?? 0, icon: "LIKE" },
          ].map((stat, i) => (
            <div
              key={i}
              className="glass rounded-[2.5rem] p-8 text-center border-[var(--border)] shadow-xl hover:shadow-[0_16px_35px_rgba(59,130,246,0.2)] transition-all group"
            >
              <div className="text-3xl mb-3">{stat.icon}</div>
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-[var(--accent)] transition-colors">
                {stat.label}
              </div>
              <div className="text-4xl font-black text-slate-100">{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="glass rounded-[3rem] overflow-hidden border-[var(--border)] shadow-2xl">
          <div className="flex border-b border-[var(--border)] bg-[var(--surface-soft)]">
            {[
              { id: "articles", label: t("mypage.tabs.articles") },
              { id: "comments", label: t("mypage.tabs.comments") },
              { id: "likes", label: t("mypage.tabs.likes") },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-6 text-sm font-black transition-all uppercase tracking-widest ${
                  activeTab === tab.id
                    ? "text-[var(--accent)] bg-[var(--surface)] border-b-4 border-[var(--accent)]"
                    : "text-slate-300 hover:text-slate-100 hover:bg-[var(--surface)]/60"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-10">
            {activeTab === "articles" && (
              <div className="space-y-4">
                {myArticles.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 font-black italic">
                    {t("mypage.empty.articles")}
                  </div>
                ) : (
                  myArticles.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => nav(`/board/${a.id}`)}
                      className="p-6 rounded-3xl hover:bg-[rgba(59,130,246,0.12)] cursor-pointer transition-all border border-transparent hover:border-[rgba(59,130,246,0.3)] group flex items-center justify-between"
                    >
                      <div>
                        <div className="text-lg font-black text-slate-100 group-hover:text-[var(--accent)] transition-colors">
                          {a.title}
                        </div>
                        <div className="text-xs font-bold text-slate-300 mt-2 flex items-center gap-4">
                          <span>
                            {t("mypage.labels.writtenAt")} {a.regDate?.split("T")[0]}
                          </span>
                          <span>
                            {t("mypage.labels.views")} {a.hitCount || 0}
                          </span>
                        </div>
                      </div>
                      <svg
                        className="w-5 h-5 text-slate-300 group-hover:text-[var(--accent)] transition-all transform group-hover:translate-x-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "comments" && (
              <div className="space-y-4">
                {myComments.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 font-black italic">
                    {t("mypage.empty.comments")}
                  </div>
                ) : (
                  myComments.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => c.relTypeCode === "article" && nav(`/board/${c.relId}`)}
                      className="p-6 rounded-3xl hover:bg-[rgba(59,130,246,0.12)] cursor-pointer transition-all border border-transparent hover:border-[rgba(59,130,246,0.3)] group"
                    >
                      <div className="text-base font-bold text-slate-200 line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
                        "{c.content}"
                      </div>
                      <div className="text-xs font-bold text-slate-400 mt-3">
                        {t("mypage.labels.writtenAt")} {c.updateDate}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "likes" && (
              <div className="space-y-4">
                {likedArticles.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 font-black italic">
                    {t("mypage.empty.likes")}
                  </div>
                ) : (
                  likedArticles.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => nav(`/board/${a.id}`)}
                      className="p-6 rounded-3xl hover:bg-[rgba(59,130,246,0.12)] cursor-pointer transition-all border border-transparent hover:border-[rgba(59,130,246,0.3)] group flex items-center justify-between"
                    >
                      <div>
                        <div className="text-lg font-black text-slate-100 group-hover:text-[var(--accent)] transition-colors">
                          {a.title}
                        </div>
                        <div className="text-xs font-bold text-slate-300 mt-2 flex items-center gap-4">
                          <span>
                            {t("mypage.labels.writer")} {a.writerName}
                          </span>
                          <span>
                            {t("mypage.labels.writtenAt")} {a.regDate?.split("T")[0]}
                          </span>
                        </div>
                      </div>
                      <svg
                        className="w-5 h-5 text-slate-300 group-hover:text-[var(--accent)] transition-all transform group-hover:translate-x-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
