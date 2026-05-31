# 拉货小票 HaulHub

拉货小票是一套面向小型物流车队的趟次小票、费用、维修和利润核算系统。项目英文名保留为 HaulHub，后台和司机端都围绕“创建小票、司机执行、费用上传、后台审核、利润统计”这条业务链路设计。

## 项目状态

当前版本包含三部分：

- 后台 Web 管理端：用于团队、成员、趟次、车辆、司机、维修、费用类型、利润统计和审计记录管理。
- 司机/移动端：基于 uni-app，支持 H5 调试和微信小程序构建，司机可查看趟次、开始运输、提交费用和票据；管理员也可在移动端处理部分后台功能。
- API 服务：Fastify + Prisma + SQLite，负责鉴权、业务接口、文件上传和数据持久化。

## 技术栈

- Monorepo：npm workspaces
- 后台 Web：Next.js 16、React 19、lucide-react
- 移动端：uni-app、Vue 3、微信小程序构建
- API：Fastify、Prisma、SQLite、Zod
- 测试：Vitest、TypeScript 类型检查
- 部署：Docker Compose 或 Node.js + systemd + Nginx

## 目录结构

```text
apps/
  admin-web/        后台 Web 管理端
  api/              Fastify API 与 Prisma 数据库
  driver-uni/       司机端/移动端 uni-app
packages/
  shared/           共享业务规则：状态流、权限、结算
  design-tokens/    共享设计 token
deploy/             Docker、Nginx、systemd 配置
scripts/            打包与部署脚本
docs/               设计、计划和部署文档
```

## 核心功能

### 团队与账号

- 超级管理员可管理团队和后台成员。
- 登录后台后先选择团队，再进入对应团队后台。
- 普通管理员/会计只看到自己团队的数据。
- 后台右上角显示账号、团队信息，并支持退出登录。

### 趟次小票

- 后台创建趟次，选择车辆、司机、客户、装货地、卸货地和预计运费。
- 司机端接收待出车小票，开始运输后进入进行中。
- 司机录入费用和票据，提交后由后台审核。
- 后台可开始审核、退回修改、完成结算。
- 待出车小票支持后台撤销，撤销会保留记录并写入审计日志；司机端不再显示已撤销小票。

### 车辆与司机

- 车辆管理支持车辆资料、车型、品牌型号、载重、年检到期、维保时间、车辆图片、绑定司机。
- 车辆状态根据数据自动判断：有未完成小票为运输中，无未完成小票为空闲中，维修/停用优先。
- 车辆详情展示出车次数、维修费用、利润贡献和历史任务轨迹。
- 司机管理支持司机资料、绑定车辆和相关趟次查看。

### 维修与费用

- 维修记录独立管理，可录入车辆、维修部件/项目、价格、日期、凭证和备注。
- 维修记录可删除，并可进入详情页查看。
- 费用类型支持启用/停用和是否必须上传票据。
- 文件上传限制为图片，单文件最大 10MB。

### 利润统计

- 支持本周、本月、本年维度统计。
- 统计运费收入、趟次费用、车辆维修支出、总支出和利润。
- 车辆利润、司机利润和费用分类用于辅助分析经营情况。

### 审计记录

- 关键后台动作会写入操作记录，例如审核、退回、结算、撤销小票。
- 支持按对象类型和动作筛选。

## 本地开发

### 环境要求

- Node.js 20 或更高版本
- npm
- Windows PowerShell、macOS Terminal 或 Linux Shell

### 安装依赖

```bash
npm install
```

### 初始化数据库

开发库使用 SQLite，默认位置在：

```text
apps/api/prisma/dev.db
```

首次运行：

```bash
npm --workspace apps/api run db:generate
npm --workspace apps/api run db:migrate
npm --workspace apps/api run db:seed
```

如果本地已有开发库，但 schema 已变化，可使用：

```bash
npx prisma db push --schema apps/api/prisma/schema.prisma
```

### 启动 API

Windows PowerShell：

```powershell
$env:DATABASE_URL='file:E:/code/HaulHub/apps/api/prisma/dev.db'
npm run dev:api
```

macOS/Linux：

```bash
DATABASE_URL='file:./apps/api/prisma/dev.db' npm run dev:api
```

API 默认地址：

```text
http://localhost:4000
```

健康检查：

```text
http://localhost:4000/health
```

### 启动后台 Web

```bash
npm run dev:admin
```

后台默认地址：

```text
http://localhost:3000
```

### 启动司机端 H5

```bash
npm run dev:driver:h5
```

司机端 H5 默认地址通常为：

```text
http://localhost:5173
```

## 常用脚本

```bash
npm run dev:api                 # 启动 API
npm run dev:admin               # 启动后台 Web
npm run dev:driver:h5           # 启动司机端 H5
npm run build:admin             # 构建后台 Web
npm run build:driver:mp-weixin  # 构建微信小程序
npm --workspace apps/api test   # API 测试
npm --workspace packages/shared test
npm --workspace apps/api run lint
npm --workspace apps/driver-uni run lint
```

## 测试与质量检查

建议提交前至少执行：

```bash
npm --workspace apps/api run lint
npm --workspace apps/api test
npm --workspace packages/shared test
npm --workspace apps/admin-web run build
npm --workspace apps/driver-uni run lint
```

## 部署方案

项目提供两种服务器端部署方案。移动端单独构建为微信小程序，后端 API 和后台 Web 部署到服务器。

### 方案一：Docker Compose

适合服务器可以安装 Docker 的场景。

```bash
git clone <repo-url> HaulHub
cd HaulHub
cp deploy/.env.example deploy/.env
sh scripts/deploy-server.sh
```

