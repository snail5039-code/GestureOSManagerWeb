import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { useModal } from "../../context/ModalContext";
import { useTranslation } from "react-i18next";

export default function BoardModify() {
  const { t } = useTranslation("board");
  const { id } = useParams();
  const nav = useNavigate();
  const { showModal } = useModal();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get(`/boards/${id}`)
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
          onClose: () => nav("/board")
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
        type: "warning"
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
        onClose: () => nav(`/board/${id}`)
      });
    } catch (e2) {
      console.error(e2);
      showModal({
        title: t("modal.modifyFailTitle"),
        message: e2?.response?.data?.message || t("modal.modifyFailMsg"),
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => nav(-1)}
          className="mb-8 flex items-center gap-2 text-slate-400 font-black hover:text-indigo-600 transition-colors group"
        >
          <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          {t("modify.back")}
        </button>

        <div className="glass rounded-[3rem] p-12 border-slate-100 shadow-2xl animate-fade-in">
          <div className="mb-10">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">{t("modify.title")}</h1>
            <p className="text-slate-400 mt-2 font-bold">{t("modify.desc")}</p>
          </div>

          <form onSubmit={onSave} className="space-y-6">
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 ml-1">
                {t("modify.labelTitle")}
              </label>
              <input
                className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder-slate-300 font-bold"
                placeholder={t("modify.placeholderTitle")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 ml-1">
                {t("modify.labelContent")}
              </label>
              <textarea
                className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder-slate-300 font-bold min-h-[400px] resize-none"
                placeholder={t("modify.placeholderContent")}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => nav(-1)}
                className="flex-1 py-5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black hover:bg-slate-50 transition-all active:scale-95"
              >
                {t("modify.cancel")}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all disabled:opacity-60 active:scale-95"
              >
                {loading ? t("modify.saving") : t("modify.save")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
