import React, { useMemo, useState } from "react";

export default function FilePicker({ onPick, label, emptyLabel }) {
  const [fileName, setFileName] = useState("");

  const inputId = useMemo(() => "file-" + Math.random().toString(36).slice(2), []);

  const onChange = (e) => {
    const f = e.target.files?.[0] ?? null;
    setFileName(f ? f.name : "");
    onPick?.(e); // ✅ MyPage handlePickProfile은 event를 받는 형태라 이벤트 전달이 맞음
  };

  return (
    <div className="flex items-center gap-3">
      <input id={inputId} type="file" accept="image/*" className="hidden" onChange={onChange} />

      <label
        htmlFor={inputId}
        className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-black cursor-pointer hover:bg-indigo-700"
      >
        {label}
      </label>

      <span className="text-sm font-bold text-slate-300">
        {fileName ? fileName : emptyLabel}
      </span>
    </div>
  );
}
