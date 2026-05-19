# 中国象棋对弈与训练平台 — 实现进度计划

> 最后更新：2026-05-18

---

## 总体架构

```
chinese-chess/
├── README.md
├── PLAN.md
│
├── web/                          # Vite + React + TypeScript 前端
│   ├── src/
│   │   ├── main.tsx              # 入口，渲染 <App />
│   │   ├── App.tsx               # 根组件，仅渲染 <ChessGame />
│   │   ├── App.css / index.css   # 全局样式（暗色木质主题）
│   │   │
│   │   ├── types/                # 类型定义
│   │   │   └── gameSession.ts    # GameSession, MoveRecord, SessionStore
│   │   │
│   │   ├── config/               # 配置层
│   │   │   └── llmProviders.ts   # 大模型提供商注册表（前端侧：提供商列表/模型选择）
│   │   │
│   │   ├── components/           # React UI 组件
│   │   │   ├── ChessGame.tsx     # 主页面：棋盘 + 侧边栏布局
│   │   │   ├── SessionList.tsx   # 棋局列表（创建/切换/删除/重命名）
│   │   │   └── LlmSettings.tsx   # 大模型配置面板 + Ping 测试
│   │   │
│   │   ├── hooks/                # React Hooks（业务逻辑）
│   │   │   ├── useChessGame.ts   # 核心对弈逻辑（Canvas 渲染、AI 回合、状态管理）
│   │   │   └── useLlmSettings.ts # 大模型设置读写、Key/端口管理
│   │   │
│   │   ├── llm/                  # 大模型通信层 → 改为调用后端 API
│   │   │   ├── apiClient.ts      # 调用后端 POST /api/ai/move
│   │   │   ├── requestAiMove.ts  # 构造局面 prompt → 发给后端 → 解析着法
│   │   │   └── debug.ts          # 开发环境日志输出
│   │   │
│   │   ├── storage/              # localStorage 持久化
│   │   │   ├── sessionStore.ts   # 棋局列表存取
│   │   │   ├── llmSettingsStore.ts # 提供商/模型选择
│   │   │   └── llmConnectionStore.ts # 后端 API 地址配置
│   │   │
│   │   └── utils/                # 纯函数工具
│   │       ├── zhChessEngine.ts  # zh-chess 内部状态类型声明
│   │       ├── applySessionToBoard.ts # 从 session 恢复棋盘状态
│   │       ├── chessSides.ts     # 阵营工具（oppositeSide / getAiSide）
│   │       └── gameSessionHelpers.ts # 状态消息生成
│   │
│   └── package.json              # 依赖：react, zh-chess, vite, typescript
│
└── server/                       # Node.js + Express 后端
    ├── src/
    │   ├── index.ts              # Express 入口，挂载路由
    │   │
    │   ├── config/
    │   │   ├── llmProviders.json # 大模型提供商配置（baseUrl、apiKey、models）
    │   │   └── llmProviderLoader.ts # 加载/查询提供商配置
    │   │
    │   ├── routes/
    │   │   └── ai.ts             # AI 相关路由（POST /ai/move, GET /ai/providers, GET /health）
    │   │
    │   └── llm/
    │       └── client.ts         # 统一 LLM 调用（适配各提供商 API 格式）
    │
    └── package.json              # 依赖：express, cors, tsx
```

**数据流**：

1. **用户走子**：前端 Canvas 点击 → `zh-chess` 校验 → 走子完成
2. **AI 回合触发**：前端判断轮到 AI → 构造 messages（system prompt + 局面 PEN + 历史） → `POST /api/ai/move` → 后端
3. **后端转发**：后端读取 `llmProviders.json` 中的 baseUrl + apiKey → 统一格式 → 调用对应 LLM API → 解析着法 → 返回 `{"move": "..."}` → 前端
4. **前端执行**：收到着法 → `zh-chess` 执行 → 更新棋盘

**架构约束**：前端**不直接访问大模型 API**，所有 LLM 请求必须经后端代理。API Key 和 baseUrl 仅存在于后端 `llmProviders.json`。

