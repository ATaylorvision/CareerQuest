import type { BuiltResume } from "@/lib/resumeBuild";
import { applyFormat, DEFAULT_FORMAT, type ResumeFormat } from "@/lib/resumeFormat";

/**
 * Page layouts for a finished resume.
 *
 * Every one of these is black, white and grey, one page, and made of real
 * selectable text. No columns are faked with tables, no icons carry meaning,
 * and nothing important is inside an image, because an applicant tracking
 * system reads the text and throws the styling away.
 */

export interface ResumeTemplate {
  id: string;
  name: string;
  blurb: string;
  /** Shown as a short note under the name in the picker. */
  bestFor: string;
  /** Two column layouts read well for humans; a single column is the safest for older parsers. */
  columns: 1 | 2;
  /** The body size, in points, that the layout is designed at. Font size controls scale from this. */
  base: number;
  /** The layout's own line spacing. */
  lh: number;
  /** Paints to the page edge, so its margins are fixed and it stays on one page. */
  bleed?: boolean;
  css: string;
  body: (r: BuiltResume, h: Helpers) => string;
}

export interface Helpers {
  esc: (s: string) => string;
  /** Target title and value proposition, when the user has set them. */
  headline: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const contactLine = (r: BuiltResume) => [r.location, r.phone, r.email].filter(Boolean).map(esc).join(" &nbsp;|&nbsp; ");

const bullets = (r: BuiltResume) =>
  r.roles
    .map(
      (role) => `<div class="role">
      <div class="rh"><span class="co">${esc(role.company)}</span><span class="loc">${esc(role.location)}</span></div>
      <div class="rt"><span class="ti">${esc(role.title)}</span><span class="dt">${esc(role.start)} – ${esc(role.end)}</span></div>
      <ul>${role.bullets.map((b) => `<li>${esc(b.text)}</li>`).join("")}</ul>
    </div>`,
    )
    .join("");

/** Plain single column experience, used by the simpler layouts. */
const bulletsPlain = (r: BuiltResume) =>
  r.roles
    .map(
      (role) => `<div class="role">
      <div class="rh"><b>${esc(role.title)}</b><span class="dt">${esc(role.start)} – ${esc(role.end)}</span></div>
      <div class="sub">${esc(role.company)}${role.location ? `, ${esc(role.location)}` : ""}</div>
      <ul>${role.bullets.map((b) => `<li>${esc(b.text)}</li>`).join("")}</ul>
    </div>`,
    )
    .join("");

const certsBlock = (r: BuiltResume) => (r.certifications.length ? `<h2>Certifications</h2><div class="stack">${r.certifications.map(esc).join("<br>")}</div>` : "");
const eduBlock = (r: BuiltResume) => (r.education.length ? `<h2>Education</h2><div class="stack">${r.education.map(esc).join("<br>")}</div>` : "");

/* ---------------------------------------------------------------- */

const BASE = `
  *{box-sizing:border-box}
  body{color:#111;margin:0;padding:38px 44px;font-size:10.5pt;line-height:1.42;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  h1{margin:0;font-weight:700;letter-spacing:-.2px}
  ul{margin:4px 0 0;padding-left:16px} li{margin:2.5px 0}
  .dt,.loc{color:#555;font-size:9.5pt;white-space:nowrap}
  .stack{line-height:1.5}
  @page{margin:0}
  @media print{body{padding:34px 40px}}
`;

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  {
    id: "rail",
    name: "Signature",
    blurb: "Your name up top, then experience on the left with skills, education and certifications in a shaded rail beside it.",
    bestFor: "The house layout. Fits a lot on one page without feeling crowded.",
    columns: 2,
    base: 10.5,
    lh: 1.42,
    css: `${BASE}
      body{font-family:Calibri,Carlito,"Segoe UI",Arial,sans-serif}
      h1{font-size:27pt;line-height:1.05}
      .role-title{color:#444;font-size:11.5pt;margin-top:2px}
      .contact{color:#666;font-size:9.5pt;margin-top:6px}
      .rule{border-bottom:2.5px solid #111;margin:10px 0 12px}
      .summary{margin-bottom:14px}
      .cols{display:flex;gap:22px;align-items:flex-start}
      .main{flex:1 1 64%;min-width:0}
      .rail{flex:0 0 32%;background:#f1f1f1;padding:12px 14px}
      h2{font-size:9pt;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;margin:0 0 6px;padding-bottom:4px;border-bottom:1px solid #999}
      .main h2{margin-top:0}
      .rail h2{margin-top:14px} .rail h2:first-child{margin-top:0}
      .role{margin-bottom:11px} .role:last-child{margin-bottom:0}
      .rh,.rt{display:flex;justify-content:space-between;gap:10px}
      .co{font-weight:700} .ti{font-style:italic;color:#333} .dt{font-style:italic}
      .skill{padding:1.5px 0}
    `,
    body: (r, h) => `
      <h1>${esc(r.name)}</h1>
      ${h.headline ? `<div class="role-title">${esc(h.headline)}</div>` : ""}
      <div class="contact">${contactLine(r)}</div>
      <div class="rule"></div>
      ${r.summary ? `<div class="summary">${esc(r.summary)}</div>` : ""}
      <div class="cols">
        <div class="main">
          <h2>Professional Experience</h2>
          ${bullets(r)}
        </div>
        <div class="rail">
          ${r.skills.length ? `<h2>Core Skills</h2>${r.skills.map((s) => `<div class="skill">${esc(s)}</div>`).join("")}` : ""}
          ${eduBlock(r)}
          ${certsBlock(r)}
        </div>
      </div>`,
  },

