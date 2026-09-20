// Runs the Vercel-style functions in /api inside the Vite dev server,
// so local development matches production without the Vercel CLI.
import type { Plugin, ViteDevServer } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export function devApi(): Plugin {
  let server: ViteDevServer;
  return {
    name: "careerquest-dev-api",
    configureServer(s) {
      server = s;
      s.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (!url.pathname.startsWith("/api/")) return next();
        const name = url.pathname.replace(/^\/api\//, "").replace(/\/$/, "");
        const file = path.resolve(process.cwd(), "api", `${name}.ts`);
        if (!/^[a-z0-9/_-]+$/i.test(name) || name.startsWith("_") || !fs.existsSync(file)) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Not found" }));
          return;
        }
        try {
          const raw = await readBody(req);
          const vreq = req as IncomingMessage & { query: Record<string, string>; body: unknown; rawBody: Buffer };
          vreq.query = Object.fromEntries(url.searchParams);
          vreq.rawBody = raw;
          const ct = req.headers["content-type"] ?? "";
          vreq.body = raw.length && ct.includes("application/json") ? JSON.parse(raw.toString("utf8")) : raw.toString("utf8");
          const vres = res as ServerResponse & { status: (c: number) => typeof vres; json: (b: unknown) => void; send: (b: unknown) => void };
          vres.status = (c: number) => {
            res.statusCode = c;
            return vres;
          };
          vres.json = (b: unknown) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(b));
          };
          vres.send = (b: unknown) => res.end(typeof b === "string" || Buffer.isBuffer(b) ? b : JSON.stringify(b));
          const mod = await server.ssrLoadModule(file);
          await mod.default(vreq, vres);
        } catch (e) {
          console.error(`[api/${name}]`, e);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
          }
          res.end(JSON.stringify({ error: "Server error" }));
        }
      });
    },
  };
}
