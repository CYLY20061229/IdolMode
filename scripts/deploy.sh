#!/bin/bash
# deploy.sh — 一键部署到阿里云 ECS
#
# 用法：
#   ./scripts/deploy.sh root@YOUR_ECS_IP
#
# 说明：
#   - .env / .env.local / .env.production 永远不会被上传，服务器上的密钥不会被覆盖
#   - 上传完成后自动 ssh 进服务器执行 npm ci + pm2 reload
#
# 首次部署前，先在服务器上手动配置一次 /opt/idol-mode/server/.env：
#   ssh root@YOUR_ECS_IP
#   nano /opt/idol-mode/server/.env
#   （参考 server/.env.example 填入真实值）

set -e

ECS_HOST="${1:-}"
if [ -z "$ECS_HOST" ]; then
  echo "用法: $0 root@YOUR_ECS_IP"
  exit 1
fi

REMOTE_DIR="/opt/idol-mode"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "▶ 同步代码到 $ECS_HOST:$REMOTE_DIR ..."
rsync -av --progress \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'server/node_modules' \
  --exclude '.expo' \
  --exclude 'dist' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '.env.production' \
  --exclude 'server/.env' \
  --exclude 'server/.env.local' \
  --exclude 'server/.env.production' \
  --exclude 'server/logs' \
  --exclude '*.log' \
  "$LOCAL_DIR/" \
  "$ECS_HOST:$REMOTE_DIR/"

echo "▶ 安装依赖 + 重载进程 ..."
ssh "$ECS_HOST" bash << 'REMOTE'
set -e
cd /opt/idol-mode/server
npm ci --omit=dev
npm run pm2:reload
pm2 status
echo "✅ 部署完成"
REMOTE
