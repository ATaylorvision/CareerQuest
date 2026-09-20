import type { TargetField } from "./jobs";

export const TARGET_FIELDS: { id: TargetField; label: string; roleTitle: string; blurb: string }[] = [
  { id: "supply", label: "Supply chain and logistics", roleTitle: "Supply Chain Operations Manager", blurb: "Inventory, vendors, carriers, and the flow of goods." },
  { id: "program", label: "Program and business operations", roleTitle: "Program Operations Manager", blurb: "Running initiatives across teams, from plan to launch." },
  { id: "cs", label: "Customer success", roleTitle: "Customer Success Manager", blurb: "Keeping customers successful, renewing, and growing." },
  { id: "health", label: "Healthcare administration", roleTitle: "Practice Operations Manager", blurb: "Running clinics and practices so care runs smoothly." },
  { id: "project", label: "Project coordination", roleTitle: "Project Coordinator", blurb: "Schedules, vendors, and deliverables for defined projects." },
];

export interface Translation {
  phrases: string[];
  keywords: string[];
  appearsIn: number; // how many saved jobs use this language
}

/** Translations of each demo resume bullet into each target field's language. */
export const BULLET_TRANSLATIONS: Record<string, Record<TargetField, Translation>> = {
  r1: {
    supply: { phrases: ["Multi site operations leadership", "P&L ownership ($38M)", "Regional network management"], keywords: ["multi site", "P&L", "network"], appearsIn: 14 },
    program: { phrases: ["Portfolio level operations ownership", "Cross location execution", "Budget accountability ($38M)"], keywords: ["portfolio", "execution", "budget"], appearsIn: 9 },
    cs: { phrases: ["Book of business ownership ($38M)", "Multi account management", "Regional relationship leadership"], keywords: ["book of business", "accounts"], appearsIn: 6 },
    health: { phrases: ["Multi practice operations leadership", "Budget ownership", "Distributed site management"], keywords: ["multi site", "budget"], appearsIn: 7 },
    project: { phrases: ["Cross site coordination", "Stakeholder management across 6 locations", "Operational oversight"], keywords: ["coordination", "stakeholders"], appearsIn: 5 },
  },
  r2: {
    supply: { phrases: ["Inventory planning and replenishment", "Stockout reduction (22%)", "Cycle count program management"], keywords: ["replenishment", "inventory planning", "fill rate"], appearsIn: 16 },
    program: { phrases: ["Recurring process ownership", "Measurable outcome delivery (22%)", "Operational cadence management"], keywords: ["process", "outcomes"], appearsIn: 6 },
    cs: { phrases: ["Proactive issue prevention", "Service level improvement (22%)", "Operational health monitoring"], keywords: ["proactive", "health score"], appearsIn: 4 },
    health: { phrases: ["Medical supply par level management", "Stockout prevention (22%)", "Supply chain coordination"], keywords: ["supplies", "par levels"], appearsIn: 6 },
    project: { phrases: ["Weekly tracking and follow through", "Deadline driven execution", "Results tracking (22%)"], keywords: ["tracking", "deadlines"], appearsIn: 5 },
  },
  r3: {
    supply: { phrases: ["Vendor and supplier management", "Claims and chargeback recovery ($210K)", "Inbound logistics coordination"], keywords: ["vendor management", "supplier", "claims"], appearsIn: 15 },
    program: { phrases: ["External partner management", "Contract and vendor accountability", "Cost recovery ($210K)"], keywords: ["partners", "vendors"], appearsIn: 8 },
    cs: { phrases: ["Escalation management", "Partner relationship management", "Commercial negotiation ($210K recovered)"], keywords: ["escalations", "negotiation"], appearsIn: 7 },
    health: { phrases: ["Vendor contract oversight", "Supply cost recovery ($210K)", "Delivery coordination"], keywords: ["vendors", "contracts"], appearsIn: 5 },
    project: { phrases: ["Vendor scheduling and coordination", "Issue resolution with suppliers", "Budget protection ($210K)"], keywords: ["vendors", "scheduling"], appearsIn: 7 },
  },
  r4: {
    supply: { phrases: ["Distributed team management (126 people)", "Manager of managers", "Frontline workforce leadership"], keywords: ["team leadership", "people management"], appearsIn: 13 },
    program: { phrases: ["Leading through managers", "Cross functional team leadership", "Change management at scale"], keywords: ["leadership", "change management"], appearsIn: 10 },
    cs: { phrases: ["Team leadership", "Coaching and development", "Scaled communication"], keywords: ["coaching", "leadership"], appearsIn: 6 },
    health: { phrases: ["Staff supervision (120+ people)", "Front office leadership", "Manager development"], keywords: ["staff supervision"], appearsIn: 9 },
    project: { phrases: ["Team coordination at scale", "Delegation and follow up", "Stakeholder communication"], keywords: ["coordination"], appearsIn: 5 },
  },
  r5: {
    supply: { phrases: ["Labor planning and optimization", "Cost reduction (18% overtime)", "Workforce management systems"], keywords: ["labor planning", "cost reduction"], appearsIn: 9 },
    program: { phrases: ["Process rollout and adoption", "Systems implementation", "Cost savings delivery (18%)"], keywords: ["rollout", "implementation", "adoption"], appearsIn: 11 },
    cs: { phrases: ["Tool adoption and training", "Change enablement", "Efficiency outcomes (18%)"], keywords: ["adoption", "enablement"], appearsIn: 8 },
    health: { phrases: ["Staff scheduling optimization", "Overtime reduction (18%)", "Scheduling system rollout"], keywords: ["scheduling", "staffing"], appearsIn: 8 },
    project: { phrases: ["Process implementation", "Schedule management", "Measured results (18%)"], keywords: ["implementation"], appearsIn: 6 },
  },
  r6: {
    supply: { phrases: ["KPI reporting and analysis", "Operational dashboards", "Executive reporting"], keywords: ["KPI", "reporting", "analysis"], appearsIn: 17 },
    program: { phrases: ["Status and performance reporting", "Leadership updates", "Data driven decision support"], keywords: ["reporting", "status updates"], appearsIn: 12 },
    cs: { phrases: ["Account health reporting", "Business review preparation", "Data storytelling"], keywords: ["business reviews", "reporting"], appearsIn: 7 },
    health: { phrases: ["Operational metrics reporting", "Productivity tracking", "Leadership reporting"], keywords: ["metrics", "reporting"], appearsIn: 7 },
    project: { phrases: ["Status reporting", "Budget and progress tracking", "Documentation"], keywords: ["status reports"], appearsIn: 8 },
  },
  s1: {
    supply: { phrases: ["Receiving and inbound operations", "Stockroom and storage management", "End to end site operations ($7.5M)"], keywords: ["receiving", "inbound"], appearsIn: 11 },
    program: { phrases: ["Site level operations ownership", "End to end process management"], keywords: ["operations"], appearsIn: 5 },
    cs: { phrases: ["Operational excellence", "Service delivery ownership"], keywords: ["service delivery"], appearsIn: 3 },
    health: { phrases: ["Single site operations management", "Supply receiving and storage"], keywords: ["operations"], appearsIn: 5 },
    project: { phrases: ["Operational execution", "Site logistics"], keywords: ["logistics"], appearsIn: 3 },
  },
  s2: {
    supply: { phrases: ["Inventory accuracy improvement", "Shrink reduction (2.1% to 1.3%)", "Process redesign"], keywords: ["inventory accuracy", "shrink", "continuous improvement"], appearsIn: 12 },
    program: { phrases: ["Process improvement", "Root cause analysis", "Measurable results"], keywords: ["process improvement"], appearsIn: 9 },
    cs: { phrases: ["Root cause problem solving", "Quality improvement"], keywords: ["problem solving"], appearsIn: 4 },
    health: { phrases: ["Compliance and audit process design", "Loss and waste reduction"], keywords: ["compliance", "audits"], appearsIn: 6 },
    project: { phrases: ["Process improvement project", "Controls and checklists"], keywords: ["process improvement"], appearsIn: 5 },
  },
  s3: {
    supply: { phrases: ["Hiring and onboarding", "Talent development", "Succession building (5 promotions)"], keywords: ["hiring", "training"], appearsIn: 8 },
    program: { phrases: ["Team building", "Training program delivery", "Talent development"], keywords: ["training"], appearsIn: 7 },
    cs: { phrases: ["Customer and team training", "Onboarding design"], keywords: ["onboarding", "training"], appearsIn: 9 },
    health: { phrases: ["Staff recruitment and training", "Retention and promotion"], keywords: ["recruitment", "training"], appearsIn: 8 },
    project: { phrases: ["Onboarding coordination", "Training logistics"], keywords: ["onboarding"], appearsIn: 4 },
  },
  s4: {
    supply: { phrases: ["Seasonal peak readiness", "Facility project coordination", "Zero downtime execution"], keywords: ["peak", "readiness"], appearsIn: 7 },
    program: { phrases: ["Launch management", "On time delivery against fixed dates", "Cross functional coordination"], keywords: ["launch", "on time delivery"], appearsIn: 12 },
    cs: { phrases: ["Implementation and go live management", "Change coordination"], keywords: ["go live", "implementation"], appearsIn: 7 },
    health: { phrases: ["Clinic opening and renovation coordination", "Continuity of operations"], keywords: ["openings"], appearsIn: 4 },
    project: { phrases: ["Project delivery on fixed timelines", "Vendor and contractor coordination", "Launch readiness"], keywords: ["timelines", "project delivery"], appearsIn: 14 },
  },
  s5: {
    supply: { phrases: ["Customer escalation resolution", "Service level ownership"], keywords: ["service levels"], appearsIn: 5 },
    program: { phrases: ["Stakeholder satisfaction", "Consistent results over time (11 quarters)"], keywords: ["stakeholders"], appearsIn: 5 },
    cs: { phrases: ["Customer satisfaction ownership (NPS)", "Escalation management", "Retention through service"], keywords: ["NPS", "customer satisfaction", "retention"], appearsIn: 13 },
    health: { phrases: ["Patient experience leadership", "Complaint resolution", "Satisfaction scores (11 quarters above average)"], keywords: ["patient experience", "satisfaction"], appearsIn: 10 },
    project: { phrases: ["Stakeholder communication", "Issue resolution"], keywords: ["communication"], appearsIn: 4 },
  },
};

