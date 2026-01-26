// src/pages/member/MyPage.jsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { useModal } from "../../context/ModalContext";
import { useTranslation } from "react-i18next";
import { formatDateTimeMinute } from "../../utils/datetime";
import FilePicker from "../../components/common/FilePicker";

import defaultAvatar from "../../assets/default-avatar.png";

const API_ORIGIN =
  import.meta.env?.VITE_API_ORIGIN ||
  import.meta.env?.VITE_API_URL ||
  window.location.origin;

// ✅ 업로드 제한(3MB)
const MAX_PROFILE_BYTES = 3 * 1024 * 1024;

function bytesToMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

/**
 * member.profileImageUrl 이
 * - "" / null -> default
 * - "/uploads/..." -> API_ORIGIN 붙여서
 * - "http..." -> 그대로
 */
function resolveProfileSrc(rawUrl, bust = "") {
  if (!rawUrl) return defaultAvatar;

  const cleaned = String(rawUrl).trim().replace(/^"+|"+$/g, "");
  if (!cleaned) return defaultAvatar;

  const isAbsolute = /^https?:\/\//i.test(cleaned);
  const normalized = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  const full = isAbsolute ? cleaned : `${API_ORIGIN}${normalized}`;

  if (!bust) return full;
  const sep = full.includes("?") ? "&" : "?";
  return `${full}${sep}v=${encodeURIComponent(bust)}`;
}