  {
    id: "classic",
    name: "Classic",
    blurb: "One column, serif type, centred name. The most conservative thing you can send.",
    bestFor: "Government, education, healthcare, law, and any older application system.",
    columns: 1,
    base: 10.5,
    lh: 1.42,
    css: `${BASE}
      body{font-family:Georgia,"Times New Roman",serif;font-size:10.5pt}
      .head{text-align:center;margin-bottom:12px}
      h1{font-size:21pt;letter-spacing:.5px}
      .contact{color:#444;font-size:9.5pt;margin-top:5px}
      h2{font-size:10pt;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;border-bottom:1px solid #333;padding-bottom:3px;margin:16px 0 7px}
      .role{margin-bottom:11px}
      .rh{display:flex;justify-content:space-between;gap:10px}
      .sub{font-style:italic;color:#444;font-size:10pt}
    `,
    body: (r, h) => `
      <div class="head">
        <h1>${esc(r.name)}</h1>
        ${h.headline ? `<div class="contact">${esc(h.headline)}</div>` : ""}
        <div class="contact">${contactLine(r)}</div>
      </div>
      ${r.summary ? `<h2>Summary</h2><div>${esc(r.summary)}</div>` : ""}
      <h2>Experience</h2>${bulletsPlain(r)}
      ${eduBlock(r)}
      ${certsBlock(r)}
      ${r.skills.length ? `<h2>Skills</h2><div>${esc(r.skills.join(" · "))}</div>` : ""}`,
  },

  {
    id: "compact",
    name: "Compact",
    blurb: "Tighter spacing and a skills line instead of a list, so a long history still lands on one page.",
    bestFor: "Ten or more years of roles, or anyone whose resume keeps spilling onto page two.",
    columns: 1,
    base: 9.8,
    lh: 1.34,
    css: `${BASE}
      body{font-family:"Helvetica Neue",Arial,Helvetica,sans-serif;font-size:9.8pt;line-height:1.34;padding:30px 40px}
      h1{font-size:19pt}
      .top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;border-bottom:1.5px solid #111;padding-bottom:7px}
      .contact{color:#555;font-size:9pt;text-align:right;line-height:1.5}
      .role-title{color:#444;font-size:10.5pt}
      h2{font-size:8.5pt;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:#333;margin:12px 0 5px}
      .role{margin-bottom:8px}
      .rh{display:flex;justify-content:space-between;gap:10px}
      .sub{color:#555;font-size:9.3pt}
      ul{padding-left:15px} li{margin:1.5px 0}
    `,
    body: (r, h) => `
      <div class="top">
        <div>
          <h1>${esc(r.name)}</h1>
          ${h.headline ? `<div class="role-title">${esc(h.headline)}</div>` : ""}
        </div>
        <div class="contact">${[r.location, r.phone, r.email].filter(Boolean).map(esc).join("<br>")}</div>
      </div>
      ${r.summary ? `<h2>Profile</h2><div>${esc(r.summary)}</div>` : ""}
      <h2>Experience</h2>${bulletsPlain(r)}
      ${r.skills.length ? `<h2>Skills</h2><div>${esc(r.skills.join(" · "))}</div>` : ""}
      ${eduBlock(r)}
      ${certsBlock(r)}`,
  },

