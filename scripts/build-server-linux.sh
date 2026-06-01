#!/usr/bin/env bash
set -euo pipefail

HTTP_PORT="${HTTP_PORT:-8088}"
API_BASE_URL="${API_BASE_URL:-/api}"
MOBILE_APP_BASE_PATH="${MOBILE_APP_BASE_PATH:-/app/}"
PATH_PREFIX="${PATH_PREFIX:-}"
INCLUDE_NODE_MODULES="${INCLUDE_NODE_MODULES:-1}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_ROOT="$ROOT/release"
RELEASE_DIR="$RELEASE_ROOT/haulhub-server-linux"
ARCHIVE="$RELEASE_ROOT/haulhub-server-linux.tar.gz"
BUILD_ROOT="${BUILD_ROOT:-/tmp/haulhub-linux-build}"
BUILD_DIR="$BUILD_ROOT/src"

trim_slashes() {
  printf '%s' "$1" | sed 's#^/*##;s#/*$##'
}

PREFIX="$(trim_slashes "$PATH_PREFIX")"
BASE_PATH=""

if [ -n "$PREFIX" ]; then
  BASE_PATH="/$PREFIX"
  if [ "$API_BASE_URL" = "/api" ]; then
    API_BASE_URL="$BASE_PATH/api"
  fi
  if [ "$MOBILE_APP_BASE_PATH" = "/app/" ]; then
    MOBILE_APP_BASE_PATH="$BASE_PATH/app/"
  fi
fi

case "$MOBILE_APP_BASE_PATH" in
  /*) ;;
  *) MOBILE_APP_BASE_PATH="/$MOBILE_APP_BASE_PATH" ;;
esac
case "$MOBILE_APP_BASE_PATH" in
  */) ;;
  *) MOBILE_APP_BASE_PATH="$MOBILE_APP_BASE_PATH/" ;;
esac

rm -rf "$BUILD_ROOT"
mkdir -p "$BUILD_DIR"

tar \
  --exclude='./.git' \
  --exclude='./.dev-logs' \
  --exclude='./node_modules' \
  --exclude='./release' \
  --exclude='./apps/admin-web/.next' \
  --exclude='./apps/driver-uni/dist' \
  -C "$ROOT" \
  -cf - . | tar -C "$BUILD_DIR" -xf -

cd "$BUILD_DIR"

rm -rf "$RELEASE_DIR" "$ARCHIVE"
mkdir -p "$RELEASE_DIR"

npm ci --include=dev

export NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL"
export NEXT_PUBLIC_BASE_PATH="$BASE_PATH"
export NEXT_PUBLIC_AMAP_JS_KEY="${NEXT_PUBLIC_AMAP_JS_KEY:-}"
export NEXT_PUBLIC_AMAP_SECURITY_JS_CODE="${NEXT_PUBLIC_AMAP_SECURITY_JS_CODE:-}"
export VITE_API_BASE_URL="$API_BASE_URL"
export VITE_H5_BASE="$MOBILE_APP_BASE_PATH"

npm --workspace apps/api run db:generate
npm --workspace apps/admin-web run build
npm --workspace apps/driver-uni run build:h5

cp package.json package-lock.json "$RELEASE_DIR/"
cp -R apps/api "$RELEASE_DIR/apps-api-tmp"
mkdir -p "$RELEASE_DIR/apps"
mv "$RELEASE_DIR/apps-api-tmp" "$RELEASE_DIR/apps/api"
mkdir -p "$RELEASE_DIR/apps/admin-web"
cp apps/admin-web/package.json "$RELEASE_DIR/apps/admin-web/package.json"
cp -R packages "$RELEASE_DIR/packages"
if [ "$INCLUDE_NODE_MODULES" = "1" ]; then
  cp -R node_modules "$RELEASE_DIR/node_modules"
fi

mkdir -p "$RELEASE_DIR/admin-web"
cp -R apps/admin-web/.next/standalone/apps/admin-web/. "$RELEASE_DIR/admin-web/"
cp -R apps/admin-web/.next/static "$RELEASE_DIR/admin-web/.next/static"
if [ -d apps/admin-web/public ]; then
  cp -R apps/admin-web/public "$RELEASE_DIR/admin-web/public"
fi

mobile_relative_path="$(trim_slashes "$MOBILE_APP_BASE_PATH")"
mkdir -p "$RELEASE_DIR/web-root/$mobile_relative_path"
cp -R apps/driver-uni/dist/build/h5/. "$RELEASE_DIR/web-root/$mobile_relative_path/"

mkdir -p "$RELEASE_DIR/deploy/systemd"
cp deploy/systemd/*.service "$RELEASE_DIR/deploy/systemd/" 2>/dev/null || true
cp deploy/ecosystem.config.cjs "$RELEASE_DIR/ecosystem.config.cjs"

nginx="$(cat deploy/nginx.baremetal.conf)"
nginx="${nginx//\$\{HTTP_PORT\}/$HTTP_PORT}"
nginx="${nginx//\$\{API_LOCATION\}/$API_BASE_URL/}"
files_location="/files/"
if [ -n "$BASE_PATH" ]; then
  files_location="$BASE_PATH/files/"
fi
nginx="${nginx//\$\{FILES_LOCATION\}/$files_location}"
app_exact="${MOBILE_APP_BASE_PATH%/}"
nginx="${nginx//\$\{APP_EXACT_LOCATION\}/$app_exact}"
nginx="${nginx//\$\{APP_LOCATION\}/$MOBILE_APP_BASE_PATH}"
admin_exact="/__haulhub_admin_exact_disabled"
admin_location="/"
if [ -n "$BASE_PATH" ]; then
  admin_exact="$BASE_PATH"
  admin_location="$BASE_PATH/"
fi
nginx="${nginx//\$\{ADMIN_EXACT_LOCATION\}/$admin_exact}"
nginx="${nginx//\$\{ADMIN_LOCATION\}/$admin_location}"
printf '%s\n' "$nginx" > "$RELEASE_DIR/deploy/nginx.conf"

cat > "$RELEASE_DIR/.env.example" <<EOF
NODE_ENV=production
PORT=4000
DATABASE_URL=file:/opt/haulhub/data/haulhub.db
UPLOAD_DIR=/opt/haulhub/data/uploads
NEXT_PUBLIC_API_BASE_URL=$API_BASE_URL
NEXT_INTERNAL_API_BASE_URL=http://127.0.0.1:4000
NEXT_PUBLIC_BASE_PATH=$BASE_PATH
VITE_API_BASE_URL=$API_BASE_URL
VITE_H5_BASE=$MOBILE_APP_BASE_PATH
AMAP_WEB_SERVICE_KEY=
NEXT_PUBLIC_AMAP_JS_KEY=
NEXT_PUBLIC_AMAP_SECURITY_JS_CODE=
EOF

cp scripts/install-baremetal.sh "$RELEASE_DIR/install.sh"
cp scripts/patch-baremetal.sh "$RELEASE_DIR/patch.sh"

tar -C "$RELEASE_DIR" -czf "$ARCHIVE" .

echo ""
echo "Linux offline server package created: $ARCHIVE"
echo "Admin Web: ${admin_location}"
echo "API: $API_BASE_URL"
echo "Mobile Web App: $MOBILE_APP_BASE_PATH"
echo "Include node_modules: $INCLUDE_NODE_MODULES"
