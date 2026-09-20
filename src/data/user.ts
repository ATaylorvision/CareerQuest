// Demo user. Fictional person, fictional employers. Labeled as sample data in the UI.

export interface ResumeBullet {
  id: string;
  text: string;
}

export interface ResumeRole {
  id: string;
  title: string;
  company: string;
  location: string;
  start: string;
  end: string;
  bullets: ResumeBullet[];
}

export interface Resume {
  name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  roles: ResumeRole[];
  education: string[];
  certifications: string[];
  skills: string[];
}

export const DEMO_USER = {
  firstName: "Renee",
  lastName: "Castillo",
  name: "Renee Castillo",
  email: "renee.castillo@example.com",
  location: "Providence, RI",
  age: 35,
  headline: "Regional operations manager, moving into supply chain and program operations",
  laidOffMonthsAgo: 4,
  formerEmployer: "Harbor & Pine Home",
};

export const BASE_RESUME: Resume = {
  name: "Renee Castillo",
  email: "renee.castillo@example.com",
  phone: "(401) 555-0148",
  location: "Providence, RI",
  summary:
    "Retail operations manager with eight years of experience running high volume stores and multi store regions. Known for tight inventory control, calm leadership, and fixing broken processes.",
  roles: [
    {
      id: "role-rom",
      title: "Regional Operations Manager",
      company: "Harbor & Pine Home",
      location: "Providence, RI",
      start: "Mar 2022",
      end: "May 2026",
      bullets: [
        { id: "r1", text: "Oversaw day to day operations for 6 stores across Rhode Island and southeastern Massachusetts with combined annual revenue of $38M." },
        { id: "r2", text: "Managed weekly inventory counts and replenishment orders for 6 locations, cutting stockouts by 22% in 2024." },
        { id: "r3", text: "Worked with 14 vendors on delivery schedules and damaged goods claims, recovering $210K in credits over two years." },
        { id: "r4", text: "Led a team of 6 store managers and about 120 hourly associates." },
        { id: "r5", text: "Rolled out a new Kronos scheduling process that reduced overtime spending by 18%." },
        { id: "r6", text: "Built weekly Excel reports on sales, shrink, and labor for the regional director." },
      ],
    },
    {
      id: "role-som",
      title: "Store Operations Manager",
      company: "Harbor & Pine Home",
      location: "Warwick, RI",
      start: "Jun 2018",
      end: "Mar 2022",
      bullets: [
        { id: "s1", text: "Ran receiving, stockroom, and floor operations for a $7.5M store." },
        { id: "s2", text: "Reduced shrink from 2.1% to 1.3% by redesigning receiving checks and cycle counts." },
        { id: "s3", text: "Hired and trained 40+ associates, 5 of whom were promoted to key holder or assistant manager." },
        { id: "s4", text: "Coordinated seasonal floor sets and a full store remodel with no missed opening days." },
        { id: "s5", text: "Handled escalated customer issues and kept store NPS above the district average for 11 straight quarters." },
      ],
    },
  ],
  education: ["B.A. Communications, University of Rhode Island, 2013"],
  certifications: ["Lean Six Sigma Yellow Belt, 2021"],
  skills: [
    "Inventory management",
    "Vendor management",
    "Labor scheduling (Kronos)",
    "Advanced Excel (pivot tables, VLOOKUP)",
    "Oracle Retail",
    "P&L review",
    "Loss prevention",
    "Team leadership and training",
  ],
};

export function allBullets(resume: Resume = BASE_RESUME) {
  return resume.roles.flatMap((r) => r.bullets.map((b) => ({ ...b, role: r })));
}

export function bulletById(id: string) {
  return allBullets().find((b) => b.id === id);
}

/* Live accounts replace the demo resume with the user's own parsed resume. */
const DEMO_RESUME: Resume = structuredClone(BASE_RESUME);

export function setBaseResume(r: Resume) {
  for (const k of Object.keys(BASE_RESUME)) delete (BASE_RESUME as unknown as Record<string, unknown>)[k];
  Object.assign(BASE_RESUME, structuredClone(r));
}

export function restoreDemoResume() {
  setBaseResume(DEMO_RESUME);
}

export function emptyResume(): Resume {
  return { name: "", email: "", phone: "", location: "", summary: "", roles: [], education: [], certifications: [], skills: [] };
}
