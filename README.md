# AISC Web Frontend

This is the React frontend of **the engine** of AISC (the AI Assessment Sandbox Configurator), served as the
compose service `aisc-webapp`. In step 4 (Collect evidence) the **Configure** and **Run** links of the Run tests
tiles open its pages: a test's saved settings, a run's set-up (what is assessed, helper models, datasets and
models, settings) and the results of past runs.

## Architecture

The application is a single-page application (SPA) with a permanent left navigation drawer. It calls the
engine's API (`aisc-backend`, Django) under `/api/v1/`; the API base URL is set by `VITE_API_URL`. For how the
engine fits in AISC, see `docs/architecture.md` ("Running tests") and `docs/appendices/4-collect-evidence.md`
("Run tests") in the aisc repository.

### Two deployment modes

`VITE_DEPLOYMENT` (set at container start from `APP_DEPLOYMENT`, read in `src/deployment.ts`):

- `standalone` (default): the engine on its own, with its own Keycloak login, its project
  wizard, the plugin package index on the Plugins page and the Tasks page.
- `configurator`: inside AISC. The gateway (oauth2-proxy) holds the session; the project is the one the
  launcher opened the engine on, and every API call names it in the `X-AISC-Project` header
  (`src/api/projectHeader.ts`, installed over fetch and axios at start). Tests are installed from the project's
  catalogue in step 3, and the Plugins page lists only the project's installed tests. The run form asks first
  for what is assessed (the system or a component of the AI card, or a local model file), and fills each helper
  model the test declares with one of the project's helper models (Manage > Helper models). A judge or other
  helper model is never a component of the system, so the AI System settings offer no LLM component type.

Any other value shows an error page (`src/DeploymentGate.tsx`).

## In the AISC stack

From the root of the [aisc](https://github.com/lux-ai-factory/aisc) repository, run
`uv run scripts/aisc.py start` (see that README). It makes the secrets, builds and starts the stack. This repo is
built (production `Dockerfile`) into the service **`aisc-webapp`**, with `APP_DEPLOYMENT: configurator`, and
served through the gateway at http://localhost/. The aisc repo's `docker-compose.engine-standalone.yml` runs it
standalone on http://localhost:8080.

## Development

### Prerequisites

- Node.js 22+
- npm

### Setup

```bash
npm install
```

### Run development server

```bash
npm run dev
```

This starts Vite in development mode. It loads environment variables from `.env.development` by default (standalone mode).

### Build for production

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Tests

```bash
npm test
```

Runs vitest (`vitest run`) with `.env.test`, in standalone mode; the tests of the configurator
mode set it themselves. No backend is needed.

## Environment Variables

Vite loads environment variables from `.env` files based on the current mode. See [Vite Env and Mode](https://vite.dev/guide/env-and-mode) for details.

Key variables:

| Variable | Description | In the AISC stack |
|---|---|---|
| `VITE_API_URL` | Base URL of the engine's API | `http://localhost` (`API_URL_EXTERNAL`) |
| `VITE_DEPLOYMENT` | `standalone` or `configurator` (unset means standalone) | `configurator` |
| `VITE_LAUNCHER_URL` | AISC's launcher, where the project was chosen and where Manage is (configurator mode) | `http://localhost:8100/` |
| `VITE_CATALOG_URL` | Where the "Public Catalogue" button goes | the public catalogue |
| `VITE_SHOW_PLUGIN_VISUALIZATION` | Boolean flag to show the plugin visualisation links | `true` |
| `VITE_SHOW_CELERY_TASKS` | Boolean flag to show the Celery tasks view (standalone mode only) | not set |
| `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID` | Keycloak login (standalone mode) | not used |

### Docker / Production Notes

In production, the application is served via Nginx inside a Docker container. All `VITE_XXX` placeholders in the built JavaScript files are replaced at container startup by the `env.sh` entrypoint script, which substitutes corresponding `APP_XXX` environment variables. The image sets `APP_DEPLOYMENT=standalone` unless the container is given another value.

## Docker

Two Dockerfiles are provided:

- **Dockerfile**: multi-stage build for production: builds with Node.js, serves with Nginx
- **Dockerfile.dev**: development-specific Docker build

## Changes on pilot

`pilot` is the branch AISC uses. Compared with `origin/master` it adds
the configurator mode and keeps standalone as on master (the list of files and reasons is
`scripts/guard-frozen-intended.txt` in the aisc repo):

- **Mode switch**: `src/deployment.ts`, `src/DeploymentGate.tsx`, `VITE_DEPLOYMENT` and
  `VITE_LAUNCHER_URL` in `.env`, `.env.development` and `.env.test`, and
  `APP_DEPLOYMENT` in the `Dockerfile`.
- **Project and session from AISC**: `src/platform/currentProject.ts`,
  `src/platform/gatewaySession.ts`, `src/api/projectHeader.ts`, `src/api/installProjectHeader.ts`,
  and the mode-dependent parts of `AuthContext.tsx`, `TopBar.tsx`, `LeftBar.tsx`, `MyApp.tsx` and
  `GlobalHome.tsx` (the Tasks page and the project wizard are standalone only). The engine's project
  is named after the platform's, free text, so its name is encoded wherever it goes into a URL (the
  route, and `/projects/by-name/` through `projectByNameUrl`); a name with `/` still cannot be opened,
  because the backend's route takes one path segment.
- **Tests from the catalogue**: `PluginInstallDialog.tsx` installs into the project you came
  from and records the catalogue entry (`src/pluginCatalogue/installUri.ts`); `Plugins.tsx` lists
  only the project's installed tests in configurator mode.
- **What is assessed and helper models**: `src/components/plugin/PluginEvaluationForm.tsx` asks for each helper
  model the test declares, among the project's helper models allowed that role (`src/api/projectHelpers.ts`,
  `GET /api/v1/projects/{pid}/helpers`), and the model name it runs; `AISystemSettings.tsx` offers no LLM
  component type in configurator mode.
