import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages 项目站点部署在 /nce/ 子路径下，必须设置 base。
// publicDir 指向 static/：Vite 会把 static/ 下的所有文件（音频、封面、图标、
// 截图、book.json）原样拷贝到 dist 根，正好对应站点根路径 /nce/。
export default defineConfig({
  base: "/nce/",
  plugins: [vue(), tailwindcss()],
  publicDir: "static",
});
