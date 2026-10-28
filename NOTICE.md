# 来源与第三方声明

耄耋格式（Maodie Format），原名 VERT Enhanced，是基于 VERT Desktop 修改的 macOS 本地文件转换工具。2026-10-28 更改产品名称、发布配置及安装文档；功能修改历史见 README 和 Git 记录。

- 上游：[VERT Desktop](https://github.com/vert-desktop/vert-desktop)，原作者 Sikander RAVATE，AGPL-3.0。保留仓库根目录 LICENSE。发布本项目时须同时遵循该许可证，不能将衍生项目整体改为专有许可或仅 MIT 许可。
- 音乐解码模块：[music-geshizhuanhuan](https://github.com/HRuiCcc/music-geshizhuanhuan)，MIT。代码和许可位于 `src-tauri/python/music_unlock/`；集成范围及相关资源来源见 `docs/reviews/2026-10-28-music-project-integration.md`。
- FFmpeg、ImageMagick、Pandoc、LibreOffice、Python 及其包由用户单独安装，各自许可证适用。当前应用包未完整捆绑这些引擎。以后若将它们随应用分发，应另行核对具体构建版本及其源码、许可证和再分发要求。
- 字体目录仅含 macOS 系统字体的配置文件，不包含系统字体文件。

产品改名不改变上游版权归属；本项目不是原版 VERT Desktop 的官方发行版。历史技术文档、测试样本文字和兼容性标识中可能保留旧名称。
