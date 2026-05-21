# Security Review: Latest Commit ae66d61 (Front-end Mobile)

## 1. Commit Summary
- Commit SHA: ae66d61e78798e2da6002a00204bc95867dff86f (and prior commits from 2026-05-20 to 2026-05-21)
- Author: yc <yc@aihehuo.com>, Cursor Agent <cursoragent@cursor.com>
- Date: 2026-05-20 to 2026-05-21
- Commit message: Multiple commits including "feat: add undo capability and key piece capture alert", "feat: implement LLM analysis export and import with board overlay", "feat: implement local chess engine with repetition detection", "feat: add production deployment script for web app", etc.
- High-level intent: Add local engine via Web Worker, introduce game session undo capabilities, export/import of LLM JSON annotations, replay controls with captured pieces, and an SSH-based deployment script.
- Actual changed scope: React component logic for game replay and undo, state modifications to local session store to support LLM analysis overlays, local chess engine math and worker code, and external deployment shell script.

## 2. Changed Files and Review Scope
| File | Change Type | Relevant Runtime Path | Security-Relevant? | Reason |
|---|---|---|---|---|
| `web/src/components/ReplayControls.tsx` | Modified | Local persistence via JSON import | Yes | Arbitrary user input is parsed as JSON and injected into the game state. |
| `web/src/components/ChessGame.tsx` | Modified | React Rendering | Yes | Renders the LLM analysis overlays directly from local session storage. |
| `web/deploy.sh` | Added | Deployment / Infrastructure | Yes | SSH and rsync commands to remote servers. |
| `web/src/utils/engine/*` | Added | Web Worker | Yes | Local engine parses FEN strings and processes game state in the background. |
| `web/src/hooks/useChessGame.ts` | Modified | State Mutation | Yes | Handles `undoMove` and race conditions with AI. |

## 3. Executive Summary
- Overall risk level: Low
- Critical findings: 0
- High findings: 0
- Medium findings: 1
- Low findings: 1
- Info findings: 1

The recent batch of commits introduces local execution logic (local engine via Web Worker) and interaction with LLM analysis tools through JSON export/import. The primary risks involve how external JSON data is validated before being persisted into local session storage and how the deployment shell script configures system access. There are no secrets exposed and no insecure deep links or native bridge issues identified.

## 4. Findings

### Finding 1: Persistent Client-Side Denial of Service via Malformed LLM Analysis JSON Import
- Severity: Medium
- Category: Accidental data modification (client-side)
- File: `web/src/components/ReplayControls.tsx`, `web/src/components/ChessGame.tsx`
- Component/Module/Bridge: ReplayControls / ChessGame React View
- What changed: Commit `656799d81b592e0798ed6146c834f27519acffe9` added the ability to paste LLM JSON analysis into a text area, which is parsed and saved to local storage via `patchActiveSession`.
- Risk: The JSON validation merely checks if `parsed.annotations` and `parsed.summary` are truthy (`if (parsed.annotations && parsed.summary)`). If a user provides an object instead of an array for `annotations` (e.g., `{"annotations": {}, "summary": {}}`), it passes the validation check and is persisted to local storage. 
- Runtime mechanism: During the React render loop in `ChessGame.tsx`, the code calls `activeSession.llmAnalysis.annotations.find(...)`. If `annotations` is not an array, this throws a `TypeError`.
- Plausible failure or attack path: A user could accidentally paste malformed JSON from an LLM, or an attacker could share a malicious "analysis snippet" with a user. Upon importing, the malformed JSON is saved to `localStorage`. The unhandled `TypeError` breaks the React render tree, causing the app to crash (White Screen of Death) when attempting to view this session. This leads to a persistent client-side Denial of Service until the user manually clears their browser's local storage or application data.
- Recommended minimal fix: Improve validation in `ReplayControls.tsx` before calling `onImportAnalysis`: `if (parsed.annotations && Array.isArray(parsed.annotations) && parsed.summary)`. Consider wrapping the LLM analysis rendering in `ChessGame.tsx` in a `try/catch` or an Error Boundary.
- Suggested test or verification: Paste `{"annotations": "not an array", "summary": "test"}` into the import field and attempt to save. Verify the app rejects the input instead of crashing.
- Confidence: High

