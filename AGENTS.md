# AGENTS.md — aisc-webapp

The **webapp layer**: the single product UI. It talks to the backend **HTTP API only**.

## Read first

The binding rules live in the parent repository, `lux-ai-factory/aisc`:
`ARCHITECTURE.md` (invariants I1–I11) and `docs/refactor-plan.md`.

## What binds this repo

- **I3 / I9** — product UI lives here and nowhere else; a domain is a *feature inside* the webapp,
  never a second frontend.

## Build and test

```bash
npm install
npm run lint
npm test          # vitest
npm run build
```

## Do not

- import backend Python or reach a database directly — use the backend API;
- add a frontend for a domain (I9).