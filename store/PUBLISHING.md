# Chrome Web Store 发布清单（0.3.0）

准备上传不代表已提交、通过审核或已经上线。此目录的文案和隐私声明基于当前代码；开发者应在商店后台逐项确认后提交，不要把任何占位说明粘贴为真实身份或测试凭据。

## 交付文件

运行 `python3 tools/build_release.py` 生成 `dist/0.3.0/`：

- `chatgpt-message-tracker-0.3.0-chrome-web-store.zip`：唯一应该上传到商店 Package 页的扩展包。manifest.json 位于 ZIP 根目录，没有 Git、测试、node_modules、研究语言包、CLI 或本地记录。
- `chatgpt-message-tracker-0.3.0-publish-kit.zip`：给发布者保存的材料包，含上传 ZIP、截图、宣传图、隐私政策、文案及本清单。不要把整个材料包上传为扩展。
- `SHA256SUMS.txt` 和 `package-audit.json`：校验值及文件清单。
- `unpacked/`：与上传 ZIP 内容一致的解压目录，可用来本地试装。

商店素材在 `store/assets/`。截图由真实扩展页面渲染，使用隔离的演示记录，不包含用户对话。标题说明属于截图展示排版，不是插件新增功能；设置截图直接展示实际设置页。宣传图复用项目现有图标，不使用 OpenAI 官方标志或官方背书。

## 后台操作

在 Chrome Web Store Developer Dashboard 使用自己的发布者账号，新建条目并上传名称带 `chrome-web-store.zip` 的文件。填写商店文案（中文在 `listing-zh-CN.md`，英文在 `listing-en.md`）、分类、发布范围、开发者联系信息和隐私字段，上传图片，再提交审核。开发者账号注册、费用、身份／联系信息及服务条款由账号所有者自行处理，本次不代操作或确认。

Google 要求 ZIP 根目录包含 manifest；简短说明最多 132 字符。截图使用 1280×800 或 640×400，至少一张；另准备 128×128 PNG 图标及 440×280 小宣传图。首次公开发布前，仍应在自己的已登录 ChatGPT 网页中实际切换中文和英文各发送一次，确认账户当前控件标签能被识别。

本扩展自身 UI 主要为简体中文；不要把 21 个网页识别词表变体写成“插件界面支持 21 种语言”。不要宣传剩余额度、官方限额预测、跨设备同步或完整账户实测。

## 隐私政策 URL 与支持 URL

Privacy policy:
https://github.com/Neptuneeeeeeee/Chatgpt-message-tracker/blob/main/PRIVACY.md

Support:
https://github.com/Neptuneeeeeeee/Chatgpt-message-tracker/issues

提交前在未登录窗口确认政策 URL 可公开访问。项目维护者的真实身份、联系邮箱及适用地区的交易者资料需要你自行确认，不从代码仓库用户名推断或虚构。

## Single purpose（可复制英文）

Locally count messages the user sends on the ChatGPT website, attribute them to the selected mode, and provide related history, statistics, corrections, and export.

## 权限用途（可复制英文）

storage:
Stores mode settings, display preferences, reset timestamps, and usage-entry metadata in chrome.storage.local. Conversation bodies are not persisted.

scripting:
Reinjects only the extension's own bundled JavaScript and CSS into already-open ChatGPT tabs after installation, update, reload, or activation, so the visible counter and send detection can resume without duplicate instances.

Host access (https://chatgpt.com/* and https://chat.openai.com/*):
Reads the ChatGPT page language, relevant mode/send controls, newly rendered user-message identifiers and text, composer draft, and current conversation path to identify actual sends and avoid duplicate or navigation-related counts. All matching happens locally in page memory. These host patterns also allow identifying already-open ChatGPT tabs for reinjection. The extension does not inspect general browsing history or other websites.

Remote code:
No. All runtime JavaScript, CSS, icons, and detection vocabulary are packaged in the extension. Developer-only extraction and test scripts are excluded from the upload ZIP. No remote script is fetched or executed at runtime.

## 数据类别：不要仅因“没有上传”就填“完全不处理用户数据”

Google 明确要求仅本地处理的数据也要披露。当前扩展的事实是：临时读取草稿和新消息正文；观察发送按键／点击；读取 ChatGPT 会话路径；在本地保存模式和时间等计数元数据。开发者不能取得这些数据。

按后台当前字段核对以下类别，向审核者明确说明全部为本地功能所需：

| 类别 | 本扩展的处理事实 |
| --- | --- |
| Website content | 临时比对 ChatGPT 草稿／新用户消息和相关控件文字，不持久保存正文、不上传。 |
| Personal communications | 草稿和发送给 ChatGPT 的消息可能构成个人通信；不能宣称完全不读取这些内容。 |
| User activity | 仅为发送判定观察相关按键、点击和网页变化；保存发送时间、模式和来源。 |
| Web history / browsing activity | 仅临时读取当前 ChatGPT 路径及已打开的 ChatGPT 标签页以避免误计数／补注入；不保存通用浏览历史或会话 URL。 |

不要误称收集登录凭据、支付资料等结构化数据；但消息文本本身可能含用户输入的敏感信息，政策对此已明确说明。后台字段及认定可能变化，最终披露需与审核当时字段和代码一致。

数据用途说明（可复制英文）：
Data is handled locally solely to provide message counting, mode attribution, history, corrections, and user-initiated export. Message bodies and conversation paths are transient and never uploaded or persisted. Only count metadata and settings are stored in the current browser profile. There is no developer backend, advertising, analytics, sale of data, or unrelated use. Users can delete history and disable or remove the extension. See the privacy policy for retention and the distinction between resetting counts and deleting history.

## Test instructions（可复制英文）

The extension has no separate account or backend. Install it in desktop Chrome, open the toolbar popup, and test manual +1/undo and the options page without logging in anywhere. To test automatic counting, use the reviewer's own permitted access to ChatGPT, open a new conversation, choose an available supported mode, and send one short test message. The extension should increment once after the new user message appears. Reopening existing history should not increment the count. The reviewer must not use the publisher's personal account; no personal account credentials are included.

Interface controls are currently in Simplified Chinese. 自动记录 = automatic counting; 自动识别模式 = automatic mode detection; 页面浮窗 = floating counter; 设置 = settings; 撤销一次 = undo; 更多功能 = more features; 清零计数 = reset displayed counts (does not delete history). Mode labels are editable. Pro or other restricted modes require the reviewer's own account eligibility. Unknown account-specific labels use manual fallback; no quota-bypass functionality exists.

## 数据迁移和公开发布前注意

本地“加载已解压”版本和商店分配的扩展 ID 可能不同。它们的记录不应假定会自动迁移；当前版本只有导出，没有导入恢复功能。先导出备份，保留旧扩展的数据；试用商店版时不要同时启用两份计数器。

本次不会替仓库添加未经授权的开源许可证，也不替发布者确认商标、第三方素材权利或商店法律条款。开发依赖不会进入扩展包，官方网页完整资源不会进入仓库或上传包；只保留识别互操作需要的少量标签及其来源记录。

## 官方参考（核对日期：2026-09-17）

https://developer.chrome.com/docs/webstore/prepare
https://developer.chrome.com/docs/webstore/publish
https://developer.chrome.com/docs/webstore/images
https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
