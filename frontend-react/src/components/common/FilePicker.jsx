// src/components/common/FilePicker.jsx
import React, { useMemo, useRef, useState } from "react";

export default function FilePicker({ onPick, label, emptyLabel }) {
  const [fileName, setFileName] = useState("");
  const inputRef = useRef(null);
  const inputId = useMemo(() => "file-" + Math.random().toString(36).slice(2), []);

  const onChange = (e) => {
    const f = e.target.files?.[0] ?? null;
    setFileName(f ? f.name : "");

    // ✅ 이벤트(e) 말고 File 자체를 넘겨야 MyPage에서 용량 체크가 확실히 동작함
    if (typeof onPick === "function") onPick(f);

    // ✅ 같은 파일을 다시 선택해도 onChange가 발생하도록 value 초기화
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onChange}
      />

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
