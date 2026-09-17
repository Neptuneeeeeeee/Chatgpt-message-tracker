# ChatGPT Message Tracker

Independent local counter; not affiliated with or endorsed by OpenAI. 独立工具，非 OpenAI 官方用量统计。

[Privacy policy / 隐私政策](PRIVACY.md) · [Chrome Web Store 发布清单](store/PUBLISHING.md)

## 中文介绍

在使用 ChatGPT 网页版时，按模式记录已经发送的消息次数，查看保留的近期历史，并随时手动修正。它是独立的本地计数工具，不查询官方配额、不预测剩余额度，也不提供 OpenAI 官方用量数据。

它是一个本地 Chrome 扩展，只做个人计数记录，不用于绕过、预测或替代 OpenAI 官方的用量限制。

### 功能

- 按模式统计发送次数：`Instant`、`Medium`、`High`、`Extra High`、`Pro`。
- 在 ChatGPT 页面右下角显示计数浮窗。
- 发送消息的瞬间自动识别输入框旁选中的 ChatGPT 模式，并按它计数。
- 支持手动选择模式、手动 `+1`、撤销、删除最近记录。
- 支持查看累计统计和最近时间范围统计。
- 支持按时间范围查看某个模式每天的使用次数。
- 支持导出设置和使用记录为 JSON。
- 所有数据只保存在本机 Chrome 扩展存储中。

### 界面预览

![ChatGPT Message Tracker 界面预览](docs/ui-preview.svg)

### 安装

1. 打开 Chrome，进入 `chrome://extensions/`。
2. 打开右上角的「开发者模式」。
3. 点击「加载已解压的扩展程序」。
4. 选择项目根目录，也就是包含 `manifest.json` 的文件夹。
5. 打开或刷新 `https://chatgpt.com/`。

### 使用方式

1. 在页面浮窗或扩展弹窗里选择当前模式。
2. 发送消息时，扩展会先读取输入框旁选中的模式，等页面上真的多出一条你的消息后再记 `+1`；识别不到模式时记给手动选中的模式。输入法选字的回车、生成中按的回车不会被误记。
3. 如果自动识别不准，可以在弹窗里关闭「自动识别模式」，改为手动选择。
4. 如果漏记或多记，可以用 `+1`、撤销或删除最近记录来修正。
5. 在设置页可以重命名模式、添加自定义模式、导出数据或清空记录。

### 隐私

这个扩展不会上传数据，也不会持久保存对话内容。为确认发送和防止重复计数，它会在当前页面内存中临时比对输入框草稿与新出现的用户消息；关闭页面后这些临时状态即消失。保存的每条记录只包含：

- 模式 ID
- 时间戳
- 记录来源，例如发送按钮、回车或手动记录

### 限制

- 只在安装了此扩展的 Chrome 用户配置中生效。
- 只统计 ChatGPT 网页端发送的消息。
- 不会统计手机 App、其他浏览器或其他设备上的使用。
- 自动识别依赖 ChatGPT 页面 UI，如果 ChatGPT 改版，可能需要更新选择器。
- 它是本地计数器，不是 OpenAI 官方用量统计。

### 更新

修改代码后，回到 `chrome://extensions/`，点击 `ChatGPT Message Tracker` 扩展卡片上的刷新按钮。

### 多语言模式识别（0.3.0）

识别依据是 ChatGPT 页面自己的语言声明和模式控件中的实际标签，不根据浏览器语言或提问语言推测，也不自行翻译英文模式名。内置 21 个语言/地区变体的官方资源词条，来源、原始消息键和 SHA-256 保存在 `docs/site-language-evidence.json`。部分词条来自同一官方网页的语音设置模块；服务器可覆盖文字输入框的显示名称，因此不能把资源存在误当成每个账户都实测通过。未知标签会明确显示手动模式。

简繁中文、英语和其他语言共用既有的五个统计 ID。只对确认出现的新用户消息计数；清空草稿、输入法选字、停止回答和切换历史会话不应加一。稳定消息 ID 用来去重，同样的文字真实发送两次仍计两次。

验证命令：`npm ci`、`npm run check`、`npm test`。运行 `npm run test:chrome` 可在临时配置中加载真实扩展进行 Chrome 本地页面测试，不使用已有 Chrome 配置、登录信息或历史计数。它不等于已登录 ChatGPT 网页的端到端验收。语言资源复核：`node --expose-gc tools/verify-evidence.mjs /path/to/exported-official-assets`。

### Chrome Web Store 打包

```sh
npm ci
npm run check
npm test
python3 tools/build_release.py
```

上传 `dist/0.3.0/chatgpt-message-tracker-0.3.0-chrome-web-store.zip`；同目录的 `publish-kit.zip` 是发布者材料，不是扩展上传包。打包采用明确文件清单，不包含依赖目录、测试、原始网站资源、浏览器数据或 Git 文件。`store/` 提供中英文介绍、权限／隐私填写说明，以及真实扩展界面的演示截图。

重新验证打包后的运行文件：先运行 `python3 tools/build_release.py --extension-only`，再运行 `CMT_EXTENSION_ROOT="$PWD/dist/0.3.0/unpacked" npm run test:chrome`。测试使用隔离配置和本地测试页面，不代表已完成真实账户的语言切换验收。

## English Introduction

Count messages you send on the ChatGPT website by mode, review retained recent history, and correct records manually. This is an independent local counter. It does not query official quotas, predict remaining allowance, or provide official OpenAI usage data.

It is a local Chrome extension for personal tracking only. It is not designed to bypass, predict, or replace OpenAI's official usage limits.

### Features

- Tracks messages by mode: `Instant`, `Medium`, `High`, `Extra High`, and `Pro`.
- Shows a small floating counter on ChatGPT pages.
- Detects the mode selected next to the composer at the moment a message is sent, and counts against it.
- Supports manual mode selection, manual `+1`, undo, and deleting recent entries.
- Shows total counts and recent time-window counts.
- Shows daily counts for a selected mode within the chosen time range.
- Exports settings and usage records as JSON.
- Stores everything locally in Chrome extension storage.

### UI Preview

![ChatGPT Message Tracker UI preview](docs/ui-preview.svg)

### Install

1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the project root folder that contains `manifest.json`.
5. Open or refresh `https://chatgpt.com/`.

### Usage

1. Choose the current mode in the floating widget or extension popup.
2. When you send a message, the extension reads the mode selected next to the composer, then records `+1` once your message actually appears in the conversation, falling back to the manually selected mode if detection fails. Enter presses that do not send (IME candidate confirmation, pressing Enter while a reply is streaming) are not counted.
3. If automatic detection is inaccurate, turn off **Auto detect mode** in the popup and select the mode manually.
4. Use `+1`, undo, or recent-entry deletion to correct records.
5. Use the options page to rename modes, add custom modes, export data, or clear records.

### Privacy

This extension does not upload data or persist conversation content. It temporarily compares the composer draft with newly rendered user messages in page memory to confirm sends and avoid double counting. These transient states disappear when the page closes. Persisted usage entries contain only:

- mode id
- timestamp
- record source, such as send button, Enter key, or manual entry

### Limitations

- It only works in the Chrome profile where the extension is installed.
- It only tracks messages sent from ChatGPT web pages.
- It cannot track ChatGPT mobile apps, other browsers, or other devices.
- It relies on ChatGPT page UI signals, so future ChatGPT UI changes may affect automatic detection.
- It is a local counter, not an official OpenAI usage meter.

### Update

After changing the code, go to `chrome://extensions/` and click the reload button on the `ChatGPT Message Tracker` extension card.
