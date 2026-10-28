# 耄耋格式 1.7.0 · macOS Apple Silicon

<img src="public/app-icon.png" width="96" alt="耄耋格式猫头图标">

[源码仓库](https://github.com/zjhyyds2024-collab/maodie-format) · [预览版下载](https://github.com/zjhyyds2024-collab/maodie-format/releases)

> 预览安装包需要另外安装本地转换引擎及 LibreOffice。请先阅读下方“本机运行组件”和“构建”部分；该 ZIP 尚未通过 Apple 开发者签名、公证或干净机器验收。

基于 [VERT Desktop](https://github.com/vert-desktop/vert-desktop) 扩展的本地格式转换应用。沿用原项目的 React / Tauri 架构和 AGPL-3.0 许可。原作者：Sikander RAVATE。功能范围参考飞鼠格式，未复制其代码、品牌或素材。

## 发布状态

项目现名「耄耋格式」（Maodie Format），原名 VERT Enhanced。当前提供 macOS 14+ / Apple Silicon 的源码构建；安装包需要另外安装转换引擎与 LibreOffice，尚未完成干净机器验收，也未经过 Apple 开发者签名和公证。

原项目与第三方归属见 [NOTICE](NOTICE.md)，改名与发布审查见 [发布审查](docs/reviews/2026-10-28-github-release-audit.md)。内部应用标识及数据目录保留旧值，以兼容现有设置和本机引擎。请勿使用仓库中历史的原版 VERT 安装脚本。

## 新增功能

- Office：DOC/DOCX/ODT/RTF 文档，XLS/XLSX/ODS/CSV 表格，PPT/PPTX/ODP 演示文稿的分类转换与 PDF 导出。
- WPS/ET/DPS：提供兼容性导入入口，尚未用真实 WPS 样本验证；请检查输出内容和排版。
- PDF：合并、按页码及每 N 页拆分、图片按队列合并 PDF、PDF 转 PNG、文字提取。
- OCR：macOS Vision 识别中英文图片和扫描 PDF；提取 PDF 文字时，扫描页自动 OCR。
- 批量结果、真实逐页进度、耗时、取消、重试、输出目录记忆、全部保存、Finder 定位。
- 不同源文件只显示对应类别的转换目标，记忆每种扩展名的上次选择。

## 使用

启动 耄耋格式.app。主页直接进入统一转换工作台，添加文件、配置预设并处理常规格式转换，侧栏「工具箱」进入工具大厅。首次界面默认中文，可在设置中选择其他语言；新增工具提供中文/英文。

未设置输出目录时，结果暂存在当前应用会话中，需要手动保存。退出应用会清理会话结果，请先保存。设置输出目录后，成功的转换会自动保存。同名文件自动编号，避免覆盖已有文件；单个「保存」使用系统保存对话框。

PDF 拆分和 PDF 转图片输出 ZIP。页码从 1 开始，如 `1-3,5`，留空表示全部。合并顺序按文件队列排列。OCR 输出 TXT，不恢复原始版式；复杂 PDF 版式不保证与原件一致；扫描表格暂不能转 Excel。CSV 只保存一个工作表，不保留样式。

## 本机运行组件

- `~/.local/share/vert-enhanced/engines/`：隔离安装的 FFmpeg、ImageMagick、Pandoc 及其动态库。
- `/Applications/LibreOffice.app`，或 `~/.local/share/vert-enhanced/LibreOffice.app`：Office 转换。
- 应用包内 `Contents/Resources/native-bin/vert-document-tools`：Swift PDFKit / Vision 工具。

转换不需要联网。应用包当前针对本机配置，不包含 FFmpeg/ImageMagick/Pandoc/LibreOffice 的全部运行库。移动到另一台 Mac 时，先运行 `scripts/setup-mac-engines.sh` 并安装 Apple Silicon 版 LibreOffice。引擎精确版本记录于 `docs/mac-engine-lock.txt`，环境可通过 micromamba 的显式清单重建。

## 构建

需要 macOS 14+、Apple Silicon、Xcode Command Line Tools、Rust 和 Node.js。运行：

```sh
bash scripts/setup-mac-engines.sh
bash scripts/build-mac.sh
```

输出：`src-tauri/target/release/bundle/macos/耄耋格式.app`。独立标识为 `local.vert.enhanced`，不会替换原版 `sh.vert.desktop`。

## 验证

```sh
npm test
npm run lint
npm run build
npm run test:e2e
cargo test --manifest-path src-tauri/Cargo.toml
```

真实引擎集成测试需先创建样本：

```sh
bash scripts/smoke-mac.sh
```

本轮已验证的具体路线与限制见 `docs/verification.md`。

## 1.2.0 新增

- JSON / XML / YAML / LOG 与常见文本导出；CSV 与 JSON/XML/YAML 结构转换。XML 保留属性及混合内容时使用节点树表示，通用 JSON 数据导出 XML 时保留类型信息。
- Excel 导出 XLS、HTML；CSV 导出 Word、EPUB。XLSM 导出会去除宏，并显示提示。
- PPT 按页导出 PNG/JPG（ZIP），以及 HTML 网页包（ZIP）。
- PDF 转 Word：对可提取文字的 PDF 尝试版式转换并检查文字覆盖；扫描页、空白页和失败版式按页重建文字，显示说明。
- PDF 原生表格转 Excel：生成表格工作表及逐页处理说明，未检测到可靠表格时失败；不提供扫描表格 OCR 恢复。
- PDF 转 HTML 文字、逐页 JPG，以及使用原密码另存解密副本。
- ZIP 压缩、解压为文件夹、包内图片按自然文件名顺序合并 PDF。解压拒绝越界路径、链接、重名冲突和过大的展开内容。
- 常用视频提取 FLAC / M4A / OGG / AAC / OPUS / WMA；图片转 PDF、文字及 3 秒静态视频。
- 增加 RAW、WPS 模板等兼容入口；RAW 根据本机已注册的解码器筛选，但并未验证所有相机型号。

此版本仍未完整覆盖飞鼠格式：OFD、MOBI、扫描表格转 Excel 尚未接入；特殊 WPS 变体、复杂 PDF 排版及 RAW 相机型号需要真实样本验证。请勿把格式入口数量理解为所有格式均可无损互转。

新增本地依赖为引擎目录中的 Python 3.12 和 `docs/mac-python-lock.txt` 固定的包；`scripts/setup-mac-engines.sh` 会安装它们。此版本针对 macOS 14+ 的 Apple Silicon Mac，实测环境为当前机器。

## 1.3.0 界面与工作流

- 左侧工作空间导航、浅色/深色主题和窄窗口紧凑导航；首页常用预设与最近任务。
- JPG / WebP / MP3 / MP4 / PDF 预设，只应用于类别匹配、目标可用的待处理文件；默认参数可恢复。预设只配置，不自动开始转换。
- 图片原文件/结果并排预览和体积比较；文本纯文本预览（最多 256 KiB）；PDF 首页缩略图与页数；其他格式使用系统应用或 Finder 查看。图片预览为最长边 1400 像素的缩略图，动图仅预览首帧；大于 128 MiB 的图片/PDF 使用系统应用查看。
- 最近 100 次转换/工具箱记录保存在本机，包含参数快照，支持搜索、状态筛选、重新加入队列、删除与清空。PDF 密码不记录。删除记录保留文件。
- 历史仅保存文件路径和元数据。尚未保存的临时结果会随应用退出清理，历史记录不会自动保留文件内容。请及时保存结果。

## 1.3.1 调整

首页移除工具箱跳转卡片和四个格式类别卡片，工具箱仍可从侧栏进入。设置页新增软件介绍、使用和兼容性说明。点击常用预设卡片右上角的铅笔，可修改名称、输出格式、图片质量或音频码率/采样率；保存后重启仍保留，可单独恢复默认。当前选中预设的更改会同步到可用的待处理文件，已完成任务和历史快照不变。

## 1.4.0 调整

- 没有文件时也可访问转换页；工具箱底部组件格子移除。
- 创建 ZIP / 7Z / TAR / TAR.GZ / TAR.BZ2 / TAR.XZ；解压另支持 RAR、GZ、BZ2、XZ 和 TGZ/TBZ2/TXZ。RAR 仅解压，加密和分卷暂不支持。新格式处理依赖 macOS 系统 libarchive，无需额外安装。新压缩/解压最多 10000 项和 2 GiB，拒绝链接、特殊文件与越界路径。
- 设置页通过按钮查看软件介绍；反馈与建议填写后打开寄往 zjhyyds2024@gmail.com 的邮件草稿，由用户确认发送。
- 设置页可选择默认保存位置或系统下载文件夹，控制自动保存和另存默认路径，也能改回手动保存。

## 1.5.0 工具大厅与页面整理

首页提供工作总览、继续转换和最近记录；上传、预设和批量队列统一放在转换页。工具箱支持搜索/分类卡片，选择后进入独立操作页，历史重试可直达对应工具。新增 PDF 页面旋转、提取、删除和重排；另存副本，不改原文件。页码从 1 开始，重排需输入每一页且仅出现一次，删除至少保留一页。工具处理仍在本机完成。

## 1.5.1 兼容性修复

大图转 ICO 自动缩放并生成常用尺寸；3GP 明确使用 H.264/AAC；多尺寸 ICO 和分层 PSD 转单图可正确输出；GIF/TIFF 转单图明确提示仅导出首帧/第一页。本机真实样本验证范围和未验证项目见 [兼容性测试报告](docs/compatibility-2026-10-24.md)。

## 1.7.0 多平台音乐与批量导出

接入 MIT 许可的 [music-geshizhuanhuan](https://github.com/HRuiCcc/music-geshizhuanhuan) 解码器，补充 QQ 音乐、酷狗旧版、酷我旧版；NCM 增加封面。支持文件夹添加、两路并发、中文 ZIP、歌曲标签与封面预览。QQ 无内嵌密钥的文件需要手动 EKey 或只读本地密钥库，密钥不进入设置或历史；KGG v5 暂不支持。

详见 [来源、接入边界与测试](docs/reviews/2026-10-28-music-project-integration.md)。第三方源码及许可证保留在 `src-tauri/python/music_unlock/`。

## 1.6.1 网易云 NCM 导入

支持 NCM 本地导入，默认还原原始 MP3/FLAC/M4A 编码，不重新编码；也可按所选参数转成普通音频格式。保留元数据时写入可读取的标题、歌手、专辑；独立封面暂不导出。NCM 仅作为输入格式，LRC 是歌词而非音频。

通过用户提供的真实 NCM 与合成样本验证，详见 [NCM 验收报告](docs/reviews/2026-10-28-ncm-validation.md)。

## 1.6.0 原生工作台与交互回归

参考 Permute 和 Clop 的任务组织方式，收紧工具栏与预设，文件队列增加类型图标和文字状态。转换参数栏可收起，宽窗口两栏独立滚动；采样率在工作台与设置页共用控件。支持 ⌘O 添加文件，编辑预设时不会误打开文件选择器。

验证混合队列失败后继续、只重试失败项、停止队列、长文件名和深浅主题。详见 [界面参考与验收](docs/reviews/2026-10-28-native-ui-validation.md)。

## 1.5.3 缺陷复核后优化

默认音频采样率跟随源文件；Opus 自动处理不兼容采样率。视频封装优先保留兼容的源编码，并在回退转码时提示。修正结构化文档标题与空格、UTF-16 中文、照片方向及 ZIP 杂项文件；PDF 表格对明确数字写入数值，同时保护编号和公式文本。

详见 [优化与回归验收](docs/reviews/2026-10-27-optimization-validation.md)。大图资源保护上限仍保留，PDF 表格提取仍需人工核对。

## 1.5.2 中文字体与扩展验证

修复无界面 Office 转 PDF 时部分中文缺字的问题：应用自带 macOS 字体目录配置，仅用于 LibreOffice 转换子进程。补测复杂 Office、1000 页文本 PDF、两分钟音视频及五种真实相机 RAW，范围和限制见 [扩展兼容性报告](docs/compatibility-2026-10-25.md)。