  {
    id: "sidebar",
    name: "Sidebar",
    blurb: "A narrow left column holds your contact details, skills and education. Experience gets the wide side.",
    bestFor: "Long skill lists, or when you want the reader to see your tools first.",
    columns: 2,
    base: 10.5,
    lh: 1.42,
    bleed: true,
    css: `${BASE}
      body{font-family:Calibri,Carlito,"Segoe UI",Arial,sans-serif;padding:0}
      .sheet{display:flex;min-height:100vh}
      .side{flex:0 0 31%;background:#111;color:#fff;padding:34px 20px}
      .side h1{font-size:19pt;line-height:1.1;color:#fff}
      .side .contact{color:#c9c9c9;font-size:9pt;margin-top:10px;line-height:1.7;word-break:break-word}
      .side h2{font-size:8.5pt;letter-spacing:1.4px;text-transform:uppercase;color:#fff;border-bottom:1px solid #555;padding-bottom:4px;margin:20px 0 7px}
      .side .stack,.side .skill{color:#e4e4e4;font-size:9.3pt}
      .skill{padding:1.5px 0}
      .main{flex:1 1 69%;padding:34px 30px;min-width:0}
      .role-title{color:#444;font-size:11.5pt;margin-bottom:12px}
      .main h2{font-size:9pt;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;border-bottom:1px solid #999;padding-bottom:4px;margin:0 0 8px}
      .main h2+*{margin-top:0}
      .role{margin-bottom:11px}
      .rh{display:flex;justify-content:space-between;gap:10px}
      .sub{font-style:italic;color:#444}
      .summary{margin-bottom:16px}
    `,
    body: (r, h) => `
      <div class="sheet">
        <div class="side">
          <h1>${esc(r.name)}</h1>
          <div class="contact">${[r.location, r.phone, r.email].filter(Boolean).map(esc).join("<br>")}</div>
          ${r.skills.length ? `<h2>Skills</h2>${r.skills.map((s) => `<div class="skill">${esc(s)}</div>`).join("")}` : ""}
          ${r.education.length ? `<h2>Education</h2><div class="stack">${r.education.map(esc).join("<br>")}</div>` : ""}
          ${r.certifications.length ? `<h2>Certifications</h2><div class="stack">${r.certifications.map(esc).join("<br>")}</div>` : ""}
        </div>
        <div class="main">
          ${h.headline ? `<div class="role-title">${esc(h.headline)}</div>` : ""}
          ${r.summary ? `<div class="summary">${esc(r.summary)}</div>` : ""}
          <h2>Experience</h2>${bulletsPlain(r)}
        </div>
      </div>`,
  },

