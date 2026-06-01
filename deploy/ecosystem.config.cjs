const appDir = process.env.APP_DIR || "/opt/haulhub";

module.exports = {
  apps: [
    {
      name: "haulhub-api",
      cwd: appDir,
      script: "npm",
      args: "--workspace apps/api run start",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "4000",
        DATABASE_URL: process.env.DATABASE_URL || `file:${appDir}/data/haulhub.db`,
        UPLOAD_DIR: process.env.UPLOAD_DIR || `${appDir}/data/uploads`,
        AMAP_WEB_SERVICE_KEY: process.env.AMAP_WEB_SERVICE_KEY || "",
      },
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: "haulhub-web",
      cwd: `${appDir}/admin-web`,
      script: "server.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: process.env.WEB_PORT || "3000",
        NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "/api",
        NEXT_INTERNAL_API_BASE_URL: process.env.NEXT_INTERNAL_API_BASE_URL || "http://127.0.0.1:4000",
        NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH || "",
        NEXT_PUBLIC_AMAP_JS_KEY: process.env.NEXT_PUBLIC_AMAP_JS_KEY || "",
        NEXT_PUBLIC_AMAP_SECURITY_JS_CODE: process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE || "",
      },
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
