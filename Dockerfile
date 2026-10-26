FROM node:24-slim AS build
WORKDIR /app
# The web build doesn't need Electron's desktop binary.
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim
WORKDIR /app
# Chromium for the browser tool; Noto fonts so Tamil renders in screenshots and posters.
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-noto-core && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=8080 PAALAM_CHROME_PATH=/usr/bin/chromium ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
COPY plugins ./plugins
COPY knowledge ./knowledge
COPY mission.json ./
COPY tsconfig.json ./
EXPOSE 8080
CMD ["npx", "tsx", "server/index.ts"]
