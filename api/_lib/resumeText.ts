import mammoth from "mammoth";
import JSZip from "jszip";
import WordExtractor from "word-extractor";

export type ResumeKind = "pdf" | "docx" | "doc" | "odt" | "rtf" | "html" | "text" | "image";

export const IMAGE_TYPES: Record<string, "image/png" | "image/jpeg" | "image/webp" | "image/gif"> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

const EXT_KIND: Record<string, ResumeKind> = {
  pdf: "pdf",
  docx: "docx",
  docm: "docx",
  dotx: "docx",
  doc: "doc",
  odt: "odt",
  rtf: "rtf",
  html: "html",
  htm: "html",
  txt: "text",
  text: "text",
  md: "text",
  markdown: "text",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  gif: "image",
};

/** Decide the format from the file name first, then the MIME type, then the file's own first bytes. */
export function detectKind(fileName: string, mime: string | undefined, buf: Buffer): ResumeKind | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (EXT_KIND[ext]) return EXT_KIND[ext];
  const m = (mime ?? "").toLowerCase();
  if (m === "application/pdf") return "pdf";
  if (m.includes("wordprocessingml")) return "docx";
  if (m === "application/msword") return "doc";
  if (m.includes("opendocument.text")) return "odt";
  if (m.includes("rtf")) return "rtf";
  if (m === "text/html") return "html";
  if (m.startsWith("text/")) return "text";
  if (m.startsWith("image/")) return "image";
  const head = buf.subarray(0, 8);
  if (head.subarray(0, 4).toString("latin1") === "%PDF") return "pdf";
  if (head.subarray(0, 5).toString("latin1") === "{\\rtf") return "rtf";
  if (head[0] === 0xd0 && head[1] === 0xcf) return "doc";
  if (head[0] === 0x89 && head[1] === 0x50) return "image";
  if (head[0] === 0xff && head[1] === 0xd8) return "image";
  return null;
}

export function imageType(fileName: string, mime: string | undefined, buf: Buffer) {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (IMAGE_TYPES[ext]) return IMAGE_TYPES[ext];
  if (mime && Object.values(IMAGE_TYPES).includes(mime as never)) return mime as (typeof IMAGE_TYPES)[string];
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  return "image/png";
}

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

export function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\s*(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/ul|\/ol|\/table|\/section)[^>]*>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Plain-text pass over RTF: drops control words and groups we do not need, keeps paragraphs and \'xx / \uN characters. */
export function rtfToText(rtf: string) {
  let out = "";
  const skip = new Set(["fonttbl", "colortbl", "stylesheet", "info", "pict", "header", "footer", "footnote", "themedata", "colorschememapping", "latentstyles", "datastore", "listtable", "listoverridetable", "rsidtbl", "generator"]);
  const stack: boolean[] = [];
  let skipping = false;
  let i = 0;
  while (i < rtf.length) {
    const c = rtf[i];
    if (c === "{") {
      stack.push(skipping);
      i++;
      // "{\*\keyword" groups and known destinations are not document text.
      if (rtf.startsWith("\\*", i)) skipping = true;
      else {
        const m = /^\\([a-z]+)/i.exec(rtf.slice(i, i + 40));
        if (m && skip.has(m[1].toLowerCase())) skipping = true;
      }
    } else if (c === "}") {
      skipping = stack.pop() ?? false;
      i++;
    } else if (c === "\\") {
      const next = rtf[i + 1];
      if (next === "'") {
        const code = parseInt(rtf.slice(i + 2, i + 4), 16);
        if (!skipping && !Number.isNaN(code)) out += Buffer.from([code]).toString("latin1");
        i += 4;
      } else if (next === "\\" || next === "{" || next === "}") {
        if (!skipping) out += next;
        i += 2;
      } else if (next === "~") {
        if (!skipping) out += " ";
        i += 2;
      } else {
        const m = /^\\([a-z]+)(-?\d+)? ?/i.exec(rtf.slice(i, i + 40));
        if (!m) {
          i += 2;
          continue;
        }
        const word = m[1].toLowerCase();
        if (!skipping) {
          if (word === "par" || word === "line" || word === "row") out += "\n";
          else if (word === "tab" || word === "cell") out += "\t";
          else if (word === "bullet") out += "- ";
          else if (word === "emdash") out += "-";
          else if (word === "endash") out += "-";
          else if (word === "u" && m[2]) {
            let n = parseInt(m[2], 10);
            if (n < 0) n += 65536;
            out += String.fromCharCode(n);
            // A \uN is followed by one fallback character that must be skipped.
            const after = i + m[0].length;
            i = rtf[after] === "\\" && rtf[after + 1] === "'" ? after + 4 : after + 1;
            continue;
          }
        }
        i += m[0].length;
      }
    } else {
      if (!skipping && c !== "\r" && c !== "\n") out += c;
      i++;
    }
  }
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function odtToText(buf: Buffer) {
  const zip = await JSZip.loadAsync(buf);
  const file = zip.file("content.xml");
  if (!file) return "";
  const xml = await file.async("string");
  return decodeEntities(
    xml
      .replace(/<text:line-break\s*\/>/g, "\n")
      .replace(/<text:tab\s*\/>/g, "\t")
      .replace(/<text:s(?:\s+text:c="(\d+)")?\s*\/>/g, (_, n) => " ".repeat(Number(n ?? 1)))
      .replace(/<\/text:(p|h|list-item)>/g, "\n")
      .replace(/<text:list-item[^>]*>/g, "- ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Text out of every non-PDF, non-image format. Returns "" when there is nothing readable. */
export async function extractText(kind: ResumeKind, buf: Buffer): Promise<string> {
  switch (kind) {
    case "docx":
      return (await mammoth.extractRawText({ buffer: buf })).value;
    case "doc": {
      // Some ".doc" files are really .docx or RTF saved under the old name; check before using the legacy reader.
      if (buf.subarray(0, 2).toString("latin1") === "PK") return (await mammoth.extractRawText({ buffer: buf })).value;
      if (buf.subarray(0, 5).toString("latin1") === "{\\rtf") return rtfToText(buf.toString("latin1"));
      const doc = await new WordExtractor().extract(buf);
      return doc.getBody();
    }
    case "odt":
      return odtToText(buf);
    case "rtf":
      return rtfToText(buf.toString("latin1"));
    case "html":
      return htmlToText(buf.toString("utf8"));
    case "text": {
      // UTF-16 text files (Notepad "Unicode") start with a byte-order mark.
      if (buf[0] === 0xff && buf[1] === 0xfe) return buf.toString("utf16le");
      return buf.toString("utf8");
    }
    default:
      return "";
  }
}
