# Privacy Policy — ChatGPT Message Tracker

Effective date: 17 September 2026. Applies to extension version 0.4.0.

ChatGPT Message Tracker is an independent, local message counter maintained in the Neptuneeeeeeee/Chatgpt-message-tracker GitHub repository. It is not affiliated with or endorsed by OpenAI. This policy describes the extension itself, not ChatGPT, Chrome, GitHub, or the Chrome Web Store.

## Purpose and local processing

The extension counts messages you send on the ChatGPT website and groups them by the selected mode. To distinguish a real send from an input-method confirmation, a cancelled action, navigation, or a repeated page render, the content script temporarily reads and compares the composer draft and newly rendered user-message text in the current page's memory. Message text can include personal or sensitive information you choose to type. The extension does not extract such information into a profile or use it for any unrelated purpose.

The script also reads the page language, relevant mode and send/stop controls, user-message DOM identifiers, and the current ChatGPT conversation path. It observes relevant keyboard, click, visibility, and DOM events for counting. The background component identifies open ChatGPT tabs only to reinsert the packaged counter after installation, reload, or activation. It does not enumerate general browsing history or operate on other websites.

These transient message contents, DOM identifiers, and conversation paths are not written to the extension's persistent storage or sent to the developer. Some transient values remain in the current page's memory until replaced, cleared by the counting flow, or the page is closed. A freshness timeout used for matching is not a promise of immediate memory erasure.

## What is stored

The extension uses chrome.storage.local in the current Chrome profile. Saved settings include enabled modes, user-editable mode labels, the selected mode, display preferences, statistics time ranges, and reset timestamps. Each usage entry contains a generated entry identifier, a mode identifier, a timestamp, and its source, such as a send button, Enter key, or manual adjustment. It does not store the message body, conversation title, conversation URL, account identity, authentication cookies, passwords, or API keys.

When another usage entry is added, entries older than approximately 120 days are pruned. This happens when adding an entry, not on a guaranteed daily deletion schedule. Other settings remain until changed or removed. Browser/operating-system backups and files that you export yourself are outside the extension's control. Chrome local storage is not an extension-provided encrypted vault; protect access to your device and browser profile.

## Transmission, sharing, and limited use

The extension has no developer-operated backend, telemetry, advertising, analytics SDK, external AI service, or account system. It makes no background network requests to upload usage records or message contents. It does not sell, share, or transfer these data to the developer or third parties, and does not use them for advertising, profiling, credit decisions, or model training. All code and detection vocabulary required at runtime are packaged with the extension; it does not download or execute remote code.

The extension's use of information is limited to its disclosed user-facing message-counting, mode-detection, history, and correction features, consistent with the Chrome Web Store User Data Policy, including its Limited Use requirements. The developer cannot access the records stored in your browser through this extension.

An export initiated by you creates a local JSON download containing settings and usage metadata, not conversation bodies. You decide whether to share that file. Opening ChatGPT, the repository, the privacy policy, or the support page is a user-initiated visit to the corresponding service and is subject to that service's own policies. Chrome and the Chrome Web Store may independently handle installation/update information under Google's policies.

## Permissions

storage is used to save settings and message-count metadata locally. scripting is used to reinsert the extension's own bundled JavaScript and CSS into already-open ChatGPT tabs so that counting can resume after an update or reload. Host access is restricted to https://chatgpt.com/* and the legacy https://chat.openai.com/* address, for the visible counter and send/mode detection. No cookies, history, debugger, native messaging, or all-websites permission is requested.

## Your controls

You can turn automatic counting off, hide the floating counter, select a mode manually, undo or delete usage entries, and export your records. Turning off automatic counting is a counting preference; to prevent all page access by this extension, disable or remove it in Chrome's extension management and reload already-open ChatGPT pages. The options page can permanently delete the current mode's or all modes' history. Resetting displayed counts is not the same as deleting history. An exported JSON file must be deleted separately by you. Removing the extension removes its Chrome extension storage; separate exports and external backups are not removed by that action.

## Contact and changes

