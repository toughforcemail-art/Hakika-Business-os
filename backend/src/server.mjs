import http from "node:http";
import { handleProvision } from "./app-mfa/service.mjs";

const port = Number(process.env.PORT || 5000);
function response(res, result) { res.writeHead(result.status, result.headers); res.end(result.body); }
function webHeaders(headers) { return Object.fromEntries(Object.entries(headers).filter(([, value]) => typeof value === "string")); }
async function body(request) { const chunks = []; let size = 0; for await (const chunk of request) { size += chunk.length; if (size > 32_768) throw Object.assign(new Error("Request too large"), { status: 413 }); chunks.push(chunk); } return Buffer.concat(chunks).toString("utf8"); }
const server = http.createServer(async (request, res) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/auth/sms-")) return response(res, { status: 410, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify({ error: "Use the same-origin application proxy" }) });
    if (url.pathname === "/api/platform/provision" && request.method === "POST") {
      const text = await body(request); request = new Request(url, { method: request.method, headers: webHeaders(request.headers), body: text });
      return response(res, await handleProvision(request));
    }
    if (url.pathname === "/api/health") return response(res, { status: 200, headers: { "content-type": "application/json" }, body: JSON.stringify({ ok: true, service: "hakika-backend" }) });
    response(res, { status: 404, headers: { "content-type": "application/json" }, body: JSON.stringify({ error: "Not found" }) });
  } catch (error) { const status = error.status || 500; response(res, { status, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify({ error: status === 500 ? "Request could not be completed" : error.message }) }); }
});
server.listen(port, "127.0.0.1", () => console.log(`Hakika backend listening on 127.0.0.1:${port}`));