  {
    id: "minimal",
    name: "Minimal",
    blurb: "Lots of white space, hairline rules, and nothing competing with the words.",
    bestFor: "Design, writing, product, and anywhere a calm page is the point.",
    columns: 1,
    base: 10.5,
    lh: 1.55,
    css: `${BASE}
      body{font-family:"Helvetica Neue",Arial,Helvetica,sans-serif;font-size:10.5pt;line-height:1.55;padding:52px 56px}
      h1{font-size:22pt;font-weight:600;letter-spacing:-.3px}
      .role-title{color:#555;margin-top:3px}
      .contact{color:#777;font-size:9.5pt;margin-top:10px}
      h2{font-size:8.5pt;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#888;margin:26px 0 9px}
      .role{margin-bottom:15px}
      .rh{display:flex;justify-content:space-between;gap:10px}
      .sub{color:#666}
      hr{border:0;border-top:1px solid #e2e2e2;margin:18px 0 0}
      ul{padding-left:15px}
    `,
    body: (r, h) => `
      <h1>${esc(r.name)}</h1>
      ${h.headline ? `<div class="role-title">${esc(h.headline)}</div>` : ""}
      <div class="contact">${contactLine(r)}</div>
      <hr>
      ${r.summary ? `<h2>Summary</h2><div>${esc(r.summary)}</div>` : ""}
      <h2>Experience</h2>${bulletsPlain(r)}
      ${eduBlock(r)}
      ${certsBlock(r)}
      ${r.skills.length ? `<h2>Skills</h2><div>${esc(r.skills.join(" · "))}</div>` : ""}`,
  },
  {
    id: "ledger",
    name: "Ledger",
    blurb: "Section names sit in a narrow column on the left, with the detail beside them. Easy to scan down the page.",
    bestFor: "Anyone with a clear list of roles who wants the reader to find things fast.",
    columns: 1,
    base: 10,
    lh: 1.4,
    css: `${BASE}
      body{font-family:Calibri,Carlito,"Segoe UI",Arial,sans-serif;font-size:10pt}
      h1{font-size:24pt;line-height:1.05}
      .contact{color:#555;font-size:9.5pt;margin:5px 0 14px}
      .sec{display:grid;grid-template-columns:104px 1fr;gap:14px;border-top:1px solid #bbb;padding:11px 0 4px}
      .sec>h2{font-size:8.5pt;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#333;margin:2px 0 0}
      .role{margin-bottom:10px}
      .rh{display:flex;justify-content:space-between;gap:10px}
      .sub{color:#555}
    `,
    body: (r, h) => {
      const sec = (title: string, inner: string) => (inner ? `<div class="sec"><h2>${title}</h2><div>${inner}</div></div>` : "");
      return `
      <h1>${esc(r.name)}</h1>
      ${h.headline ? `<div class="contact" style="margin-bottom:2px">${esc(h.headline)}</div>` : ""}
      <div class="contact">${contactLine(r)}</div>
      ${sec("Summary", r.summary ? esc(r.summary) : "")}
      ${sec("Experience", bulletsPlain(r))}
      ${sec("Skills", r.skills.length ? esc(r.skills.join(" · ")) : "")}
      ${sec("Education", r.education.map(esc).join("<br>"))}
      ${sec("Certifications", r.certifications.map(esc).join("<br>"))}`;
    },
  },

  {
    id: "timeline",
    name: "Timeline",
    blurb: "Dates run down the left edge with a thin rule, and each role hangs off it.",
    bestFor: "A steady career path where the progression is the story.",
    columns: 1,
    base: 10,
    lh: 1.4,
    css: `${BASE}
      body{font-family:Georgia,"Times New Roman",serif;font-size:10pt}
      h1{font-size:23pt;letter-spacing:.3px}
      .contact{color:#555;font-size:9.5pt;margin:4px 0 12px}
      h2{font-size:9pt;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:16px 0 8px;border-bottom:1px solid #333;padding-bottom:3px}
      .tl{border-left:1.5px solid #999;margin-left:64px;padding-left:16px}
      .item{position:relative;margin-bottom:11px}
      .item .when{position:absolute;left:-98px;width:76px;text-align:right;color:#555;font-size:8.8pt;line-height:1.3}
      .item b{font-size:10.5pt}
      .sub{color:#555;font-style:italic}
    `,
    body: (r, h) => `
      <h1>${esc(r.name)}</h1>
      ${h.headline ? `<div class="contact" style="margin-bottom:0">${esc(h.headline)}</div>` : ""}
      <div class="contact">${contactLine(r)}</div>
      ${r.summary ? `<h2>Summary</h2><div>${esc(r.summary)}</div>` : ""}
      <h2>Experience</h2>
      <div class="tl">${r.roles
        .map(
          (role) => `<div class="item role"><div class="when">${esc(role.start)}<br>${esc(role.end)}</div>
            <b>${esc(role.title)}</b><div class="sub">${esc(role.company)}${role.location ? `, ${esc(role.location)}` : ""}</div>
            <ul>${role.bullets.map((b) => `<li>${esc(b.text)}</li>`).join("")}</ul></div>`,
        )
        .join("")}</div>
      ${eduBlock(r)}
      ${certsBlock(r)}
      ${r.skills.length ? `<h2>Skills</h2><div>${esc(r.skills.join(" · "))}</div>` : ""}`,
  },

