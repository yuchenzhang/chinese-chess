# Frontend Security Review

**Date:** May 19, 2026  
**Target:** `chinese-chess` Frontend / Web Client  
**Commits Reviewed:** Latest refactors including `d675141f` (integration with python xiangqi-engine) and `1c6c152e` (unify coordinate system & store settings).

## Executive Summary
A targeted security review of the frontend codebase has been performed. The application primarily serves as a React/Vite-based client connecting to a backend engine. The recent architectural shift has significantly improved the security posture by migrating sensitive configurations out of the client. 

## 1. Secrets & Transport
- **Secrets Management:** In previous iterations, there might have been a risk of handling LLM API keys in the client. The latest commits explicitly resolved this. `web/src/storage/llmKeyStore.ts` now contains only stub functions, and comments explicitly state: *"API keys are now stored server-side... The frontend no longer holds API keys."* This is a strong security improvement.
- **Transport Security:** Transport logic in `web/src/llm/apiClient.ts` retrieves the backend URL from local storage (`web/src/storage/llmConnectionStore.ts`), which defaults to `http://127.0.0.1:8000`. 
  - **Risk:** By default, it allows plaintext HTTP. This is acceptable for local development but poses a risk (Man-in-the-Middle) if deployed over a network. 
  - **Recommendation:** If this application is ever hosted in production, ensure that HTTPS is enforced or at least configure the backend connection to default to a secure protocol (`https://`).

## 2. Client Storage
- **`localStorage` Usage:** The application utilizes `localStorage` for game sessions (`sessionStore.ts`), connection configurations (`llmConnectionStore.ts`), and user settings (`llmSettingsStore.ts`).
- **Data Sensitivity:** The stored data contains no Personally Identifiable Information (PII) or sensitive tokens. It merely stores FEN strings, move history, local preferences, and local connection URIs.
- **Data Integrity / XSS:** All data fetched from `localStorage` is passed through `JSON.parse` with basic fallback mechanisms if parsing fails or schemas differ. The risk of DOM-based XSS through manipulated `localStorage` inputs (e.g. `session.title`) is mitigated by the React framework, which natively escapes string interpolation. No instances of `dangerouslySetInnerHTML` were found in the `src/` directory.

## 3. Dependency & Supply-Chain Touchpoints
- **Dependencies (`web/package.json`):** Standard ecosystem tools are used (`react`, `vite`, `typescript`). The only external domain-specific dependency is `zh-chess` (v2.1.1).
- **Risk:** Client-side dependency hijacking is a perennial risk. While standard tools are heavily scrutinized, `zh-chess` represents a more niche package.
- **Recommendation:** Establish a continuous dependency monitoring process (e.g., `npm audit` inside CI/CD) to monitor the `zh-chess` dependency for any newly discovered vulnerabilities. Ensure package-lock.json is consistently audited.

## 4. Deep Links, Native Bridges, & WebViews
- The application currently operates as a standard SPA (Single Page Application) built with React.
- There are no explicit deep-linking handlers (`intent://` or Universal Links) or Native Bridge definitions (`window.webkit.messageHandlers` / `window.Android`) present in the source.
- If wrapped in a WebView (e.g., Cordova, React Native WebView) in the future, standard Origin bounds and CSP (Content Security Policy) rules must be explicitly added to `index.html`.

## Conclusion
The frontend currently maintains a healthy security posture for its operating context. The removal of API key handling from the client is the most significant security enhancement in the recent updates.

**Overall Rating:** Low Risk.