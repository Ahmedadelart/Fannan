// Cloudflare Worker in front of Fannan (routes: fannan.net/* and *.fannan.net/*).
// Passes every request to the Cloud Run service, keeping the visitor's address in
// X-Forwarded-Host so the app knows which surface (marketing, app, artist site) to show.
// ORIGIN is set when the Worker is deployed (infra/deploy-edge.mjs).

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const visitorHost = url.host;
    const origin = new URL(env.ORIGIN);

    const upstream = new URL(url.pathname + url.search, origin);
    const headers = new Headers(request.headers);
    headers.set("x-forwarded-host", visitorHost);
    headers.set("x-forwarded-proto", "https");

    const response = await fetch(upstream, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    });

    // Never leak the internal address in redirects.
    const location = response.headers.get("location");
    if (location && location.includes(origin.host)) {
      const fixed = new Response(response.body, response);
      fixed.headers.set("location", location.replace(origin.host, visitorHost));
      return fixed;
    }
    return response;
  },
};
