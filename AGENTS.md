# AGENTS.md

## Cursor Cloud specific instructions

### Architecture (current state)

This repo contains only a **frontend** (`web/` — Vite + React 18 + TypeScript). The Node.js/Express backend (`server/`) was removed; the frontend now communicates with an external **Python xiangqi engine** at `http://127.0.0.1:8000` (configurable in the UI's backend URL setting).

- **Frontend dev server**: `cd web && npm run dev` → http://localhost:5173
- **Local two-player mode** works without any backend (human vs human on the same board).
- **AI mode** requires the external Python engine (not included in this repo) to serve `POST /api/move/best` and `GET /api/health`.

### Running the frontend

```bash
cd web
npm run dev   # Vite HMR dev server at http://localhost:5173
```

### Known issues (pre-existing)

1. **ESLint fails** — `eslint-plugin-react-hooks@5.2.0` removed the `configs.flat.recommended` export used in `eslint.config.js`. Lint currently errors with `TypeError: Cannot read properties of undefined (reading 'recommended')`.
2. **TypeScript build (`npm run build`) fails** — Two pre-existing errors in `src/hooks/useChessGame.ts`:
   - Unused import `loadLlmSettings` (line 10)
   - `Property 'message' does not exist on type 'UpdateResult'` (line 191)
   
   The Vite dev server is unaffected because it uses esbuild for transpilation without full type-checking.

### Testing

- **E2E tests** (Playwright) exist in `web/tests/ui/` but require both the Vite dev server and the Python engine backend to be running.
- No unit test framework is configured for the frontend.
- Since `npm run build` has pre-existing TS errors, use `npm run dev` for day-to-day development and manual browser testing.

### Important notes

- The `zh-chess` library renders a Canvas-based chessboard (720×720). Manual testing requires opening the browser at localhost:5173.
- All game state is persisted in browser `localStorage` — no database needed.
- The backend URL defaults to `http://127.0.0.1:8000` and is stored in `localStorage` under key `chinese-chess:llm-connection:v2`.
