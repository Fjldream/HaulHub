const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const fontPath = path.join(
  root,
  "apps",
  "driver-uni",
  "src",
  "static",
  "fonts",
  "material-symbols-outlined.woff2",
);
const wxssPath = path.join(
  root,
  "apps",
  "driver-uni",
  "dist",
  "build",
  "mp-weixin",
  "app.wxss",
);
const appJsonPath = path.join(
  root,
  "apps",
  "driver-uni",
  "dist",
  "build",
  "mp-weixin",
  "app.json",
);
const projectConfigPath = path.join(
  root,
  "apps",
  "driver-uni",
  "dist",
  "build",
  "mp-weixin",
  "project.config.json",
);

if (!fs.existsSync(fontPath)) {
  throw new Error(`Material Symbols font not found: ${fontPath}`);
}

if (!fs.existsSync(wxssPath)) {
  throw new Error(`WeChat app.wxss not found: ${wxssPath}`);
}

const fontBase64 = fs.readFileSync(fontPath).toString("base64");
const dataUrl = `data:font/woff2;base64,${fontBase64}`;
const wxss = fs.readFileSync(wxssPath, "utf8");
const nextWxss = wxss.replace(
  /url\((?:\/?static\/fonts\/material-symbols-outlined\.woff2|["']\/?static\/fonts\/material-symbols-outlined\.woff2["'])\)\s*format\(["']woff2["']\)/,
  `url("${dataUrl}") format("woff2")`,
);

if (nextWxss === wxss) {
  throw new Error("Material Symbols font URL was not found in app.wxss");
}

fs.writeFileSync(wxssPath, nextWxss);
console.log("Embedded Material Symbols font into mp-weixin app.wxss");

if (!fs.existsSync(appJsonPath)) {
  throw new Error(`WeChat app.json not found: ${appJsonPath}`);
}
const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
appJson.lazyCodeLoading = "requiredComponents";
fs.writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`);
console.log("Enabled required component lazy loading in mp-weixin app.json");

if (!fs.existsSync(projectConfigPath)) {
  throw new Error(`WeChat project.config.json not found: ${projectConfigPath}`);
}
const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, "utf8"));
projectConfig.setting = {
  ...projectConfig.setting,
  minified: true,
  uploadWithSourceMap: false,
};
fs.writeFileSync(projectConfigPath, `${JSON.stringify(projectConfig, null, 2)}\n`);
console.log("Enabled upload-ready minification settings in project.config.json");
