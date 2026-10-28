# 耄耋格式：本地改名与 GitHub 发布审查

日期：2026-10-28。审查范围：本机 `/Applications/VERT Enhanced.app` 的包信息，以及当前仓库源码、打包配置、安装脚本、依赖清单和工作流。安装包原版本 1.7.0，与源码版本一致；本次没有对原二进制进行反编译，也没有完成全量安全审计或干净机器测试。用户已明确本轮只做本地准备，不创建仓库、不推送、不发布。

## 结论

可以先按 AGPL-3.0 的衍生项目准备源码公开。当前还不能把安装包描述为开箱即用的正式发行版；引擎安装、干净机器验收、签名公证和第三方再分发核对尚待完成。上游来源为 https://github.com/vert-desktop/vert-desktop ，其 README 标示 AGPL-3.0；本地 LICENSE 保留不变。许可证最终义务以 LICENSE 原文为准，本报告不构成独立法律审查。

## 本轮已处理

| 项目 | 原问题 | 处理结果 |
| --- | --- | --- |
| 产品名称 | 安装包和界面显示 VERT Enhanced | 产品名、窗口名、侧栏、介绍、反馈标题、网页标题及构建路径改成「耄耋格式」 |
| 项目归属 | Cargo repository 将衍生项目指向上游仓库 | 移除误导的 repository 字段，保留原作者与 AGPL，新增 NOTICE.md |
| 发布工作流 | Linux 构建无法覆盖新增的 macOS 功能；旧发布流程操作上游 Homebrew 仓库 | 改为手动 macOS Apple Silicon 预览构建，仅上传 artifact，无自动正式 Release 或跨仓库写入 |
| CI | pnpm 锁定清单与实际 npm 开发流程存在漂移，Linux 验证不代表 macOS | CI 统一 npm ci；前端构建、测试及界面回归，Rust 在 macOS 上验证，并构建 Swift 工具 |
| Pages | 旧站点宣传原版安装方式，部署 docs 还包含内部报告 | 改为手动部署独立 site 目录，页面明确源码预览和引擎依赖 |
| Python 安装 | packaging 依赖指向构建机器 file:///home/conda/... | 改为本机实际安装版本 packaging==26.3 |
| 引擎清单 | 包含本机用户名，缺少 @EXPLICIT 标识 | 去除本机路径并规范为 micromamba 显式包清单 |
| 公开内容 | 个别报告含本机绝对路径 | 改为通用路径；两个私人文件管理脚本加入 .gitignore |

产品显示名已更改；`local.vert.enhanced`、Rust crate 名、localStorage 键、`~/.local/share/vert-enhanced/`、环境变量及测试样本文字保留，避免现有数据或引擎失效。这些内部值不影响显示名。此方式属于兼容原应用的改名，不是完全独立数据空间的新产品。

## 正式安装包仍需处理

1. **引擎并未完整捆绑。** `Runtime::resolve` 默认从用户目录加载 FFmpeg、ImageMagick、Pandoc 和 Python，Office 另需 LibreOffice；预览包在新 Mac 上需要 README 中的安装步骤。`setup-mac-engines.sh` 当前仍选择安装当时的最新 conda 引擎，虽然已有快照，却尚未完成从快照重建的验收。
2. **没有 Apple 开发者签名和公证。** 本机仅采用 ad-hoc 签名，其校验通过不等于其他 Mac 的 Gatekeeper 会允许启动。
3. **第三方组件需逐项核对。** 保留 MIT 音乐解码器许可证与集成说明；发布者还需核对解码资源、未来捆绑引擎的具体构建许可及源码提供要求。AGPL 主许可证不能代替全部第三方检查。
4. **安全加固项。** Tauri 配置的 CSP 为 null，文件系统 capability 包含 home-recursive；属于需要进一步收紧和验证的攻击面，不能据此断言已经存在可利用漏洞。当前依赖扫描仅覆盖 npm 生产依赖，不覆盖 Rust/Python/外部引擎或历史提交。
5. **旧资料属于历史记录。** `docs/index.html`、`docs/install.sh`、`docs/uninstall.sh` 仍为上游历史资料，不是本项目的安装入口；新 Pages 仅部署 site。本地未改动历史提交，不能将当前路径扫描结果解释为 Git 历史已完成隐私清理。
6. **GitHub 在线流程未运行。** 本轮没有设置 remote 或发布到 GitHub，修改后的工作流需在目标仓库实际运行后才能确认可用。

## 本轮验证

- `npm test`：22 个文件、180 项通过。
- `npm run lint`、`npm run build`：通过。
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：10 项通过，11 项依赖真实引擎/本机样本的集成测试按原配置忽略；没有声称本轮完成全部格式验收。
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`：通过。
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`：26 项通过；使用本机已安装 Chrome。默认命令最初因缺少 Playwright 自带 Chromium 无法启动浏览器，未作为通过依据；CI 已配置安装 Chromium。
- `npm audit --omit=dev`：本次注册表查询返回 0 条已知生产依赖漏洞，不等于全面安全保证。
- `git diff --check`：通过。

安装包构建、签名与交付结果见本文下方的最终记录。

## 最终交付记录

- Tauri release 构建成功：`src-tauri/target/release/bundle/macos/耄耋格式.app`。
- 已复制到 `/Applications/耄耋格式.app`；旧版 `/Applications/VERT Enhanced.app` 保留用于回退。二者使用相同内部标识，建议退出旧版后再使用新版。
- 对构建产物进行 ad-hoc 签名，构建目录与安装目录均通过 `codesign --verify --deep --strict`。检查 Info.plist 产品名、版本、兼容标识、原生工具及随包 MIT 许可证均符合预期。
- ZIP：`outputs/maodie-format-1.7.0/maodie-format-1.7.0-macos-arm64.zip`；SHA-256：`e805e70224f3f6ff239287aa191aa6fd87a3a666394c63504dab6b40f7b697f5`。
- 交付目录附 README、NOTICE、AGPL LICENSE 和本报告。没有启动新版做真实 GUI 转换，也没有创建 GitHub 仓库、提交或推送代码。
- GitHub 的 `macos-15` ARM64 标签依据官方 runner 清单：https://github.com/actions/runner-images 。实际工作流仍待在线验证。
