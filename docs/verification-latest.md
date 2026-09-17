# 多语言计数复核报告

> 本文记录发布准备之前的多语言修复检查，其确切文件版本见 `verification-latest.json` 中的 SHA-256。随后商店准备增加了 manifest 介绍和设置页隐私入口；打包产物的较新验证见 `release-0.3.0.json`。此处“未推送”和“界面未变”等说明属于当次检查的历史状态。

版本：0.3.0。机器可读结果、测试用例和被验证文件的 SHA-256 见 `verification-latest.json`。本报告只描述下列实际完成的验证，不把官方语言资源或本地测试页面等同于已登录 ChatGPT 账户实测。

## 最终结果

| 检查 | 结果 |
| --- | --- |
| 代码与 DOM 回归测试 | 206 项通过，0 失败、0 跳过、0 取消。 |
| 真实 Chrome + 实际 MV3 扩展 | Chrome 153.0.8010.48，112 个本地页面场景通过；产生 110 条隔离测试记录。 |
| 浏览器运行与清理 | 页面/扩展 JavaScript 运行时错误列表为空；测试 Chrome 正常退出（exit code 0）；临时配置已删除，无对应验证进程遗留。 |
| 官方资源复核 | 20 个非英语语言包的 SHA-256 及 280 条原始词条全部一致；静态解析，无远程代码执行。 |
| 加载、权限、存储 | 正常加载与补注入脚本顺序一致；权限、存储键和原有五个模式 ID 不变。 |
| 界面及存储核心 | `shared.js`、popup/options 的 JS/HTML/CSS、`content.css` 相对原版本未改动；仅浮窗识别失败说明文字调整。 |
| 差异检查 | `git diff --check` 通过。未提交或推送 Git。 |

Chrome 原生 stderr 仍记录了显示同步、网络服务、新标签页、Crashpad 和推送服务诊断。这些已检查并按类别记录在 JSON 中；不将“无页面 JavaScript 错误”写成“浏览器完全没有诊断”。最终浏览器场景断言全部通过且正常退出。

## 本次发现并修复

- 连续发送相同文字但消息 ID 不同，原来会被三秒文字去重误删一次。现在优先使用消息 ID 去重，真实发送两次计两次。
- 未确认的发送意图可能被其他会话的历史消息确认。现在核对消息与草稿、会话路径；保留首次发送创建会话 URL 的例外。
- 清空或卸载输入框不代表发送成功。取消这种兜底计数，只接受实际新用户消息。
- 嵌套标签 `Extra <b>High</b>` 原来可能只留下 High。现在按可见 DOM 文本顺序读取，保留 Extra；隐藏、禁用标签不作为模式证据。
- 选中项无法识别时，不再退回到旧的已知按钮标签；页面未声明语言时不伪称英文。
- 支持分步渲染的用户消息空壳；慢渲染仍保留发送时选中的模式，避免记到后来切换的模式。

## 验证范围

Chrome 验证使用临时配置，加载项目中实际扩展文件。请求由测试工具在到达网络前替换为明确标记的本地页面；21 个语言/地区变体与五个模式均执行了发送、读取真实扩展存储的断言。另验证重复发送、停止、隐藏标签、重复注入、嵌套标签、分步渲染和跨会话历史。

**这不是已登录 ChatGPT 账户的端到端验证。** 用户 Chrome 禁止通过 Apple Events 执行网页 JavaScript，未更改该安全设置。未操作真实账户切换语言或发送测试问题，也未重新加载用户配置中的扩展、清空或写入其使用记录。

官方资源中部分 Instant / Medium / High 词条来自网页语音设置的 intelligence 项；文字输入框的 preset 名称可以由服务器覆盖。因此保留精确匹配和未知标签的手动回退，不推断未经证实的译名或 Standard / Extended 等档位等价关系。

## 重现

```sh
npm ci
npm run check
npm test
npm run test:chrome
node --expose-gc tools/verify-evidence.mjs /path/to/exported-official-assets
```

`test:chrome` 默认使用 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`，其他路径可用 `CMT_CHROME` 指定。测试使用独立临时配置及私有调试管道，不要求开启用户日常 Chrome 的 Apple Events JavaScript 权限。

本次最终原始日志：`/tmp/cmt-final-verification/`。其中成功的 Chrome 结果在 `chrome-final/`；`chrome/` 是早先启动超时的失败尝试，不应混用。持久结果以本目录 `verification-latest.json` 为准。
