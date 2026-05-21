# 中国象棋对弈与训练系统

面向 Web 的中国象棋对弈与训练平台，集成 AI 决策引擎与 LLM 教练。

## 核心特性

- **对弈引擎**：内置基于 Alpha-Beta 剪枝与启发式评估的本地 JS 引擎，支持多级难度（2-4层搜索）。
- **AI 教练 (Coaching)**：集成 LLM（如 Gemini/DeepSeek），提供开局指导、着法分析、关键子力损失预警及复盘建议。
- **动态复盘**：支持完整的走子记录回放，可在历史任意节点查看局面或导入 AI 分析。
- **交互引导**：内置交互式操作演示（Guide Tour），帮助新用户快速上手。
- **棋局管理**：支持多会话切换，自动保存对局状态。

## 路线图

| 阶段 | 目标 | 状态 |
|------|------|------|
| **Phase 1** | Web UI：棋盘、本地双人对弈、走子记录、PEN 局面导出、棋局管理 | 已完成 |
| **Phase 2** | 接入大模型：人机对弈、AI 着法解析、LLM 配置与测试 | 已完成 |
| **Phase 3** | 成长与训练：AI 场景化指导、关键子力预警、历史对局分析 | 已完成 |
| **Phase 4** | 增强与优化：悔棋、回放演示、部署优化、多语言 | 进行中 |

## 技术栈

- **前端**：Vite + React + TypeScript
- **规则引擎**：[zh-chess](https://github.com/kongyijilafumi/zh-chess)（走子校验、局面解析）
- **AI/LLM**：本地 Web Worker 引擎 + OpenAI 兼容接口（API 转发）

## 本地开发

```bash
cd web
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`。

## 仓库

[https://github.com/yuchenzhang/chinese-chess](https://github.com/yuchenzhang/chinese-chess)

## License

MIT
