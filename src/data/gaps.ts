// Library of requirements that show up in postings but are not in the demo resume.
// Used by Job Detail (gaps), the Studio (Gaps we did not fill) and the Skill Gap Roadmap.

export type GapSeverity = "dealbreaker" | "trainable" | "preferred";

export interface Gap {
  id: string;
  label: string;
  severity: GapSeverity;
  note: string;
  coverLetterLine: string;
  timeToCredible: string;
  hoursEstimate: number;
  resources: { id: string; title: string; cost: string; detail: string; minutes: number }[];
}

export const SEVERITY_LABEL: Record<GapSeverity, string> = {
  dealbreaker: "Likely a dealbreaker",
  trainable: "Likely trainable",
  preferred: "Nice to have, not required",
};

export const GAPS: Record<string, Gap> = {
  wms: {
    id: "wms",
    label: "Warehouse management system (WMS) experience",
    severity: "trainable",
    note: "You ran inventory in Oracle Retail across six stores. The concepts carry over. Hiring managers mostly want to know you will not be lost on day one.",
    coverLetterLine:
      "I have not used a dedicated WMS yet, but I ran receiving, cycle counts, and replenishment in Oracle Retail across six sites and I pick up new systems quickly.",
    timeToCredible: "2 to 3 weeks",
    hoursEstimate: 14,
    resources: [
      { id: "wms-1", title: "Warehouse management fundamentals, free video series", cost: "Free", detail: "Short vendor neutral lessons on receiving, putaway, picking, and slotting. Most people finish in a weekend.", minutes: 240 },
      { id: "wms-2", title: "Request a sandbox demo from a mid market WMS vendor", cost: "Free", detail: "Most vendors give a guided demo. Ask to see receiving and cycle counting so you can speak to the screens in interviews.", minutes: 60 },
      { id: "wms-3", title: "Write a one page comparison: Oracle Retail inventory vs a WMS", cost: "Free", detail: "Turns what you already know into interview language. Copilot can review it.", minutes: 45 },
    ],
  },
  sql: {
    id: "sql",
    label: "SQL or data querying",
    severity: "trainable",
    note: "Usually listed as preferred. Your Excel pivot table work shows the same thinking. A few weeks of basics is enough to say yes honestly.",
    coverLetterLine:
      "My reporting work has been in Excel with pivot tables and lookups, and I am currently learning SQL to work with larger data sets.",
    timeToCredible: "3 to 4 weeks",
    hoursEstimate: 20,
    resources: [
      { id: "sql-1", title: "Interactive SQL lessons in the browser", cost: "Free", detail: "Free public tutorials let you write real queries without installing anything. Aim for SELECT, WHERE, GROUP BY, and JOIN.", minutes: 360 },
      { id: "sql-2", title: "Rebuild one of your old weekly shrink reports as a SQL query", cost: "Free", detail: "Use a free sample retail dataset. It gives you a concrete story for interviews.", minutes: 120 },
      { id: "sql-3", title: "Intro to SQL course on a MOOC platform (audit track)", cost: "Free to audit", detail: "Structured path with quizzes if you prefer a course format.", minutes: 600 },
    ],
  },
  bi: {
    id: "bi",
    label: "Power BI or Tableau dashboards",
    severity: "trainable",
    note: "You already build weekly KPI reports. Moving them into a dashboard tool is a small, visible upgrade.",
    coverLetterLine:
      "I built weekly KPI reports on sales, shrink, and labor in Excel for regional leadership, and I am moving that same work into Power BI.",
    timeToCredible: "2 weeks",
    hoursEstimate: 12,
    resources: [
      { id: "bi-1", title: "Microsoft Learn: Power BI data analyst learning path", cost: "Free", detail: "Official free modules. The first three are enough to build a real dashboard.", minutes: 300 },
      { id: "bi-2", title: "Publish one dashboard using public retail data", cost: "Free", detail: "Link it in your resume header. Recruiters click these.", minutes: 180 },
    ],
  },
  apics: {
    id: "apics",
    label: "APICS CPIM or CSCP certification",
    severity: "preferred",
    note: "Almost always listed as preferred. Worth doing eventually, not worth delaying applications for.",
    coverLetterLine:
      "I hold a Lean Six Sigma Yellow Belt and I am planning to pursue supply chain certification as I move into this field.",
    timeToCredible: "3 to 6 months",
    hoursEstimate: 90,
    resources: [
      { id: "apics-1", title: "ASCM free supply chain fundamentals webinar series", cost: "Free", detail: "Good for vocabulary before you commit to the full exam.", minutes: 180 },
      { id: "apics-2", title: "Check if your state workforce board covers certification costs", cost: "Often $0 for laid off workers", detail: "Many dislocated worker programs pay for industry certifications. Worth one phone call.", minutes: 30 },
      { id: "apics-3", title: "CPIM Part 1 self study", cost: "About $600 to $1,000", detail: "Only after you have a few interviews under your belt.", minutes: 3000 },
    ],
  },
  dc: {
    id: "dc",
    label: "3+ years in a distribution center environment",
    severity: "dealbreaker",
    note: "Your stockroom and receiving work is close, but it is not a DC. Some hiring managers will flex on this. Some will not. Address it head on.",
    coverLetterLine:
      "My background is in multi store retail rather than a distribution center, but I ran receiving and replenishment for six locations and I understand the downstream side of the DC very well.",
    timeToCredible: "Not closable quickly",
    hoursEstimate: 0,
    resources: [
      { id: "dc-1", title: "Ask a DC contact for a 30 minute walkthrough", cost: "Free", detail: "Seeing the floor gives you real detail to use in interviews. Insider Connections has two people who can help.", minutes: 60 },
      { id: "dc-2", title: "Target DC supervisor roles as a stepping stone", cost: "Free", detail: "Supervisor roles often accept multi site retail. Filter your feed for them.", minutes: 20 },
    ],
  },
  pmp: {
    id: "pmp",
    label: "PMP or CAPM certification",
    severity: "preferred",
    note: "CAPM is realistic in a month and signals you speak the language. PMP needs documented project hours.",
    coverLetterLine:
      "I have coordinated seasonal floor sets and a full store remodel on fixed dates, and I am completing formal project management training.",
    timeToCredible: "4 to 6 weeks",
    hoursEstimate: 35,
    resources: [
      { id: "pmp-1", title: "Entry level project management certificate on a MOOC platform", cost: "About $49 per month", detail: "Self paced, widely recognized by recruiters for coordinator roles.", minutes: 1800 },
      { id: "pmp-2", title: "Document your store remodel as a project case study", cost: "Free", detail: "Scope, timeline, budget, stakeholders. This becomes your best interview answer.", minutes: 90 },
    ],
  },
  salesforce: {
    id: "salesforce",
    label: "Salesforce or CRM administration",
    severity: "trainable",
    note: "Most sales ops roles train on their CRM setup. Free guided modules get you conversant fast.",
    coverLetterLine:
      "I have not administered a CRM, but I managed reporting and process changes across six locations and I am working through CRM admin training now.",
    timeToCredible: "2 to 3 weeks",
    hoursEstimate: 15,
    resources: [
      { id: "sf-1", title: "Free CRM admin beginner trail", cost: "Free", detail: "Hands on modules in a free practice org.", minutes: 600 },
      { id: "sf-2", title: "Build a simple pipeline report in a free dev account", cost: "Free", detail: "Screenshot it for your portfolio.", minutes: 90 },
    ],
  },
  ehr: {
    id: "ehr",
    label: "EHR systems (Epic, athena, or similar)",
    severity: "trainable",
    note: "Clinics expect to train new managers on their EHR. What they screen for is comfort with systems and patient flow.",
    coverLetterLine:
      "I have not worked in an EHR, but I rolled out a new Kronos scheduling process to about 120 associates and I learn software quickly.",
    timeToCredible: "1 to 2 weeks",
    hoursEstimate: 8,
    resources: [
      { id: "ehr-1", title: "Free intro to electronic health records course (audit)", cost: "Free to audit", detail: "Covers workflows, terminology, and privacy basics.", minutes: 360 },
      { id: "ehr-2", title: "HIPAA basics for non clinical staff", cost: "Free", detail: "A one hour primer that removes the biggest unknown.", minutes: 60 },
    ],
  },
  saas: {
    id: "saas",
    label: "Prior SaaS or software industry experience",
    severity: "dealbreaker",
    note: "Some teams screen hard on this. Others care more about customer handling. Lean on your NPS record and your system rollouts.",
    coverLetterLine:
      "I am coming from retail, not software, but I kept customer satisfaction above district average for 11 straight quarters and I have trained large teams on new tools.",
    timeToCredible: "Not closable quickly",
    hoursEstimate: 0,
    resources: [
      { id: "saas-1", title: "Learn the core SaaS metrics: churn, NRR, onboarding time", cost: "Free", detail: "A few hours of reading lets you talk about the business the way they do.", minutes: 120 },
    ],
  },
  forecast: {
    id: "forecast",
    label: "Demand forecasting models",
    severity: "trainable",
    note: "You did replenishment, which sits right next to forecasting. The gap is the statistical side, not the judgment.",
    coverLetterLine:
      "I managed replenishment across six stores and cut stockouts by 22%, and I am building my forecasting skills to go further upstream.",
    timeToCredible: "4 to 6 weeks",
    hoursEstimate: 25,
    resources: [
      { id: "fc-1", title: "Forecasting basics in Excel: moving averages and seasonality", cost: "Free", detail: "You already know Excel. This is the shortest path.", minutes: 240 },
      { id: "fc-2", title: "Free online textbook on forecasting principles", cost: "Free", detail: "Read chapters 1 to 3 for the vocabulary.", minutes: 300 },
    ],
  },
  tms: {
    id: "tms",
    label: "Transportation management system (TMS)",
    severity: "trainable",
    note: "Mostly learned on the job. Your vendor delivery scheduling is the right foundation.",
    coverLetterLine:
      "I coordinated delivery schedules with 14 vendors and I am comfortable learning a TMS to manage carriers directly.",
    timeToCredible: "1 to 2 weeks",
    hoursEstimate: 8,
    resources: [
      { id: "tms-1", title: "Freight and carrier management basics, free webinar", cost: "Free", detail: "Covers load planning, carriers, and freight terms.", minutes: 90 },
    ],
  },
  revcycle: {
    id: "revcycle",
    label: "Revenue cycle or medical billing background",
    severity: "dealbreaker",
    note: "This is specialized knowledge. It is a real gap for a lead role. A coordinator role could get you there.",
    coverLetterLine:
      "I do not have a billing background, and I would bring strong process and team leadership while I learn the revenue cycle.",
    timeToCredible: "3+ months",
    hoursEstimate: 60,
    resources: [
      { id: "rc-1", title: "Medical billing and coding intro (community college, noncredit)", cost: "About $200", detail: "Evening format, often covered by workforce grants.", minutes: 2400 },
    ],
  },
  pmtools: {
    id: "pmtools",
    label: "Project tools (Smartsheet, Asana, or Jira)",
    severity: "trainable",
    note: "Easy to learn. Recruiters just want to see the word on your resume with something real behind it.",
    coverLetterLine:
      "I have run multi week projects on shared trackers and I am comfortable in any project tool the team uses.",
    timeToCredible: "3 to 5 days",
    hoursEstimate: 5,
    resources: [
      { id: "pt-1", title: "Rebuild your store remodel plan in a free project tool", cost: "Free", detail: "Free tiers are enough. Now you have used it for something real.", minutes: 120 },
    ],
  },
};
