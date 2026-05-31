#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/opt/haulhub}"
export APP_DIR
BACKUP_ROOT="${BACKUP_ROOT:-/opt/haulhub-backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"
PACKAGE_DIR="$(pwd)"

load_env_file() {
  env_file="$1"
  if [ ! -f "$env_file" ]; then
    return 0
  fi

  clean_env="$(mktemp)"
  sed '1s/^\xEF\xBB\xBF//' "$env_file" | tr -d '\r' > "$clean_env"
  set -a
  # shellcheck disable=SC1090
  . "$clean_env"
  set +a
  rm -f "$clean_env"
}

if [ ! -f "$PACKAGE_DIR/package.json" ] || [ ! -d "$PACKAGE_DIR/apps/api" ] || [ ! -d "$PACKAGE_DIR/admin-web" ]; then
  echo "Please run this script from the extracted haulhub-server package directory."
  exit 1
fi

mkdir -p "$APP_DIR" "$BACKUP_DIR"

if [ -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env" "$BACKUP_DIR/.env"
fi

if [ -d "$APP_DIR/data" ]; then
  tar -czf "$BACKUP_DIR/data.tar.gz" -C "$APP_DIR" data
fi

if command -v pm2 >/dev/null 2>&1; then
  pm2 stop haulhub-api haulhub-web >/dev/null 2>&1 || true
fi

if [ -d "$APP_DIR/node_modules" ]; then
  mv "$APP_DIR/node_modules" "$BACKUP_DIR/node_modules"
fi

rm -rf \
  "$APP_DIR/admin-web" \
  "$APP_DIR/apps" \
  "$APP_DIR/deploy" \
  "$APP_DIR/packages" \
  "$APP_DIR/web-root" \
  "$APP_DIR/ecosystem.config.cjs" \
  "$APP_DIR/install.sh" \
  "$APP_DIR/patch.sh" \
  "$APP_DIR/.env.example" \
  "$APP_DIR/package.json" \
  "$APP_DIR/package-lock.json"

cp "$PACKAGE_DIR/package.json" "$APP_DIR/package.json"
cp "$PACKAGE_DIR/package-lock.json" "$APP_DIR/package-lock.json"
cp "$PACKAGE_DIR/.env.example" "$APP_DIR/.env.example"
cp "$PACKAGE_DIR/ecosystem.config.cjs" "$APP_DIR/ecosystem.config.cjs"
cp "$PACKAGE_DIR/install.sh" "$APP_DIR/install.sh"
cp "$PACKAGE_DIR/patch.sh" "$APP_DIR/patch.sh"
cp -R "$PACKAGE_DIR/admin-web" "$APP_DIR/admin-web"
cp -R "$PACKAGE_DIR/apps" "$APP_DIR/apps"
cp -R "$PACKAGE_DIR/deploy" "$APP_DIR/deploy"
cp -R "$PACKAGE_DIR/packages" "$APP_DIR/packages"
cp -R "$PACKAGE_DIR/web-root" "$APP_DIR/web-root"

if [ -d "$BACKUP_DIR/node_modules" ]; then
  mv "$BACKUP_DIR/node_modules" "$APP_DIR/node_modules"
elif [ -d "$PACKAGE_DIR/node_modules" ]; then
  cp -R "$PACKAGE_DIR/node_modules" "$APP_DIR/node_modules"
fi

mkdir -p "$APP_DIR/data/uploads"

if [ ! -f "$APP_DIR/.env" ]; then
  cp "$PACKAGE_DIR/.env.example" "$APP_DIR/.env"
fi

cd "$APP_DIR"

load_env_file "$APP_DIR/.env"

if [ "${INSTALL_NODE_MODULES:-0}" = "1" ] || [ ! -x "$APP_DIR/node_modules/.bin/prisma" ]; then
  echo "Installing Linux npm dependencies. This is required on first deployment or when dependencies change."
  npm ci --include=dev
fi
npm --workspace apps/api run db:generate
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

if ! command -v pm2 >/dev/null 2>&1; then
  echo "PM2 is not installed. Install it first: npm install -g pm2"
  exit 1
fi

pm2 startOrReload "$APP_DIR/ecosystem.config.cjs" --update-env
pm2 save

pm2 status haulhub-api haulhub-web
echo "Patch applied. Backup saved at: $BACKUP_DIR"
echo "Nginx was not modified. Add the location blocks from $APP_DIR/deploy/nginx.conf to your server config manually."
