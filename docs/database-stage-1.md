# 阶段 1：真实账号和数据库

目标：让用户、资料、好友关系、消息、AI 生成记录从前端 mock 迁移到后端数据库。

## 推荐选型

- 数据库：阿里云 RDS PostgreSQL
- 账号第一版：`deviceId` 匿名账号
- 后续绑定：手机号验证码、邮箱验证码、Apple 登录都绑定到同一个 `users.id`

PostgreSQL 的好处是后面 `ai_generation_jobs.request_payload / response_payload` 可以直接用 `jsonb`，适合追踪模型调用和调试生成质量。

## 最小表

已经在 `server/migrations/001_initial.sql` 创建：

- `users`
- `profiles`
- `artists`
- `artist_friends`
- `self_messages`
- `fan_messages`
- `idol_chat_messages`
- `ai_generation_jobs`

## ECS 配置

在 `/opt/idol-mode/server/.env.production` 增加：

```env
DATABASE_URL=postgresql://USER:PASSWORD@RDS_HOST:5432/idol_mode
DB_SSL=false
DB_POOL_MAX=10
```

如果 RDS 强制 SSL，把 `DB_SSL=true`。

## 运行迁移

```bash
cd /opt/idol-mode/server
npm install
npm run db:migrate
npm run pm2:reload
curl http://127.0.0.1:8787/health
```

`/health` 应该返回：

```json
{
  "database": "configured"
}
```

## 第一批 API

### 匿名登录

```bash
curl -X POST http://127.0.0.1:8787/auth/device \
  -H 'Content-Type: application/json' \
  --data '{"deviceId":"ios-device-demo-001","platform":"ios"}'
```

返回 `user.id` 和 `sessionToken`。后续 App 请求优先带：

```text
Authorization: Bearer returned-session-token
```

手动调试时暂时仍兼容：

```text
X-User-Id: returned-user-id
```

上线前建议设置：

```env
ALLOW_INSECURE_USER_ID_HEADER=false
```

### 拉取启动数据

```bash
curl http://127.0.0.1:8787/me/bootstrap \
  -H 'Authorization: Bearer returned-session-token'
```

### 保存资料

```bash
curl -X PUT http://127.0.0.1:8787/me/profile \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: returned-user-id' \
  --data '{"nickname":"Luna Field","signature":"Tonight I am practicing.","avatar":"LF"}'
```

### 添加 bubble friend

```bash
curl -X POST http://127.0.0.1:8787/me/friends \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: returned-user-id' \
  --data '{"artistId":"artist-1"}'
```

### 保存自己营业消息

```bash
curl -X POST http://127.0.0.1:8787/me/self-messages \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: returned-user-id' \
  --data '{"id":"self-demo-1","text":"今天练习结束了。","status":"pending","createdAt":"22:10"}'
```

### 确认发送

```bash
curl -X PATCH http://127.0.0.1:8787/me/self-messages/self-demo-1 \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: returned-user-id' \
  --data '{"status":"sent"}'
```

### 生成并保存粉丝消息

```bash
curl -X POST http://127.0.0.1:8787/ai/fan-messages \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: returned-user-id' \
  --data '{"message":"今天练习结束了。","sourceMessageId":"self-demo-1","count":4}'
```

这会同时写入：

- `fan_messages`
- `ai_generation_jobs`

## 下一步前端迁移顺序

1. App 启动时生成/读取本地 `deviceId`，调用 `/auth/device`
2. 用返回的 `user.id` 调 `/me/bootstrap`
3. 编辑资料改为 `PUT /me/profile`
4. 添加/删除好友改为 `/me/friends`
5. self-chat 发消息和确认发送写入 `self_messages`
6. AI 返回的粉丝消息写入 `fan_messages`

这一阶段先不做复杂 token。等 TestFlight 验证用户愿意使用后，再加短信/邮箱/Apple 登录和 JWT/session。
