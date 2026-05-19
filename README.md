# 中国象棋对弈与训练系统

面向 Web 的中国象棋对弈与训练平台，分阶段建设。

## 路线图

| 阶段 | 目标 | 状态 |
|------|------|------|
| **Phase 1** | Web UI：棋盘、本地双人对弈、走子记录、PEN 局面导出、棋局管理、执子方选择 | 已完成 |
| **Phase 2** | 接入大模型：人机对弈、AI 着法解析与重试、LLM 提供商配置与 Ping 测试 | 已完成 |
| **Phase 3** | 成长与训练：基于大模型的复盘、习题与水平评估 | 待开始 |
| **Phase 4** | 增强与优化：悔棋/回放、导出、多语言支持 | 规划中 |

## 技术栈

- **前端**：Vite + React + TypeScript（`web/`）
- **规则引擎**：[zh-chess](https://github.com/kongyijilafumi/zh-chess)（走子校验、将军/绝杀、PEN 记谱）

详见 `PLAN.md` 了解完整架构设计与实现进度。

## 本地开发

在项目根目录 `chinese-chess/` 下：

```bash
cd web
npm install
npm run dev
```

若从 `hobby` 工作区进入，路径为 `hobby/chinese-chess/web`。

浏览器打开终端提示的地址（默认 `http://localhost:5173`）。

## 仓库

https://github.com/yuchenzhang/chinese-chess

## License

MIT
