// Faux Jellyseerr du banc « droits-vigie » : un catalogue déterministe, aucune sortie vers TMDB.
import { createServer } from "node:http";
const PORT = Number(process.env.PORT ?? 18142);
const posted = [];
const movie = (id) => ({ id, mediaType: "movie", title: `Film ${id}`, posterPath: null, releaseDate: "2020-01-01", voteAverage: 7, voteCount: 100, popularity: 10 });
const page = (n, total, make) => ({ page: n, totalPages: total, totalResults: total * 20, results: n > total ? [] : Array.from({ length: 20 }, (_, i) => make((n - 1) * 20 + i + 1)) });
function route(method, url, body) {
  const p = url.pathname;
  const n = Number(url.searchParams.get("page") ?? 1);
  if (p === "/api/v1/status") return [200, { version: "2.7.3" }];
  if (p === "/api/v1/settings/main") return [200, { blocklistedTags: "", enableSpecialEpisodes: false }];
  if (p === "/api/v1/discover/movies") return [200, page(n, 5, movie)];
  if (p === "/api/v1/discover/trending") return [200, page(n, 5, movie)];
  if (p === "/api/v1/search") return [200, page(n, 1, movie)];
  let m = /^\/api\/v1\/movie\/(\d+)$/.exec(p);
  if (m) return [200, { ...movie(Number(m[1])), keywords: [], credits: { cast: [] }, relatedVideos: [] }];
  m = /^\/api\/v1\/movie\/(\d+)\/similar$/.exec(p);
  if (m) return [200, page(n, 2, (i) => movie(1000 + i))];
  if (p === "/api/v1/collection/9") return [200, { id: 9, name: "Saga", parts: [movie(1), movie(2)] }];
  if (p === "/api/v1/request" && method === "GET") return [200, { pageInfo: { pages: 0, pageSize: 50, results: 0, page: 1 }, results: [] }];
  if (p === "/api/v1/request" && method === "POST") { posted.push(JSON.parse(body || "{}")); return [201, { id: 500 + posted.length, status: 1, media: { id: 70, status: 2 } }]; }
  if (p === "/api/v1/user" && method === "GET") return [200, { pageInfo: { pages: 0, results: 0 }, results: [] }];
  if (p === "/__posted") return [200, { posted }];
  return [404, { message: "not in fake" }];
}
createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const [status, json] = route(req.method, new URL(req.url, "http://x"), body);
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(json));
  });
}).listen(PORT, "127.0.0.1", () => console.log(`[fake-seerr] :${PORT}`));
