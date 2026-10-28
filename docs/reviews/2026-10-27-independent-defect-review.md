# VERT Enhanced 1.5.2：D1–D11 独立复核

日期：2026-10-27。复核对象：原始本机实测报告（未随仓库发布）。本轮仅复核，未修改程序、默认设置或安装包。

## 结论

报告发现了真实问题，但不能把 11 项原文全部按同一严重度接受。应优先处理默认 OPUS 失败、照片方向丢失和 UTF-16 文本转 Office 乱码。D2、D6、D8、D9 有需要收窄或更正的具体断言；D4、D5 是可复现的转换策略问题；D10 是明确的资源保护上限，尚不足以判定为程序错误。

| 编号 | 独立结论 | 证据与需要修正之处 | 建议处理级别 |
|---|---|---|---|
| D1 | 成立 | WAV/MP4→OPUS，传界面默认 44100 Hz 均失败；48000 或不指定采样率均成功 | 高，优先 |
| D2 | 核心成立，范围需修正 | JSON/LOG 转 DOCX/PDF/EPUB 有固定标题及 NBSP；CSV→DOCX/EPUB 有标题，CSV→PDF 本次没有。PDF 元数据标题是 structured，并非 Converted document | 中 |
| D3 | 成立，但存在类型推断取舍 | PDF 金额确为字符串，SUM 忽略；同时保住前导零、长编号和公式安全 | 中，先确定类型策略 |
| D4 | 现象成立，默认策略问题 | 48 kHz WAV→MP3/WAV/FLAC 均被改为 44.1 kHz；省略参数均保留 48 kHz | 中，勿表述为编码器故障 |
| D5 | 现象成立，编码策略风险 | MKV 音频变 Vorbis；TS 变 MPEG-2/MP2；文件本身不是无效文件，也没有发现“只换容器/无损封装”承诺 | 中，先确定产品语义 |
| D6 | 部分成立 | GIF/BMP 方向错误成立；JPEG/PNG/WebP/AVIF 在尊重方向标签的解码路径中正常；TIFF 双重旋转本轮未复现 | 中，输出正确性 |
| D7 | 成立 | 实际 PDF→PNG ZIP 含 pages/._page-0001.png | 低，产物整洁度 |
| D8 | 部分成立 | 原始 XML 异常透传、错误尾部被截掉成立；本轮“无表格”错误是干净中文，没有复现每次 Python 调用均带遥测噪声 | 低，诊断与易用性 |
| D9 | 部分成立，根因需更正 | UTF-16LE/BE TXT→DOCX/PDF 均乱码；Python 路径两种 BOM 均正确，并非只识别 LE | 中，内容正确性 |
| D10 | 限制成立，是否缺陷未定 | 108 MP JPEG→PDF 被明确拒绝；同图→WebP 成功。50 MP 是主动资源上限，不是崩溃或误解码 | 限制说明/产品取舍 |
| D11 | 现象成立，输出语义问题 | 无表 HTML→CSV 保存整段源码；有表 HTML 正常提取表格。不是运行失败，但与“表格导出”的预期不一致 | 低 |

## 方法与环境

- 实际安装应用为 1.5.2；本轮宿主为 **macOS 27.0.1 / arm64**，不是此前报告中的 macOS 26.6.2。环境差异尤其影响日志噪声和查看器行为，不能忽略。
- 源码基准：`bafa1b1500f1e6e6a9065a1decdc8060c663d76f`。
- 独立编写最小夹具、运行器及分析脚本，没有执行原报告附带的 harness/run_matrix/make_fixtures，也没有照用其测试结果。
- 隔离 Rust 运行器只读引用当前生产 `convert.rs`、`runtime.rs` 等源文件；实际调用安装包内 Python、Swift、字体配置与本机引擎。四组安装资源与源码副本 SHA-256 全部一致。
- 这不是反编译安装版二进制，也不是 49 次 GUI 点击验收；前端参数通过 `DEFAULT_SETTINGS → defaultOptions → executeConversion → ConvertRequest` 源码链核对，默认请求明确带 `sample_rate=44100`。
- **49 个独立调用**（包含正常对照、故障触发和诊断模拟），43 次命令成功、6 次返回错误。这里的“成功”只表示命令完成，不能作为缺陷不存在的结论；例如 D2、D3、D6、D9 均可能成功生成错误/不合预期的内容。另做 2 次工作簿求和下游验证。

## 逐项复核

### D1：默认 OPUS 失败——成立

输入分别为 48 kHz WAV 和带 AAC 音轨的 MP4。生产转换函数收到与界面一致的默认采样率 44100、码率 192 kbps，均返回 libopus 不支持 44100 的错误；显式 48000 和省略采样率各自均成功。对应输出的实际编码为 Opus、采样率为 48000。

原文“100%”应限定为当前默认参数和本轮已测入口，不外推所有参数和文件。本轮已足够确认默认可用性缺陷。此前我方测试使用 `ConvertOptions::default()`（字段为 None），未覆盖界面真实默认参数，所以漏检了此问题。

