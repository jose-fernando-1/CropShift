# Cropshift landing page: production image (Next.js standalone server, one static page).
# NEXT_PUBLIC_DEMO_URL is where the "Open the demo" buttons point; it is baked in at build time
# (default /demo, the web app's path behind deployment/'s nginx).

FROM node:22.21-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22.21-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_DEMO_URL=/demo
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_DEMO_URL=$NEXT_PUBLIC_DEMO_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22.21-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ > /dev/null || exit 1
CMD ["node", "server.js"]
