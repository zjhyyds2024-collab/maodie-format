import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import History from "./pages/History";
import Tools from "./pages/Tools";
import { listen } from "@tauri-apps/api/event";
import Settings from "./pages/Settings";
import { useAppStore } from "./store";

export default function App() {
  const { i18n } = useTranslation();
  const settings = useAppStore((s) => s.settings);

  useEffect(() => {
    const root = document.documentElement;
    const theme = settings.theme;

    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      root.classList.toggle("dark", mq.matches);
      const handler = (e: MediaQueryListEvent) =>
        root.classList.toggle("dark", e.matches);
      mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
    }
  }, [settings.theme]);

  useEffect(() => {
    i18n.changeLanguage(settings.language);
  }, [settings.language, i18n]);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const subscription = listen<{job_id: string; stage: string; current?: number; total?: number}>("conversion-progress", ({ payload }) => {
      const file = useAppStore.getState().files.find(f => f.id === payload.job_id);
      if (file?.status === "converting") useAppStore.getState().updateFile(payload.job_id, { stage: payload.stage, progress: payload.total ? Math.min(99, (payload.current ?? 0) / payload.total * 100) : 0 });
    });
    return () => { void subscription.then(unlisten => unlisten()).catch(() => {}); };
  }, []);

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/convert" element={<Navigate to="/" replace />} />
          <Route path="/history" element={<History />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
