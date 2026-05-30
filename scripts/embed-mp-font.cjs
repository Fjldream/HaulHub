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
