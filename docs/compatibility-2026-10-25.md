# VERT Enhanced 1.5.2：扩展兼容性测试

日期：2026-10-25。本轮补测真实相机 RAW、复杂 Office 样本、千页 PDF、两分钟音视频与取消操作。发现并修复无界面 Office 转 PDF 的中文字体缺失问题。环境仍为本机 macOS 26.6.2 / Apple Silicon，不扩大到其他机器或系统版本。

## 结果

| 测试 | 数量 | 结果 |
|---|---:|---|
| 复杂 Word、Excel、PPT、千页 PDF、两分钟视频转换 | 12 条路线 | 全部通过 |
| 5 个真实相机 RAW → JPG / PNG | 10 条路线 | 全部通过 |
| Office/PDF/音视频内容检查 | 30 项 | 修复后全部通过 |
| RAW 输出重新解码及尺寸检查 | 10 项 | 全部通过 |
| 实际 FFmpeg 取消 | 1 项 | 约 1 秒取消，无需等待任务自然结束 |
| 中文可见字形回归 | 2 个样本 | 实际 PDF 首页经栅格 OCR 检查通过 |
| 既有真实引擎集成套件 | 1 套 | 回归通过 |
| Rust 常规测试 | 6 项 | 全部通过 |

数量按不同层级分列，内容检查、回归套件与转换路线有重叠，不汇总成单一案例数。

## 本轮发现：PDF 文字能提取，但中文没有显示

新生成的复杂 DOCX/PPTX 转 PDF 时，LibreOffice 的无界面字体回退只找到了不包含相应中文字形的字体。PDF 中可以保留 Unicode 文本，但画面上的部分中文缺失；pypdf 与 MuPDF 对这种 PDF 的提取结果也不一致。因此「命令成功」「文件非空」或「能提取文字」不能证明渲染正确。

修复：新增随应用打包的 fonts/fonts.conf，包含 macOS 系统、共享和用户字体目录及用户缓存目录。仅在 LibreOffice 子进程设置 FONTCONFIG_FILE，不修改系统字体设置，不替换原文档字体，也不把系统字体复制进应用包。配置缺失时明确报错。

复验不仅检查文字，还将生成 PDF 首页栅格化并 OCR，分别识别 Word 标题中的「兼容」和 PPT 标题中的「演示」。已查看修复前后页面图像，确认中文恢复显示。增加了独立的真实引擎回归测试 office_pdf_visible_chinese_regression，防止只检查 PDF 文本而漏检。

首次内容检查有三项失败：Word/PPT 中文显示两项是真实问题；PPT 图片 ZIP 数量的检查误把 macOS `._` 元数据当作页面，已修正为只统计普通 PNG。实际页面数量为 13，没有缺页或多页。首次检查记录保留，没有改写为全通过。

## 复杂文档样本与检查范围

- **Word**：中英文、页眉页码、表格合并单元格、内嵌图片、列表、横竖页面与分栏。导出 PDF/ODT/独立 HTML；检查开始/结束/表格标记、图片、横竖页及中文可见性。
- **Excel**：5000 行、两张工作表、跨表 SUM/COUNTA、逐行公式、合并单元格、图表、条件格式、冻结窗格及打印区域。XLSX→ODS→XLSX 读回检查中文、最后一行、公式与计算结果（合计 125025、行数 5000）、图表、合并单元格和条件格式。CSV 检查完整 5001 行（含表头）；PDF 按打印区域输出 3 页。没有声称每种样式和打印细节都逐像素一致。
- **PPT**：13 张幻灯片，中英文、表格、图片、列表与数学公式。PDF 保留全部页数与文字标记；逐页 PNG ZIP 的普通页面数量正确。没有对数学公式或每一张图片逐像素比对。
- **PDF**：生成 1000 页带页码和内容标记的文本 PDF（约 0.55 MB）。检查全部文字标记和顺序；提取第 1000/1/500 页、删除第 2–999 页、1000 页完整倒序，逐页检查顺序并确认源文件 SHA-256 不变。这是页数测试，不是大型扫描 PDF 或文件体积极限测试。
- **视频**：640×360、120 秒、带音轨，源文件约 15 MB。转 MKV/3GP/MP3，检查 120 秒时长、轨道，并完整解码。两分钟不等同于数小时长视频，不能据此外推长期运行或内存稳定性。

## 真实 RAW 样本

