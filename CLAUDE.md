# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

中国象棋对弈与训练平台 — A Chinese chess (xiangqi) web app with AI opponent via LLM.

**Architecture**: Frontend (Vite + React + TypeScript) + Backend (Express + TypeScript). The frontend never directly calls LLM APIs — all AI requests go through the backend proxy.

```
chinese-chess/
├── web/                          # Frontend (Vite + React 18 + TS)
│   └── src/
│       ├── components/           # ChessGame (main page), SessionList, LlmSettings
│       ├── hooks/                # useChessGame (core game logic + AI turns), useLlmSettings
│       ├── llm/                  # Frontend LLM layer → calls backend API (not direct LLM)
│       ├── storage/              # localStorage: sessions, settings, connections
│       ├── config/               # LLM provider registry (frontend side)
│       ├── types/                # GameSession, MoveRecord
│       └── utils/                # zh-chess type declarations, PEN helpers, side utilities
│
└── server/                       # Backend (Express 4 + TS + tsx)
    └── src/
        ├── config/               # llmProviders.json (providers/models/apiKeys), loader
        ├── routes/               # ai.ts: POST /api/ai/move, POST /api/ai/ping, GET /api/ai/providers
        ├── llm/                  # client.ts (unified LLM call), pingTest.ts
        ├── reporter/             # htmlReporter.ts (test report generator)
        ├── app.ts                # Express app factory (imported by tests)
        └── index.ts              # Entry point (imports app.ts, calls .listen())
```

**Data flow for AI moves**: Frontend Canvas click → zh-chess validates → frontend constructs messages (PEN + history) → `POST http://127.0.0.1:3001/api/ai/move` → backend reads llmProviders.json for baseUrl + apiKey → calls LLM → parses `{"move": "..."}` → returns to frontend → frontend executes move on board.

## Commands

### Frontend (web/)

```bash
cd web
npm install          # Install dependencies
npm run dev          # Dev server at http://localhost:5173
npm run build        # TypeScript + Vite production build → dist/
npm run lint         # ESLint check
npm run preview      # Preview built dist/
```

### Backend (server/)

```bash
cd server
npm install          # Install dependencies
npm run dev          # Dev server with hot reload at http://127.0.0.1:3001
npm run build        # TypeScript compile → dist/
npm run start        # Production: node --env-file=.env dist/index.js
npm test             # Run all tests (vitest) → also generates test-report.html
npm run test:watch   # Watch mode
```

### Tests

```bash
cd server
npm test             # All tests
npx vitest run -t "pings bailian"    # Run a single test by name
npx vitest run routes/ai.test.ts     # Run a single test file
```

Test files: `server/src/llm/pingTest.test.ts` (config + LLM connectivity), `server/src/routes/ai.test.ts` (HTTP endpoints).

## LLM Provider Configuration

`server/src/config/llmProviders.json` defines providers (bailian, dashscope, deepseek) with baseUrl, apiKey (referenced as `$ENV_VAR`), models, and apiPath. API keys are loaded from `server/.env` via Node.js `--env-file` flag. The loader in `llmProviderLoader.ts` resolves `$VAR` references from `process.env`.

**Currently registered providers**:
- **百炼 Coding Plan** (`bailian`) — `https://coding.dashscope.aliyuncs.com/v1` — models: qwen3.6-plus, qwen3.5-plus, etc.
- **千问 DashScope** (`dashscope`) — `https://dashscope.aliyuncs.com/compatible-mode/v1` — models: qwen-plus, qwen-turbo, qwen-max
- **DeepSeek** (`deepseek`) — `https://api.deepseek.com/v1` — models: deepseek-v4-flash, deepseek-v4-pro

## Key Technical Details

- **Chess engine**: `zh-chess@2.1.1` provides move validation, check/checkmate detection, PEN notation, and Canvas rendering
- **AI move format**: LLM must return `{"move": "着法"}` JSON (e.g. `{"move": "炮二平五"}`)
- **SSE/JSON parsing**: The LLM client handles both SSE streaming and plain JSON responses from all providers
- **Retry logic**: Frontend retries AI moves up to 3 times, feeding back the previous error to the prompt
- **Test report**: Running `npm test` generates `server/test-report.html` — an HTML page with test results, descriptions, and module summary
- **Frontend still uses direct LLM calls**: The current frontend `web/src/llm/client.ts` calls LLMs directly. Phase 2.5 migration to use the backend API is pending (see PLAN.md).

## Important Conventions

- TypeScript strict mode in both web/ and server/
- Server uses ESM (`"type": "module"` in package.json)
- `zh-chess` has incomplete type declarations — manual `any` types in `web/src/utils/zhChessEngine.ts` are intentional
- `server/src/app.ts` exports the Express app without calling `.listen()` so tests can create isolated servers
- `.env` files are gitignored — never commit API keys
- PLAN.md is the authoritative document for architecture, progress, and future phases