/** One line story per role and target. Built only from resume facts. */
export const STORY_LINES: Record<string, Record<TargetField, string>> = {
  "role-rom": {
    supply: "I ran a six site, $38M operation where inventory, vendors, and labor all had to work together. That is supply chain, seen from the store end.",
    program: "I led six locations and 126 people through new processes and systems, measured the results, and reported them to leadership. That is program operations.",
    cs: "I owned a $38M book across six locations, kept service high, and resolved escalations with vendors and customers. That is customer success.",
    health: "I ran six sites with 126 staff, tight budgets, and strict standards. A group of practices needs the same thing.",
    project: "I coordinated vendors, schedules, and six teams every week. Project coordination is that same muscle with a defined finish line.",
  },
  "role-som": {
    supply: "I ran receiving, stock, and floor operations for a $7.5M store and cut shrink by more than a third. That is inventory control.",
    program: "I delivered a full remodel and seasonal launches on fixed dates without missing an opening day. That is launch management.",
    cs: "I kept customer satisfaction above district average for 11 straight quarters. That is retention work.",
    health: "I ran a busy site, hired and trained 40+ people, and kept customers happy through every change. A clinic needs that.",
    project: "I coordinated a full store remodel and seasonal resets without missing an opening day. That is project coordination.",
  },
};

