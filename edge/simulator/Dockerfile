# 顧好 場館模擬器（雲端版）— 建置 context 為專案根目錄
#   docker build -f edge/simulator/Dockerfile -t gh-iot-simulator .
# 扮演一台在浮動 IP 後面的場館電腦：只主動連出到 Gateway，不接受 Gateway 連進來；
# 對外的 HTTP 只有模擬器網頁（CONSOLE_PASSWORD 保護）與 /healthz。
FROM node:20-alpine
RUN apk add --no-cache ffmpeg font-dejavu
WORKDIR /app
COPY packages/iot-contract packages/iot-contract
COPY services/iot-gateway/package.json services/iot-gateway/package-lock.json services/iot-gateway/
# 模擬器直接用 tsx 執行 TypeScript（含 embedded gateway 的相依），所以 dev 相依也要裝
RUN cd services/iot-gateway && npm ci --no-audit --no-fund
COPY services/iot-gateway/tsconfig.json services/iot-gateway/
COPY services/iot-gateway/src services/iot-gateway/src
COPY edge/simulator edge/simulator
ENV NODE_ENV=production PORT=8080 TSX_TSCONFIG_PATH=edge/simulator/tsconfig.json
USER node
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "services/iot-gateway/node_modules/tsx/dist/cli.mjs", "edge/simulator/src/cli.ts", "cloud"]
