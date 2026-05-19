# 问题记录 — 中国象棋对弈平台

> 2026-05-19

---

## P1 — AI 第二步仍返回第一步的着法（炮二平五）

### 现象

用户走完第二步后，AI 仍然返回 `炮二平五`（与第一步相同），但该着法在第二步的局面下是非法的。前端显示"着法不合法"错误，游戏卡住。

### 根因分析

通过服务器日志确认：

```
[API DEBUG] incoming request: {
  positionPen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/6P2/P1P1P3P/1C5C1/9/RNBAKABNR b',
  moveSide: 'BLACK',
  ...
}
[API] 增强提示: 棋盘视觉 + 44 个合法着法 (side: BLACK)
[LLM] ← {"move":"炮二平五"}
[API] 着法验证通过: "炮二平五" → 砲二平五

[API DEBUG] incoming request: {
  positionPen: 'rnbakabnr/9/1c2c4/p1p1p1p1p/9/6P2/P1P1P3P/1C5C1/9/RNBAKABNR w',
  moveSide: 'BLACK',
  ...
}
[API] 增强提示: 棋盘视觉 + 35 个合法着法 (side: BLACK)
[LLM] ← {"move":"炮二平五"}
[API] LLM 返回非法着法: "炮二平五"，不在 35 个合法着法中
```

关键发现：
1. **第一次请求**：`positionPen` 以 `b` 结尾（黑方走棋），LLM 返回 `炮二平五`，验证通过
2. **第二次请求**：`positionPen` 以 `w` 结尾（红方走棋），但 `moveSide` 是 `BLACK`
   - PEN 中的回合标记与实际走棋方不一致
   - 后端使用 `getLegalMovesFromPen(pen, sideToMove)` 计算合法着法
   - 如果 PEN 的 turn 标记是 `w`（红方），但传入了 `BLACK`，`getLegalMovesFromPen` 可能会计算出错误的合法着法列表
3. LLM 仍然返回 `炮二平五` — 这说明 LLM 被 prompt 中的历史记录误导了（历史记录里第一条就是红方炮二平五）

### 可能原因

1. **`positionPen` 的回合标记错误**：前端 `onMove` 回调中 `game.getCurrentPenCode(nextTurn)` 生成的 PEN 可能包含了错误的回合标记
2. **`getLegalMovesFromPen` 依赖 PEN 的 turn 标记**：即使传入了正确的 `side` 参数，内部可能仍使用 PEN 中的 turn 字母来计算合法着法
3. **LLM 被历史记录误导**：prompt 中的走子历史包含了 `炮二平五`，LLM 可能直接复制了历史着法

### 已尝试的修复

- ✅ **字符标准化**：在后端 `toMoveStr` 中强制映射 `炮 -> 砲` 等繁简体字符，适配 `zh-chess` 引擎。
- ✅ **坐标系统一**：发现 `zh-chess` 引擎要求黑方也使用红方视角的 1-9 路编号。已统一前后端及提示词中的记谱逻辑。
- ✅ **UI 调试增强**：在前端展示大模型原始回复内容，直观排查解析失败。
- ✅ **手动重试按钮**：允许用户在 AI 卡住时手动触发走子。

### 下一步

1. **观察 AI 逻辑稳定性**：在统一坐标系后，观察 LLM 是否能准确理解视觉棋盘并选出合法着法。
2. **长历史干扰**：目前的走子记录可能仍会误导 LLM（尤其是它可能分不清历史中哪一步是谁走的），考虑在 prompt 中对历史记录做更明确的角色标注。

---

## P2 — 无法安装 Playwright MCP Bridge

### 现象

尝试使用 Playwright MCP 进行浏览器自动化测试时失败：

```
Error: Extension connection timeout. Make sure the "Playwright MCP Bridge" extension is installed.
```

### 已尝试的方法

1. `npm install -D @playwright/test` — 安装成功，但 MCP 连接仍然失败
2. `npm install -D @playwright/browser-mcp` — 包不存在（404）
3. 尝试 npx 安装 — 无可用方案

### 原因

Playwright MCP Bridge 是一个浏览器扩展，需要在浏览器中手动安装和启用。当前环境中该扩展未安装。

### 影响

无法通过 Claude Code 直接操控浏览器进行端到端测试，需要人工在浏览器中操作并反馈结果。

### 临时方案

- 通过 `curl` / `node fetch` 直接调用后端 API 进行测试
- 人工在浏览器中操作前端，观察行为

---

## P3 — 前端第二步发送的 positionPen 可能不正确

### 现象

服务器日志显示第二次请求的 `positionPen` 以 `w` 结尾（红方走棋），但 `moveSide` 是 `BLACK`。这表示 PEN 中的回合标记与实际走棋方不一致。

### 相关代码

- `web/src/hooks/useChessGame.ts:402` — `positionPen: game.getCurrentPenCode(nextTurn)`
- `web/src/utils/zhChessEngine.ts:13-15` — `getEngineTurn(game)` 读取 `currentSide`

### 调查方向

1. 在 `onMove` 回调中添加 debug log，对比：
   - `penCode`（回调参数，zh-chess 自带）
   - `game.getCurrentPenCode(nextTurn)`（手动调用）
   - `game.getCurrentPenCode(mover)`（用走棋方调用）
2. 确认 `getCurrentPenCode` 的 `side` 参数含义