  {
    id: "banner",
    name: "Banner",
    blurb: "Your name in white on a solid dark band, then a clean single column. Confident without being loud.",
    bestFor: "Sales, operations, customer success and other roles where presence matters.",
    columns: 1,
    base: 10.3,
    lh: 1.4,
    css: `${BASE}
      body{font-family:Arial,Helvetica,"Liberation Sans",sans-serif;font-size:10.3pt}
      .band{background:#1a1a1a;color:#fff;padding:16px 20px;margin-bottom:12px}
      .band h1{font-size:22pt;color:#fff;letter-spacing:.2px}
      .band .contact{color:#d6d6d6;font-size:9.3pt;margin-top:5px}
      .band .role-title{color:#e8e8e8;font-size:10.5pt;margin-top:2px}
      h2{font-size:9pt;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;background:#eee;padding:3px 8px;margin:13px 0 7px}
      .role{margin-bottom:10px}
      .rh{display:flex;justify-content:space-between;gap:10px}
      .sub{color:#555}
    `,
    body: (r, h) => `
      <div class="band"><h1>${esc(r.name)}</h1>${h.headline ? `<div class="role-title">${esc(h.headline)}</div>` : ""}<div class="contact">${contactLine(r)}</div></div>
      ${r.summary ? `<h2>Summary</h2><div>${esc(r.summary)}</div>` : ""}
      <h2>Experience</h2>${bulletsPlain(r)}
      ${eduBlock(r)}
      ${certsBlock(r)}
      ${r.skills.length ? `<h2>Skills</h2><div>${esc(r.skills.join(" · "))}</div>` : ""}`,
  },

  {
    id: "executive",
    name: "Executive",
    blurb: "A centred serif header with a double rule, generous summary, and restrained small caps throughout.",
    bestFor: "Senior roles, management, finance and anywhere a formal tone is expected.",
    columns: 1,
    base: 10.5,
    lh: 1.45,
    css: `${BASE}
      body{font-family:Cambria,Georgia,"Times New Roman",serif}
      .head{text-align:center;padding-bottom:9px;border-bottom:3px double #222;margin-bottom:12px}
      h1{font-size:23pt;font-variant:small-caps;letter-spacing:1.6px;font-weight:600}
      .contact{color:#444;font-size:9.5pt;margin-top:5px}
      .role-title{font-style:italic;color:#333;margin-top:2px}
      h2{font-size:10pt;font-variant:small-caps;letter-spacing:1.6px;font-weight:700;margin:15px 0 6px;border-bottom:1px solid #aaa;padding-bottom:2px}
      .summary{font-size:10.8pt;line-height:1.5}
      .role{margin-bottom:10px}
      .rh{display:flex;justify-content:space-between;gap:10px}
      .sub{font-style:italic;color:#444}
    `,
    body: (r, h) => `
      <div class="head"><h1>${esc(r.name)}</h1>${h.headline ? `<div class="role-title">${esc(h.headline)}</div>` : ""}<div class="contact">${contactLine(r)}</div></div>
      ${r.summary ? `<div class="summary">${esc(r.summary)}</div>` : ""}
      <h2>Professional Experience</h2>${bulletsPlain(r)}
      ${eduBlock(r)}
      ${certsBlock(r)}
      ${r.skills.length ? `<h2>Core Competencies</h2><div>${esc(r.skills.join(" · "))}</div>` : ""}`,
  },

  {
    id: "split",
    name: "Split",
    blurb: "Experience on the wide left, skills, education and certifications on the right, divided by a single thin line.",
    bestFor: "When your skills deserve as much attention as your job history.",
    columns: 2,
    base: 10,
    lh: 1.4,
    css: `${BASE}
      body{font-family:"Helvetica Neue",Arial,Helvetica,sans-serif;font-size:10pt}
      h1{font-size:23pt}
      .contact{color:#555;font-size:9.3pt;margin:4px 0 6px}
      .rule{border-bottom:1.5px solid #111;margin:6px 0 12px}
      .cols{display:flex;gap:0;align-items:flex-start}
      .main{flex:1 1 66%;min-width:0;padding-right:18px}
      .side{flex:0 0 34%;border-left:1px solid #bbb;padding-left:18px}
      h2{font-size:8.8pt;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;margin:0 0 6px;color:#222}
      .side h2{margin-top:14px} .side h2:first-child{margin-top:0}
      .role{margin-bottom:10px}
      .rh{display:flex;justify-content:space-between;gap:8px}
      .sub{color:#555}
      .skill{padding:1px 0}
      .summary{margin-bottom:12px}
    `,
    body: (r, h) => `
      <h1>${esc(r.name)}</h1>
      ${h.headline ? `<div class="contact" style="margin:2px 0 0">${esc(h.headline)}</div>` : ""}
      <div class="contact">${contactLine(r)}</div>
      <div class="rule"></div>
      ${r.summary ? `<div class="summary">${esc(r.summary)}</div>` : ""}
      <div class="cols">
        <div class="main"><h2>Experience</h2>${bulletsPlain(r)}</div>
        <div class="side">
          ${r.skills.length ? `<h2>Skills</h2>${r.skills.map((x) => `<div class="skill">${esc(x)}</div>`).join("")}` : ""}
          ${eduBlock(r)}
          ${certsBlock(r)}
        </div>
      </div>`,
  },