源码：[默认采样率](../../src/store/index.ts:20)、[前端实际传参](../../src/converters/execution.ts:14)、[后端追加 -ar](../../src-tauri/src/commands/convert.rs:425)。证据：`evidence.json → D1`。

### D2：标题及 NBSP——核心成立，不能泛化全部结构化路线

JSON/LOG→DOCX/PDF/EPUB 都插入了非源文件内容的 Converted document。JSON→DOCX 出现 26 个 U+00A0；去掉标题后直接复制正文给 JSON 解析器仍失败，确认不是仅外观缩进变化。LOG→DOCX 同样把普通空格改为 NBSP。

CSV→DOCX/EPUB 插入标题，但 CSV→PDF 走 LibreOffice 表格分支，本轮没有该标题。测试 JSON/LOG PDF 的元数据标题为 `structured`；“PDF 元数据标题同样为 Converted document”本轮未复现。CSV 表格正文没有出现 NBSP，不能把 NBSP 影响面扩大到所有 CSV。

源码：[中间 HTML 标题与 pre](../../src-tauri/python/advanced_tools.py:139)。证据：`evidence.json → D2`，含各格式正文摘录与 JSON 解析结果。

### D3：数字文本化——成立，但不能盲目自动转数值

自建 PDF 表格包含金额 1234.5、负数 -42、编号 00123、18 位编号、日期及 `=1+1`。Excel 中这些单元格均是字符串 `s`。

为核实实际使用影响，复制生成的工作簿，在新工作表加入对金额列的 SUM，再用 LibreOffice 计算读回：文本金额的结果为 **0**；仅把两个金额格改为真正数字的对照结果为 **1192.5**。

这确认数值可用性不足；但现有实现也避免了公式执行，并保留前导零和长编号。原报告建议的简单数字正则会误把编号当数值；18 位编号还可能超过 Excel 精度。后续修复应明确列类型或提供可控推断，不能直接把所有“像数字”的字符串转浮点数。原文“无法排序”也应改成“数值排序语义可能错误”，文本仍可排序。

源码：[统一字符串与 data_type](../../src-tauri/python/advanced_tools.py:222)。证据：`evidence.json → D3`、`spreadsheet-sum.json`。

### D4：默认重采样——现象成立

自建 48 kHz WAV 转 MP3/WAV/FLAC，带实际界面默认参数时均为 44100；省略采样率时均为 48000。`useDefaultsAutomatically=false` 控制默认格式选择，并不阻止音频参数被传入。

应将其视为默认参数与“保持源文件”的产品语义问题，而不是三种编码器不支持 48 kHz。当前设置页并没有全局采样率选择控件；原文“设置页允许 8000–192000”不准确。预设编辑与后端范围校验不能等同于设置页功能。WAV/FLAC 也不能只凭目标格式名就承诺位深、采样率和波形逐位不变。

源码：[参数合并与发送](../../src/converters/execution.ts:9)、[后端采样率](../../src-tauri/src/commands/convert.rs:425)。证据：`evidence.json → D4`。

### D5：编码变化——成立，尚不构成“无效文件”

同一 H.264/AAC MP4 的结果：MKV=H.264/Vorbis；TS=MPEG-2/MP2；AVI=MPEG-4/MP3；WMV=MSMPEG4V3/WMAV2，与原文技术现象一致。

当前实现是“交给 FFmpeg 默认编码器进行转换”，不是 remux；没有看到界面或 README 承诺只换容器。无谓重编码与缺少编码说明是兼容性/质量策略问题，但不能据此说产物不符合容器规范。本轮未测试电视和第三方硬件播放器，不能把“很多设备不支持”当作独立实测结论。

源码：[音视频转换参数](../../src-tauri/src/commands/convert.rs:408)。证据：`evidence.json → D5`。

### D6：EXIF 方向——GIF/BMP 成立，TIFF 风险未实证

独立制作四象限色块 JPEG，物理 400×200、Orientation=6。正确显示应为 200×400，并保持象限位置。

GIF/BMP 输出仍是横向 400×200，且没有方向标签；Pillow 和 ImageMagick 两条显示路径均与正确参考图不符，问题成立。JPEG/PNG/WebP/AVIF 保留标签，两种尊重标签的显示路径均正确；不能将其归为已损坏。

TIFF 的尺寸/标签表象确与原文相似，但本轮两条显示路径都得到正确 200×400 和正确象限，**没有复现双重旋转**。跨查看器风险仍可记录，不能写成已发生的缺陷，更不能据此直接对所有输出无差别 strip 元数据。

源码：[图片参数缺少 auto-orient](../../src-tauri/src/commands/convert.rs:385)。证据：`evidence.json → D6`、`orientation-expected.png`、`displayed-*.png`。

### D7：AppleDouble——成立

调用生产 PDF→PNG 打包路线，一个 PDF 页面对应 ZIP 条目：`pages/`、`pages/page-0001.png`、`pages/._page-0001.png`。多出的 AppleDouble 确为应用产物，不是原报告计数器凭空制造。

