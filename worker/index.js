// Cloudflare Worker 入口
// 1) /api/**  → 转发到后端真实地址（后端只有 http，浏览器 https 页面直连会被拦截）
// 2) 其他请求 → 交给绑定的静态资源（Vite 构建产物 dist）

const UPSTREAM = "http://codercba.com:1888";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

function withCORS(response) {
  const newResponse = new Response(response.body, response);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    newResponse.headers.set(key, value);
  }
  return newResponse;
}

async function proxyApi(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const target = UPSTREAM + url.pathname + url.search;

  const init = { method: request.method, headers: {} };
  const contentType = request.headers.get("Content-Type");
  if (contentType) init.headers["Content-Type"] = contentType;
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstreamResponse = await fetch(target, init);
  const proxied = new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: {
      "Content-Type":
        upstreamResponse.headers.get("Content-Type") ??
        "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
  return withCORS(proxied);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith("/api/")) {
      return proxyApi(request);
    }

    return env.ASSETS.fetch(request);
  },
};