  {
    id: "skillsfirst",
    name: "Skills first",
    blurb: "A grid of your skills right under your name, then your experience. Puts what you can do ahead of where you did it.",
    bestFor: "Career changers, whose skills travel further than their old job titles.",
    columns: 1,
    base: 10.2,
    lh: 1.4,
    css: `${BASE}
      body{font-family:Calibri,Carlito,"Segoe UI",Arial,sans-serif;font-size:10.2pt}
      h1{font-size:25pt;line-height:1.05}
      .contact{color:#555;font-size:9.5pt;margin:5px 0 4px}
      .role-title{color:#333;font-size:11pt}
      h2{font-size:9pt;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;border-bottom:1px solid #999;padding-bottom:3px;margin:15px 0 7px}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:3px 16px}
      .grid div{padding:2px 0 2px 10px;border-left:2px solid #333}
      .role{margin-bottom:10px}
      .rh{display:flex;justify-content:space-between;gap:10px}
      .sub{color:#555}
    `,
    body: (r, h) => `
      <h1>${esc(r.name)}</h1>
      ${h.headline ? `<div class="role-title">${esc(h.headline)}</div>` : ""}
      <div class="contact">${contactLine(r)}</div>
      ${r.summary ? `<h2>Summary</h2><div>${esc(r.summary)}</div>` : ""}
      ${r.skills.length ? `<h2>Key Skills</h2><div class="grid">${r.skills.map((x) => `<div>${esc(x)}</div>`).join("")}</div>` : ""}
      <h2>Experience</h2>${bulletsPlain(r)}
      ${eduBlock(r)}
      ${certsBlock(r)}`,
  },

  {
    id: "heritage",
    name: "Heritage",
    blurb: "A left aligned serif name, small caps headings and quiet dotted rules. Traditional, with a little warmth.",
    bestFor: "Education, nonprofit, healthcare, and hospitality.",
    columns: 1,
    base: 10.5,
    lh: 1.45,
    css: `${BASE}
      body{font-family:Garamond,"EB Garamond",Georgia,"Times New Roman",serif;font-size:11pt}
      h1{font-size:25pt;font-weight:600;letter-spacing:.4px}
      .contact{color:#444;font-size:10pt;margin:3px 0 4px}
      h2{font-size:10.5pt;font-variant:small-caps;letter-spacing:1.5px;font-weight:700;margin:15px 0 6px;border-bottom:1px dotted #555;padding-bottom:2px}
      .role{margin-bottom:10px}
      .rh{display:flex;justify-content:space-between;gap:10px}
      .sub{font-style:italic;color:#444}
      .dt{font-size:10pt}
    `,
    body: (r, h) => `
      <h1>${esc(r.name)}</h1>
      ${h.headline ? `<div class="contact" style="margin-top:0">${esc(h.headline)}</div>` : ""}
      <div class="contact">${contactLine(r)}</div>
      ${r.summary ? `<h2>Summary</h2><div>${esc(r.summary)}</div>` : ""}
      <h2>Experience</h2>${bulletsPlain(r)}
      ${eduBlock(r)}
      ${certsBlock(r)}
      ${r.skills.length ? `<h2>Skills</h2><div>${esc(r.skills.join(", "))}</div>` : ""}`,
  },
];

export const DEFAULT_RESUME_TEMPLATE = RESUME_TEMPLATES[0].id;

export function resumeTemplate(id: string | undefined): ResumeTemplate {
  return RESUME_TEMPLATES.find((t) => t.id === id) ?? RESUME_TEMPLATES[0];
}

/** The full printable document for one template. */
export function renderResumeHtml(r: BuiltResume, templateId: string | undefined, title: string, headline = "", format: ResumeFormat = DEFAULT_FORMAT, preview = false): string {
  const t = resumeTemplate(templateId);
  // Keep a role together on a page rather than splitting its heading from its lines.
  const keep = `.role{break-inside:avoid}h2{break-after:avoid}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${applyFormat(t, format, preview)}${keep}</style></head><body>${t.body(r, { esc, headline })}</body></html>`;
}
