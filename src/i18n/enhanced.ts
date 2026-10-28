import { useTranslation } from "react-i18next";
export function useLabel() {
  const { i18n } = useTranslation();
  return (zh: string, en: string) => i18n.language.startsWith("zh") ? zh : en;
}
