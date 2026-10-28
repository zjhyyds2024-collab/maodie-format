# 应用图标

`maodie-cat-head.png` 为「耄耋格式」的透明底猫头图标母版，来源为用户于 2026-10-28 提供的橘猫照片，经内置 image_gen 编辑工具抠图并补足清晰度。它是根据原图处理的图像，毛发等细节含生成式重建。

编辑提示：仅提取原图猫头，保留折耳、圆脸、大眼睛、粉鼻子、白色嘴部与原有表情；删除身体、脖子及环境；写实风格、正方形画布、透明背景，四周留白；不加文字、配饰或底板。

更新图标：`npm run tauri -- icon assets/maodie-cat-head.png`。应用打包使用 `src-tauri/icons/` 的 PNG、ICNS 与 ICO；界面侧栏和网页 favicon 使用 `public/app-icon.png`（由 128x128.png 复制）。
