import React, { useState } from "react";
import { api } from "../../api/client";
import { useTranslation } from "react-i18next";

export default function CommentWrite({ relTypeCode, relId, parentId = null, onSuccess, onCancel = null }) {
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(false);
    const { t } = useTranslation("board");

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim()) return;

        try {
            setLoading(true);
            await api.post(`/comments/${relTypeCode}/${relId}`, {
                content,
                parentId,
            });
            setContent("");
            if (onSuccess) onSuccess();
        } catch (e) {
            console.error(e);
            alert(e?.response?.data?.message || t("comment.writeFail", { defaultValue: "Failed to post comment" }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="mt-4">
            <div className="flex flex-col gap-2">
                <textarea
                    className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                    rows={parentId ? 2 : 3}
                    placeholder={parentId ? t("comment.placeholderReply") : t("comment.placeholderComment")}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                        >
                            {t("comment.cancel")}
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={loading || !content.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                    >
                        {loading ? t("comment.submitting") : parentId ? t("comment.submitReply") : t("comment.submitComment")}
                    </button>
                </div>
            </div>
        </form>
    );
}