export default function MyPage() {
  const { t } = useTranslation(["member"]);
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

  // ✅ 프로필 이미지 업로드/미리보기 상태
  const [profileFile, setProfileFile] = useState(null);
  const [profilePreview, setProfilePreview] = useState("");

  // ✅ 기본 이미지로 되돌리기 플래그
  const [revertToDefault, setRevertToDefault] = useState(false);

  // ✅ 저장 직후 캐시 방지용
  const [profileBust, setProfileBust] = useState(String(Date.now()));

  // revoke용 ref
  const previewRef = useRef("");

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
          title: t("member:mypage.modal.sessionExpiredTitle"),
          message: t("member:mypage.modal.sessionExpiredMsg"),
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
          countryId: String(res.data.member.countryId ?? ""),
        });

        setIsNicknameChecked(true);
        setIsEmailVerified(true);
        setRevertToDefault(false);

        // 이미지 새로고침(캐시 방지)
        setProfileBust(String(Date.now()));
      }
    } catch (e) {
      console.error(e);
      showModal({
        title: t("member:mypage.modal.loadFailTitle"),
        message: t("member:mypage.modal.loadFailMsg"),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [isAuthed, logout, showModal, t]);

  const handleLinkManager = async () => {
    try {
      const res = await api.post("/auth/bridge/start");
      const { code, expiresInSec } = res.data || {};
      if (!code) throw new Error("NO_CODE");

      window.location.href = `gestureos://auth?code=${encodeURIComponent(code)}`;

      showModal({
        title: t("member:mypage.modal.linkTitle"),
        message: t("member:mypage.modal.linkMsg", { sec: expiresInSec ?? 60 }),
        type: "success",
      });
    } catch (e) {
      console.error(e);
      showModal({
        title: t("member:mypage.modal.linkFailTitle"),
        message: t("member:mypage.modal.linkFailMsg"),
        type: "error",
      });
    }
  };

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
        countryId: String(data.member.countryId ?? ""),
      });
      setIsNicknameChecked(true);
      setIsEmailVerified(true);
      setNicknameMsg({ text: "", color: "" });
      setPwMsg({ text: "", color: "" });
      setEmailMsg({ text: "", color: "" });
      setVerificationCode("");

      setProfileFile(null);
      setRevertToDefault(false);

      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = "";
      setProfilePreview("");
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
          setPwMsg({
            text: t("member:mypage.passwordMatch"),
            color: "text-emerald-500",
          });
        } else {
          setPwMsg({
            text: t("member:mypage.passwordNotMatch"),
            color: "text-rose-500",
          });
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
      const res = await api.get(`/members/checkNickname?nickname=${encodeURIComponent(nickname)}`);
      if (res.data?.result === "fail") {
        setNicknameMsg({
          text: t("member:mypage.nicknameDuplicate"),
          color: "text-rose-500",
        });
        setIsNicknameChecked(false);
      } else {
        setNicknameMsg({
          text: t("member:mypage.nicknameAvailable"),
          color: "text-emerald-500",
        });
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
        title: t("member:mypage.modal.inputErrorTitle"),
        message: t("member:mypage.errors.emailRequired"),
        type: "warning",
      });
      return;
    }

    setIsSendingCode(true);
    try {
      await api.post("/members/sendVerificationCode", { email });
      showModal({
        title: t("member:mypage.modal.codeSentTitle"),
        message: t("member:mypage.modal.codeSentMsg"),
        type: "success",
      });
      setEmailMsg({
        text: t("member:mypage.verificationSent"),
        color: "text-indigo-500",
      });
      setIsEmailVerified(false);
    } catch (e) {
      showModal({
        title: t("member:mypage.modal.sendFailTitle"),
        message: e.response?.data?.message ?? t("member:mypage.errors.sendFail"),
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
        title: t("member:mypage.modal.inputErrorTitle"),
        message: t("member:mypage.errors.codeRequired"),
        type: "warning",
      });
      return;
    }

    setIsVerifyingCode(true);
    try {
      await api.post("/members/verifyCode", { email, code });
      showModal({
        title: t("member:mypage.modal.verifiedTitle"),
        message: t("member:mypage.modal.verifiedMsg"),
        type: "success",
      });
      setIsEmailVerified(true);
      setEmailMsg({
        text: t("member:mypage.emailVerified"),
        color: "text-emerald-500",
      });
    } catch (e) {
      showModal({
        title: t("member:mypage.modal.verifyFailTitle"),
        message: e.response?.data?.message ?? t("member:mypage.errors.verifyFail"),
        type: "error",
      });
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // ✅ 이미지 선택/미리보기 (+ 3MB 초과 시 모달)
  const handlePickProfile = (payload) => {
    let file = null;

    // (1) native input change event
    if (payload?.target?.files?.[0]) {
      file = payload.target.files[0];
    }
    // (2) File directly
    else if (payload instanceof File) {
      file = payload;
    }
    // (3) FileList or wrapper
    else if (payload?.files?.[0] instanceof File) {
      file = payload.files[0];
    } else if (payload?.file instanceof File) {
      file = payload.file;
    }

    if (!file) return;

    // 같은 파일 재선택 가능하게 input value 리셋(이벤트일 때만)
    try {
      if (payload?.target) payload.target.value = "";
    } catch {
      // ignore
    }

    if (!file.type?.startsWith("image/")) {
      showModal({
        title: t("member:mypage.modal.uploadFailTitle"),
        message: t("member:mypage.modal.uploadOnlyImage"),
        type: "error",
      });
      return;
    }

    // ✅ 3MB 초과면 모달 띄우고 업로드/미리보기 막음
    if (file.size > MAX_PROFILE_BYTES) {
      showModal({
        title: t("member:mypage.modal.uploadFailTitle"),
        message: t("member:mypage.modal.uploadMaxSize"),
        type: "error", // ✅ warning 말고 error
      });
      return;
    }

    setRevertToDefault(false);
    setProfileFile(file);

    if (previewRef.current) URL.revokeObjectURL(previewRef.current);

    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setProfilePreview(url);
  };

  const clearPickedProfile = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = "";
    setProfilePreview("");
    setProfileFile(null);
    setRevertToDefault(false);
  };

  const handleRevertDefault = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = "";
    setProfilePreview("");
    setProfileFile(null);
    setRevertToDefault(true);
  };

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = "";
    };
  }, []);

  // ✅ 업로드 API 호출
  // ✅ 중요: multipart/form-data 헤더를 수동 지정하지 말 것(axios가 boundary 자동 설정)
  const uploadProfileImage = async (file) => {
    // ✅ 방어: 선택 단계가 씹혀도 업로드 단계에서 하드 차단
    if (file?.size > MAX_PROFILE_BYTES) {
      showModal({
        title: t("member:mypage.modal.uploadFailTitle"),
        message: `${t("member:mypage.modal.uploadMaxSize")} (선택한 파일: ${bytesToMB(file.size)}MB)`,
        type: "error",
      });
      throw new Error("FILE_TOO_LARGE");
    }

    const fd = new FormData();
    fd.append("file", file);

    const res = await api.post("/members/profile-image", fd);

    const url = res.data?.url ?? res.data?.profileImageUrl ?? res.data?.data?.url;
    if (!url) throw new Error("NO_PROFILE_URL");
    return url;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!data?.member) return;

    // ✅ 저장 시점에서도 3MB 하드 차단 (여기가 핵심)
    if (profileFile && profileFile.size > MAX_PROFILE_BYTES) {
      showModal({
        title: t("member:mypage.modal.uploadFailTitle"),
        message: t("member:mypage.modal.uploadMaxSize"),
        type: "error",
      });
      return;
    }

    if (editForm.loginPw && editForm.loginPw !== editForm.loginPwConfirm) {
      showModal({
        title: t("member:mypage.modal.inputErrorTitle"),
        message: t("member:mypage.errors.passwordMismatch"),
        type: "warning",
      });
      return;
    }

    if (editForm.email !== (data.member.email || "") && !isEmailVerified) {
      showModal({
        title: t("member:mypage.modal.verifyNeededTitle"),
        message: t("member:mypage.errors.emailVerifyRequired"),
        type: "warning",
      });
      return;
    }

    if (!isNicknameChecked && editForm.nickname !== (data.member.nickname || "")) {
      showModal({
        title: t("member:mypage.modal.inputErrorTitle"),
        message: t("member:mypage.errors.nicknameCheckRequired"),
        type: "warning",
      });
      return;
    }

    if (editForm.nickname !== (data.member.nickname || "") && !data.nicknameChangeAllowed) {
      showModal({
        title: t("member:mypage.modal.inputErrorTitle"),
        message: `${t("member:mypage.nicknameLimit")}\n${t("member:mypage.nextChangeDate")}: ${data.nextNicknameChangeDate}`,
        type: "warning",
      });
      return;
    }

    try {
      // 1) 파일 업로드(선택 시) / 기본 이미지로 되돌리기
      let profileImageUrl = data.member.profileImageUrl ?? null;

      if (revertToDefault) {
        profileImageUrl = null;
      } else if (profileFile) {
        profileImageUrl = await uploadProfileImage(profileFile);
      }

      // 2) 업데이트 payload 만들기 (countryId 빈 값 방어)
      const nextCountryId =
        editForm.countryId === "" || editForm.countryId == null ? null : Number(editForm.countryId);

      const updateData = {
        id: data.member.id,
        email: editForm.email.trim(),
        nickname: editForm.nickname.trim(),
        countryId: nextCountryId,
        profileImageUrl,
        resetProfileImage: revertToDefault,
      };
      if (editForm.loginPw) updateData.loginPw = editForm.loginPw;

      // 3) 수정 요청
      await api.put(`/members/modify/${data.member.id}`, updateData);

      // ✅ 화면 즉시 반영
      setData((prev) => {
        if (!prev?.member) return prev;
        return { ...prev, member: { ...prev.member, ...updateData } };
      });

      showModal({
        title: t("member:mypage.modal.updatedTitle"),
        message: t("member:mypage.modal.updatedMsg"),
        type: "success",
      });

      setIsEditing(false);
      clearPickedProfile();
      setRevertToDefault(false);

      // 이미지 캐시 무력화
      setProfileBust(String(Date.now()));

      // 4) 최종 동기화
      await fetchData();
    } catch (e2) {
      console.error(e2);

      // FILE_TOO_LARGE는 이미 모달 띄웠으니 조용히 종료
      if (String(e2?.message || "").includes("FILE_TOO_LARGE")) return;

      // ✅ 서버가 용량 초과를 500으로 뭉개서 보내는 경우까지 프론트에서 문구 교체(보험)
      const rawMsg = String(e2?.response?.data?.message || e2?.message || "");
      if (/maxuploadsize|too large|payload|multipart/i.test(rawMsg)) {
        showModal({
          title: t("member:mypage.modal.uploadFailTitle"),
          message: t("member:mypage.modal.uploadMaxSize"),
          type: "error",
        });
        return;
      }

      showModal({
        title: t("member:mypage.modal.updateFailTitle"),
        message: e2.response?.data?.message || t("member:mypage.errors.updateFail"),
        type: "error",
      });
    }
  };

  const memberProfileUrl = data?.member?.profileImageUrl;

  const displayProfileSrc = useMemo(() => {
    if (profilePreview) return profilePreview;
    if (revertToDefault) return defaultAvatar;
    return resolveProfileSrc(memberProfileUrl, profileBust);
  }, [profilePreview, revertToDefault, memberProfileUrl, profileBust]);

  const editPreviewSrc = useMemo(() => {
    if (profilePreview) return profilePreview;
    if (revertToDefault) return defaultAvatar;
    return resolveProfileSrc(memberProfileUrl, profileBust);
  }, [profilePreview, revertToDefault, memberProfileUrl, profileBust]);

  // ✅ country 번역 키가 없으면 서버 countryName으로 폴백
  const countryLabel = useCallback(
    (c) => {
      const key = `member:country.${c.id}`;
      const translated = t(key);
      if (!translated || translated === key) return c.countryName;
      return translated;
    },
    [t]
  );

  if (authLoading || (loading && isAuthed)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthed || !data) return null;

  const { member, stats, myArticles, myComments, likedArticles } = data;

  return (
    <div className="min-h-screen bg-[var(--bg)] py-12 px-6 text-[color:var(--text)]">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-black text-[color:var(--text-strong)] tracking-tight">
            {t("member:mypage.title")}
          </h1>

          <div className="flex items-center gap-3">
            <button
              onClick={handleLinkManager}
              className="px-8 py-4 rounded-2xl font-black transition-all shadow-xl bg-[var(--surface)] border border-[var(--border)] text-[color:var(--text)] hover:bg-[var(--surface-soft)]"
            >
              {t("member:mypage.modal.linkTitle")}
            </button>

            <button
              onClick={handleEditToggle}
              className={`px-8 py-4 rounded-2xl font-black transition-all shadow-xl ${
                isEditing
                  ? "bg-[var(--surface)] border border-[var(--border)] text-[color:var(--text)] hover:bg-[var(--surface-soft)]"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
            >
              {isEditing ? t("member:mypage.cancelEdit") : t("member:mypage.editProfile")}
            </button>
          </div>
        </div>

        <div className="glass rounded-[3rem] p-12 border-[var(--border)] shadow-2xl animate-fade-in">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden border border-[var(--border)] bg-[var(--surface-soft)] shadow-2xl rotate-3">
              <img
                src={displayProfileSrc}
                alt="profile"
                className="w-full h-full object-cover -rotate-3"
                onError={(e) => {
                  console.error("[PROFILE_IMG_ERROR]", e.currentTarget.src);
                  e.currentTarget.src = defaultAvatar;
                }}
              />
            </div>

            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-wrap items-center gap-4 justify-center md:justify-start mb-4">
                <h2 className="text-4xl font-black text-[color:var(--text-strong)]">
                  {member.name}
                </h2>
                <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-black rounded-full border border-indigo-100 uppercase tracking-widest">
                  {member.role}
                </span>
              </div>

              <p className="text-xl font-bold text-[color:var(--text)] mb-6">{member.email}</p>

              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <div className="px-5 py-2 bg-[var(--surface-soft)] rounded-2xl text-sm font-black text-[color:var(--text)] border border-[var(--border)]">
                  {t("member:mypage.labels.id")}: {member.loginId}
                </div>

                <div className="px-5 py-2 bg-[var(--surface-soft)] rounded-2xl text-sm font-black text-[color:var(--text)] border border-[var(--border)]">
                  {t("member:mypage.labels.joined")}: {formatDateTimeMinute(member.regDate)}
                </div>

                {member.nickname && (
                  <div className="px-5 py-2 bg-emerald-500/10 rounded-2xl text-sm font-black text-[color:var(--text)] border border-emerald-500/30">
                    {t("member:mypage.labels.nickname")}: {member.nickname}
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
                <div className="md:col-span-2">
                  <label className="block text-sm font-black text-[color:var(--text)] mb-2 ml-1">
                    {t("member:mypage.profile.label")}
                  </label>

                  <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--surface-soft)]">
                      <img
                        src={editPreviewSrc}
                        alt="profile preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = defaultAvatar;
                        }}
                      />
                    </div>

                    <div className="flex flex-col gap-3">
                      <FilePicker
                        onPick={handlePickProfile}
                        label={t("member:mypage.profile.pickFile")}
                        emptyLabel={t("member:mypage.profile.noFile")}
                      />

                      <div className="flex gap-2 flex-wrap">
                        {(profilePreview || member.profileImageUrl || revertToDefault) && (
                          <button
                            type="button"
                            onClick={clearPickedProfile}
                            className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[color:var(--text)] hover:bg-[var(--surface-soft)] font-black"
                          >
                            {t("member:mypage.profile.pickCancel")}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleRevertDefault}
                          className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-black border border-slate-700"
                        >
                          {t("member:mypage.profile.revertDefault")}
                        </button>
                      </div>

                      <p className="text-xs font-bold text-[var(--muted)]">
                        {t("member:mypage.profile.hintApplyOnSave")}
                      </p>

                      <p className="text-[11px] font-bold text-[var(--muted)]">
                        {t("member:mypage.profile.currentUrl")}:{" "}
                        {member.profileImageUrl ?? t("member:mypage.profile.none")}
                      </p>

                      {revertToDefault && (
                        <p className="text-[11px] font-black text-amber-300">
                          {t("member:mypage.profile.willRevertDefault")}
                        </p>
                      )}

                      <p className="text-[11px] font-bold text-[var(--muted)]">
                        최대 3MB 이미지 파일만 업로드 가능합니다.
                      </p>
                    </div>
                  </div>
                </div>

                {!member.provider && (
                  <>
                    <div>
                      <label className="block text-sm font-black text-[color:var(--text)] mb-2 ml-1">
                        {t("member:mypage.form.newPassword")}
                      </label>
                      <input
                        type="password"
                        name="loginPw"
                        value={editForm.loginPw}
                        onChange={handleInputChange}
                        placeholder={t("member:mypage.form.passwordPlaceholder")}
                        className="w-full px-6 py-4 bg-[var(--surface-soft)] border border-[var(--border)] rounded-2xl focus:ring-2 focus:ring-[var(--accent)] focus:bg-[var(--surface)] outline-none transition-all font-bold text-[color:var(--text)]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-black text-[color:var(--text)] mb-2 ml-1">
                        {t("member:mypage.form.passwordConfirm")}
                      </label>
                      <input
                        type="password"
                        name="loginPwConfirm"
                        value={editForm.loginPwConfirm}
                        onChange={handleInputChange}
                        placeholder={t("member:mypage.form.passwordConfirmPlaceholder")}
                        className="w-full px-6 py-4 bg-[var(--surface-soft)] border border-[var(--border)] rounded-2xl focus:ring-2 focus:ring-[var(--accent)] focus:bg-[var(--surface)] outline-none transition-all font-bold text-[color:var(--text)]"
                      />
                      {pwMsg.text && (
                        <p className={`text-xs ml-2 mt-2 font-black ${pwMsg.color}`}>{pwMsg.text}</p>
                      )}
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-black text-[color:var(--text)] mb-2 ml-1">
                    {t("member:mypage.form.email")}
                  </label>

                  <div className="flex gap-3">
                    <input
                      type="email"
                      name="email"
                      value={editForm.email}
                      onChange={handleInputChange}
                      className="flex-1 px-6 py-4 bg-[var(--surface-soft)] border border-[var(--border)] rounded-2xl focus:ring-2 focus:ring-[var(--accent)] focus:bg-[var(--surface)] outline-none transition-all font-bold text-[color:var(--text)]"
                    />

                    {editForm.email !== data.member.email && !isEmailVerified && (
                      <button
                        type="button"
                        onClick={handleSendCode}
                        disabled={isSendingCode}
                        className="px-6 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg"
                      >
                        {isSendingCode
                          ? t("member:mypage.email.sending")
                          : t("member:mypage.email.sendCode")}
                      </button>
                    )}
                  </div>

                  {editForm.email !== data.member.email && !isEmailVerified && (
                    <div className="flex gap-3 mt-3 animate-slide-in-bottom">
                      <input
                        type="text"
                        placeholder={t("member:mypage.email.codePlaceholder")}
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        className="flex-1 px-6 py-4 bg-[var(--surface-soft)] border border-[var(--border)] rounded-2xl focus:ring-2 focus:ring-[var(--accent)] focus:bg-[var(--surface)] outline-none transition-all font-bold text-[color:var(--text)]"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyCode}
                        disabled={isVerifyingCode}
                        className="px-6 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg"
                      >
                        {isVerifyingCode
                          ? t("member:mypage.email.verifying")
                          : t("member:mypage.email.verify")}
                      </button>
                    </div>
                  )}

                  {emailMsg.text && (
                    <p className={`text-xs ml-2 mt-2 font-black ${emailMsg.color}`}>{emailMsg.text}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-black text-[color:var(--text)] mb-2 ml-1">
                    {t("member:mypage.form.country")}
                  </label>

                  <select
                    name="countryId"
                    value={editForm.countryId}
                    onChange={handleInputChange}
                    className="w-full px-6 py-4 bg-[var(--surface-soft)] border border-[var(--border)] rounded-2xl focus:ring-2 focus:ring-[var(--accent)] focus:bg-[var(--surface)] outline-none transition-all font-bold text-[color:var(--text)] appearance-none"
                  >
                    <option value="">{t("member:mypage.form.countrySelect")}</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>
                        {countryLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-black text-[color:var(--text)] mb-2 ml-1">
                    {t("member:mypage.form.nickname")}
                  </label>

                  <input
                    type="text"
                    name="nickname"
                    value={editForm.nickname}
                    onChange={handleInputChange}
                    onBlur={handleNicknameBlur}
                    className="w-full px-6 py-4 bg-[var(--surface-soft)] border border-[var(--border)] rounded-2xl focus:ring-2 focus:ring-[var(--accent)] focus:bg-[var(--surface)] outline-none transition-all font-bold text-[color:var(--text)]"
                  />

                  {nicknameMsg.text && (
                    <p className={`text-xs ml-2 mt-2 font-black ${nicknameMsg.color}`}>{nicknameMsg.text}</p>
                  )}

                  {!data.nicknameChangeAllowed && (
                    <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs font-black text-[color:var(--text)] flex items-center gap-3">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {t("member:mypage.nicknameLimit")} ({t("member:mypage.nextChangeDate")}:{" "}
                      {data.nextNicknameChangeDate})
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-700 hover:-translate-y-0.5 transition-all active:scale-95"
                >
                  {t("member:mypage.saveChanges")}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            { label: t("member:mypage.stats.articles"), value: stats?.articleCount ?? 0, icon: "POST" },
            { label: t("member:mypage.stats.comments"), value: stats?.commentCount ?? 0, icon: "CMT" },
            { label: t("member:mypage.stats.likes"), value: stats?.likeCount ?? 0, icon: "LIKE" },
          ].map((stat, i) => (
            <div
              key={i}
              className="glass rounded-[2.5rem] p-8 text-center border-[var(--border)] shadow-xl hover:shadow-[0_16px_35px_rgba(59,130,246,0.2)] transition-all group"
            >
              <div className="text-3xl mb-3">{stat.icon}</div>
              <div className="text-xs font-black text-[var(--muted)] uppercase tracking-widest mb-1 group-hover:text-[var(--accent)] transition-colors">
                {stat.label}
              </div>
              <div className="text-4xl font-black text-[color:var(--text-strong)]">{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="glass rounded-[3rem] overflow-hidden border-[var(--border)] shadow-2xl">
          <div className="flex border-b border-[var(--border)] bg-[var(--surface-soft)]">
            {[
              { id: "articles", label: t("member:mypage.tabs.articles") },
              { id: "comments", label: t("member:mypage.tabs.comments") },
              { id: "likes", label: t("member:mypage.tabs.likes") },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-6 text-sm font-black transition-all uppercase tracking-widest ${
                  activeTab === tab.id
                    ? "text-[var(--accent)] bg-[var(--surface)] border-b-4 border-[var(--accent)]"
                    : "text-[var(--muted)] hover:text-[color:var(--text)] hover:bg-[var(--surface)]/60"
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
                  <div className="py-20 text-center text-[var(--muted)] font-black italic">
                    {t("member:mypage.empty.articles")}
                  </div>
                ) : (
                  myArticles.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => nav(`/board/${a.id}`)}
                      className="p-6 rounded-3xl hover:bg-[rgba(59,130,246,0.12)] cursor-pointer transition-all border border-transparent hover:border-[rgba(59,130,246,0.3)] group flex items-center justify-between"
                    >
                      <div>
                        <div className="text-lg font-black text-[color:var(--text-strong)] group-hover:text-[var(--accent)] transition-colors">
                          {a.title}
                        </div>
                        <div className="text-xs font-bold text-[var(--muted)] mt-2 flex items-center gap-4">
                          <span>
                            {t("member:mypage.labels.writtenAt")} {formatDateTimeMinute(a.regDate)}
                          </span>
                          <span>
                            {t("member:mypage.labels.views")} {a.hitCount || 0}
                          </span>
                        </div>
                      </div>
                      <svg
                        className="w-5 h-5 text-[var(--muted)] group-hover:text-[var(--accent)] transition-all transform group-hover:translate-x-1"
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
                  <div className="py-20 text-center text-[var(--muted)] font-black italic">
                    {t("member:mypage.empty.comments")}
                  </div>
                ) : (
                  myComments.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => c.relTypeCode === "article" && nav(`/board/${c.relId}`)}
                      className="p-6 rounded-3xl hover:bg-[rgba(59,130,246,0.12)] cursor-pointer transition-all border border-transparent hover:border-[rgba(59,130,246,0.3)] group"
                    >
                      <div className="text-base font-bold text-[color:var(--text)] line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
                        "{c.content}"
                      </div>
                      <div className="text-xs font-bold text-[var(--muted)] mt-3">
                        {t("member:mypage.labels.writtenAt")} {formatDateTimeMinute(c.updateDate)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "likes" && (
              <div className="space-y-4">
                {likedArticles.length === 0 ? (
                  <div className="py-20 text-center text-[var(--muted)] font-black italic">
                    {t("member:mypage.empty.likes")}
                  </div>
                ) : (
                  likedArticles.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => nav(`/board/${a.id}`)}
                      className="p-6 rounded-3xl hover:bg-[rgba(59,130,246,0.12)] cursor-pointer transition-all border border-transparent hover:border-[rgba(59,130,246,0.3)] group flex items-center justify-between"
                    >
                      <div>
                        <div className="text-lg font-black text-[color:var(--text-strong)] group-hover:text-[var(--accent)] transition-colors">
                          {a.title}
                        </div>
                        <div className="text-xs font-bold text-[var(--muted)] mt-2 flex items-center gap-4">
                          <span>
                            {t("member:mypage.labels.writer")} {a.writerName}
                          </span>
                          <span>
                            {t("member:mypage.labels.writtenAt")} {formatDateTimeMinute(a.regDate)}
                          </span>
                        </div>
                      </div>
                      <svg
                        className="w-5 h-5 text-[var(--muted)] group-hover:text-[var(--accent)] transition-all transform group-hover:translate-x-1"
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
