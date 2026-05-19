```markdown
# chinese-chess Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the core development patterns and conventions used in the `chinese-chess` TypeScript codebase. You'll learn about file naming, import/export styles, commit message conventions, and how to write and run tests. This guide is designed to help new contributors quickly adopt the project's standards and workflows.

## Coding Conventions

### File Naming
- **PascalCase** is used for file names.
  - Example: `ChessBoard.ts`, `GameLogic.ts`

### Import Style
- **Relative imports** are used throughout the codebase.
  - Example:
    ```typescript
    import { ChessPiece } from './ChessPiece';
    ```

### Export Style
- **Named exports** are preferred.
  - Example:
    ```typescript
    export function movePiece() { ... }
    export const BOARD_SIZE = 9;
    ```

### Commit Messages
- **Conventional commit** style is followed.
- Prefixes include `docs` and `feat`.
  - Example:
    ```
    feat: add move validation for horse piece
    docs: update README with setup instructions
    ```
- Average commit message length: ~53 characters.

## Workflows

### Commit Workflow
**Trigger:** When making any code or documentation changes  
**Command:** `/commit`

1. Write your code or documentation changes.
2. Stage your changes with `git add`.
3. Use a conventional commit message with a prefix (`feat`, `docs`, etc.).
   - Example: `git commit -m "feat: implement checkmate detection"`
4. Push your changes to the repository.

### Testing Workflow
**Trigger:** When adding new features or making changes to existing code  
**Command:** `/test`

1. Write or update test files following the `*.test.*` pattern.
   - Example: `ChessBoard.test.ts`
2. Use the project's (unspecified) test runner to execute tests.
   - Example (if using Jest): `npx jest`
3. Ensure all tests pass before committing.

## Testing Patterns

- Test files use the `*.test.*` naming convention.
  - Example: `MoveGenerator.test.ts`
- The specific testing framework is not detected; check the project for details.
- Tests should cover new features and bug fixes.

## Commands
| Command   | Purpose                                      |
|-----------|----------------------------------------------|
| /commit   | Guide for making conventional commits        |
| /test     | Steps for writing and running tests          |
```
