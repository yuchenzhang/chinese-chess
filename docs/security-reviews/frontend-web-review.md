# 网页前端安全审查报告 (Security Review: Web Frontend)

## 1. 文档元信息 (Document Meta)
- **审查日期**: 2026-05-22
- **审查人员**: Antigravity (AI 编码助手 / Advanced Agentic Coding)
- **审查对象**: 网页前端模块 (`web/src/` 下的核心组件、引擎算法解释页、本地计算线程及存储工具)
- **评估状态**: 🟢 安全合格 (无遗留漏洞)

---

## 2. 审查范围与主要文件 (Review Scope & Target Files)

| 目标文件 | 变更类型 | 核心运行时路径 | 安全相关性 | 审计关注点 |
| :--- | :--- | :--- | :--- | :--- |
| `web/src/components/EngineExplanationPage.tsx` | 新增/修改 | 算法解释交互与公式渲染 | 中 | 交互公式渲染、图形模拟及用户操作节点 XSS 防范。 |
| `web/src/components/ChangelogPage.tsx` | 新增/修改 | 版本更新日志展示 | 低 | 静态与动态超链接的安全跳转，防范反向页劫持。 |
| `web/src/storage/llmKeyStore.ts` | 存根化 | 客户端秘钥存储管理 | 高 | 保证前端无任何敏感 API Key 遗存或加载动作。 |
| `web/src/storage/llmConnectionStore.ts` | 修改 | 后端通信地址及连接管理 | 高 | 后端 API 配置的安全格式化、本地存储读取防溢出。 |
| `web/src/utils/engine/localEngine.ts` | 修改 | Web Worker 多线程计算 | 中 | 线程间消息传送沙盒安全性，排除动态执行 (RCE) 风险。 |
| `web/src/utils/penParser.ts` | 新增/修改 | 象棋局面 FEN/PEN 解析 | 中 | 输入解析器数组边界与格式校验健壮性。 |

---

## 3. 安全评估摘要 (Executive Summary)

- **整体风险评级**: 🟢 零/极低风险 (Low)
- **致命漏洞 (Critical)**: 0
- **高危漏洞 (High)**: 0
- **中危漏洞 (Medium)**: 0
- **低危漏洞 (Low)**: 0

本次审查专门针对网页端新集成的**算法解释模块 (Minimax/Alpha-Beta 模拟器、权重热力图)** 及**系统底层连接存储**进行了代码级的安全扫描与动态逻辑推演。结果表明，系统已实现了极高水平的本质安全 (Secured by Default)。

---

## 4. 关键安全特性与防御实现 (Key Mitigations Verified)

### 特性 1: 零 XSS 注入通道 (Zero DOM-based XSS Sinks)
- **检查动作**：对整个前端 `web/src` 的所有组件进行了 `dangerouslySetInnerHTML`、`eval(`、`Function(` 关键字的全面检索。
- **审查结果**：全量通过 (0 匹配)。
- **防御机制**：所有新页面（算法解释及日志页）中的动态变量、参数以及引擎调试输出，均完全基于 React 官方安全的 JSX 插值方式渲染。即使有恶意的 HTML 特殊字符，也会被自动转义为文本实体，杜绝了反射型或存储型 XSS 的可能。

### 特性 2: 完善的超链接反劫持控制 (Reverse Tabnabbing Prevention)
- **检查动作**：审计了包含外部跳转 `target="_blank"` 的超链接配置。
- **审查结果**：系统内仅有 3 处外链（均指向官方 GitHub 仓库）：
  - `web/src/components/ChangelogPage.tsx`
  - `web/src/components/ChessGame.tsx` (顶部与底部各一处)
- **防御机制**：全部超链接均加持了 `rel="noopener noreferrer"` 属性。此配置可有效切断目标标签页对当前标签页 `window.opener` 对象的控制，防止外部恶意网页将源标签页重定向至钓鱼网站。

### 特性 3: 客户端凭证零残留 (No Client-side Secrets)
- **检查动作**：深度审计了 [llmKeyStore.ts](file:///Users/yc/workspace/hobby/chinese-chess/web/src/storage/llmKeyStore.ts)。
- **审查结果**：该模块已重构为完全安全的存根 (Stub)，核心读写接口强制置空。
- **防御机制**：所有的大模型 (LLM) 推理调用均改由后端 Python 象棋引擎进行中转，前端仅在本地存储中记录引擎的宿主 URL（`chinese-chess:llm-connection:v2`）。没有任何 API 密钥保留在浏览器中，彻底免除了客户端遭解密导致秘钥失窃的风险。

### 特性 4: 健壮的本地存储容错与输入校验
- **检查动作**：审计了 `localStorage` 数据加载及校验逻辑。
- **审查结果**：
  - 各类存储读取函数均使用标准的 `try-catch` 进行逻辑防护。一旦发生本地数据损坏或非法数据篡改，系统会自动使用 `createSession()` 重置为安全的缺省状态，绝不引发运行时白屏挂起。
  - 用户配置的后端地址 `backendUrl` 输入具有过滤机制，并在请求中以安全的 HTTP fetch 常规发起请求，不支持任何危险的 `javascript:` 或 `data:` 协议。

### 特性 5: 线程独立的本地推演沙箱
- **检查动作**：审计了 Web Worker 的多线程推演实现。
- **审查结果**：
  - 工作线程 [engine.worker.ts](file:///Users/yc/workspace/hobby/chinese-chess/web/src/utils/engine/engine.worker.ts) 基于标准的静态 ESM 导入构建，无动态注入外部模块。
  - 推演计算完全隔离于工作线程沙箱，无法操纵浏览器的主 DOM Tree，并在完成计算或遭遇异常时立即执行 `.terminate()` 终结线程，安全性良好且无内存泄露。

---

## 5. 生产硬化推荐行动 (Production Hardening Actions)

为确保项目未来的商业化或线上生产发布，建议额外注意以下环境硬化举措：

1. **启用连接协议强制安全 (HTTPS Enforcement)**:
   - 当网页前端部署于 HTTPS 的生产服务器时，浏览器会因“混合内容”安全策略（Mixed Content Blocks）限制向 HTTP 协议的引擎接口发送请求。请务必保证前端和 Python 引擎同时启用 `https` 加密传输。
2. **后端引擎 CORS 白名单收紧**:
   - 远程 Python 象棋引擎应将 `Access-Control-Allow-Origin` 字段明确收紧为前端网页的真实部署域名，不得随意开启 `*`，防止跨站请求伪造 (CSRF) 探测漏洞。
3. **输入字段长度限制 (Length Limitation)**:
   - 建议在 `LlmSettings.tsx` 的后端地址 `input` 输入元素中加入 `maxLength={256}` 的硬性校验，以防止超长的垃圾文本过度填塞浏览器本地 Local Storage。

---

**审计结论**：**本项目网页前端实现了全方位的结构化安全防御，代码纯净、机制规范，暂无已知可利用的安全漏洞。符合生产交付及集成要求。**
