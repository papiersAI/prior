# prior demo — single container: zero-dep Node server serving the built UI
# and replaying recorded runs (MOCK mode only; no keys, no live engine).
FROM node:22-slim
WORKDIR /app
COPY server/ server/
COPY ui/dist/ ui/dist/
COPY PRIOR.md ./
ENV MOCK=1
CMD ["node", "server/index.mjs"]