---

## Phase 1 — Web UI + 本地双人对弈（基础棋盘）

### 1.1 项目脚手架

- **状态**：已完成
- **实现方案**：
  - Vite 5 + React 18 + TypeScript 5.6 作为前端构建栈
  - `zh-chess@2.1.1` 作为象棋规则引擎（走子校验、将军/绝杀判定、PEN 记谱）
  - Canvas 渲染棋盘（720×720），`zh-chess` 自带绘制能力

### 1.2 Canvas 棋盘渲染

- **状态**：已完成
- **文件**：`hooks/useChessGame.ts:331-337`
- **实现方案**：
  - 在 `useEffect` 中创建 `new ZhChess({...})`，传入 canvas 2D context 和棋盘尺寸/配色参数
  - 棋盘背景色 `#e8c890`，红棋子 `#fff8e8`，黑棋子 `#f5ecd8`，可落子点 `#15803d`
  - Canvas 不通过 CSS 缩放（防止坐标偏移），点击事件直接传递 MouseEvent 给 `game.listenClickAsync(e)`

### 1.3 本地双人对弈（点击走棋）

- **状态**：已完成
- **文件**：`hooks/useChessGame.ts:419-430`
- **实现方案**：
  - Canvas 监听 `click` 事件，将 MouseEvent 传给 `zh-chess` 的 `listenClickAsync`
  - `zh-chess` 内部处理选中棋子、显示可落子点、执行走子
  - 走子完成后触发 `move` 事件，回调中记录着法并更新 session 状态
  - 对局结束触发 `over` 事件，设置 winner 和 status 为 `'finished'`

### 1.4 走子记录（记谱）

- **状态**：已完成
- **文件**：`types/gameSession.ts`、`hooks/useChessGame.ts:355-383`
- **实现方案**：
  - 类型 `MoveRecord = { side, penCode, inCheck }` 记录每一步的走子方、PEN 着法、是否将军
  - 在 `zh-chess` 的 `on('move', ...)` 回调中，通过 `game.getCurrentPenCode(nextTurn)` 获取新局面 PEN
  - 走子历史追加到当前 session 的 `moveHistory` 数组
  - UI 侧在 `ChessGame.tsx:165-183` 以 `<ol>` 列表展示，带手数和将军标记

### 1.5 PEN 局面序列化

- **状态**：已完成
- **文件**：`types/gameSession.ts:18`、`hooks/useChessGame.ts:370`
- **实现方案**：
  - 每个 session 保存 `positionPen` 字段，存储当前局面的 PEN 编码（含行棋方信息）
  - 每次走子后调用 `game.getCurrentPenCode(nextTurn)` 更新
  - 侧边栏底部展示当前 PEN 字符串（`ChessGame.tsx:185-189`），供调试和后续 LLM 读盘使用

### 1.6 棋局管理（多局切换）

- **状态**：已完成
- **文件**：`components/SessionList.tsx`、`storage/sessionStore.ts`
- **实现方案**：
  - `SessionStore` 结构：`{ version, activeSessionId, sessions: GameSession[] }`
  - 持久化到 `localStorage`，key 为 `chinese-chess:sessions:v1`
  - 支持创建新棋局（`createSession`）、切换（`switchSession`）、删除（`deleteSession`）、重命名（`renameSession`，双击标题触发）
  - 删除最后一局时自动创建新空局
  - 列表按 `updatedAt` 倒序排列

### 1.7 执子方选择与翻转棋盘

- **状态**：已完成
- **文件**：`hooks/useChessGame.ts:239-249, 323-329`
- **实现方案**：
  - 用户可选择执红（先手）或执黑
  - 通过 `game.changePlaySide(side)` 切换视角
  - 翻转棋盘按钮调用相同逻辑

---

## Phase 2 — 接入大模型：人机对弈

### 2.1 大模型提供商配置

