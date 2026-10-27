# 部署到 Cloudflare Worker（GitHub 自动部署）

本项目已按「Worker + 静态资源」改造完，直接按下面两步走即可。

## 0. 已经帮你改好的文件

| 文件 | 作用 |
| --- | --- |
| `wrangler.jsonc` | Worker 配置：`name=tripdemo`，入口 `worker/index.js`，静态资源 `./dist`，绑定 `ASSETS`，并开启 `allow_custom_ports` |
| `worker/index.js` | Worker 入口：`/api/**` 转发到后端，其余请求交给静态资源 |
| `src/services/request/config.js` | `BASE_URL` 改为相对路径 `/api`（彻底避免跨域与混合内容） |
| `vite.config.js` | 给 dev / preview 加 `/api` 代理，本地开发行为不变 |
| `.github/workflows/deploy.yml` | GitHub Actions 自动部署工作流（方案 B 用） |
| `.node-version` | 声明 Node 22 |
| `package.json` | 新增 `wrangler` 依赖与 `npm run deploy` 脚本 |

已本地验证：`npm run build` 通过（3.4s，51 个产物文件）；`npx wrangler deploy --dry-run` 通过，正确识别到 51 个静态资源与 `env.ASSETS` 绑定。

---

## 1. 为什么不能「直接扔上去」（两个必踩的坑）

**坑一：混合内容（Mixed Content）**
后端 `http://codercba.com:1888` 只有 HTTP。实测：

```
http://codercba.com:1888/api/home/hotSuggests   → 200
https://codercba.com:1888/api/home/hotSuggests  → 000（不通）
```

Cloudflare 站点强制 HTTPS，`https` 页面里发 `http` 请求会被浏览器直接拦截，**与 CORS 无关**（该接口 CORS 其实已放开）。解决办法就是让请求保持同源 `/api/**`，再由 Worker 服务端转发——这就是 `worker/index.js` 干的事。

**坑二：Node 版本**
`package.json` 的 `engines` 要求 `^22.18.0 || >=24.12.0`，Vite 8 也要 Node 22。若构建机上 Node 太低会失败。已在 `.node-version` 声明；若构建日志仍报版本错，在 Cloudflare 的构建设置里加环境变量 `NODE_VERSION=22`。

**好消息**：项目用的是 `createWebHashHistory`（哈希路由），所有页面都在 `/` 下，**不需要配 SPA 回退规则**。

**坑三：Workers 会吃掉自定义端口（本项目真实踩中，已修）**

Cloudflare Workers 的 `fetch()` **默认忽略 URL 里的自定义端口**，除非开启 `allow_custom_ports` 兼容标志。实测链路：

```
Worker 请求 http://codercba.com:1888/api/...
  → 端口被忽略，实际打到 http://codercba.com:80
  → 80 返回 301 跳转到 https://codercba.com/
  → 该域名 443 不通（000）
  → fetch 抛错 → 500 → axios 报错 → 被拦截器吞掉
  → 页面报 "Cannot read properties of undefined (reading 'data')"
```

解法：`wrangler.jsonc` 里加 `"compatibility_flags": ["allow_custom_ports"]`。已加上并验证部署成功。

---

## 2. 方案 A：Workers Builds + GitHub（推荐，零配置 CI）

1. 把代码推到 GitHub（见第 4 节）
2. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → 选 **GitHub**
3. 授权 GitHub，选择 `StarrySkyWings/vueStay-trip` 仓库
4. 构建设置填：

| 配置项 | 值 |
| --- | --- |
| Root directory | `/` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy`（默认就是这个，留空也行） |
| Branch | `main` |

5. **注意**：Dashboard 里创建的 Worker 名字必须等于 `wrangler.jsonc` 的 `name`，即 **`vuestay-trip`**，否则构建会失败（Cloudflare 的强制校验）
6. Save and Deploy → 部署完成后访问 `https://vuestay-trip.<你的子域>.workers.dev`

之后每次 `git push` 到 main 都会自动构建部署；其他分支会生成 Preview URL。

---