默认 Nginx 对外端口不是 80，而是 8088。需要修改端口时，编辑：

```text
deploy/.env
```

例如：

```env
HTTP_PORT=8090
```

常用命令：

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env ps
docker compose -f deploy/docker-compose.yml --env-file deploy/.env logs -f --tail=120
docker compose -f deploy/docker-compose.yml --env-file deploy/.env restart
```

### 方案二：开箱即用包，无 Docker

适合不想在服务器安装 Docker 的场景。服务器需要 Node.js 20、Nginx 和 systemd。

本机打包：

```powershell
.\scripts\build-server-baremetal.ps1 -HttpPort 8090 -ApiBaseUrl "/api"
```

产物：

```text
release/haulhub-server.zip
```

上传服务器后：

```bash
mkdir -p /opt/haulhub
unzip haulhub-server.zip -d /opt/haulhub
cd /opt/haulhub
sh install.sh
```

默认数据目录：

```text
/opt/haulhub/data/haulhub.db
/opt/haulhub/data/uploads
```

### 微信小程序构建

```powershell
.\scripts\build-mp-weixin.ps1 -ApiBaseUrl "https://你的域名/api"
```

构建产物：

```text
apps/driver-uni/dist/build/mp-weixin
```

用微信开发者工具打开该目录，上传发布。

## 环境变量

### API

```env
DATABASE_URL=file:/opt/haulhub/data/haulhub.db
UPLOAD_DIR=/opt/haulhub/data/uploads
PORT=4000
```

### 后台 Web

```env
NEXT_PUBLIC_API_BASE_URL=/api
```

本地开发也可以使用：

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

## 生产上线检查

- 确认服务器域名和 HTTPS 已配置。
- 确认 Nginx 对外端口符合部署要求，不占用默认 80 时要在安全组开放对应端口。
- 确认微信小程序后台配置了 request 和 uploadFile 合法域名。
- 确认 SQLite 数据库和 uploads 目录有定期备份。
- 确认超级管理员、团队、管理员、司机、车辆和费用类型已初始化。
- 上传图片建议控制在 10MB 以内。
- 首次部署后访问 `/health` 检查 API 状态。

## 当前默认开发端口

```text
后台 Web: http://localhost:3000
API:      http://localhost:4000
司机 H5:  http://localhost:5173
```

## 数据安全说明

- `.env`、SQLite 数据库、上传文件和 release 打包产物不会提交到 Git。
- 生产环境请备份数据库和上传目录。
- 当前密码校验仍是开发版简单实现，上线前建议接入安全哈希、密码重置和更严格的会话策略。

## 品牌命名

- 中文名：拉货小票
- 英文名：HaulHub

后台和移动端可同时展示中文主品牌与较轻量的 HaulHub 标识。

## 服务器网页 App 部署入口

服务器部署包现在同时包含后台 Web、API 和移动端 H5 网页 App。

无 Docker 服务器需要预装：Node.js 20、PM2、Nginx。Node 服务由 PM2 管理，Nginx 只负责对外入口和静态文件。

默认访问路径：

```text
后台 Web:    http://服务器:8088/
移动 H5 App: http://服务器:8088/app/
API:         http://服务器:8088/api/
上传文件:    http://服务器:8088/files/
```

Docker 部署时可以在 `deploy/.env` 中调整：

```env
HTTP_PORT=8088
NEXT_PUBLIC_API_BASE_URL=/api
VITE_API_BASE_URL=/api
VITE_H5_BASE=/app/
```

无 Docker 打包命令：

```powershell
.\scripts\build-server-baremetal.ps1 -HttpPort 8088 -ApiBaseUrl "/api" -MobileAppBasePath "/app/"
```

开箱即用压缩包 `release/haulhub-server.zip` 内包含：

```text
admin-web/     后台 Web standalone 服务
apps/api/      API 服务
web-root/app/  移动端 H5 网页 App 静态文件
deploy/        Nginx 配置
ecosystem.config.cjs  PM2 服务配置
patch.sh       服务器整包替换补丁脚本
```

后续出补丁时，推荐在服务器这样执行：

```bash
mkdir -p /tmp/haulhub-patch
unzip -o haulhub-server.zip -d /tmp/haulhub-patch
cd /tmp/haulhub-patch
APP_DIR=/opt/haulhub sh patch.sh
```

`patch.sh` 会自动备份 `/opt/haulhub/data` 和 `/opt/haulhub/.env`，然后整包替换程序目录，并使用 PM2 重启 `haulhub-api` 和 `haulhub-web`。

安装和补丁脚本不会修改服务器 Nginx。请把 `/api/`、`/files/`、`/app/` 和 `/` 这几个 location 手动合并到现有 HTTPS `server {}` 中。

发布包会带上本地构建时准备好的 `node_modules`，服务器默认不重新下载 npm 依赖。只有当服务器架构和本地构建环境不一致，或需要强制重新安装依赖时，才执行：

```bash
INSTALL_NODE_MODULES=1 APP_DIR=/opt/haulhub sh install.sh
```

如果要部署到已有域名的子路径，例如 `https://fjhdream.cn/haulhub/`，打包时传入路径前缀：

```powershell
.\scripts\build-server-baremetal.ps1 -PathPrefix "haulhub"
```

这会自动生成：

```text
后台 Web:    /haulhub/
API:         /haulhub/api
移动 H5 App: /haulhub/app/
```

不传 `-PathPrefix` 时保持默认：

```text
后台 Web:    /
API:         /api
移动 H5 App: /app/
```
