# VERT Enhanced 1.5.1 兼容性测试报告

日期：2026-10-24。结论：本机已测样本通过；发现的 ICO、PSD 和 3GP 问题已修复并安装 1.5.1。结果仅适用于下述环境与样本，不代表所有文件变体和其他电脑均兼容。

## 环境与方法

macOS 26.6.2（25G83），Apple Silicon / arm64。应用声明最低 macOS 14，但没有在 macOS 14/15 或 Intel Mac 上执行测试。

运行组件：FFmpeg 9.0.2、ImageMagick 7.1.2-31、Pandoc 3.12.1、LibreOffice 26.8.1.1、Python 3.12.15，以及应用内 PDFKit / Vision 工具。应用仍依赖本机独立引擎目录和 LibreOffice，单独复制应用包到另一台电脑不能保证可运行。

通过生产 Rust 转换函数执行真实引擎，使用已安装应用的 Python 与原生资源。测试开始前校验应用包内两个 Python 脚本与原生工具和源码树副本 SHA-256 一致。此次测试没有上传文件，也没有使用改扩展名伪造的 WPS/RAW 样本。

## 结果

| 项目 | 案例数量 | 结果 |
|---|---:|---|
| 8 种代表源文件的输出矩阵 | 94 | 93 成功；嵌套 JSON → CSV 按预期拒绝 |
| 生成格式作为输入的回读转换 | 42 | 全部通过 |
| 中文/空格/符号/Emoji/大写扩展名、多帧 GIF/TIFF、旧 DOC/PPT | 5 | 全部通过 |
| 输出内容检查 | 65 | 全部通过 |
| Python 内容与边界测试 | 24 | 全部通过 |
| Rust 常规测试 | 6 | 全部通过 |
| 既有真实引擎集成套件 | 1 套 | 通过，含多种转换、OCR、PDF、ZIP、密码与错误输入 |
| 补充 RAR 样本 | 3 | 2 个正常解压；含链接的样本按预期拒绝 |

前三行合计 141 条转换/边界案例：140 条成功，1 条预期拒绝。其他行有重复验证，不与 141 相加。

输出矩阵分布：PNG 17 条、WAV 11 条、MP4 20 条、DOCX 8 条、CSV 13 条、PPTX 6 条、JSON 13 条、PDF 6 条。PDF → XLSX 使用实际带表格的 PDF，不以扫描页代替原生表格。

覆盖图片 PNG/JPEG/WebP/GIF/BMP/TIFF/AVIF/HEIC/JXL/ICO/PSD/EXR/HDR、常用音频与视频容器、Office/文本/结构化数据、PDF 和归档。回读验证包含格式可被再次作为输入读取；并非任意两个扩展名之间都已测试。

具体核对：

- 图像重新解码；ICO 含 256、128、64、48、32、16 六种正方形尺寸。
- 音视频实际解码；视频容器保留视频和音轨，GIF 仅视频；图片转视频为 3 秒。
- CSV 经 XLSX/XLS/ODS 往返后，逐单元格检查中文、引号、逗号和单元格内换行。
- JSON 经 XML/YAML 往返后，比较实际值和数据类型。
- PDF 检查页数、页面顺序、旋转角度、文字和原文件未修改；原生表格检查实际单元格。
- 图片及扫描 PDF 的中英文 OCR；扫描页转 Word 的降级说明；扫描表格转 Excel 明确失败。
- ZIP/7Z/TAR/TAR.GZ/TAR.BZ2/TAR.XZ、GZ/BZ2/XZ 检查中文、同名编号和空文件往返；损坏文件和不安全成员被拒绝。
- 旧 DOC/PPT 是 LibreOffice 实际导出的二进制格式，再经应用转 PDF，核对中文和英文文本。

## 发现并修复

1. **大图 → ICO 失败**：ICO 最大尺寸有限。现在先按比例缩小并透明补成正方形，再生成六种常用尺寸。
2. **MP4 → 3GP 编码失败**：本机 FFmpeg 不含该容器默认选择的 AMR 编码器。现在明确使用 H.264/AAC，保留视频与音频。
3. **多尺寸 ICO / 分层 PSD → PNG 无结果**：引擎生成多个带编号文件，而应用期望单文件。现在 ICO 选择首个尺寸、PSD 导出合成图，并显示说明。
4. **多帧 GIF/TIFF 转单图**：明确导出首帧/第一页，并显示提示，避免多个编号输出导致失败。支持多帧的目标格式继续交给引擎处理；没有宣称已验证所有动画特性。

## 安装版验收

已安装到 /Applications/VERT Enhanced.app，界面显示 1.5.1，设置和历史保留。旧版备份在 work/install/VERT Enhanced-before-1.5.1.app。

实际应用通过系统文件选择器载入 1200×500 中文 PNG，成功导出 ICO 并自动保存；检查保存文件确有六种图标尺寸。继续向已有队列添加带音轨 MP4，成功导出 3GP 并保存；ffprobe 确认视频为 H.264、音频为 AAC。应用本地签名校验通过。

## 未验证与已知边界

- 没有真实 WPS/WPT/ET/ETT/DPS/DPT、各相机 RAW、复杂分栏/公式/图表/嵌入对象/宏文档样本，不能标为已验证支持。
- 旧 DOC/PPT 来自本机生成样本，不覆盖所有历史 Office 版本。
- PDF → Word 不保证精确还原复杂版式；OCR 不保证逐字正确；扫描表格 → Excel 暂不支持。
- 未验证超大文件、长视频、数千页 PDF、内存压力和长时间运行。
- 未验证其他 macOS 版本、Intel Mac、Windows/Linux 或其他设备上的系统播放器行为。
- OFD、MOBI 等未实现格式不在本轮测试范围。

## 证据与复现

原始输出和日志位于 [work/compatibility-20261024](../work/compatibility-20261024)：matrix/results.json、input-results.json、edges/results.json、content-checks.json、environment.json、rar/results.json 及各套测试日志。首次失败保存在 results-before-fixes.json、input-results-before-fixes.json 和 matrix-before-fixes.log。

现有样本和安装组件就绪后，可执行：

```sh
PATH="$HOME/.cargo/bin:$PATH" cargo test --manifest-path src-tauri/Cargo.toml installed_engines_convert_real_fixtures -- --ignored --nocapture
PATH="$HOME/.cargo/bin:$PATH" cargo test --manifest-path src-tauri/Cargo.toml installed_app_compatibility_matrix -- --ignored --nocapture
PATH="$HOME/.cargo/bin:$PATH" cargo test --manifest-path src-tauri/Cargo.toml generated_format_inputs_roundtrip -- --ignored --nocapture
PATH="$HOME/.cargo/bin:$PATH" cargo test --manifest-path src-tauri/Cargo.toml compatibility_edge_fixtures -- --ignored --nocapture
PYTHONDONTWRITEBYTECODE=1 "$HOME/.local/share/vert-enhanced/engines/bin/python" -m unittest discover -s tests -p 'test_*.py' -v
```

回读测试依赖矩阵输出；边界测试依赖本轮生成的旧 DOC/PPT 样本。上述真实引擎测试默认标为 ignored，需要显式执行，不能用普通 cargo test 的通过来替代。

后续补测：2026-10-25 已增加五种真实 RAW、复杂 Office、千页文本 PDF 和两分钟视频的验证，并修复中文渲染问题。最新范围与保留限制见 [1.5.2 扩展报告](compatibility-2026-10-25.md)。
