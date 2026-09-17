# ChatGPT Message Tracker

[English](README.md) · **简体中文** · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md)

一个本地 Chrome 扩展：按模式（`Instant`、`Medium`、`High`、`Extra High`、`Pro`）统计你在 ChatGPT 网页版**实际发送**的消息次数，让你随时清楚自己到底用了多少。

> **独立本地计数工具，与 OpenAI 无关、未获其认可。**
> 它不查询官方配额、不预测剩余额度，也不提供 OpenAI 官方用量数据。

![ChatGPT Message Tracker 界面预览](docs/ui-preview.svg)

---

## 安装

无需构建，直接从本仓库加载扩展：

1. 克隆或下载本仓库，如为压缩包请先解压。
2. 打开 Chrome，进入 `chrome://extensions/`。
3. 打开右上角的**开发者模式**。
4. 点击**加载已解压的扩展程序**，选择项目根目录（即包含 `manifest.json` 的文件夹）。
5. 打开或刷新 [https://chatgpt.com/](https://chatgpt.com/)，页面右下角会出现计数浮窗。

## 怎么用

1. **正常发消息即可。** 发送时扩展会读取输入框旁选中的模式，等你的消息真正出现在对话里后才为该模式记 `+1`。
2. **看页面右下角的浮窗**，或点击扩展图标打开弹窗，查看各模式计数，也可以手动 `+1` 或**撤销一次**。
3. **记错了随时修正。** 漏记或多记都可以用 `+1`、撤销或删除最近记录来纠正。
4. **自动识别不准时**，在弹窗里关闭**自动识别模式**，改为按手动选择的模式计数。
5. **更多功能在设置页**：重命名模式、添加自定义模式、查看时间范围统计和每日统计、导出 JSON、清空记录。

以下情况**不会**被误记：输入法选字时按回车、回答生成中按回车、清空草稿、停止回答。

## 功能

- 按模式统计发送次数：`Instant`、`Medium`、`High`、`Extra High`、`Pro`，并支持自定义模式。
- 在 ChatGPT 页面右下角显示计数浮窗。
- 发送瞬间自动识别模式，依据是 ChatGPT 页面自己的语言和标签，不根据浏览器语言猜测。
- 扩展界面支持 21 种语言，自动跟随浏览器语言。
- 时间范围统计（最近 3 小时 / 24 小时 / 7 天 / 30 天）和各模式每日统计。
- 手动修正：`+1`、撤销、删除最近记录。
- 导出设置和使用记录为 JSON。
- 所有数据只保存在本机 Chrome 扩展存储中。

## 隐私

扩展不会上传任何数据，也不会保存对话内容。为确认发送、防止重复计数，它会在页面内存中临时比对输入框草稿与新出现的消息，关闭页面后这些临时状态即消失。保存的每条记录只包含：

- 模式 ID
- 时间戳
- 记录来源（发送按钮、回车或手动记录）

详见完整[隐私政策](PRIVACY.md)。

## 限制

- 只在安装了此扩展的 Chrome 用户配置中生效。
- 只统计 ChatGPT 网页端发送的消息，不含手机 App、其他浏览器或其他设备。
- 自动识别依赖 ChatGPT 页面 UI；如果 ChatGPT 改版，选择器可能需要更新。
- 它是个人本地计数器，不是 OpenAI 官方用量统计。

## 更新

拉取新代码或修改代码后，回到 `chrome://extensions/`，点击 **ChatGPT Message Tracker** 扩展卡片上的刷新按钮。

## 开发

```sh
npm ci            # 安装依赖
npm run check     # 静态检查
npm test          # 单元测试
npm run test:chrome   # 在隔离的 Chrome 配置中加载真实扩展，对本地测试页面跑测试
```

模式标签识别内置 21 个语言/地区变体的官方资源词条，来源、原始消息键和 SHA-256 记录在 `docs/site-language-evidence.json`。复核命令：

```sh
node --expose-gc tools/verify-evidence.mjs /path/to/exported-official-assets
```

## Chrome Web Store 打包

```sh
npm ci
npm run check
npm test
python3 tools/build_release.py
```

脚本会在 `dist/` 下生成可上传的扩展 zip 和 `publish-kit.zip`（发布者材料，**不要**上传）。`store/` 目录包含商店介绍文案、权限/隐私填写说明和真实界面截图。完整清单见 `store/PUBLISHING.md`。