- **状态**：已完成
- **文件**：`config/llmProviders.ts`、`components/LlmSettings.tsx`、`hooks/useLlmSettings.ts`
- **实现方案**：
  - 注册表模式：`LLM_PROVIDERS` 数组，每个提供商有 `id, name, defaultPort, models, apiKeyHint, portHint`
  - 当前支持两个提供商：
    - **Hermes**（默认端口 19789，模型 `hermes-agent`）
    - **OpenClaw**（默认端口 18789，模型 `openclaw`）
  - UI 面板可选择提供商、配置端口、输入 API Key
  - 所有配置保存在 `localStorage`（三个独立的 store：settings、keys、connections）
  - Ping 测试功能：先发 `GET /health`，再 POST 一条 `ping` 消息验证连通性

### 2.2 LLM 通信客户端

- **状态**：已完成
- **文件**：`llm/client.ts`
- **实现方案**：
  - 调用 OpenAI 兼容的 `/v1/chat/completions` 端点
  - URL 动态构建：`http://127.0.0.1:{port}/v1/chat/completions`
  - 支持 SSE（流式）和 JSON（非流式）两种响应格式解析
  - 错误处理：HTTP 非 200 时尝试解析错误体 message
  - 开发环境输出完整请求/响应到控制台（`debug.ts`）

### 2.3 AI 着法请求与解析

- **状态**：已完成
- **文件**：`llm/requestAiMove.ts`
- **实现方案**：
  - 构造 prompt：包含当前 PEN 局面、走子历史、AI 阵营、上次非法着法提示
  - System prompt 约束输出格式为 `{"move": "着法"}` JSON
  - 响应解析：优先 JSON.parse，失败后尝试 markdown code block 提取，再失败后正则匹配
  - 失败时抛出 `LlmClientError`，由上层重试逻辑处理

### 2.4 AI 回合控制与重试

- **状态**：已完成
- **文件**：`hooks/useChessGame.ts:101-186`
- **实现方案**：
  - `runAiTurn` 回调：判断是否轮到 AI、调用 `requestAiMove`、通过 `game.moveStrAsync` 执行
  - 最大重试 3 次（`MAX_AI_RETRIES`），每次将上次错误反馈给 prompt
  - `aiRunIdRef` 机制：用户切换棋局/操作时递增 runId，废弃中的请求自动丢弃
  - `queueMicrotask` 延迟触发 AI 回合，避免与同步状态更新冲突
  - AI 思考期间显示遮罩层（`board-blocker`），阻止用户点击棋盘

### 2.5 人机对弈开关

- **状态**：已完成
- **文件**：`hooks/useChessGame.ts:252-281`、`components/ChessGame.tsx:125-133`
- **实现方案**：
  - `vsAi` 布尔值存在于 `GameSession` 上，可逐局开关
  - 对局进行中不可切换模式（`disabled` 状态）
  - 切换为 AI 模式时重置 session 状态为 `'setup'`，清空走子历史

### 2.6 对局生命周期管理

- **状态**：已完成
- **文件**：`hooks/useChessGame.ts:283-321`
- **实现方案**：
  - `startNewGame`：检查 vsAi 已开启 + API Key 已配置 → 调用 `game.gameStart(side)` → 设置 session 为 `'active'` → 若 AI 先手则立即触发 AI 回合
  - 对局结束（`over` 事件）：设置 `winner`、`status: 'finished'`
  - 胜负判定后显示胜方信息

---

## Phase 2.5 — 后端基础设施（骨架已搭建）

### 2.5.1 后端脚手架

- **状态**：已完成
- **文件**：`server/package.json`、`server/tsconfig.json`、`server/.gitignore`
- **实现方案**：
  - Node.js 24 + Express 4 + TypeScript（ESM 模式）
  - `tsx` 作为开发时 TypeScript 运行时（`npm run dev` → `tsx watch`）
  - 构建产物输出到 `dist/`，生产环境 `node dist/index.js`
  - 默认端口 3001（可通过 `PORT` 环境变量覆盖）
  - CORS 默认开启（允许任意来源，开发阶段）