For privacy questions, open an issue at https://github.com/Neptuneeeeeeee/Chatgpt-message-tracker/issues without posting private conversations, credentials, or sensitive exports. GitHub issues are public; do not use them to send confidential material. Future changes to data handling will be reflected in an updated policy and extension release as appropriate.

# 隐私政策 — ChatGPT Message Tracker

生效日期：2026 年 9 月 17 日。适用于 0.4.0 版本。

本扩展是独立的本地消息计数工具，由 Neptuneeeeeeee/Chatgpt-message-tracker GitHub 仓库维护，与 OpenAI 无隶属、合作或官方背书关系。本政策说明扩展本身，不代替 ChatGPT、Chrome、GitHub 或 Chrome Web Store 的政策。

## 本地处理什么信息

为确认一次操作确实发送了消息，而不是输入法选字、取消、切换会话或重复渲染，扩展会在当前网页内存中临时读取并比对输入框草稿与新出现的用户消息文字。文字可能包含你自行输入的个人或敏感信息；扩展不会将这些信息提取为用户画像，也不会用于其他目的。

扩展还读取页面语言、模式和发送／停止控件、用户消息的网页标识，以及当前 ChatGPT 会话路径，并观察与计数有关的按键、点击、可见性和网页变化。后台仅识别已打开的 ChatGPT 标签页，以便安装、更新或重新启用后补注入计数器，不收集其他网站的浏览历史。

上述消息文字、网页消息标识和会话路径不写入扩展的持久存储，也不发送给开发者。临时值会在计数流程中替换或清理，部分可能保留到页面关闭；用于匹配的新鲜度时限不代表内存会在该时刻立即擦除。

## 保存和保留期限

设置和计数记录只保存在当前 Chrome 配置的 chrome.storage.local 中。设置包括模式名称、开关、显示方式、统计范围和清零时间。每条使用记录仅包含生成的记录标识、模式标识、时间戳和来源，例如发送按钮、回车或手动调整；不保存消息正文、会话标题／网址、账户身份、身份验证 Cookie、密码或 API key。

每次新增使用记录时，会清理约 120 天以前的记录；这不是每日定时删除。设置保留到你修改或移除它们。本地存储并非扩展自行提供的加密保险箱，请保护设备和浏览器配置的访问权限。自行导出的文件及浏览器／系统备份不由扩展管理。

## 上传、分享与用途限制

扩展没有开发者后台、遥测、广告、分析 SDK、外部 AI 服务或独立账号体系，不在后台上传消息或计数记录。数据不出售、不分享给开发者或第三方，不用于广告、画像、信用判断或模型训练。运行所需代码与识别词表全部随扩展打包，不下载或执行远程代码。

信息仅用于已披露的消息计数、模式识别、历史查看和修正功能，遵守 Chrome Web Store 用户数据政策及 Limited Use 要求。开发者无法通过本扩展访问你浏览器里的记录。

只有你主动导出时，才会生成包含设置和计数元数据的本地 JSON 文件，不含对话正文。是否分享该文件由你决定。你主动打开 ChatGPT、仓库、隐私政策或支持页面时，对应服务按自己的政策处理访问。Chrome 和商店可能依据 Google 的政策独立处理安装、更新等信息。

## 权限与控制

storage 用于本地保存设置和计数；scripting 用于向已经打开的 ChatGPT 页面重新注入扩展自己的打包脚本和样式。网站权限仅限 chatgpt.com 和旧地址 chat.openai.com，不申请 Cookie、浏览历史、调试器、本地通信或所有网站权限。

你可以关闭自动计数、隐藏浮窗、手动选择模式、撤销／删除记录和导出。关闭自动计数只是计数选项；要停止扩展的全部网页访问，请在 Chrome 扩展管理中停用或移除扩展，并刷新已打开的 ChatGPT 页面。设置页可永久删除某模式或全部历史；“清零计数”不会删除历史。自行导出文件需要另行删除；卸载扩展不会删除这些导出文件或外部备份。

隐私问题可通过 https://github.com/Neptuneeeeeeee/Chatgpt-message-tracker/issues 联系。Issue 是公开页面，请不要提交私人对话、凭据或敏感导出文件。未来数据处理方式改变时，会相应更新政策与版本。
