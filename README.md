# Vape Wallpaper Studio

内部版文生图网页，基于 `Vite + React + Node.js`，支持：

- Flux 模型选择
- 比例 / 张数选择
- DeepSeek 提示词优化
- Flux 批量生成
- 结果预览、单张下载、批量 ZIP 下载
- 本地历史记录缓存
- LoRA 训练 / 我的 LoRA 占位页

## 本地启动

需要本机安装 Node.js 20+。

1. 安装依赖

```bash
npm install
```

2. 准备服务端密钥

可选其一：

- 复制 [server.config.example.json](/Users/felixwang/Documents/电子烟壁纸素材/server.config.example.json) 为 `server.config.json`
- 或直接设置环境变量，参考 [.env.example](/Users/felixwang/Documents/电子烟壁纸素材/.env.example)

3. 构建并启动

```bash
npm run build
npm start
```

默认地址：

```text
http://localhost:4173
```

## 配置说明

前端公开配置在 [public/config.json](/Users/felixwang/Documents/电子烟壁纸素材/public/config.json)。

服务端支持以下环境变量：

- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_ENDPOINT`
- `DEEPSEEK_MODEL`
- `DEEPSEEK_API_KEY`
- `BFL_API_KEY`

如果环境变量未设置，服务端会回退读取本地 `server.config.json`。

## 正式部署

当前仓库已经补齐正式部署所需文件：

- [render.yaml](/Users/felixwang/Documents/电子烟壁纸素材/render.yaml)：Render Web Service 配置
- [Dockerfile](/Users/felixwang/Documents/电子烟壁纸素材/Dockerfile)：通用容器部署
- [.node-version](/Users/felixwang/Documents/电子烟壁纸素材/.node-version)：固定 Node 版本

推荐直接部署到 Render：

1. 把仓库推到 GitHub / GitLab
2. 在 Render 新建 Web Service，导入当前仓库
3. 读取 [render.yaml](/Users/felixwang/Documents/电子烟壁纸素材/render.yaml)
4. 在 Render 后台补充两个密钥环境变量：
   `DEEPSEEK_API_KEY`
   `BFL_API_KEY`
5. 完成首发后会得到一个长期可访问的 `onrender.com` 域名

如果你使用其他平台，只要支持长期运行 Node Web Service 或 Docker，也可以直接部署。

## 安全说明

- `server.config.json` 已加入忽略列表，不应提交到 git。
- 如果这个目录曾经被上传到远程仓库或共享给他人，建议立即轮换现有 API Key。

## 已知限制

- 由于 Black Forest Labs 不接受当前线上域名的浏览器跨域直连，运行版改为最小同源代理服务，避免 `Failed to fetch`。
- 当前服务端会代理 Flux 结果图片，历史记录保存的是同源代理地址；如果服务端重启，旧历史里的图片链接可能失效，需要重新生成。
