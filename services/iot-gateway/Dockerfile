# 顧好 IoT Gateway — 建置 context 為專案根目錄（需要 packages/iot-contract）
#   docker build -f services/iot-gateway/Dockerfile -t gh-iot-gateway .
FROM node:20-alpine AS build
WORKDIR /app
COPY packages/iot-contract packages/iot-contract
COPY services/iot-gateway/package.json services/iot-gateway/package-lock.json services/iot-gateway/
RUN cd services/iot-gateway && npm ci --no-audit --no-fund
COPY services/iot-gateway services/iot-gateway
RUN cd services/iot-gateway && npm run build && npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app/services/iot-gateway/package.json ./
COPY --from=build /app/services/iot-gateway/node_modules ./node_modules
COPY --from=build /app/services/iot-gateway/dist ./dist
COPY --from=build /app/services/iot-gateway/migrations ./migrations
USER node
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "dist/index.js"]
