# 中国象棋对弈与训练系统

面向 Web 的中国象棋对弈与训练平台，分阶段建设。

## 路线图

| 阶段 | 目标 | 状态 |
|------|------|------|
| **Phase 1** | Web UI：棋盘、本地双人对弈、走子记录与 PEN 局面导出 | 进行中 |
| **Phase 2** | 接入大模型：单用户与 AI 对弈（局面以 PEN/FEN 协议交换） | 待开始 |
| **Phase 3** | 成长与训练：基于大模型的复盘、习题与水平评估 | 待开始 |

## 技术栈

- **前端**：Vite + React + TypeScript（`web/`）
- **规则引擎**：[zh-chess](https://github.com/kongyijilafumi/zh-chess)（走子校验、将军/绝杀、PEN 记谱）

后续 Phase 2 计划在 `server/` 增加 API，统一局面序列化格式，供前端与 LLM 共用。

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
