# 阿里云 ECS 部署 Idol Mode API

这是面向中国用户的稳定后端方案，替代所有临时 tunnel。

## 推荐架构

第一阶段：

```text
Expo App
  -> https://api.yourdomain.com
  -> 阿里云 ECS + Nginx
  -> systemd 服务 idol-mode-api
  -> 阿里云百炼 / DashScope Qwen API
```

正式生产：

```text
Expo App
  -> HTTPS 域名
  -> 阿里云 ALB/SLB
  -> 多台 ECS / 容器服务 ACK
  -> 阿里云百炼 / DashScope Qwen API
```

## 地域选择

- 快速内测：阿里云香港 ECS，不需要 ICP 备案，国内访问通常比欧美服务稳定。
- 正式面向大陆用户：阿里云大陆地域 ECS，域名需要 ICP 备案。

## 服务器准备

建议：

- Ubuntu 22.04 LTS
- 2 vCPU / 2GB RAM 起步
- 安全组开放 `80`、`443`、`22`
- 不要直接开放 `8787`

阿里云官方 ECS Docker 文档：  
https://help.aliyun.com/zh/ecs/user-guide/install-and-use-docker

## 上传代码

在本机：

```bash
rsync -av \
  --exclude node_modules \
  --exclude .expo \
  --exclude .env \
  --exclude .env.local \
  --exclude .env.production \
  --exclude 'server/.env' \
  --exclude 'server/.env.local' \
  --exclude 'server/.env.production' \
  /Users/chenyang/Desktop/今天也在营业/ \
  root@YOUR_ECS_IP:/opt/idol-mode/
```

> **重要：** `.env` 系列文件永远不要被 rsync 覆盖。服务器上的 `.env` 只在服务器上维护，本地不存这些文件（`.gitignore` 已忽略它们）。

## 配置环境变量

在 ECS：

```bash
cd /opt/idol-mode/server
cp .env.example .env.production
nano .env.production
```

填入：

```env
AI_PROVIDER=qwen
QWEN_API_KEY=sk-your-real-dashscope-key
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen3.5-plus
RATE_LIMIT_PER_MINUTE=90
ALLOWED_ORIGINS=*
```

## 启动 API

在 ECS：

```bash
cd /opt/idol-mode/server
systemctl restart idol-mode-api
systemctl status idol-mode-api --no-pager
```

测试：

```bash
curl http://127.0.0.1:8787/health
```

## PM2 Cluster 进程管理

小范围内测建议用 PM2 cluster 替代单个 systemd Node 进程，让 Node 使用多核 CPU，并在进程异常退出后自动拉起。

在 ECS：

```bash
npm install -g pm2
cd /opt/idol-mode/server
mkdir -p logs
systemctl stop idol-mode-api
systemctl disable idol-mode-api
npm run pm2:start
pm2 save
pm2 startup systemd -u root --hp /root
```

`pm2 startup` 会输出一条需要复制执行的命令，执行后重启机器也会自动恢复 PM2 进程。

日常部署更新（在本机执行）：

```bash
# 一键部署：同步代码 + npm ci + pm2 reload
# .env 文件永远不会被覆盖
./scripts/deploy.sh root@YOUR_ECS_IP
```

或者手动分步：

```bash
# 1. 同步代码（.env 系列全部排除）
rsync -av \
  --exclude '.git' --exclude 'node_modules' --exclude 'server/node_modules' \
  --exclude '.expo' --exclude '.env' --exclude '.env.local' --exclude '.env.production' \
  --exclude 'server/.env' --exclude 'server/.env.local' --exclude 'server/.env.production' \
  /Users/chenyang/Desktop/今天也在营业/ root@YOUR_ECS_IP:/opt/idol-mode/

# 2. 在服务器上重载
ssh root@YOUR_ECS_IP "cd /opt/idol-mode/server && npm ci --omit=dev && npm run pm2:reload"
pm2 status
curl http://127.0.0.1:8787/health
```

查看日志：

```bash
pm2 logs idol-mode-api
tail -f /opt/idol-mode/server/logs/request.log
tail -f /opt/idol-mode/server/logs/error.log
tail -f /opt/idol-mode/server/logs/ai-failures.log
tail -f /opt/idol-mode/server/logs/slow-requests.log
```

## 日志落盘和轮转

应用会写入这些 JSONL 日志：

- `/opt/idol-mode/server/logs/request.log`：所有请求日志
- `/opt/idol-mode/server/logs/error.log`：服务端错误日志
- `/opt/idol-mode/server/logs/ai-failures.log`：Qwen / AI 调用失败日志
- `/opt/idol-mode/server/logs/slow-requests.log`：慢请求日志，默认 `SLOW_REQUEST_MS=3000`
- `/opt/idol-mode/server/logs/pm2-out.log`、`pm2-error.log`：PM2 标准输出和错误输出

配置 logrotate：

```bash
cp /opt/idol-mode/server/deploy/logrotate-idol-mode-api /etc/logrotate.d/idol-mode-api
logrotate -d /etc/logrotate.d/idol-mode-api
```

确认 dry-run 没报错后，系统会按天轮转并压缩日志。

## Nginx 反向代理

安装 Nginx 后：

```bash
sudo cp /opt/idol-mode/server/deploy/nginx-idol-mode-api.conf /etc/nginx/conf.d/idol-mode-api.conf
sudo nano /etc/nginx/conf.d/idol-mode-api.conf
```

把：

```nginx
server_name api.example.com;
```

改成你的域名。

检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## HTTPS

正式上线必须使用 HTTPS。可选：

- 阿里云 ALB/SLB 配 HTTPS 证书，然后转发到 ECS 的 HTTP 80。
- 在 ECS Nginx 上配置证书。

阿里云 ALB HTTPS 监听官方文档：  
https://www.alibabacloud.com/help/zh/doc-detail/198571.html

## App 配置

部署成功后，把 App 的 `.env.local` 改为：

```env
EXPO_PUBLIC_IDOL_MODE_API_URL=https://api.yourdomain.com
```

然后重新启动 Expo 或重新打包 App：

```bash
npm run start -- --clear
```

## 生产注意事项

- Qwen / DashScope key 只放 ECS `.env.production`，不要放 App。
- `.env.production` 不要提交 git。
- 大陆正式运营建议完成 ICP 备案。
- 用户量增长后，把 in-memory 限流替换为 Redis 限流。
- 接入阿里云日志服务 SLS，保留 API 错误日志和调用量。