/** Onboarding: other previous fields for people who are not the demo user. */
export const PREVIOUS_FIELDS = [
  { id: "retail", label: "Retail operations" },
  { id: "hospitality", label: "Hospitality and restaurants" },
  { id: "education", label: "Teaching and education" },
  { id: "military", label: "Military service" },
];

export const OTHER_FIELD_SAMPLES: Record<string, { text: string; out: Record<TargetField, string[]> }[]> = {
  hospitality: [
    { text: "Managed a 180 seat restaurant with 45 staff and $4M in annual sales.", out: { supply: ["Site operations leadership", "P&L ownership ($4M)", "Food cost and inventory control"], program: ["Operations ownership", "Budget accountability", "Team leadership"], cs: ["Guest experience leadership", "Revenue ownership ($4M)", "Service recovery"], health: ["Front of house operations", "Staff scheduling", "Customer experience"], project: ["Event coordination", "Vendor coordination", "Shift planning"] } },
    { text: "Negotiated with food and beverage suppliers to cut costs 12%.", out: { supply: ["Supplier negotiation", "Procurement cost reduction (12%)"], program: ["Vendor management", "Cost savings delivery"], cs: ["Commercial negotiation"], health: ["Vendor contract management"], project: ["Budget management"] } },
    { text: "Trained new hires and wrote the front of house training manual.", out: { supply: ["Standard operating procedure development"], program: ["Training program design", "Documentation"], cs: ["Onboarding and enablement"], health: ["Staff training", "Policy documentation"], project: ["Documentation", "Training coordination"] } },
  ],
  education: [
    { text: "Planned and delivered curriculum for 120 students across 5 class sections.", out: { supply: ["Planning and scheduling at scale"], program: ["Program design and delivery", "Stakeholder management (120+)"], cs: ["Customer education", "Onboarding content"], health: ["Patient education programs"], project: ["Project planning", "Deliverable tracking"] } },
    { text: "Tracked student performance data and adjusted instruction each quarter.", out: { supply: ["KPI tracking", "Data driven adjustments"], program: ["Outcome measurement", "Continuous improvement"], cs: ["Health score monitoring", "Data driven interventions"], health: ["Quality metrics"], project: ["Progress tracking"] } },
    { text: "Led parent conferences and resolved conflicts with families.", out: { supply: ["Stakeholder communication"], program: ["Stakeholder alignment"], cs: ["Escalation handling", "Relationship management"], health: ["Patient and family communication"], project: ["Stakeholder updates"] } },
  ],
  military: [
    { text: "Led a 30 person logistics platoon responsible for $12M in equipment.", out: { supply: ["Logistics team leadership", "Asset management ($12M)", "Accountability systems"], program: ["Team leadership", "Mission planning"], cs: ["Team leadership under pressure"], health: ["Supply and asset management"], project: ["Resource planning", "Execution under deadlines"] } },
    { text: "Planned movement of personnel and equipment for training exercises.", out: { supply: ["Transportation planning", "Logistics coordination"], program: ["Operational planning", "Cross unit coordination"], cs: ["Planning and coordination"], health: ["Scheduling and coordination"], project: ["Logistics planning", "Timeline management"] } },
    { text: "Maintained readiness reporting for command leadership.", out: { supply: ["Readiness and KPI reporting"], program: ["Executive reporting"], cs: ["Reporting"], health: ["Compliance reporting"], project: ["Status reporting"] } },
  ],
};

