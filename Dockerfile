# ───── 阶段 1：构建 dist/（build.py 仅用 Python 标准库，无第三方依赖） ─────
FROM python:3.12-alpine AS build
WORKDIR /app
COPY . .
RUN python scripts/build.py

# ───── 阶段 2：运行（server.js 仅用 Node 内置模块，无 npm install） ─────
FROM node:20-alpine
ENV NODE_ENV=production \
    PORT=3009 \
    HOST=0.0.0.0 \
    TEMPLATES_DIR=/data/templates
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY scripts/server.js scripts/template-store.js ./scripts/
# 内置模板作为种子；首次启动若持久卷为空则拷入，之后完全以卷中内容为准
COPY templates ./templates-seed
EXPOSE 3009
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:3009/templates/index.json >/dev/null || exit 1
# 用 sh -c 内联种子逻辑，避免单独的 entrypoint 脚本在 Windows 下产生 CRLF 问题
CMD ["sh", "-c", "mkdir -p \"$TEMPLATES_DIR\"; if [ -z \"$(ls -A \"$TEMPLATES_DIR\" 2>/dev/null)\" ]; then cp -r /app/templates-seed/. \"$TEMPLATES_DIR\"/; fi; exec node scripts/server.js"]