### Finding 2: Deployment Script Uses Root SSH Access
- Severity: Low
- Category: Supply chain / deps / Infrastructure
- File: `web/deploy.sh`
- Component/Module/Bridge: Deployment script
- What changed: Commit `fc4db2d319c6df8760887a2c29fd2dea2873f02c` introduced `deploy.sh`.
- Risk: The script hardcodes `ssh root@$host` and `rsync -azv $APPNAME root@$host:$REMOTE_DIR`.
- Runtime mechanism: Execution on the developer's local machine or CI/CD runner.
- Plausible failure or attack path: While typical for small projects, deploying as the `root` user violates the principle of least privilege. If the developer's environment or deployment pipeline is compromised, the attacker can leverage the SSH keys to gain direct `root` access to the production server.
- Recommended minimal fix: Create a restricted user (e.g., `deploy`) on the target server with permissions limited to `/mnt/app/linkaccel`, and change the SSH user in `deploy.sh` from `root` to this restricted user.
- Suggested test or verification: Verify deployment succeeds using a non-root user.
- Confidence: High

### Finding 3: Safe handling of AI race conditions during Undo (Info)
- Severity: Info
- Category: Accidental data modification (client-side)
- File: `web/src/hooks/useChessGame.ts`
- Component/Module/Bridge: useChessGame Hook
- What changed: Commit `ae66d61e78798e2da6002a00204bc95867dff86f` added `undoMove`.
- Risk: N/A
- Runtime mechanism: When the player attempts to undo a move, the hook checks `if (aiThinking)` and aborts the undo action.
- Plausible failure or attack path: N/A. This is a positive finding. It prevents a race condition where the local state is rewound while the web worker or server API is simultaneously processing a move, which could result in a corrupted local chess board state upon the AI returning a move.
- Recommended minimal fix: None required.
- Suggested test or verification: N/A
- Confidence: High

## 5. Client Data Deletion / Modification Checklist (Mobile)
| Check | Result | Notes |
|---|---|---|
| Destructive local reset / wipe risk | Pass | Undo functionality is controlled safely. |
| Risky local migrations / schema changes | Fail | LLM JSON import writes loosely validated data to `localStorage`. |
| Broad cache/state update risk | Pass | Local engine cleanly separates current state via `Board.fromFen()`. |
| Background task side effects | Pass | Web worker terminates gracefully on errors without mutating shared state. |
| Chat/message DB integrity risk | N/A | No chat functionality. |
| Missing guards / race risk | Pass | `aiThinking` guards against concurrent state mutations during AI turns. |
| Reversibility / recovery concern | Pass | Explicit `undoMove` properly implemented. |

## 6. External Attack Surface Checklist (Mobile)
| Check | Result | Notes |
|---|---|---|
| Secrets in repo / shipped configs | Pass | No API keys or secrets checked into the frontend codebase. |
| Secure storage for tokens/PII | Pass | Local storage is used safely without exposing sensitive PII. |
| TLS / ATS / cleartext / pinning | Pass | Relying on previous configurations. |
| Deep links / URL handling | N/A | No new URL routing handlers. |
| WebView & JS bridge risks | Pass | React escapes outputs mitigating basic XSS; no native bridges added. |
| Native module exposure & validation | N/A | Not applicable for this React setup. |
| Logging/analytics PII leakage | Pass | Local engine logging only outputs board state and depth metrics. |
| Third-party SDK init & permissions | Pass | No risky new third-party SDKs introduced. |
| Debug/Flipper/dev-only code in release | Pass | Dev dependencies correctly managed. |
| Dependency/supply-chain touchpoints | Warning| `deploy.sh` accesses server as `root` user via SSH. |

## 7. Recommended Next Actions
1. **Fix JSON Import Validation:** Modify `handleImportSubmit` in `web/src/components/ReplayControls.tsx` to strictly check `Array.isArray(parsed.annotations)` before accepting and persisting the payload to avoid rendering crashes.
2. **Apply Error Boundaries:** Implement an Error Boundary component around the `ChessGame` renderer to ensure that single malformed game sessions do not result in application-wide White Screens of Death.
3. **Restrict Deployment User Privileges:** Update `web/deploy.sh` to use an unprivileged system user instead of `root`.