### 2.5.2 大模型提供商配置（后端）

- **状态**：已完成
- **文件**：`server/src/config/llmProviders.json`、`server/src/config/llmProviderLoader.ts`
- **实现方案**：
  - JSON 文件定义 `providers` 数组，每个提供商有：
    - `id`: 唯一标识（`bailian` / `dashscope` / `deepseek`）
    - `name`: 显示名称
    - `baseUrl`: LLM API 基础地址（从 `server/.env` 环境变量读取）
    - `apiKey`: 认证密钥（从 `server/.env` 环境变量读取，格式为 `$VAR_NAME`）
    - `models`: 该提供商支持的模型列表
    - `apiPath`: API 路径（不同提供商格式不同）
  - 当前注册三个提供商：
    - **百炼 Coding Plan**（`bailian`）：`https://coding.dashscope.aliyuncs.com/v1/chat/completions`
    - **千问 DashScope**（`dashscope`）：`https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
    - **DeepSeek**（`deepseek`）：`https://api.deepseek.com/v1/chat/completions`
  - `llmProviderLoader.ts` 加载 JSON 并解析 `$VAR` 引用为 `process.env` 值

### 2.5.3 统一 LLM 调用客户端

- **状态**：已完成
- **文件**：`server/src/llm/client.ts`
- **实现方案**：
  - 统一入口 `callLlmForMove(providerId, modelId, messages)`
  - 使用 `stream: true` 进行 SSE 流式请求
  - 调用 `fetch` 直连 `baseUrl + apiPath`，Bearer token 认证
  - 支持 SSE 和 JSON 两种响应格式解析
  - `extractMove()` 函数从 LLM 响应中提取着法，支持：
    - JSON `{"move": "..."}` 解析
    - Markdown code block 提取
    - Inline JSON 正则匹配
    - **原始中文记谱字符串**（如 `兵五进一`，不要求 JSON 包裹）
  - 失败时抛出 Error，由上层处理

### 2.5.4 API 路由

- **状态**：已完成
- **文件**：`server/src/routes/ai.ts`、`server/src/index.ts`
- **实现方案**：
  - `POST /api/ai/move`：请求 AI 着法
    - 入参：`{ providerId, modelId, messages, positionPen?, moveSide? }`
    - 出参：`{ move: string, rawContent?: string, fullPrompt?: string }` 或 `{ error: string, fullPrompt?: string }`
    - 校验提供商和模型存在性
    - **服务端提示词增强**：自动在 user prompt 后追加：
      - 视觉棋盘图（`renderBoardAsText`：9×10 文字网格 + 楚河汉界 + 棋子 inventory）
      - 所有合法着法列表（从 PEN 计算，`getLegalMovesFromPen`）
    - **服务端着法验证**：对比 LLM 返回的着法与合法着法列表，不合法时返回 `{ error }`（200 状态码，方便前端重试）
    - 错误处理：catch 中返回 200 + `fullPrompt`，而非 500
  - `GET /api/ai/providers`：列出所有可用提供商及配置状态
  - `GET /api/health`：健康检查
  - `POST /api/ai/ping`：测试提供商连通性

### 2.5.5 前端已迁移至后端 API

- **状态**：已完成
- **变更**：
  - `web/src/llm/apiClient.ts`：新建，调用 `POST http://127.0.0.1:3001/api/ai/move`
    - `ApiClientError` 携带 `fullPrompt` 字段，用于错误时保留后端增强提示词
  - `web/src/llm/requestAiMove.ts`：改为调用 `apiClient.ts`，构造 OpenAI 兼容 messages
  - `web/src/hooks/useChessGame.ts`：AI 回合中使用 `fullPrompt` 更新前端显示
  - `components/ChessGame.tsx:192-206`：展示 `lastAiPrompt`（发送给大模型的完整提示词）
