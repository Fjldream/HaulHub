# 拉货小票部署方案

本文说明拉货小票 HaulHub 的上线部署方式。推荐部署结构如下：

- 微信小程序：司机端/移动端。
- 服务器：API + 后台 Web + Nginx。
- 数据：SQLite 数据库 + 上传文件目录。

服务器端提供两种方案：

- Docker Compose：适合服务器可安装 Docker 的场景。
- 开箱即用包：适合服务器不安装 Docker，只使用 Node.js + systemd + Nginx 的场景。

## Docker Compose 部署

### 服务器要求

- Docker
- Docker Compose
- 已开放对外 HTTP 端口，默认 `8088`

### 首次部署

```bash
git clone <repo-url> HaulHub
cd HaulHub
cp deploy/.env.example deploy/.env
sh scripts/deploy-server.sh
```

### 修改对外端口

默认端口不是 80，而是 `8088`。如需改为 `8090`，编辑 `deploy/.env`：

```env
HTTP_PORT=8090
```

然后重新执行：

```bash
sh scripts/deploy-server.sh
```

### 更新部署

```bash
cd HaulHub
git pull
sh scripts/deploy-server.sh
```

### 常用命令

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env ps
docker compose -f deploy/docker-compose.yml --env-file deploy/.env logs -f --tail=120
docker compose -f deploy/docker-compose.yml --env-file deploy/.env restart
```

## 开箱即用包部署

### 服务器要求

- Node.js 20+
- Nginx
- systemd
- unzip

### 本机打包

```powershell
.\scripts\build-server-baremetal.ps1 -HttpPort 8090 -ApiBaseUrl "/api"
```

打包产物：

```text
release/haulhub-server.zip
```

### 上传并安装

```bash
mkdir -p /opt/haulhub
unzip haulhub-server.zip -d /opt/haulhub
cd /opt/haulhub
sh install.sh
```

安装脚本会完成：

- 创建 `/opt/haulhub/.env`
- 创建 `/opt/haulhub/data/uploads`
- 执行 Prisma 数据库迁移
- 安装并启动 `haulhub-api` 和 `haulhub-web`
- 生成并加载 Nginx 配置

### 默认数据位置

```text
/opt/haulhub/data/haulhub.db
/opt/haulhub/data/uploads
```

## 微信小程序部署

构建：

```powershell
.\scripts\build-mp-weixin.ps1 -ApiBaseUrl "https://你的域名/api"
```

产物目录：

```text
apps/driver-uni/dist/build/mp-weixin
```

使用微信开发者工具打开该目录，上传发布。

## 上线检查清单

- API `/health` 可访问。
- 后台 Web 可登录。
- Nginx `/api` 正确转发到 API。
- Nginx `/files` 正确转发到上传文件接口。
- 微信小程序后台已配置合法 request/uploadFile 域名。
- SQLite 数据库和上传目录已纳入备份。
- 超级管理员、团队、管理员、司机、车辆、费用类型已初始化。
- 生产环境建议启用 HTTPS。

## 备份建议

Docker 方案备份 Docker volume 中的数据。

开箱即用方案备份：

```text
/opt/haulhub/data/haulhub.db
/opt/haulhub/data/uploads
```
