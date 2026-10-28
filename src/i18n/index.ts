import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import es from "./locales/es.json";
import it from "./locales/it.json";
import bs from "./locales/bs.json";
import hr from "./locales/hr.json";
import id from "./locales/id.json";
import tr from "./locales/tr.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import el from "./locales/el.json";
import zhCN from "./locales/zh-CN.json";
import zhTW from "./locales/zh-TW.json";
import ptBR from "./locales/pt-BR.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "bs", label: "Bosanski" },
  { code: "hr", label: "Hrvatski" },
  { code: "id", label: "Indonesia" },
  { code: "tr", label: "Türkçe" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "el", label: "Ελληνικά" },
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "pt-BR", label: "Português (BR)" },
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      de: { translation: de },
      es: { translation: es },
      it: { translation: it },
      bs: { translation: bs },
      hr: { translation: hr },
      id: { translation: id },
      tr: { translation: tr },
      ja: { translation: ja },
      ko: { translation: ko },
      el: { translation: el },
      "zh-CN": { translation: zhCN },
      "zh-TW": { translation: zhTW },
      "pt-BR": { translation: ptBR },
    },
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "vert-desktop-lang",
    },
  });

export default i18n;