- **新增：手动触发按钮**。当 AI 卡住时，用户可以点击“请求 AI 走子”手动重试。
- **新增：自动触发机制**。页面加载或切换棋局时，若处于 AI 回合会自动触发。

### 2.5 后端基础设施（已完成）
...
### 2.5.6 视觉棋盘提示词（替代 PEN 压缩编码）

- **状态**：已完成
- **文件**：`server/src/utils/penValidator.ts`（`renderBoardAsText`）、`server/src/routes/ai.ts`
- **实现方案**：
- PEN 压缩编码（`rnbakabnr/9/1c5c1/...`）LLM 难以理解，导致重复/非法着法
- `renderBoardAsText(penStr)` 将 PEN 解析为 9×10 文字网格
- **坐标系统一**：发现 `zh-chess` 引擎要求红黑双方均使用红方视角（从右向左 1-9 路）进行记谱。已统一前后端及提示词逻辑，彻底解决“未找到棋子”的坐标偏移问题。
- 增强后的 prompt 包含明确的编号说明和合法着法列表。

### 2.5.8 UI 调试增强
- **状态**：已完成
- **文件**：`web/src/components/ChessGame.tsx`
- **实现方案**：
- **大模型最新回复**：在侧边栏实时展示 AI 返回的原始 JSON 内容，方便定位解析错误。
- **提示词显示**：展示发送给后端的完整增强提示词（包含视觉棋盘和合法着法）。
- **移除冗余**：移除了单独的局面 PEN 显示，整合进提示词中。

- **状态**：已完成
- **文件**：`server/src/llm/complexGame.test.ts`
- **实现方案**：
  - 测试 4 个模型（qwen3-coder-next, qwen3-coder-plus, qwen3-max, kimi-k2.5）
  - 7 个游戏位置（1, 6, 10, 12, 20, 30, 40 步历史）
  - 每个测试：发送视觉棋盘 + 合法着法列表 → 验证 LLM 返回是否为合法着法
  - 使用 `buildRichMessages()` 构造包含视觉棋盘、历史记录、合法着法的完整 prompt
  - 结果：视觉棋盘方案显著优于原始 PEN 编码

---

## Phase 3 — 成长与训练（待实现）

### 3.1 AI 复盘分析

- **状态**：未开始
- **设计**：
  - 对局结束后，将整个走子历史 + 最终 PEN 发送给大模型
  - 生成复盘报告：关键失误点、推荐着法、局势评估
  - 复盘结果展示在独立的复盘面板中
- **实现方案**：
  - 新建 `llm/reviewGame.ts`：构造复盘 prompt（完整走子历史、最终局面 PEN、胜方信息），请求 LLM 生成结构化复盘报告
  - 新增类型 `types/reviewReport.ts`：定义 `ReviewReport` 结构（`overallAssessment`, `keyMoves: Array<{moveNum, played, recommended, analysis, severity}>`, `summary`）
  - 新建组件 `components/GameReview.tsx`：复盘面板，展示总评、关键着法对比表、局势走势文字描述
  - 在 `ChessGame.tsx` 侧边栏增加"复盘"tab，对局结束后可点击进入
  - 新增存储 `storage/reviewStore.ts`：复盘报告按 sessionId 缓存到 localStorage，避免重复请求
  - 复用 `llm/client.ts` 的 `chatCompletion`，但使用更高 `maxTokens`（2048+）和 `temperature: 0.5` 以获取更丰富的分析
  - 复盘 prompt 设计要点：
    - system prompt 约束输出为 JSON 格式，包含 `overall`（总评）、`criticalMoments`（关键转折点）、`blunders`（重大失误）、`suggestions`（改进建议）
    - 传入完整的 moveHistory（每步 PEN），让 LLM 逐步分析质量
    - 对于 AI vs AI 的对局也可复盘，此时以"旁观分析"角度生成
  - 性能考虑：复盘请求可能耗时较长（10-30s），需展示 loading 状态和超时提示（60s 超时）

### 3.2 战术习题生成

