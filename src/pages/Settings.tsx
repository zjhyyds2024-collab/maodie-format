import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Info, MessageSquare, FolderOpen } from "lucide-react";
import AudioSampleRate from "../components/AudioSampleRate";
import Modal from "../components/Modal";
import Feedback from "../components/Feedback";
import { chooseDirectory, errorMessage } from "../converters/tasks";
import { APP_VERSION } from "../appInfo";
import { useLabel } from "../i18n/enhanced";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store";
import { SUPPORTED_LANGUAGES } from "../i18n";
import type { AppSettings } from "../converters/types";
import { getOutputFormats } from "../converters/formats";

export default function Settings() {
  const { t } = useTranslation();
  const label = useLabel();
  const [dialog, setDialog] = useState<"about"|"feedback">();
  const busy = useAppStore(s=>s.batchRunning||s.toolsRunning);
  const report = (error:unknown) => useAppStore.getState().addToast(errorMessage(error), "error");
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    updateSettings({ [key]: value });

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-bold">{t("settings.title")}</h1>

      {dialog==="about" && <Modal title={label("关于软件", "About this app")} onClose={()=>setDialog(undefined)}>
        <p className="text-sm font-medium">耄耋格式 · v{APP_VERSION}</p>
        <p className="mt-3 text-sm leading-relaxed">{label("耄耋格式 是一款在 Mac 上运行的本地文件转换工具，支持图片、音视频、Office 文档，以及 PDF、OCR 和常见压缩格式工具。", "耄耋格式 is a local file converter for Mac, with image, audio, video and Office conversion, plus PDF, OCR and archive tools.")}</p>
        <div className="mt-4 space-y-3 text-xs leading-relaxed text-[rgb(var(--muted))]">
          <p>{label("开始使用：从主页点击开始转换，在转换页拖入文件、选择预设并开始转换。点击预设右上角的铅笔，可修改名称、格式和参数；更改保存在本机，重启后仍可使用。更多文档操作可从侧栏工具箱进入。", "Get started: start from Home, then add files and choose a preset in the conversion workspace. Use the pencil on a preset to edit its name, format and options. Changes stay on this Mac across restarts. Open Tools in the sidebar for document operations.")}</p>
          <p>{label("文件与隐私：转换在本机完成，无需上传。任务记录保留最近 100 次执行的路径和参数。请及时保存结果，未保存的临时文件会在退出应用时清理。", "Files and privacy: conversions run locally without uploads. History stores paths and settings for the last 100 tasks. Save your results before quitting; unsaved temporary files are cleared on exit.")}</p>
          <p>{label("兼容性：WPS 和部分 RAW 为兼容导入；复杂 PDF 转 Word/Excel 请核对结果。OFD、MOBI 和扫描表格转 Excel 暂未支持。", "Compatibility: WPS and some RAW formats use compatibility imports. Review complex PDF to Word/Excel results. OFD, MOBI and scanned tables to Excel are not supported yet.")}</p>
          <p className="border-t border-[rgb(var(--border))] pt-3">{label("基于 Sikander RAVATE 的 VERT Desktop 扩展，遵循 AGPL-3.0 许可。", "Based on VERT Desktop by Sikander RAVATE, licensed under AGPL-3.0.")}</p>
        </div>
      </Modal>}
      {dialog==="feedback" && <Modal title={label("反馈与建议", "Feedback & suggestions")} onClose={()=>setDialog(undefined)}><Feedback/></Modal>}

      {/* Appearance */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold border-b border-[rgb(var(--border))] pb-2">
          {t("settings.appearance.title")}
        </h2>
        <div className="flex flex-col gap-4">
          <SettingRow label={t("settings.appearance.theme")}>
            <select
              value={settings.theme}
              onChange={(e) => update("theme", e.target.value as AppSettings["theme"])}
              className="select-field"
            >
              <option value="system">{t("settings.appearance.system")}</option>
              <option value="light">{t("settings.appearance.light")}</option>
              <option value="dark">{t("settings.appearance.dark")}</option>
            </select>
          </SettingRow>

          <SettingRow label={t("settings.appearance.language")}>
            <select
              value={settings.language}
              onChange={(e) => update("language", e.target.value)}
              className="select-field"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </SettingRow>
        </div>
      </section>

      <section className="mb-8" aria-labelledby="output-settings-title">
        <h2 id="output-settings-title" className="mb-4 border-b border-[rgb(var(--border))] pb-2 text-lg font-semibold">{label("默认保存位置", "Default save location")}</h2>
        <p className="mb-3 text-xs leading-relaxed text-[rgb(var(--muted))]">{label("设置后，转换和工具箱的结果会自动保存到这里，同名文件自动编号。", "When configured, conversion and tool results are saved here automatically. Duplicate names are numbered.")}</p>
        <p className="mb-3 break-all rounded-lg border border-[rgb(var(--border))] p-3 text-sm select-text">{settings.outputDirectory??label("未设置 · 完成后手动保存", "Not set · save results manually")}</p>
        <div className="flex flex-wrap gap-2"><button disabled={busy} className="tool-button" onClick={()=>void chooseDirectory().catch(report)}><FolderOpen size={15}/>{label("选择文件夹", "Choose folder")}</button><button disabled={busy} className="tool-button" onClick={()=>void invoke<string>("default_output_directory").then(path=>update("outputDirectory",path)).catch(report)}>{label("使用下载文件夹", "Use Downloads")}</button>{settings.outputDirectory&&<button disabled={busy} className="tool-button" onClick={()=>update("outputDirectory",undefined)}>{label("改为手动保存", "Save manually")}</button>}</div>
      </section>

      {/* Conversion */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold border-b border-[rgb(var(--border))] pb-2">
          {t("settings.conversion.title")}
        </h2>
        <div className="flex flex-col gap-4">
          <SettingRow label={`${t("settings.conversion.image")} (${t("settings.conversion.defaultFormats")})`}>
            <FormatSelect
              category="image"
              value={settings.defaultImageFormat}
              onChange={(v) => update("defaultImageFormat", v)}
            />
          </SettingRow>

          <SettingRow label={`${t("settings.conversion.audio")} (${t("settings.conversion.defaultFormats")})`}>
            <FormatSelect
              category="audio"
              value={settings.defaultAudioFormat}
              onChange={(v) => update("defaultAudioFormat", v)}
            />
          </SettingRow>

          <SettingRow label={`${t("settings.conversion.video")} (${t("settings.conversion.defaultFormats")})`}>
            <FormatSelect
              category="video"
              value={settings.defaultVideoFormat}
              onChange={(v) => update("defaultVideoFormat", v)}
            />
          </SettingRow>

          <SettingRow label={`${t("settings.conversion.document")} (${t("settings.conversion.defaultFormats")})`}>
            <FormatSelect
              category="document"
              value={settings.defaultDocumentFormat}
              onChange={(v) => update("defaultDocumentFormat", v)}
            />
          </SettingRow>

          <SettingRow label={t("settings.conversion.quality")}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="100"
                value={settings.quality}
                onChange={(e) => update("quality", Number(e.target.value))}
                className="w-32"
              />
              <span className="w-10 text-sm tabular-nums">{settings.quality}%</span>
            </div>
          </SettingRow>

          <SettingRow label={t("settings.conversion.audioBitrate")}>
            <select
              value={settings.audioBitrate}
              onChange={(e) => update("audioBitrate", Number(e.target.value))}
              className="select-field"
            >
              {[64, 96, 128, 160, 192, 256, 320].map((b) => (
                <option key={b} value={b}>{b} kbps</option>
              ))}
            </select>
          </SettingRow>

          <SettingRow label={label("音频采样率", "Audio sample rate")}>
            <div className="max-w-[240px] text-right"><AudioSampleRate value={settings.sampleRate} onChange={value=>update("sampleRate", value)} disabled={busy}/><p className="mt-2 text-xs leading-relaxed text-[rgb(var(--muted))]">{label("显式数值会覆盖源采样率；Opus 等格式会使用编码器支持的采样率。", "An explicit value overrides the source rate. Formats such as Opus use a rate their encoder supports.")}</p></div>
          </SettingRow>

          <SettingRow label={t("settings.conversion.preserveMetadata")}>
            <Toggle
              value={settings.preserveMetadata}
              onChange={(v) => update("preserveMetadata", v)}
            />
          </SettingRow>

          <SettingRow label={t("settings.conversion.useDefaults")}>
            <Toggle
              value={settings.useDefaultsAutomatically}
              onChange={(v) => update("useDefaultsAutomatically", v)}
            />
          </SettingRow>
        </div>
      </section>
      <div className="flex flex-wrap gap-3 border-t border-[rgb(var(--border))] pt-5"><button className="tool-button" onClick={()=>setDialog("about")}><Info size={16}/>{label("关于软件", "About this app")}</button><button className="tool-button" onClick={()=>setDialog("feedback")}><MessageSquare size={16}/>{label("反馈与建议", "Feedback & suggestions")}</button></div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm font-medium text-[rgb(var(--fg))]">{label}</label>
      {children}
    </div>
  );
}

function FormatSelect({
  category,
  value,
  onChange,
}: {
  category: Parameters<typeof getOutputFormats>[0];
  value: string;
  onChange: (v: string) => void;
}) {
  const formats = getOutputFormats(category);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="select-field">
      {formats.map((f) => (
        <option key={f.ext} value={f.ext}>{f.label}</option>
      ))}
    </select>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? "bg-brand-500" : "bg-[rgb(var(--border))]"}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}
