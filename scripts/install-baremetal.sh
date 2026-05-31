#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/opt/haulhub}"
export APP_DIR

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

if [ "$(pwd)" != "$APP_DIR" ]; then
  mkdir -p "$APP_DIR"
  cp -R . "$APP_DIR"
  cd "$APP_DIR"
fi

mkdir -p "$APP_DIR/data/uploads"

if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
fi

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

load_env_file "$APP_DIR/.env"

pm2 startOrReload "$APP_DIR/ecosystem.config.cjs" --update-env
pm2 save
pm2 startup systemd -u "$(id -un)" --hp "$HOME" || true

pm2 status haulhub-api haulhub-web
echo "Nginx was not modified. Add the location blocks from $APP_DIR/deploy/nginx.conf to your server config manually."
