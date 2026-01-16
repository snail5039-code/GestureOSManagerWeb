import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "ko",
    supportedLngs: ["ko", "en", "ja"],
    ns: ["common", "header", "board", "member", "layout", "chat"],
    defaultNS: "common",

    backend: { loadPath: "/locales/{{lng}}/{{ns}}.json" },

    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "lng",
    },

    interpolation: { escapeValue: false },

    react: {
      useSuspense: false,
    },

    debug: true,
  });

export default i18n;
