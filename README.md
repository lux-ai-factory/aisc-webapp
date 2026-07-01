# AISC Web Frontend

This is the React-based frontend for the AI Assessment Sandbox (AISC) platform. It provides a graphical interface for managing AI model evaluation projects, configuring plugins, running evaluations, and inspecting results.

## Architecture

The application is a single-page application (SPA) with a permanent left navigation drawer. It communicates with the AISC backend API (Django-based) via REST endpoints under `/api/v1/`. The API base URL is configured through the `VITE_API_URL` environment variable.

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

This starts Vite in development mode. It loads environment variables from `.env.development` by default.

### Build for production

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Environment Variables

Vite loads environment variables from `.env` files based on the current mode. See [Vite Env and Mode](https://vite.dev/guide/env-and-mode) for details.

Key variables:

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the AISC backend API |
| `VITE_SHOW_PLUGIN_VISUALIZATION` | Boolean flag to enable/disable plugin visualization links |

### Docker / Production Notes

In production, the application is served via Nginx inside a Docker container. All `VITE_XXX` placeholders in the built JavaScript files are replaced at container startup by the `env.sh` entrypoint script, which substitutes corresponding `APP_XXX` environment variables.

## Docker

Two Dockerfiles are provided:

- **Dockerfile** — Multi-stage build for production: builds with Node.js, serves with Nginx
- **Dockerfile.dev** — Development-specific Docker build

## Related Repositories

This frontend is part of the [AISC](https://github.com/lux-ai-factory/aisc) monorepo, which also includes:

- **apps/backend** — Django REST API backend
- **apps/eval** — Celery worker for running evaluations
- **shared/plugin-interface** — Plugin interface specification
- **shared/plugin-manager** — Plugin discovery and loading library

##  Contributing

We welcome community contributions! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) for details.

By submitting contributions, you agree to the [CLA](CLA/CLA_VERA.md) and license your work under [Apache 2.0](LICENSE).

---

##  License

This project is licensed under the [Apache License 2.0](LICENSE).  
© 2024–2026 Université du Luxembourg and Luxembourg Institute of Science and Technology (LIST). Originally developed within the SerVal Research Group and the Interdisciplinary Centre for Security, Reliability and Trust (SnT).

