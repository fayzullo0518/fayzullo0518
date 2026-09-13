# ---------- 1. build the browser bundle ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json ./
COPY client/package.json client/package-lock.json ./client/
RUN npm ci --prefix client --no-audit --no-fund

COPY client ./client
RUN npm --prefix client run build

# ---------- 2. runtime ----------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# the API's own dependencies only — no build tooling in the final image
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server --omit=dev --no-audit --no-fund

COPY server ./server
COPY package.json ./
COPY --from=build /app/client/dist ./client/dist

# the database and uploads live on a volume, outside the image
ENV DATA_DIR=/data
RUN mkdir -p /data && chown -R node:node /data /app

# never run the web process as root
USER node

EXPOSE 5175
ENV PORT=5175 HOST=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5175)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