- **状态**：未开始
- **设计**：
  - 基于当前局面或历史对局，让大模型生成战术题目（杀法、得子、防守）
  - 用户在棋盘上解题，走子正确性由 `zh-chess` 校验
  - 习题难度分级
- **实现方案**：
  - 新建 `llm/generatePuzzle.ts`：给定当前局面 PEN，请求 LLM 生成战术题目
  - 新增类型 `types/puzzle.ts`：定义 `Puzzle` 结构（`id`, `difficulty: 'easy' | 'medium' | 'hard'`, `category: 'mate' | 'material' | 'defense'`, `fenPosition`, `description`, `solution: string[]`, `hint`, `timeLimit?`）
  - 新建组件 `components/PuzzleView.tsx`：习题模式视图，包含题目描述、倒计时、解题反馈
  - 在 `ChessGame.tsx` 中新增模式切换：`mode: 'game' | 'puzzle'`
    - `game` 模式：正常对弈
    - `puzzle` 模式：加载习题，用户在规定步数内走出正确着法
  - 新建 hook `usePuzzle.ts`：管理习题加载、解题进度、正确/错误判定、计时
  - 校验逻辑：用户走子后，对比 `zh-chess` 实际着法与 `puzzle.solution` 中的期望着法
    - 正确：进入下一步或标记完成
    - 错误：显示提示，可选择重试或查看答案
  - 习题生成 prompt 设计：
    - system prompt 要求输出 JSON 格式题目
    - 指定题目类型（一步杀、两步杀、得子、解围等）
    - 要求给出着法序列（红方和黑方交替）作为标准答案
  - 新建存储 `storage/puzzleStore.ts`：已生成的习题缓存，按局面 PEN 索引，避免重复生成
  - 习题面板可在侧边栏独立 tab 中选择：从当前局面生成 / 随机练习 / 历史习题

### 3.3 水平评估

- **状态**：未开始
- **设计**：
  - 根据多局对局记录，综合评估棋力水平
  - 大模型分析走子质量，给出等级评定
- **实现方案**：
  - 新建 `llm/evaluateSkill.ts`：汇总用户所有 session 的走子历史，请求 LLM 生成综合评估报告
  - 新增类型 `types/skillAssessment.ts`：定义 `SkillAssessment` 结构（`overallLevel`, `strengths: string[]`, `weaknesses: string[]`, `gameCount`, `winRate`, `detailedAnalysis`）
  - 新建组件 `components/SkillDashboard.tsx`：独立页面/模态框，展示棋力雷达图文字描述、近期表现趋势、改进建议
  - 评估触发方式：
    - 侧边栏"我的水平"按钮，主动触发评估
    - 每完成 N 局对弈后自动提示（可配置，默认 N=5）
  - 评估数据输入：
    - 最近 N 局（默认 10 局）的完整 moveHistory
    - 各局结果（胜/负/和）
    - 对局模式（vs AI / 本地双人 / 习题）
  - 评估 prompt 设计：
    - system prompt 要求以专业棋评角度分析
    - 输出结构化 JSON，包含开局理解、中局战术、残局处理、防守能力等维度
    - 等级参考：入门 → 初级 → 中级 → 中高级 → 高级 → 专家
  - 评估结果存储 `storage/assessmentStore.ts`：保存历史评估记录，支持趋势对比
  - 考虑未来扩展：添加 ELO 评分系统（基于与不同难度 AI 的对战结果）

---

## Phase 4 — 增强与优化（规划中）

### 4.1 着法合法性预判与即时提示

- **状态**：未开始
- **设计**：AI 着法请求前，先在客户端校验着法合法性，减少 LLM 调用失败
- **实现方案**：在 `requestAiMove` 返回后、执行前，使用 `zh-chess` 的 `game.getLegalMoves()` 预判，如着法非法则自动重试而不计入重试次数

### 4.2 对局回放与导出

