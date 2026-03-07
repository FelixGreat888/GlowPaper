# 流光SVG（佐糖出品）

内部版 SVG 素材工具，当前包含：

- V2 工作台：文生 SVG、上传二次编辑、历史缓存、本地预览
- 登录注册：邮箱 + 密码 + 邀请码
- 服务端代理：SVG 生成/编辑请求全部走本站后端，不在前端暴露第三方 API
- 算粒系统：新用户注册默认赠送 10 算粒，生成与编辑按质量扣减
- 管理后台：查看用户、禁用/恢复账号、直接调整算粒余额
- V1 备份入口：继续保留旧版本页面

## 页面入口

- 主站（正式 V2）：`/` 或 `/v2.html`
- 管理后台：`/admin.html`
- V1 备份入口：`/v1.html`

## 本地启动

需要本机安装 Node.js 20+。

1. 安装依赖

```bash
npm install
```

2. 配置环境变量

可选其一：

- 复制 [server.config.example.json](/Users/felixwang/Documents/电子烟壁纸素材/server.config.example.json) 为本地私有的 `server.config.json`
- 或使用 [.env.example](/Users/felixwang/Documents/电子烟壁纸素材/.env.example) 里的变量名直接写入环境

必须配置的变量：

- `DATABASE_URL`
- `SESSION_SECRET`
- `APP_INVITE_CODE`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `SVG_API_KEY`

如果需要保留 V1 的提示词优化 / Flux 生图能力，还需要：

- `DEEPSEEK_API_KEY`
- `BFL_API_KEY`

3. 启动后端

```bash
npm run dev:server
```

默认地址：

```text
http://localhost:4173
```

4. 如需前端热更新，再单独启动 Vite

```bash
npm run dev:v2
```

Vite 开发服务器默认在 `http://localhost:5173`，并已代理 `/api` 到本地 Node 服务。

## 算粒规则

当前内置规则：

- 生成：低 `1` / 中 `2` / 高 `3`
- 编辑：低 `2` / 中 `3` / 高 `5`
- 新用户注册成功默认赠送 `10` 算粒

真实余额以后端数据库为准，前端只做展示。

## Render 部署

仓库已包含 [render.yaml](/Users/felixwang/Documents/电子烟壁纸素材/render.yaml)，会同时创建：

- 一个 Web Service
- 一个 Render Postgres 数据库

首次部署前，至少补齐这些环境变量：

- `APP_INVITE_CODE`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `SVG_API_KEY`
- `DEEPSEEK_API_KEY`（如果还要用 V1 DeepSeek）
- `BFL_API_KEY`（如果还要用 V1 Flux）

`SESSION_SECRET` 会由 Render 自动生成，`DATABASE_URL` 会自动绑定到 Render Postgres。

## 安全说明

- `server.config.json` 已加入忽略列表，不能提交到仓库。
- 前端不再保存 SVG 第三方 API 的域名和 key。
- 浏览器端请求只会看到本站的 `/api/*`。
- 这是基础账号体系版本，当前不包含邮箱验证、忘记密码、支付充值、多邀请码管理。
