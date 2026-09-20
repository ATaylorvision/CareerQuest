/**
 * Page layouts for a cover letter.
 *
 * The words are written elsewhere. These only decide how the page is set:
 * the header, the greeting, how the body is broken up, and the sign off.
 * Black, white and grey, one page, real text.
 */

export interface LetterContext {
  name: string;
  location: string;
  phone: string;
  email: string;
  /** Body paragraphs, already written. */
  paragraphs: string[];
  company: string;
  jobTitle: string;
  hiringManager?: string;
  date: string;
}

export interface LetterTemplate {
  id: string;
  name: string;
  blurb: string;
  bestFor: string;
  css: string;
  body: (c: LetterContext) => string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const paras = (c: LetterContext) => c.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("");
const greeting = (c: LetterContext) => (c.hiringManager ? `Dear ${esc(c.hiringManager)},` : "Dear Hiring Manager,");

const BASE = `
  *{box-sizing:border-box}
  body{color:#111;margin:0;padding:46px 54px;font-size:11pt;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  p{margin:0 0 11px}
  .sign{margin-top:22px}
  @page{margin:0}
  @media print{body{padding:40px 48px}}
`;

export const LETTER_TEMPLATES: LetterTemplate[] = [
  {
    id: "signature",
    name: "Signature",
    blurb: "The same bold name and rule as the Signature resume, so the two arrive looking like a set.",
    bestFor: "Sending a resume and letter together.",
    css: `${BASE}
      body{font-family:Calibri,Carlito,"Segoe UI",Arial,sans-serif}
      h1{font-size:25pt;margin:0;font-weight:700;letter-spacing:-.2px}
      .contact{color:#666;font-size:9.5pt;margin-top:6px}
      .rule{border-bottom:2.5px solid #111;margin:10px 0 18px}
      .meta{color:#555;font-size:9.5pt;margin-bottom:16px}
      .greet{margin-bottom:11px}
    `,
    body: (c) => `
      <h1>${esc(c.name)}</h1>
      <div class="contact">${[c.location, c.phone, c.email].filter(Boolean).map(esc).join(" &nbsp;|&nbsp; ")}</div>
      <div class="rule"></div>
      <div class="meta">${esc(c.date)}<br>${esc(c.company)}<br>Re: ${esc(c.jobTitle)}</div>
      <div class="greet">${greeting(c)}</div>
      ${paras(c)}
      <div class="sign">Sincerely,<br>${esc(c.name)}</div>`,
  },

  {
    id: "block",
    name: "Business block",
    blurb: "A traditional block letter: your address, the date, the company, then the letter.",
    bestFor: "Formal industries, and anything that may be printed and filed.",
    css: `${BASE}
      body{font-family:Georgia,"Times New Roman",serif}
      .from{margin-bottom:18px;line-height:1.5}
      .from b{font-size:12pt}
      .to{margin:18px 0;line-height:1.5}
      .greet{margin-bottom:11px}
    `,
    body: (c) => `
      <div class="from"><b>${esc(c.name)}</b><br>${[c.location, c.phone, c.email].filter(Boolean).map(esc).join("<br>")}</div>
      <div>${esc(c.date)}</div>
      <div class="to">${esc(c.hiringManager ?? "Hiring Manager")}<br>${esc(c.company)}</div>
      <div class="greet">${greeting(c)}</div>
      <p><b>Re: ${esc(c.jobTitle)}</b></p>
      ${paras(c)}
      <div class="sign">Sincerely,<br><br>${esc(c.name)}</div>`,
  },

  {
    id: "note",
    name: "Short note",
    blurb: "No letterhead at all. Reads like a good email, which is how most letters are actually read.",
    bestFor: "Pasting into an application box or the body of an email.",
    css: `${BASE}
      body{font-family:"Helvetica Neue",Arial,Helvetica,sans-serif;font-size:11pt;padding:44px 50px;max-width:660px}
      .subject{font-weight:600;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid #ddd}
      .greet{margin-bottom:11px}
      .sign{margin-top:18px;color:#333}
    `,
    body: (c) => `
      <div class="subject">${esc(c.jobTitle)} — ${esc(c.name)}</div>
      <div class="greet">${greeting(c)}</div>
      ${paras(c)}
      <div class="sign">Thanks for your time,<br>${esc(c.name)}<br><span style="color:#777;font-size:9.5pt">${[c.phone, c.email].filter(Boolean).map(esc).join(" · ")}</span></div>`,
  },

  {
    id: "proof",
    name: "Proof points",
    blurb: "An opening line, then your strongest evidence as three bullets, then a short close.",
    bestFor: "Skimmable roles and busy hiring managers who will not read four paragraphs.",
    css: `${BASE}
      body{font-family:Calibri,Carlito,"Segoe UI",Arial,sans-serif}
      h1{font-size:17pt;margin:0;font-weight:700}
      .contact{color:#666;font-size:9.5pt;margin:5px 0 16px;padding-bottom:12px;border-bottom:1px solid #ccc}
      .greet{margin-bottom:11px}
      ul{margin:12px 0;padding-left:18px}
      li{margin:7px 0}
    `,
    body: (c) => {
      // First paragraph opens, last one closes, everything between becomes evidence.
      const [first, ...rest] = c.paragraphs;
      const close = rest.length > 1 ? rest[rest.length - 1] : "";
      const middle = rest.length > 1 ? rest.slice(0, -1) : rest;
      return `
      <h1>${esc(c.name)}</h1>
      <div class="contact">${[c.location, c.phone, c.email].filter(Boolean).map(esc).join(" &nbsp;|&nbsp; ")}</div>
      <div class="greet">${greeting(c)}</div>
      ${first ? `<p>${esc(first)}</p>` : ""}
      ${middle.length ? `<ul>${middle.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
      ${close ? `<p>${esc(close)}</p>` : ""}
      <div class="sign">Sincerely,<br>${esc(c.name)}</div>`;
    },
  },

  {
    id: "story",
    name: "Narrative",
    blurb: "Opens on the story rather than the job title, with a quiet header underneath the first line.",
    bestFor: "Career changers explaining why the move makes sense.",
    css: `${BASE}
      body{font-family:Georgia,"Times New Roman",serif;font-size:11.5pt;line-height:1.7;padding:54px 60px;max-width:680px}
      .open{font-size:13pt;line-height:1.5;margin-bottom:18px}
      .who{color:#777;font-size:9.5pt;letter-spacing:.4px;text-transform:uppercase;margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid #ddd}
      .greet{margin-bottom:11px}
    `,
    body: (c) => {
      const [first, ...rest] = c.paragraphs;
      return `
      <div class="who">${esc(c.name)} &nbsp;·&nbsp; ${esc(c.jobTitle)} at ${esc(c.company)}</div>
      <div class="greet">${greeting(c)}</div>
      ${first ? `<p class="open">${esc(first)}</p>` : ""}
      ${rest.map((p) => `<p>${esc(p)}</p>`).join("")}
      <div class="sign">Sincerely,<br>${esc(c.name)}<br><span style="color:#777;font-size:9.5pt">${[c.phone, c.email].filter(Boolean).map(esc).join(" · ")}</span></div>`;
    },
  },
];

export const DEFAULT_LETTER_TEMPLATE = LETTER_TEMPLATES[0].id;

export function letterTemplate(id: string | undefined): LetterTemplate {
  return LETTER_TEMPLATES.find((t) => t.id === id) ?? LETTER_TEMPLATES[0];
}

export function renderLetterHtml(c: LetterContext, templateId: string | undefined, title: string): string {
  const t = letterTemplate(templateId);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${t.css}</style></head><body>${t.body(c)}</body></html>`;
}
