# Plumtree Connect - production image
# Next.js 14 on Node 24. node:sqlite is built into Node, so there is no
# native module to compile.

FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------- dependencies ----------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---------- build ----------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The database is created at runtime; nothing here touches data/.
RUN npm run build

# ---------- runtime ----------
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/plumtree.db

# `next start` needs the Next runtime, React and the compiled output.
# `tsx` stays installed so `npm run seed` works inside the container.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src/lib ./src/lib
COPY --from=build /app/src/styles ./src/styles
COPY --from=build /app/tsconfig.json ./tsconfig.json

# The SQLite file lives here. Mount a volume on /app/data so data survives
# redeploys.
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000
CMD ["npm", "run", "start"]
