import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { VantResolver } from "@vant/auto-import-resolver";

// 后端真实地址。dev / preview 由 Vite 代理转发，生产由 Cloudflare Pages Functions 转发，
// 保证线上 https 页面不直连 http 接口（规避浏览器混合内容拦截）
// const API_PROXY = {
//   "/api": {
//     target: "http://codercba.com:1888",
//     changeOrigin: true,
//   },
// };

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [VantResolver()],
    }),
    Components({
      resolvers: [VantResolver()],
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // server: {
  //   proxy: API_PROXY,
  // },
  // preview: {
  //   proxy: API_PROXY,
  // },
});
