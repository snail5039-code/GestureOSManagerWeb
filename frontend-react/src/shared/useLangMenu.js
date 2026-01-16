// src/shared/useLangMenu.js
import { useEffect, useState } from "react";
import i18n from "../i18n";

export default function useLangMenu() {
  const LANGUAGES = [
    { code: "en", name: "English" },
    { code: "ko", name: "한국어" },
    { code: "ja", name: "日本語" },
  ];

  const [isLangOpen, setIsLangOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState("한국어");

  useEffect(() => {
    const lng = i18n.resolvedLanguage || i18n.language || "ko";
    const found = LANGUAGES.find((x) => x.code === lng) || LANGUAGES[1];
    setCurrentLang(found.name);
  }, [i18n.resolvedLanguage, i18n.language]);

  const selectLang = async (code) => {
    // ✅ detector가 보는 키랑 똑같이
    localStorage.setItem("lng", code);

    // ✅ promise 끝난 뒤 UI가 안정적으로 따라감
    await i18n.changeLanguage(code);

    const found = LANGUAGES.find((x) => x.code === code);
    if (found) setCurrentLang(found.name);

    setIsLangOpen(false);
  };

  return { LANGUAGES, isLangOpen, setIsLangOpen, currentLang, selectLang };
}