/** Rule based translator for anything the user types. Honest: it only relabels what is there. */
const RULES: { test: RegExp; phrase: string }[] = [
  { test: /\b(locations?|stores?|sites?|branches|offices|clinics|facilities|warehouses)\b/i, phrase: "Multi site operations leadership" },
  { test: /(\$\s?\d|revenue|p&l|budget|sales of|profit)/i, phrase: "P&L ownership" },
  { test: /\b(team|staff|associates|employees|people|crew|reports)\b/i, phrase: "Distributed team management" },
  { test: /\b(states|regions?|territor(y|ies)|districts?)\b/i, phrase: "Cross regional coordination" },
  { test: /\b(inventory|stock|supplies|replenish)/i, phrase: "Inventory planning and control" },
  { test: /\b(vendors?|suppliers?|contractors?|partners?)\b/i, phrase: "Vendor and supplier management" },
  { test: /\bschedul/i, phrase: "Workforce and schedule planning" },
  { test: /\b(customers?|clients?|guests?|patients?|members?)\b/i, phrase: "Customer experience management" },
  { test: /\b(train|hired|hiring|onboard|coach|mentor)/i, phrase: "Talent development and onboarding" },
  { test: /\b(report|excel|data|dashboard|metrics|kpi)/i, phrase: "KPI reporting and analysis" },
  { test: /\b(reduc|cut|improv|saved|increas|grew|lowered)/i, phrase: "Process improvement with measurable results" },
  { test: /\b(launch|open(ed|ing)|remodel|project|rollout|rolled out|implement)/i, phrase: "Project delivery on fixed timelines" },
  { test: /\b(safety|compliance|audit|regulat)/i, phrase: "Compliance and risk management" },
  { test: /\b(negotiat|contract)/i, phrase: "Commercial negotiation" },
  { test: /\b(fleet|vehicles?|trucks?|deliver|shipping|freight)/i, phrase: "Fleet and logistics operations" },
];

export function translateFreeText(text: string): string[] {
  const out = RULES.filter((r) => r.test.test(text)).map((r) => r.phrase);
  // Managing several locations implies owning their results and their people.
  if (/\b(managed|ran|oversaw|led)\b.*\b(locations|stores|sites|branches)\b/i.test(text)) {
    out.splice(1, 0, "P&L ownership", "Distributed team management");
  }
  return Array.from(new Set(out)).slice(0, 4);
}

export const TRANSLATOR_EXAMPLE = "Managed 40 rental vehicle locations across three states";
