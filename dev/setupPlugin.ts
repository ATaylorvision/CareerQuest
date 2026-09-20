// A private setup page for non-technical setup. Dev server only, localhost only.
// Keys typed here are written to .env.local on this computer and nowhere else.
import type { Plugin } from "vite";
import type { IncomingMessage } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

interface Field {
  key: string;
  label: string;
  help: string;
  link?: string;
  optional?: boolean;
  secret?: boolean;
}

const GROUPS: { title: string; blurb: string; fields: Field[] }[] = [
  {
    title: "1. Supabase (your database and logins)",
    blurb: "In your Supabase project open Project Settings, then API Keys, then the Legacy API keys tab.",
    fields: [
      { key: "VITE_SUPABASE_URL", label: "Project URL", help: "Looks like https://abcdefgh.supabase.co", secret: false },
      { key: "VITE_SUPABASE_ANON_KEY", label: "anon public key", help: "A very long code starting with eyJ" },
      { key: "SUPABASE_SERVICE_ROLE_KEY", label: "service_role key", help: "Also starts with eyJ. Keep this one private." },
      { key: "SUPABASE_DB_URL", label: "Database connection (lets me build the tables for you)", help: "Click Connect at the top of Supabase, choose Session pooler, copy the URI, and replace [YOUR-PASSWORD] with your database password.", optional: true },
    ],
  },
  {
    title: "2. Anthropic (the AI)",
    blurb: "console.anthropic.com, then API Keys.",
    fields: [{ key: "ANTHROPIC_API_KEY", label: "API key", help: "Starts with sk-ant-" }],
  },
  {
    title: "3. Adzuna (real job listings)",
    blurb: "developer.adzuna.com, then your dashboard.",
    fields: [
      { key: "ADZUNA_APP_ID", label: "Application ID", help: "A short code of letters and numbers", secret: false },
      { key: "ADZUNA_APP_KEY", label: "Application key", help: "A longer code" },
    ],
  },
  {
    title: "4. JSearch on RapidAPI (more real job listings)",
    blurb: "rapidapi.com, open JSearch, then Endpoints. The key is shown in the code panel as X-RapidAPI-Key.",
    fields: [{ key: "RAPIDAPI_KEY", label: "RapidAPI key", help: "A long code of letters and numbers" }],
  },
  {
    title: "5. Stripe (payments, TEST mode)",
    blurb: "dashboard.stripe.com. Turn on Test mode first, then Developers, then API keys. No real money moves in test mode.",
    fields: [
      { key: "STRIPE_SECRET_KEY", label: "Secret key", help: "Starts with sk_test_" },
      { key: "VITE_STRIPE_PUBLISHABLE_KEY", label: "Publishable key", help: "Starts with pk_test_", secret: false },
    ],
  },
  {
    title: "6. Resend (email)",
    blurb: "resend.com, then API Keys.",
    fields: [{ key: "RESEND_API_KEY", label: "API key", help: "Starts with re_" }],
  },
];

const ALL_KEYS = new Set(GROUPS.flatMap((g) => g.fields.map((f) => f.key)));

function envPath() {
  return path.resolve(process.cwd(), ".env.local");
}

function readEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(envPath())) return out;
  for (const line of fs.readFileSync(envPath(), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function writeEnv(updates: Record<string, string>) {
  let text = fs.existsSync(envPath()) ? fs.readFileSync(envPath(), "utf8") : "";
  for (const [k, v] of Object.entries(updates)) {
    const re = new RegExp(`^${k}=.*$`, "m");
    if (re.test(text)) text = text.replace(re, () => `${k}=${v}`);
    else text += `${text.endsWith("\n") || !text ? "" : "\n"}${k}=${v}\n`;
  }
  fs.writeFileSync(envPath(), text);
}

function isLocal(req: IncomingMessage) {
  const host = (req.headers.host ?? "").split(":")[0];
  const addr = req.socket.remoteAddress ?? "";
  return (host === "localhost" || host === "127.0.0.1") && (addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1");
}

function run(script: string): Promise<string> {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [script], { cwd: process.cwd() });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", () => resolve(out.replace(/\x1B\[[0-9;]*m/g, "").replace(/^.*injected env.*\n/gm, "")));
  });
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function page() {
  const env = readEnv();
  const groups = GROUPS.map(
    (g) => `
    <section>
      <h2>${esc(g.title)}</h2>
      <p class="blurb">${esc(g.blurb)}</p>
      ${g.fields
        .map((f) => {
          const filled = !!env[f.key]?.trim();
          return `<label>
            <span class="lbl">${esc(f.label)}${f.optional ? ' <em>(recommended)</em>' : ""} ${filled ? '<b class="ok">saved</b>' : ""}</span>
            <input type="${f.secret === false ? "text" : "password"}" name="${f.key}" autocomplete="off" spellcheck="false" placeholder="${filled ? "Saved. Leave blank to keep it, or paste a new one." : "Paste here"}" />
            <span class="help">${esc(f.help)}</span>
          </label>`;
        })
        .join("")}
    </section>`,
  ).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>CareerQuest setup</title>
  <style>
    :root{--b:#1d4ed8;--g:#15803d;--t:#0f172a;--m:#475569;--l:#e2e8f0}
    *{box-sizing:border-box}body{font:16px/1.5 system-ui,Segoe UI,sans-serif;color:var(--t);background:#f8fafc;margin:0;padding:24px}
    main{max-width:720px;margin:0 auto}h1{font-size:28px;margin:0 0 6px}
    .lead{color:var(--m);margin:0 0 20px}
    .safe{background:#ecfdf5;border:1px solid #bbf7d0;color:#14532d;border-radius:12px;padding:12px 16px;margin-bottom:20px;font-size:14px}
    section{background:#fff;border:1px solid var(--l);border-radius:14px;padding:18px 20px;margin-bottom:16px}
    h2{font-size:17px;margin:0 0 2px}.blurb{color:var(--m);font-size:14px;margin:0 0 12px}
    label{display:block;margin-bottom:14px}.lbl{display:block;font-weight:600;font-size:14px;margin-bottom:4px}
    em{font-weight:400;color:var(--m)}input{width:100%;padding:11px 12px;border:1px solid #cbd5e1;border-radius:10px;font:inherit}
    input:focus{outline:2px solid var(--b);border-color:var(--b)}.help{display:block;color:var(--m);font-size:13px;margin-top:3px}
    .ok{color:var(--g);font-size:12px;background:#dcfce7;padding:1px 8px;border-radius:99px;margin-left:6px}
    .bar{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0 16px}
    button{font:inherit;font-weight:600;border-radius:10px;padding:12px 18px;border:1px solid var(--l);background:#fff;cursor:pointer}
    button.p{background:var(--b);color:#fff;border-color:var(--b)}button:disabled{opacity:.5}
    pre{background:#0f172a;color:#e2e8f0;border-radius:12px;padding:14px 16px;font-size:13px;white-space:pre-wrap;min-height:60px}
  </style></head><body><main>
  <h1>CareerQuest setup</h1>
  <p class="lead">Paste your keys below, press Save, then Test. You can do it in pieces and come back.</p>
  <div class="safe"><b>This page is private.</b> It only works on your own computer. Whatever you paste is saved to a file on this computer and never sent through chat or shown on screen.</div>
  <form id="f">${groups}</form>
  <div class="bar">
    <button class="p" id="save">Save my keys</button>
    <button id="test">Test my keys</button>
    <button id="migrate">Create the database tables</button>
  </div>
  <pre id="out">Nothing run yet.</pre>
  <script>
    const out=document.getElementById('out');
    const post=(u,b)=>fetch(u,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b||{})}).then(r=>r.json());
    async function save(){
      const data={};new FormData(document.getElementById('f')).forEach((v,k)=>{if(String(v).trim())data[k]=String(v).trim()});
      const r=await post('/__setup/save',data);
      out.textContent=r.saved.length?('Saved '+r.saved.length+' key(s): '+r.saved.join(', ')+'\\n\\nNow press Test my keys.'):'Nothing new to save.';
      if(r.saved.length)setTimeout(()=>location.reload(),1800);
    }
    async function busy(btn,txt,fn){btn.disabled=true;out.textContent=txt;try{out.textContent=await fn()}finally{btn.disabled=false}}
    document.getElementById('save').onclick=e=>{e.preventDefault();save()};
    document.getElementById('test').onclick=async e=>{e.preventDefault();await save();busy(e.target,'Testing each service...',async()=>(await post('/__setup/test')).output)};
    document.getElementById('migrate').onclick=e=>{e.preventDefault();busy(e.target,'Building tables...',async()=>(await post('/__setup/migrate')).output)};
  </script></main></body></html>`;
}

export function setupPage(): Plugin {
  return {
    name: "careerquest-setup",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname !== "/setup" && !url.pathname.startsWith("/__setup/")) return next();
        if (!isLocal(req)) {
          res.statusCode = 403;
          res.end("Setup is only available on the computer running CareerQuest.");
          return;
        }
        if (url.pathname === "/setup") {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(page());
          return;
        }
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
        res.setHeader("Content-Type", "application/json");
        if (url.pathname === "/__setup/save") {
          const updates: Record<string, string> = {};
          for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
            if (ALL_KEYS.has(k) && typeof v === "string" && v.trim() && !/[\r\n]/.test(v)) updates[k] = v.trim().replace(/^["']|["']$/g, "");
          }
          writeEnv(updates);
          res.end(JSON.stringify({ saved: Object.keys(updates) }));
        } else if (url.pathname === "/__setup/test") {
          res.end(JSON.stringify({ output: await run("scripts/check-keys.mjs") }));
        } else if (url.pathname === "/__setup/migrate") {
          res.end(JSON.stringify({ output: await run("scripts/migrate.mjs") }));
        } else {
          res.statusCode = 404;
          res.end("{}");
        }
      });
    },
  };
}
