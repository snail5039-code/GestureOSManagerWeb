import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../api/client";
import { useModal } from "../../context/ModalContext";
import { useTranslation } from "react-i18next";

export default function FindLoginId() {
  const navigate = useNavigate();
  const { showModal } = useModal();
  const { t } = useTranslation(["member"]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFindLoginId = async () => {
    if (!name.trim())
      return showModal({
        title: t("member:findLoginId.modal.inputError"),
        message: t("member:findLoginId.modal.needName"),
        type: "warning",
      });

    if (!email.trim())
      return showModal({
        title: t("member:findLoginId.modal.inputError"),
        message: t("member:findLoginId.modal.needEmail"),
        type: "warning",
      });

    setLoading(true);
    try {
      const response = await api.post("/members/findLoginId", { name, email });
      const { message, loginId } = response.data;

      showModal({
        title: t("member:findLoginId.modal.successTitle"),
        message: t("member:findLoginId.modal.successMessage", {
          message,
          loginId,
        }),
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center py-20 px-6">
      <div className="w-full max-w-xl bg-white rounded-[3rem] p-12 shadow-2xl border border-slate-100 animate-scale-in">
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-100 rotate-3">
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
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>

          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            {t("member:findLoginId.title")}
          </h1>
          <p className="text-slate-400 mt-3 font-bold">
            {t("member:findLoginId.subtitle")}
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-black text-slate-700 mb-2 ml-1">
              {t("member:findLoginId.field.name")}
            </label>
            <input
              type="text"
              placeholder={t("member:findLoginId.placeholder.name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all placeholder-slate-300 font-bold"
            />
          </div>

          <div>
            <label className="block text-sm font-black text-slate-700 mb-2 ml-1">
              {t("member:findLoginId.field.email")}
            </label>
            <input
              type="email"
              placeholder={t("member:findLoginId.placeholder.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all placeholder-slate-300 font-bold"
            />
          </div>

          <div className="pt-6 flex flex-col gap-4">
            <button
              onClick={handleFindLoginId}
              disabled={loading}
              className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all disabled:opacity-60 active:scale-95"
            >
              {loading
                ? t("member:findLoginId.btn.loading")
                : t("member:findLoginId.btn.submit")}
            </button>

            <button
              onClick={() => navigate(-1)}
              className="w-full py-5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black hover:bg-slate-50 transition-all active:scale-95"
            >
              {t("member:findLoginId.btn.back")}
            </button>
          </div>

          <div className="text-center pt-4 flex items-center justify-center gap-6 text-sm font-bold text-slate-400">
            <Link
              to="/findLoginPw"
              className="hover:text-indigo-600 transition-colors"
            >
              {t("member:findLoginId.link.findPw")}
            </Link>
            <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
            <Link
              to="/login"
              className="hover:text-indigo-600 transition-colors"
            >
              {t("member:findLoginId.link.login")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
