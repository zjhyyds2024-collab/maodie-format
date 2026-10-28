# Filee 参考评估与 VERT 改进建议

检查日期：2026-10-24。目标仓库：[KnifeLemon/Filee](https://github.com/KnifeLemon/Filee)。通过 GitHub 插件读取 README、文件目录、转换队列、路由规划、输出路径解析、引擎安装、文件夹监听与引擎说明。不是全仓库审计，没有安装或运行 Filee 桌面程序，也没有修改远端项目。

## VERT 优先值得改进的内容

### 1. 引擎管理和可迁移安装（优先）

VERT 当前需要脚本安装本机引擎，README 明确说明应用包不包含完整运行库，换 Mac 还需要单独配置。已有 engine_status 后端检查，但缺少完整的用户安装/修复流程。

Filee 的引擎安装器包含固定 SHA-256 校验、暂存目录安装、安装完成后切换目录及版本标记。值得借鉴这种交付方式。建议 VERT 在设置中展示每项引擎的状态、用途、版本、下载大小和修复入口；只在所需转换缺失引擎时引导安装。

来源：[EngineInstaller.cs](https://github.com/KnifeLemon/Filee/blob/main/src/Filee.Engines/Infrastructure/EngineInstaller.cs)、[引擎说明](https://github.com/KnifeLemon/Filee/blob/main/docs/ENGINES.md)。

### 2. 保存结果与历史可用性（优先）

VERT 未设置输出目录时使用会话临时结果；退出应用会清理，历史记录只保留路径，不能保证重新打开结果。建议增加用户可见的「未保存」状态和退出提醒，或经用户选择持久保存结果；历史中明确区分已保存、临时和已失效。

Filee 的默认输出放在原文件附近，输出解析器处理自定义目录、名称模板、冲突编号和源文件保护。VERT 已有同名编号和手动/自动保存，不需要重复开发；下一步重点是结果生命周期。

来源：[Filee README](https://github.com/KnifeLemon/Filee#features)、[OutputPathResolver.cs](https://github.com/KnifeLemon/Filee/blob/main/src/Filee.Core/Presets/OutputPathResolver.cs)；本地 README 和 src/store/history.ts。

### 3. 转换能力与路线说明（优先）

不要只比较扩展名数量。建议界面明确显示「直接转换」「需中间格式」「可能丢失排版」「需 OCR」，并由实际可用引擎决定目标列表。Filee 的 RoutePlanner 把格式和引擎构成图，支持多步路线；VERT 可以逐步引入同类能力，先覆盖最常用的路线并验证真实样本。

来源：[RoutePlanner.cs](https://github.com/KnifeLemon/Filee/blob/main/src/Filee.Core/Conversion/RoutePlanner.cs)。

### 4. 按资源限制批处理（中优先）

VERT 目前按文件顺序处理。Filee 队列有批内并发和引擎信号量。建议 VERT 先引入小规模、可配置并发：轻量图片可并行，Office、扫描 PDF、高清视频限制并发，并展示单文件状态。不要直接按 CPU 核心数同时启动多个重型引擎。

来源：[JobQueue.cs](https://github.com/KnifeLemon/Filee/blob/main/src/Filee.Core/Conversion/JobQueue.cs)。

### 5. macOS 日常入口（后续）

Filee 提供快捷键、拖放、命令行与监听文件夹。VERT 可以优先做 Finder 快速操作/「打开方式」和最近预设，再考虑自动监听。监听需要处理文件尚未写完、重复转换、输出再次触发以及休眠后恢复；不宜只加一个文件夹监听器。

来源：[README](https://github.com/KnifeLemon/Filee#features)、[WatchFolderService.cs](https://github.com/KnifeLemon/Filee/blob/main/src/Filee.App/Services/WatchFolderService.cs)。

## Filee 自身值得修正或完善的点

### 路由规划的三步上限存在状态建模问题（源码反例）

读取时的树 SHA：da760fdcf9e9f42848b7ef62cdb82e2d66971707。

RoutePlanner.Plan 在 134 行限制 MaxSteps，但 145–150 行仅按目标格式保存单个最小成本和对应跳数。带跳数上限的最短路需要同时按「格式、已用跳数」区分状态；更便宜但跳数更多的中间路径，不能直接淘汰较贵但跳数更少的路径。

反例：S→A→B→X 每条成本 1；S→X 成本 10；X→T 成本 1。三步上限内存在 S→X→T（成本 11）。当前模型会用成本 3、三跳的 X 替换原先一跳成本 10 的 X；之后 X 达到三步上限，无法继续到 T，返回无路线。本地同构算法反例已复现，尚未在 Filee 的 .NET 测试工程中验证，也没有证明现有格式图一定触发它。

建议把 dist、prev 和优先队列状态改为 (format, hops)，或按跳数分层动态规划；增加上述合成图回归测试。OCR 组合路线是否也应遵守统一三步上限，应明确约定。

来源：[RoutePlanner.cs:134–151](https://github.com/KnifeLemon/Filee/blob/main/src/Filee.Core/Conversion/RoutePlanner.cs#L134-L151)。

### macOS 分发与界面可发现性

README 将 macOS 标为 preview，并说明没有公证；建议正式面向普通用户时补齐 Developer ID 签名、公证和设备验收。环形菜单适合熟练用户；首次使用仍需清晰的普通窗口入口、键盘操作和取消说明。这是产品建议，不是本次实测得到的故障。

来源：[安装与签名说明](https://github.com/KnifeLemon/Filee#install)。

## 本次实施范围

已按用户选择合并 VERT 首页与转换页并调整为更偏 macOS 原生风格；同时修复已有队列后上传监听卸载的问题。上述引擎管理、持久结果、路由、并发和系统扩展属于下一阶段建议，没有擅自加入本轮。
