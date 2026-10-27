var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/index.js
var UPSTREAM = "http://codercba.com:1888";
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization"
};
function withCORS(response) {
  const newResponse = new Response(response.body, response);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    newResponse.headers.set(key, value);
  }
  return newResponse;
}
__name(withCORS, "withCORS");
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
      "Content-Type": upstreamResponse.headers.get("Content-Type") ?? "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60"
    }
  });
  return withCORS(proxied);
}
__name(proxyApi, "proxyApi");
var index_default = {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/api/")) {
      return proxyApi(request);
    }
    return env.ASSETS.fetch(request);
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
