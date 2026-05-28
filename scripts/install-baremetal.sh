#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/opt/haulhub}"

if [ "$(pwd)" != "$APP_DIR" ]; then
  mkdir -p "$APP_DIR"
  cp -R . "$APP_DIR"
  cd "$APP_DIR"
fi

mkdir -p "$APP_DIR/data/uploads"

if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
fi

npm ci --include=dev
npm --workspace apps/api run db:generate
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

cp "$APP_DIR/deploy/systemd/haulhub-api.service" /etc/systemd/system/haulhub-api.service
cp "$APP_DIR/deploy/systemd/haulhub-web.service" /etc/systemd/system/haulhub-web.service
systemctl daemon-reload
systemctl enable haulhub-api haulhub-web
systemctl restart haulhub-api haulhub-web

if command -v nginx >/dev/null 2>&1; then
  cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/conf.d/haulhub.conf
  nginx -t
  systemctl reload nginx || systemctl restart nginx
else
  echo "Nginx is not installed. Install nginx, then copy deploy/nginx.conf to /etc/nginx/conf.d/haulhub.conf."
fi

systemctl --no-pager status haulhub-api haulhub-web || true
