# AISC Web Frontend

This is the React-based frontend of the AISC execution engine (step 4 of the AI Assessment
Sandbox Configurator). It provides a graphical interface for managing AI model evaluation
projects, installing and configuring plugins, running evaluations, and inspecting results.

## Architecture

The application is a single-page application (SPA) with a permanent left navigation drawer. It communicates with the AISC backend API (Django-based) via REST endpoints under `/api/v1/`. The API base URL is configured through the `VITE_API_URL` environment variable.

### Two deployment modes

`VITE_DEPLOYMENT` (set at container start from `APP_DEPLOYMENT`, read in `src/deployment.ts`):

- `standalone` (default): the engine on its own, with its own Keycloak login, its project
  wizard, the plugin package index on the Plugins page and the Tasks page.
- `configurator`: inside the Configurator. The gateway (oauth2-proxy) holds the session, the
  project is the one the launcher opened the engine on, every API call carries it in the
  `X-AISC-Project` header (`src/api/projectHeader.ts`, installed over fetch and axios at start),
  plugins are found in the hosted catalogue and installed into that project, and the Plugins
  page lists only the project's installed tests.

Any other value shows an error page (`src/DeploymentGate.tsx`).

## In the AISC stack

From the root of the [aisc](https://github.com/lux-ai-factory/aisc) repository, follow its
README (`./scripts/secrets.sh` once, then Docker Compose with
`docker-compose.plugin_downloader.yml`, `docker-compose-infra.development.yml` and
`docker-compose.development.yml`). This repo is built (production `Dockerfile`) into the
service **`aisc-webapp`**, with `APP_DEPLOYMENT: configurator`, and served through the gateway at
http://localhost/. The aisc repo's `docker-compose.engine-standalone.yml` runs it standalone on
http://localhost:8080.

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

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the AISC backend API |
| `VITE_DEPLOYMENT` | `standalone` or `configurator` (unset means standalone) |
| `VITE_LAUNCHER_URL` | The Configurator's launcher, where the project was chosen (configurator mode) |
| `VITE_CATALOG_URL` | Where the "Public Catalogue" button goes |
| `VITE_SHOW_PLUGIN_VISUALIZATION` | Boolean flag to enable/disable plugin visualization links |
| `VITE_SHOW_CELERY_TASKS` | Boolean flag to show the Celery tasks view |
| `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID` | Keycloak login (standalone mode) |
| `VITE_REPORT_URL` | Link to the report module (default `/report`) |

### Docker / Production Notes

In production, the application is served via Nginx inside a Docker container. All `VITE_XXX` placeholders in the built JavaScript files are replaced at container startup by the `env.sh` entrypoint script, which substitutes corresponding `APP_XXX` environment variables. The image sets `APP_DEPLOYMENT=standalone` unless the container is given another value.

## Docker

Two Dockerfiles are provided:

- **Dockerfile**: multi-stage build for production: builds with Node.js, serves with Nginx
- **Dockerfile.dev**: development-specific Docker build

## Changes on feat/unified-modules

`feat/unified-modules` is the branch the Configurator uses. Compared with `origin/master` it adds
the configurator mode and keeps standalone as on master (the list of files and reasons is
`scripts/guard-frozen-intended.txt` in the aisc repo):

- **Mode switch**: `src/deployment.ts`, `src/DeploymentGate.tsx`, `VITE_DEPLOYMENT` and
  `VITE_LAUNCHER_URL` in `.env`, `.env.development` and the new `.env.test`, and
  `APP_DEPLOYMENT` in the `Dockerfile`.
- **Project and session from the Configurator**: `src/platform/currentProject.ts`,
  `src/platform/gatewaySession.ts`, `src/api/projectHeader.ts`, `src/api/installProjectHeader.ts`,
  and the mode-dependent parts of `AuthContext.tsx`, `TopBar.tsx`, `LeftBar.tsx`, `MyApp.tsx` and
  `GlobalHome.tsx` (the Tasks page and the project wizard are standalone only).
- **Plugins from the catalogue**: `PluginInstallDialog.tsx` installs into the project you came
  from and records the catalogue entry (`src/pluginCatalogue/installUri.ts`); `Plugins.tsx` lists
  only the project's installed tests in configurator mode.
- **Open a test from the URL**: `src/pages/OpenPluginFromUrl.tsx` wraps the evaluation page, so
  `/projects/<name>/plugins/evaluation?plugin=<plugin name>` opens that test's card (the link from
  the launcher's step 4).
- **Tests** for each of these (`*.test.ts`, `*.test.tsx`), including a check that master's files
  the configurator no longer edits are unchanged.

## Related Repositories

This frontend is part of the [AISC](https://github.com/lux-ai-factory/aisc) monorepo, which also includes:

- **apps/backend**: Django REST API backend
- **apps/eval**: Celery worker for running evaluations
- **shared/plugin-interface**: plugin interface specification
- **shared/plugin-manager**: plugin discovery and loading library

## Contributing

We welcome community contributions! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) for details.

By submitting contributions, you agree to the contributor license agreement
([individuals](<AISC ICLA (Individuals).txt>), [entities](<AISC CCLA (Entities).txt>)) and license
your work under [Apache 2.0](LICENSE.md).

---

## License

This project is licensed under the [Apache License 2.0](LICENSE.md).
© 2024–2026 Université du Luxembourg and Luxembourg Institute of Science and Technology (LIST).
