<script setup lang="ts">
</script>

<template>
  <view />
</template>

<style>
/* #ifdef H5 */
@import url("https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap");
@import url("https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap");
/* #endif */

/* #ifdef MP-WEIXIN */
@font-face {
  font-family: "Material Symbols Outlined";
  font-style: normal;
  font-weight: 400;
  src: url("/static/fonts/material-symbols-outlined.woff2") format("woff2");
}
/* #endif */

page {
  --driver-status-height: var(--status-bar-height, 0px);
  --driver-topbar-body-height: 64px;
  --driver-topbar-height: calc(var(--driver-status-height) + var(--driver-topbar-body-height));
  --driver-tabs-height: 58px;
  --driver-bottom-safe: 8px;
  --driver-bottom-body-height: 74px;
  --driver-bottom-height: calc(var(--driver-bottom-body-height) + var(--driver-bottom-safe));
  --driver-gutter: clamp(16px, 4.5vw, 22px);
  --driver-shell-width: 100vw;
  --driver-bg: #f5f7fb;
  --driver-surface: #ffffff;
  --driver-surface-soft: #eef4ff;
  --driver-ink: #172033;
  --driver-muted: #687385;
  --driver-primary: #0b2f5b;
  --driver-primary-2: #1262b8;
  --driver-accent: #ffb454;
  --driver-green: #1f8f61;
  --driver-red: #c23b36;
  --driver-border: rgba(30, 48, 80, 0.1);
  --driver-shadow: 0 14px 34px rgba(16, 39, 74, 0.12);
  --driver-soft-shadow: 0 8px 22px rgba(16, 39, 74, 0.08);
  background: var(--driver-bg);
  color: var(--driver-ink);
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Microsoft YaHei", Arial, sans-serif;
}

view,
text,
button,
input,
textarea {
  box-sizing: border-box;
}

button,
uni-button {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: 1;
  text-align: center;
}

button::after,
uni-button::after {
  border: 0;
}

button text,
uni-button text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1.2;
}

.material-symbols-outlined {
  display: inline-block;
  font-family: "Material Symbols Outlined";
  font-size: 24px;
  font-style: normal;
  font-weight: normal;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  font-feature-settings: "liga";
  -webkit-font-feature-settings: "liga";
  -webkit-font-smoothing: antialiased;
  font-variation-settings: "FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24;
}

.driver-page {
  position: relative;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  overflow-x: hidden;
  background:
    radial-gradient(circle at 18% 0%, rgba(18, 98, 184, 0.14), transparent 34%),
    linear-gradient(180deg, #f8fbff 0%, var(--driver-bg) 34%, #f7f8fb 100%);
  color: var(--driver-ink);
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Microsoft YaHei", Arial, sans-serif;
}

.driver-topbar {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  width: var(--driver-shell-width);
  min-height: var(--driver-topbar-height);
  padding: var(--driver-status-height) var(--driver-gutter) 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.62);
  background: rgba(248, 251, 255, 0.9);
  box-shadow: 0 8px 28px rgba(16, 39, 74, 0.08);
  backdrop-filter: blur(18px);
}

.driver-icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: var(--driver-primary);
  box-shadow: 0 5px 16px rgba(16, 39, 74, 0.08);
}

.driver-brand,
.driver-title {
  flex: 1;
  min-width: 0;
  color: var(--driver-primary);
  font-family: "Hanken Grotesk", Inter, sans-serif;
  font-size: 21px;
  font-weight: 800;
  line-height: 28px;
}

.driver-brand {
  font-size: 26px;
  font-weight: 800;
  line-height: 32px;
}

.driver-content {
  min-height: 100vh;
  min-height: 100dvh;
  padding: calc(var(--driver-topbar-height) + 20px) var(--driver-gutter)
    calc(var(--driver-bottom-height) + 32px);
}

.driver-card {
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: var(--driver-soft-shadow);
}

.driver-bottom-nav,
.driver-bottom-action {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 50;
  width: var(--driver-shell-width);
  border-top: 1px solid rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 -12px 30px rgba(16, 39, 74, 0.1);
  backdrop-filter: blur(18px);
}

.driver-bottom-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(10px, 3vw, 18px);
  min-height: var(--driver-bottom-height);
  padding: 8px var(--driver-gutter) calc(8px + var(--driver-bottom-safe));
}

.driver-nav-item {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  max-width: none;
  min-height: 48px;
  margin: 0;
  padding: 0 8px;
  border-radius: 18px;
  color: var(--driver-muted);
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
}

.driver-nav-item.active {
  background: linear-gradient(135deg, var(--driver-primary), var(--driver-primary-2));
  color: #ffffff;
  box-shadow: 0 10px 22px rgba(18, 98, 184, 0.22);
}

.driver-nav-item .material-symbols-outlined {
  margin-bottom: 0;
}

.driver-nav-item text:last-child {
  max-width: 100%;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.driver-primary-button,
.driver-secondary-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
  min-height: 56px;
  padding: 0 16px;
  border-radius: 18px;
  font-family: "Hanken Grotesk", Inter, sans-serif;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
}

.driver-primary-button {
  background: linear-gradient(135deg, var(--driver-primary), var(--driver-primary-2));
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(18, 98, 184, 0.24);
}

.driver-secondary-button {
  background: #edf4ff;
  color: var(--driver-primary);
}

.driver-primary-button[disabled],
.driver-secondary-button[disabled] {
  opacity: 0.55;
}

.driver-label {
  color: var(--driver-muted);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.driver-heading {
  color: var(--driver-primary);
  font-family: "Hanken Grotesk", Inter, sans-serif;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}

.driver-body {
  color: var(--driver-ink);
  font-size: 16px;
  line-height: 24px;
}

.driver-muted {
  color: var(--driver-muted);
  font-size: 14px;
  line-height: 20px;
}

@media (max-width: 340px) {
  page {
    --driver-gutter: 12px;
  }

  .driver-brand {
    font-size: 22px;
  }

  .driver-primary-button,
  .driver-secondary-button {
    font-size: 16px;
    line-height: 22px;
  }
}

@media (min-width: 520px) {
  .driver-nav-item {
    flex: 0 0 220px;
  }
}
</style>
