// Cloudflare Worker 入口
// 1) /api/**  → 转发到后端真实地址，并在边缘缓存 GET 结果
// 2) 其他请求 → 交给绑定的静态资源（Vite 构建产物 dist）
//
// 为什么必须缓存：上游 codercba.com:1888 在国内，Cloudflare 边缘跨境回源一次要 5s+，
// 首页一开就要发 3 个请求，不缓存的话用户每次都得干等。

const UPSTREAM = "http://codercba.com:1888";
const CACHE_TTL_SECONDS = 600;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

function withCORS(response) {
  const next = new Response(response.body, response);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    next.headers.set(key, value);
  }
  return next;
}

function jsonError(message, status = 502) {
  return withCORS(
    new Response(
      JSON.stringify({ errcode: status, errmsg: message, data: null }),
      {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    )
  );
}

async function fetchUpstream(request) {
  const url = new URL(request.url);
  const target = UPSTREAM + url.pathname + url.search;

  const init = { method: request.method, headers: {} };
  const contentType = request.headers.get("Content-Type");
  if (contentType) init.headers["Content-Type"] = contentType;
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  try {
    return await fetch(target, init);
  } catch (error) {
    return jsonError("upstream fetch failed: " + error.message);
  }
}

function toProxied(upstreamResponse) {
  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: {
      "Content-Type":
        upstreamResponse.headers.get("Content-Type") ??
        "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
    },
  });
}

async function proxyApi(request, ctx) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== "GET") {
    return withCORS(toProxied(await fetchUpstream(request)));
  }

  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });

  const hit = await cache.match(cacheKey);
  if (hit) {
    const cached = new Response(hit.body, hit);
    cached.headers.set("X-Worker-Cache", "HIT");
    return withCORS(cached);
  }

  const upstreamResponse = await fetchUpstream(request);
  if (upstreamResponse.ok) {
    const toCache = toProxied(upstreamResponse.clone());
    toCache.headers.set("X-Worker-Cache", "MISS");
    ctx.waitUntil(cache.put(cacheKey, toCache.clone()));
  }

  const response = toProxied(upstreamResponse);
  response.headers.set("X-Worker-Cache", "MISS");
  return withCORS(response);
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith("/api/")) {
      return proxyApi(request, ctx);
    }

    return env.ASSETS.fetch(request);
  },
};
