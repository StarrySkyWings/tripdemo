// 统一走同源 /api/**：
// - 开发（npm run dev）与本地预览（npm run preview）由 Vite proxy 转发
// - 生产（Cloudflare Pages）由 Pages Functions 转发
// 这样 https 页面不会直连 http 接口，规避浏览器「混合内容」拦截
export const BASE_URL = "/api";
export const TIMEOUT = 10000;
