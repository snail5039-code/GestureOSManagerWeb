import React from "react";
import { useTranslation } from "react-i18next";

export default function Modal({ show, onClose, title, message, type = "info", children }) {
    const { t } = useTranslation("common");
    if (!show) return null;

    const typeStyles = {
        info: "bg-indigo-50 text-indigo-600 border-indigo-100",
        success: "bg-emerald-50 text-emerald-600 border-emerald-100",
        error: "bg-rose-50 text-rose-600 border-rose-100",
        warning: "bg-amber-50 text-amber-600 border-amber-100",
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div
                className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                            {title || "알림"}
                        </h3>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {message && (
                        <div className={`p-4 rounded-2xl border mb-6 font-bold text-sm ${typeStyles[type]}`}>
                            {message}
                        </div>
                    )}

                    <div className="space-y-4">
                        {children}
                    </div>

                    {!children && (
                        <button
                            onClick={onClose}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all shadow-lg"
                        >
                            {t("common.ok")}
                                                
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}