- **状态**：未开始
- **设计**：支持完整回放任意一局棋，支持导出 PEN/图片
- **实现方案**：
  - 新建 `components/GameReplay.tsx`：回放控制器（上一步/下一步/自动播放/跳转第 N 步）
  - 导出功能：复制 PEN 到剪贴板、生成局面截图（Canvas `toDataURL`）

### 4.3 多语言与国际象棋风格 PEN 支持

- **状态**：未开始
- **设计**：支持全角/半角数字自动转换，兼容不同记谱风格
- **实现方案**：新建 `utils/penNormalizer.ts`，统一输入格式后再发送给 LLM

---

## 开发工作流

### 本地开发

```bash
# 前端
cd web
npm install
npm run dev        # http://localhost:5173

# 后端（另一个终端）
cd server
npm install
npm run dev        # http://127.0.0.1:3001
```

### 大模型配置

1. 编辑 `server/src/config/llmProviders.json`，填入对应提供商的 `baseUrl` 和 `apiKey`
2. 启动后端后，前端可通过 `GET /api/ai/providers` 获取可用模型列表
3. API Key **仅存储在后端**，前端不接触密钥

---

## 已知限制

| 限制 | 说明 | 影响 |
|------|------|------|
| 无撤销/悔棋 | `zh-chess` 引擎未提供 undo API | 用户走错棋后无法撤回 |
| 无计时器 | 当前对局无时间限制 | 不适合限时对弈场景 |
| AI 着法格式不依赖 JSON | 已修复：`extractMove()` 现在也接受原始中文记谱 | 不再需要 LLM 严格输出 JSON |
| Canvas 不可缩放 | 棋盘固定 720×720 | 小屏幕设备上可能显示不全 |
| 无开局库 | AI 不使用预定义开局 | 开局质量完全依赖 LLM 理解 |
| **第二步 AI 卡住** | AI 第二步仍返回第一步的着法（`炮二平五`） | 详见 PROBLEMS.md |

---

## 故障排查

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| AI 回合一直 loading | 后端未启动 / LLM 服务不可达 | 检查 `server/` 是否运行（`http://127.0.0.1:3001/api/health`）|
| "无法解析着法" | LLM 返回非 JSON 格式 | 已修复：`extractMove()` 现在也接受原始中文记谱 |
| 棋盘点击无响应 | Canvas 未正确初始化 | 检查浏览器控制台是否有 `zh-chess` 相关报错 |
| 棋局列表为空 | localStorage 被清除 | 刷新页面会自动创建新空局 |
| TypeScript 报错 | `zh-chess` 类型声明不完整 | `zhChessEngine.ts` 中有 `any` 声明，属已知妥协 |
| LLM 返回 401 | `llmProviders.json` 中 apiKey 未填或无效 | 检查后端配置文件中 apiKey 是否正确 |
| LLM 返回 404 | `baseUrl` 或 `apiPath` 配置错误 | 对照提供商文档检查 URL 路径 |
| 后端启动报错 ENOENT | `llmProviders.json` 路径不正确 | 确保从 `server/` 目录下启动服务 |

---

## 技术决策与约束

| 决策 | 选择 | 原因 |
|------|------|------|
| 渲染方式 | Canvas + zh-chess 内置绘制 | 快速上线，避免手写 SVG 棋盘 |
| 状态管理 | React useState + useRef | 中等复杂度，不需要 Redux |
| 持久化 | localStorage | 单用户场景，无需后端 |
| 后端框架 | Node.js + Express | 与前端 TypeScript 技术栈统一 |
| LLM 通信 | 前端 → 后端 → LLM | API Key 不暴露给前端，集中管理各提供商配置 |
| LLM 适配 | 统一 OpenAI 兼容格式 | 百炼/DashScope/DeepSeek 均支持此协议格式 |
| 局面协议 | PEN（中国象棋标准） | zh-chess 原生支持，LLM prompt 直接用 |
| AI 着法格式 | JSON `{"move": "..."}` | 简单可靠，易于解析和重试 |
| 类型安全 | TypeScript strict 模式 | 早期发现类型错误，zh-chess 缺少完整类型声明需手动补充 |