此前我方页面计数排除 `._` 能验证真实页面未丢失，但并没有解决产物夹杂元数据的问题。本项属于整洁度和跨平台使用问题，不等于多导出一页，也不意味着文件损坏。

源码：[ditto 打包参数](../../src-tauri/src/commands/convert.rs:666)。证据：`evidence.json → D7`。

### D8：错误输出——截断及异常透传成立，噪声依赖环境

生产路径的无表格 PDF→XLSX 返回干净中文，没有遥测/fontconfig 前缀；不能接受“每次 Python 调用都有噪声”的普遍说法。XML 外部实体被安全拒绝，但错误文本仍透传 EntitiesForbidden 等内部异常，这部分成立；没有读取实体指向的文件。

另用生产 `run()` 启动受控测试进程：先输出约 4000 字符诊断噪声，再输出真正错误标记。用户错误字符串只含开头 3000 字符，真正的尾部标记消失，证实截断方向确有问题。这是诊断模拟，不能冒称真实转换现场已经输出该人工标记。

源码：[失败输出选择与截断](../../src-tauri/src/commands/runtime.rs:192)。证据：`evidence.json → D8`。

### D9：UTF-16——Office 乱码成立，BE 判断错误

独立生成带 BOM 的 LE/BE 两种文本。两种 TXT→DOCX/PDF 都成功生成文件，但中文变成字节误解码乱码；不能用命令返回成功当作内容正确。

两种编码的 LOG→JSON/CSV 都准确恢复中文和换行。当前 `read_text()` 明确同时判断 `FF FE` 和 `FE FF`，安装包与源码哈希一致。因此“Python 只识别 LE、不识别 BE”的根因不成立，不能重复修改这一判断。真正需要统一的是 TXT 直交 Pandoc与其他文本适配路径的编码处理。

源码：[BOM 判断](../../src-tauri/python/advanced_tools.py:34)、[TXT 直交 Pandoc](../../src-tauri/src/commands/convert.rs:559)。证据：`evidence.json → D9`。

### D10：50 MP——明确限制，不应直接认定为错误

实际生成 12000×9000（108 MP）JPEG。应用 PDF 路线返回“图片超过 5000 万像素处理上限”；同图转 WebP 成功，确认不同路线的上限确实不同。

Swift 代码主动检查宽高和总像素，属于防内存失控的保护。108 MP 光一个 RGBA 解码缓冲就约 432 MB，尚未计算临时图像与 PDF 编码的额外内存。未证明 50 MP 上限设错，也未进行所有设备的内存容量测试。可把限制说明、预先检测或用户可控缩放列为改进，不能直接把上限提高到 200 MP。

源码：[原生图片限制](../../native/DocumentTools.swift:47)。证据：`evidence.json → D10`。

### D11：无表格 HTML→CSV——输出语义问题成立

无表格 HTML 得到 `text` 表头和整段 HTML 源码单元格；有表格对照则正确得到 Name/Value 和 Alpha/42。当前代码在没找到 table 时继续走通用文本封装分支，并非解析器崩溃或丢失原始 HTML。

如果该入口意图是“从网页提取表格”，应明确拒绝无表格输入；如果允许“保存源码到 CSV”，应明确说明。本轮确认行为与提示语义不匹配，不把它升级为安全漏洞。

源码：[HTML 表格回退与 CSV 文本分支](../../src-tauri/python/advanced_tools.py:109)。证据：`evidence.json → D11`。

## 建议后续顺序（未实施）

1. D1：先补界面默认参数的真实转换回归，解决默认不可用。
2. D6 的 GIF/BMP、D9 的 TXT→Office：输出内容/方向错误。
3. D2：去掉非源内容并保证正文可正确复制；D3：先确定数值与标识符类型策略。
4. D4/D5：明确“自动保持/重采样/重新编码/换容器”语义后处理。
5. D7/D8/D11：产物整洁度、错误说明和输入语义。
6. D10：先说明限制与资源预算；TIFF 双重旋转继续跨查看器验证，不按已确认故障修复。

## 可复现材料

全部新材料在 [work/independent-review-20261027](../../work/independent-review-20261027)：

- `prepare.py`：自建夹具及 49 个请求。
- `runner/main.rs`、`runner/Cargo.toml`：只读引用生产源文件的独立入口。
- `cases.json`、`results.json`：精确传参、返回值、错误及耗时。
- `analyze.py`、`evidence.json`：实际内容、编码、方向和类型核验。
- `spreadsheet-sum.json`：金额文本与数字对照的求和结果。
- `provenance.json`、`environment.json`：资源哈希、Git 基准、系统版本和原报告 SHA-256。

没有更改原始报告，也没有修改生产代码、安装应用、用户默认设置。当前结论仅覆盖本轮样本和上述环境；原报告附带的 75 项总体矩阵没有被整份重跑或重新背书。
