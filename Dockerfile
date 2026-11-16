# Production Dockerfile for VERA webapp

# Build Stage
# Uses Node.js to create an optimized production build
FROM node:22.23.3-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve Stage
# Uses Nginx to serve the static files efficiently, as its unprivileged user; it keeps port 80, which Docker lets
# any user of a container bind
FROM nginxinc/nginx-unprivileged:1.30.6-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03

# Configure Nginx
COPY nginx-default.conf /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app /app

# Deployment mode (AISC_DEPLOYMENT): standalone unless the container is told
# otherwise (the Configurator sets APP_DEPLOYMENT=configurator); env.sh writes it
# into the bundle at start.
ENV APP_DEPLOYMENT=standalone

# Setup environment variable injection script; it rewrites the bundle at start, so nginx's user owns it
USER root
COPY env.sh /docker-entrypoint.d/env.sh
RUN chmod +x /docker-entrypoint.d/env.sh && chown -R nginx /usr/share/nginx/html
USER nginx

# Expose HTTP port
EXPOSE 80

# Start Nginx in foreground mode
CMD ["nginx", "-g", "daemon off;"]
