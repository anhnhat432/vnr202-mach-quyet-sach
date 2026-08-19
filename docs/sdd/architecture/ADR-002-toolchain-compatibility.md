# ADR-002: Phase 1 TypeScript and Test DOM Compatibility

Status: Accepted for Phase 1
Date: 2026-08-19

## Context

The approved Phase 1 plan named TypeScript 7.0.2 and jsdom 30.0.1. At implementation time, `eslint-config-next@16.3.1` depends on `typescript-eslint@8.67.0`, which rejects TypeScript 7, while jsdom 30.0.1 requires Node 22.22.2 or newer. The project runtime is pinned to Node 22.14.0.

## Decision

- Use TypeScript 6.0.3 until the Next.js lint toolchain supports TypeScript 7.
- Use jsdom 29.0.0 because it supports Node 22.14.0.
- Keep Next.js 16.3.1, React 19.2.8, Node 22.14.0 and all Core contracts unchanged.

## Consequences

- Lint, typecheck, tests and builds can run without unsupported-engine or unsupported-parser failures.
- Revisit the two dev dependencies after `typescript-eslint` supports TypeScript 7 or the project raises its Node floor.
- This ADR changes development tooling only and does not change runtime behavior, data contracts or security rules.