- **Open a test from the URL**: `src/pages/OpenPluginFromUrl.tsx` wraps the evaluation page, so
  `/projects/<name>/plugins/evaluation?plugin=<plugin name>` opens that test's card (the link from
  the launcher's step 4).
- **Failed runs**: the results list shows Done and Failed runs, with a failed run's errors in words
  (`src/pages/evaluationOutcome.ts`).
- **No report links**, in both modes: the Completed Evaluations page has no Download Report button and no
  per-evaluation report icon, and there is no `VITE_REPORT_URL`. They went to `/report/generate`, which the AISC
  stack never serves; the AISC report is the report composer (`/report-composer`). This is the one change that
  also touches standalone (`src/pages/PluginEvaluations.tsx`).
- **Tests** for each of these (`*.test.ts`, `*.test.tsx`), including a check that master's files
  the configurator does not edit are unchanged.

## Related Repositories

This frontend is part of the [AISC](https://github.com/lux-ai-factory/aisc) monorepo, which also includes:

- **apps/backend**: the engine's Django API (`aisc-backend`)
- **apps/eval**: the Celery worker that installs and runs tests (`aisc-eval-worker`)
- **shared/plugin-interface**: the library every test plugin implements
- **shared/plugin-manager**: plugin discovery and loading library

## Contributing

We welcome community contributions. Please read our [CONTRIBUTING.md](CONTRIBUTING.md) for details.

By submitting contributions, you agree to the contributor license agreement
([individuals](<AISC ICLA (Individuals).txt>), [entities](<AISC CCLA (Entities).txt>)) and license
your work under [Apache 2.0](LICENSE.md).

---

## License

This project is licensed under the [Apache License 2.0](LICENSE.md).
© 2024–2026 Université du Luxembourg and Luxembourg Institute of Science and Technology (LIST).
