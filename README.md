# A4S Web

## About enviornment variables

By default, vite as a system to manage environment variables.

Environment variables are defined in `.env` files, which are loaded based on the mode you are running.
The default mode is `development`, so the `.env.development` file will be loaded when running `npm run dev`.
The default mode when building is `production`, so the `.env.production` file will be loaded when running `npm run build`.

Read more here: https://vite.dev/guide/env-and-mode.

Because we only run whitin docker, in production mode, all variables in the `.env.production` file are place holders where `VITE_XXX` is replaced with `APP_XXX` for the `npm run build` command.

When you start the docker container the entrypoint script `env.sh` will replace the `APP_XXX` variables with the values from the environment variables set in the docker container.

Please do not change the name of the `.env.XXX` files as this will break autodiscovery of the environment variables.
