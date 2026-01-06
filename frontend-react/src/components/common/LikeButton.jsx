import React, { useState } from "react";
import { api } from "../../api/client";

export default function LikeButton({
    targetId,
    targetType = "article", // "article" or "comment"
    initialLiked = false,
    initialCount = 0
}) {
    const [liked, setLiked] = useState(initialLiked);
    const [count, setCount] = useState(initialCount);
    const [loading, setLoading] = useState(false);

    const handleToggle = async () => {
        try {
            setLoading(true);
            const url = `/reactions/${targetType}/${targetId}`;

            const res = await api.post(url);
            setLiked(res.data.isLiked);
            setCount(res.data.likeCount);
        } catch (e) {
            console.error(e);
            if (e?.response?.status === 401) {
                alert("로그인이 필요합니다.");
            } else {
                alert("좋아요 처리 중 오류가 발생했습니다.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleToggle}
            disabled={loading}
            className={`flex items-center gap-1 px-3 py-1 rounded-full border transition-colors ${liked
                ? "bg-red-50 border-red-200 text-red-600"
                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
        >
            <span className="text-lg">{liked ? "❤️" : "🤍"}</span>
            <span className="text-sm font-medium">{count}</span>
        </button>
    );
}
