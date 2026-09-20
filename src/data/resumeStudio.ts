// Truth Mode tailoring for the demo. Every change references an existing resume line.
// Change types are limited to what Truth Mode allows: reorder, reword, emphasize, format.

export type ChangeType = "reorder" | "reword" | "emphasize" | "format";

export interface TailorChange {
  id: string;
  section: "Summary" | "Regional Operations Manager" | "Store Operations Manager" | "Skills" | "Certifications";
  sourceId: string; // the resume line this came from
  type: ChangeType;
  original: string;
  tailored: string;
  reason: string;
  ats: { keywords?: number; structure?: number; length?: number };
}

export const CHANGE_TYPE_LABEL: Record<ChangeType, string> = {
  reorder: "Reordered",
  reword: "Reworded",
  emphasize: "Re-emphasized",
  format: "Reformatted",
};

/** Tailoring for the Northvale Operations Manager role (j01). */
export const NORTHVALE_CHANGES: TailorChange[] = [
  {
    id: "c1",
    section: "Summary",
    sourceId: "summary",
    type: "reword",
    original:
      "Retail operations manager with eight years of experience running high volume stores and multi store regions. Known for tight inventory control, calm leadership, and fixing broken processes.",
    tailored:
      "Operations manager with eight years running multi site retail operations, focused on inventory control, vendor coordination, and process improvement. Lean Six Sigma Yellow Belt.",
    reason: "Leads with multi site operations and inventory, the first two requirements in this posting. Every claim comes from your existing bullets and certification.",
    ats: { keywords: 3 },
  },
  {
    id: "c2",
    section: "Regional Operations Manager",
    sourceId: "r2",
    type: "reorder",
    original: "Managed weekly inventory counts and replenishment orders for 6 locations, cutting stockouts by 22% in 2024.",
    tailored: "Managed weekly inventory counts and replenishment planning across 6 locations, cutting stockouts by 22% in 2024.",
    reason: "Moved to top because this job lists inventory forecasting as requirement #2. Changed \"orders\" to \"planning\" to match their wording. The work is the same.",
    ats: { keywords: 3 },
  },
  {
    id: "c3",
    section: "Regional Operations Manager",
    sourceId: "r1",
    type: "reword",
    original: "Oversaw day to day operations for 6 stores across Rhode Island and southeastern Massachusetts with combined annual revenue of $38M.",
    tailored: "Led day to day operations for 6 sites across Rhode Island and southeastern Massachusetts, $38M combined annual revenue.",
    reason: "Changed \"stores\" to \"sites\" so the screening software reads it as multi site operations. Same facts, same numbers.",
    ats: { keywords: 2 },
  },
  {
    id: "c4",
    section: "Regional Operations Manager",
    sourceId: "r3",
    type: "reword",
    original: "Worked with 14 vendors on delivery schedules and damaged goods claims, recovering $210K in credits over two years.",
    tailored: "Managed relationships with 14 vendors covering delivery schedules and damaged goods claims, recovering $210K in credits over two years.",
    reason: "Leads with \"managed relationships\" because vendor management is requirement #3.",
    ats: { keywords: 2 },
  },
  {
    id: "c5",
    section: "Regional Operations Manager",
    sourceId: "r6",
    type: "reword",
    original: "Built weekly Excel reports on sales, shrink, and labor for the regional director.",
    tailored: "Built weekly KPI reports in Excel covering sales, shrink, and labor for regional leadership.",
    reason: "The posting says \"KPI reporting\" four times. Your reports were KPI reports, so we used their term.",
    ats: { keywords: 3 },
  },
  {
    id: "c6",
    section: "Regional Operations Manager",
    sourceId: "r5",
    type: "reword",
    original: "Rolled out a new Kronos scheduling process that reduced overtime spending by 18%.",
    tailored: "Redesigned labor scheduling in Kronos, reducing overtime spend by 18%.",
    reason: "Shorter. Recruiters and screening software weigh the first five words most.",
    ats: { length: 1 },
  },
  {
    id: "c7",
    section: "Store Operations Manager",
    sourceId: "s2",
    type: "emphasize",
    original: "Reduced shrink from 2.1% to 1.3% by redesigning receiving checks and cycle counts.",
    tailored: "Redesigned receiving checks and cycle count process, reducing shrink from 2.1% to 1.3%.",
    reason: "Leads with the process change instead of the result, because this role screens for continuous improvement experience.",
    ats: { keywords: 1 },
  },
  {
    id: "c8",
    section: "Skills",
    sourceId: "skills",
    type: "reorder",
    original:
      "Inventory management, Vendor management, Labor scheduling (Kronos), Advanced Excel (pivot tables, VLOOKUP), Oracle Retail, P&L review, Loss prevention, Team leadership and training",
    tailored:
      "Inventory management, Vendor management, Advanced Excel (pivot tables, VLOOKUP), Oracle Retail, Labor scheduling (Kronos), P&L review, Team leadership and training, Loss prevention",
    reason: "Reordered so the skills this posting names come first. Nothing added, nothing removed.",
    ats: { keywords: 2 },
  },
  {
    id: "c9",
    section: "Certifications",
    sourceId: "certs",
    type: "format",
    original: "Lean Six Sigma Yellow Belt, 2021 (listed under Education)",
    tailored: "Certifications: Lean Six Sigma Yellow Belt, 2021",
    reason: "Moved into its own Certifications heading so screening software parses it. The posting lists Lean as a plus.",
    ats: { structure: 3 },
  },
];

/** Things the AI was asked to add and refused. Shown so the constraint is visible. */
export const BLOCKED_EDITS = [
  { text: "Add \"demand forecasting\" to skills", why: "Your resume shows replenishment, not forecasting. We do not add skills you have not listed." },
  { text: "Round stockout reduction up to 25%", why: "Your resume says 22%. We never change numbers." },
  { text: "Add \"WMS (Manhattan, Blue Yonder)\"", why: "Not in your resume. Listed in Gaps we did not fill instead." },
];

export const BASE_ATS = { keywords: 22, formatting: 18, structure: 12, length: 14, fileType: 10 };
export const ATS_MAX = { keywords: 40, formatting: 20, structure: 15, length: 15, fileType: 10 };

export interface ResumeVersion {
  id: string;
  name: string;
  target: string;
  ats: number;
  createdDaysAgo: number;
  sends: number;
  responses: number;
  note: string;
  changeIds?: string[];
}

export const SEED_VERSIONS: ResumeVersion[] = [
  { id: "v-base", name: "Base resume", target: "General", ats: 71, createdDaysAgo: 118, sends: 3, responses: 0, note: "The resume you uploaded. Retail language throughout." },
  { id: "v-supply", name: "Supply Chain Ops, v2", target: "Supply chain and operations roles", ats: 88, createdDaysAgo: 34, sends: 7, responses: 3, note: "Leads with inventory and vendors. Your best performer." },
  { id: "v-program", name: "Program Coordinator, v1", target: "Program and project roles", ats: 82, createdDaysAgo: 21, sends: 4, responses: 1, note: "Leads with the remodel and the Kronos rollout." },
];