样本来自 [RevelRaw 的公开样本仓库](https://github.com/tellodaniel/revelraw-sample-raw-files)，其 README 声明来自 raw.pixls.us 并采用 CC0。下载 release 原文件，并逐一核对发布的 SHA256SUMS.txt；LibRaw raw-identify 验证相机型号。文件未提交到 Git。

| 原文件 | 识别型号 | JPG/PNG 输出尺寸 | 结果 |
|---|---|---|---|
| Sony-a7III.ARW | Sony ILCE-7M3 | 6024×4024 | 两条通过 |
| Canon-EOS-R.CR3 | Canon EOS R | 6742×4498 | 两条通过 |
| Canon-5D-Mark-IV.CR2 | Canon EOS 5D Mark IV | 6744×4502 | 两条通过 |
| Nikon-Z6.NEF | Nikon Z 6 | 6064×4040 | 两条通过 |
| Ricoh-GR-III.DNG | Ricoh GR III | 6020×4024 | 两条通过 |

以上确认能读取这些样本并输出高分辨率可解码图像，没有与相机原厂软件进行色彩、白平衡、高光恢复或镜头校正的基准比对；也不代表所有型号、压缩方式或 RAW 变体兼容。

## 仍未验证

- 未取得可确认来源的真实金山 WPS/ET/DPS/WPT/ETT/DPT 样本。搜索到的一个 `.wps` 冒烟文件实际以 RTF 头开始，已排除（[该文件原文](https://github.com/AndersonBY/wps2office/blob/main/testdata/smoke.wps)）。没有以 Microsoft Works 的同名扩展名冒充金山 WPS。
- 未验证宏、数字签名、嵌入对象、所有复杂版式、巨型扫描 PDF、小时级视频和文件体积上限。
- 未验证其他相机型号、Intel、其他 macOS 版本、其他操作系统或另一台 Mac 的独立安装。

## 证据与复现

证据在 [work/compatibility-20261025](../work/compatibility-20261025)：

- fixtures/raw-sources.json、SHA256SUMS.txt、raw-identification.json：原始来源、校验和及型号识别。
- complex-results.json、raw-results.json：真实转换结果与耗时。
- complex-content-checks.json、raw-content-checks.json：内容检查结果。
- content-before-font-fix.json、docx-before-font-fix.png：首次失败证据；verified-docx-page1.png、verified-pptx-page1.png 及 OCR 文本：修复后渲染证据。
- make-fixtures.py、download-raw.py、validate-complex.py：本轮本机生成和核验脚本。
- complex-tests.log、raw-tests.log、cancel-tests.log、font-regression-tests.log、regression-tests.log、rust-unit-tests.log、build.log：运行日志。

测试代码位于 src-tauri/src/commands/convert_tests.rs，真实引擎测试默认 ignored。准备相同样本后分别运行 extended_complex_compatibility、real_camera_raw_compatibility、installed_ffmpeg_cancellation、office_pdf_visible_chinese_regression；普通 cargo test 的 6 项通过不代替这些实测。

## 安装版与 macOS 授权

已构建、签名并安装 /Applications/VERT Enhanced.app，界面显示 1.5.2；字体配置确实在应用包内，签名校验通过，旧版备份位于 work/install/VERT Enhanced-before-1.5.2.app。

安装版通过系统文件选择器载入 complex.docx 后，Office 转换曾一直等待。已安全停止测试任务。系统 TCC 日志确认：LibreOffice 子进程读取文稿文件夹时，系统以 VERT（local.vert.enhanced）作为负责应用，发起 kTCCServiceSystemPolicyDocumentsFolder 授权请求。命令行与界面启动的差异在这里不能忽略；环境变量对照实验未复现阻塞，不能归因于 __CFBundleIdentifier 或 XPC_SERVICE_NAME。

2026-10-26 补充验收：用户已明确授权并手动允许 macOS 文稿文件夹访问。此前等待的安装版 complex.docx → PDF 已成功完成，并自动保存到用户原有输出目录。界面显示的首次 124 秒包含授权等待，不作为正常转换耗时。

已核对实际保存的 PDF：3 页齐全，中英文开始/结束/表格/分栏标记正确，内嵌图片存在，横竖页面保留；首页栅格化后 OCR 确认中文确实可见，应用内预览也正常。随后从应用窗口对同一文件再次转换，界面耗时约 2 秒，自动编号保存为 complex (1).pdf，无需再次授权。复测文件页数及提取文字与首份一致，首份文件 SHA-256 未改变。

因此，本机安装版的该 Word → PDF 路线已通过验收；不扩展为所有 Office 文件或其他设备均通过。实测证据在 work/compatibility-20261026/installed-word-checks.json、installed-word-page1.png 和 installed-word-ocr.txt。