## 3. 方案 B：GitHub Actions（更可控，适合已有 CI）

`.github/workflows/deploy.yml` 已写好，只需配两个 Secrets：

1. Cloudflare Dashboard → **My Profile** → **API Tokens** → Create Token，用「Edit Cloudflare Workers」模板
2. GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions** → New repository secret：
   - `CLOUDFLARE_API_TOKEN`：上一步的 token
   - `CLOUDFLARE_ACCOUNT_ID`：Dashboard 右侧栏的 Account ID

推到 `main` 即触发。也可以在 Actions 页面手动 `Run workflow`。

---

## 4. 关于 Git：当前仓库需要重建

工作目录里的 `.git` 目录已不存在（Git 仓库信息丢失），远端 `https://github.com/StarrySkyWings/vueStay-trip.git` 仍在（HTTP 200 可访问）。恢复方式：

**如果远端仓库是空的或可以覆盖**（最简单）：

```bash
cd /c/Users/86186/Desktop/code/vueStay-trip
git init -b main
git remote add origin https://github.com/StarrySkyWings/vueStay-trip.git
git add .
git commit -m "chore: 接入 Cloudflare Worker 部署配置"
git push -u --force origin main
```

**如果远端已有历史且要保留**：先 `git clone` 远端到别处，把本地这 5 个改动文件复制过去再提交，避免强推覆盖历史。

> `.gitignore` 已忽略 `node_modules` 和 `dist`，直接 `git add .` 是安全的。

---

## 5. 部署后必须做的一件事：百度地图 AK 白名单

`index.html` 里的百度地图 AK（`hyScguTx9y2XgRGpUimEfoy8pGybLKCu`）通常配了 Referer 白名单。默认可能只放行了 localhost，上线后地图会加载失败。

去[百度地图开放平台控制台](https://lbsyun.baidu.com/apiconsole/key) → 应用管理 → 把 `*.workers.dev`（以及你绑定的自定义域名）加进 Referer 白名单。

顺带提醒：这个 AK 是明文写在 `index.html` 里的，正式项目建议改用环境变量注入。

---

## 6. 本地验证与排错

**本地跑一遍 Worker 环境**（会同时启动静态资源与 `/api` 代理）：

```bash
npm run build
npx wrangler dev      # 等价于线上行为，推荐用它验收
```

**手动部署一次**：

```bash
npm run deploy        # = npm run build && wrangler deploy
```

首次会弹出浏览器授权登录 Cloudflare 账号（点 Allow）；终端里若卡在等待授权，检查是否开了代理导致回调失败。

无浏览器 / CI 环境改用 API Token：

```bash
# Windows PowerShell
$env:CLOUDFLARE_API_TOKEN="xxx"; npm run deploy
# macOS / Linux
CLOUDFLARE_API_TOKEN=xxx npm run deploy
```

顺带一提，构建时 `postcss-px-to-viewport: postcss.plugin was deprecated` 是插件自身的弃用警告，不影响产物，可忽略。

**常见问题**

| 现象 | 原因 / 处理 |
| --- | --- |
| `'wrangler' 不是内部或外部命令` | `wrangler` 只在 `package-lock.json` 里、没装进 `node_modules`。执行 `npm install` 再跑；CI 环境用 `npm ci` |
| 页面能打开但全是空数据 | 检查 Network 里 `/api/**` 是否 200；若 404 说明 Worker 没命中，确认 `worker/index.js` 已提交 |
| 构建报 Node / engine 错误 | 构建设置加 `NODE_VERSION=22` |
| 构建报 "Worker name mismatch" | Dashboard 上的 Worker 名改成 `vuestay-trip` |
| 地图空白 | 百度 AK 白名单没加 `*.workers.dev` |
| 接口 502 / 超时 | 后端 `codercba.com:1888` 是教学接口，可能已下线；需要自建后端或换接口 |

**回滚**：以上改动都在 Git 里，删掉 `wrangler.jsonc`、`worker/`、`.github/` 并把 `config.js` 的 `BASE_URL` 改回绝对地址即可恢复原样。
