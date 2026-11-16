# Cropshift web: production image (Next.js standalone server).
# API_MODE / API_ORIGIN / API_TIMEOUT_MS / SHOW_DATA_FLOW are read at runtime, so one image
# serves both the mock API and the live proxy to FastAPI.

FROM node:22.21-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22.21-alpine AS build
WORKDIR /app
# Optional URL prefix baked into the build (Next.js basePath), e.g. /demo behind deployment/'s nginx.
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22.21-alpine AS runner
WORKDIR /app
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NODE_ENV=production \
    BASE_PATH=$NEXT_PUBLIC_BASE_PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    API_MODE=mock
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
# Liveness of the web process itself (a static page), independent of the backend.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:3000${BASE_PATH:-/}" > /dev/null || exit 1
CMD ["node", "server.js"]
