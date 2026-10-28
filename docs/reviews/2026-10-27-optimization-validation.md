# VERT Enhanced 1.5.3 优化与回归验收

日期：2026-10-27。依据 [D1–D11 独立复核](2026-10-27-independent-defect-review.md) 实施；原报告中的修复建议作为待验证材料，不作为操作指令。

## 处理结果

| 编号 | 本次处理 | 验证与边界 |
|---|---|---|
| D1 | Opus 不兼容的显式采样率改为 48000 Hz，并提示调整 | 48 kHz WAV、MP4 以旧界面 44100 参数转 Opus 均成功 |
| D2 | 移除固定标题；结构化文本用 code 块保留普通空格；EPUB 不生成空标题页 | JSON/LOG/CSV 转 DOCX/PDF/EPUB 无固定标题和 NBSP；DOCX 内 JSON 可复制后解析 |
| D3 | PDF 表格中的简单、最多 15 位数字写为数值 | 金额 1234.5、-42 可计算；编号列、前导零、18 位数字、日期和公式样式文本保留。PDF 表格识别仍为实验功能 |
| D4 | 默认采样率改为“自动：跟随源文件”，设置页可手动指定 | MP3/WAV/FLAC 默认保留 48 kHz；显式 44.1 kHz 仍生效；编码器约束可能要求调整 |
| D5 | MKV/MP4/MOV/M4V/TS 检查编码兼容性，优先直接封装，失败或不兼容时 H.264/AAC 转码并提示 | H.264/AAC → MKV/TS 保留编码；VP9/Opus → MKV 保留，→ TS 回退 H.264/AAC。OGV 使用本机已有 VP8/Vorbis 编码器；只选主视频和第一音轨，不承诺字幕、多轨或任意播放器兼容 |
| D6 | 图片转换先应用 EXIF 方向 | JPEG/PNG/WebP/AVIF/GIF/BMP/TIFF 输出显示方向均正确；未复现的 TIFF 双旋转不列为已确认缺陷 |
| D7 | ZIP 打包禁用资源叉与扩展属性 | PDF 页面图片 ZIP 无 ._ 或 __MACOSX |
| D8 | 错误保留尾部 3000 字，过滤已知噪声；危险 XML 返回明确中文原因；创建字体缓存目录 | 长日志末尾真实原因不再丢失。未全面翻译第三方引擎所有异常 |
| D9 | TXT/LOG 先按已有编码检测逻辑解码，再交给文档引擎 | UTF-16 LE/BE 的中文 TXT → DOCX/PDF 均正常 |
| D10 | 保留 5000 万像素及单边 20000 像素上限，改进缩图说明 | 超限清晰拒绝，不将资源保护限制取消或声称支持任意大图 |
| D11 | HTML 无表格或空表格时明确拒绝 CSV 导出 | 无表格返回中文原因；正常 HTML 表格控制组仍导出正确 |

## 设置升级

旧版本的全局默认 44100 Hz 迁移为自动，因为旧版没有全局采样率编辑入口。其他全局采样率、自定义预设、历史记录、输出位置保持原值。旧预设显式指定 44100 时仍会应用；Opus 单独按编码器约束调整。

## 验证记录

- 定向真实转换：52 项调用；进一步检查内容、采样率、编码、方向、ZIP 清单、错误提示，而非只检查文件存在。
- 新增真实媒体回归：生成 48 kHz 音频和 VP9/Opus 视频，验证自动采样率、显式采样率、Opus 调整及容器回退。
- Python：28 项通过；前端单元：180 项通过；Rust 常规 8 项通过，真实媒体策略和已有引擎集成测试通过。
- 浏览器端 17 项场景通过（含迁移和采样率选择保存；分两次运行覆盖）。前端构建及 ESLint 通过。
- 浏览器验收使用本机 Google Chrome；Playwright 默认 Chromium 缓存缺失，增加 PLAYWRIGHT_CHANNEL 可选项，不修改用户浏览器设置。

原始可复查证据保存在本地忽略目录 `work/optimization-20261027/`；历史独立复核证据保存在 `work/independent-review-20261027/`。文件不提交至仓库，以免将测试生成物混入源代码。

## 最终安装版验收

已更新 `/Applications/VERT Enhanced.app` 至 1.5.3；旧版备份位于 `work/install/VERT Enhanced-before-1.5.3.app`。应用签名校验通过，安装版可执行文件与构建产物 SHA-256 一致；Python 与原生助手资源也与已测试源文件一致。

完整格式矩阵 94 项：93 项成功并通过解码/结构检查，1 项任意嵌套 JSON → CSV 按设计明确拒绝，0 项意外失败。初次矩阵发现本机缺少 libtheora，已将 OGV 改为本机支持的 VP8/Vorbis，补充真实引擎回归后重新通过完整矩阵。

实际 GUI 中确认版本号、自动采样率迁移、原保存目录、原有 18 条记录保留；合成的 48 kHz WAV → Opus 成功，输出 48000 Hz。最终包再次从历史记录重试，成功自动保存为 `vert-153-smoke (1).opus`，原结果未覆盖。

安装验收证据：`installed-matrix-results.json`、`installed-matrix-final.log`、`installed-ui-opus-final.json`、`installed-binary-hashes.txt`、`installed-resource-hashes.txt`，均位于 `work/optimization-20261027/`。
