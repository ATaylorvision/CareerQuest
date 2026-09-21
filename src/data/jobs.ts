import { COMPANIES, type Company } from "./companies";
import { GAPS, type Gap } from "./gaps";
import { daysUntilWeekday } from "@/lib/date";

export type WorkMode = "Remote" | "Hybrid" | "Onsite" | "Not stated";
export type Category =
  | "Operations"
  | "Supply Chain & Logistics"
  | "Program Management"
  | "Customer Success"
  | "Healthcare Admin"
  | "Sales Operations"
  | "Project Coordination";
export type TargetField = "supply" | "program" | "cs" | "health" | "project";
export type ApplyMethod = "auto" | "prefill" | "manual";

export type { LegitSignals, LegitBadge, LegitFactor } from "@/lib/legit";
import { computeLegitimacy, type LegitSignals, type LegitBadge, type LegitFactor } from "@/lib/legit";

export interface LiveTranslation {
  from: string;
  phrases: string[];
}

export interface RequirementCheck {
  text: string;
  status: "met" | "partial" | "gap";
  note?: string;
}

export interface Job {
  id: string;
  title: string;
  company: Company;
  location: string;
  mode: WorkMode;
  salary: [number, number] | null;
  postedDaysAgo: number;
  /** null when the source does not share applicant counts. Never guessed. */
  applicants: number | null;
  category: Category;
  careerChangerFriendly: boolean;
  why: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
  gaps: Gap[];
  target: TargetField;
  applyMethod: ApplyMethod;
  manualReason?: string;
  source: string;
  closesInDays?: number;
  signals: LegitSignals;
  legit: { score: number; badge: LegitBadge; factors: LegitFactor[] };
  breakdown: { experience: number; skills: number; industry: number; transferable: number };
  match: number;
  isNew?: boolean;
  /** Real listing fields, present only for live jobs. */
  live?: boolean;
  applyUrl?: string;
  descriptionText?: string;
  /** Added by the person themselves. It belongs in their tracker and Studio, never in the Matches feed. */
  imported?: boolean;
  /** Terms the posting asks for, read once and kept on the job. Absent until first read. */
  keywords?: { must: string[]; nice: string[] } | null;
  reqChecks?: RequirementCheck[];
  translations?: LiveTranslation[];
  storyLine?: string;
  salaryPeriod?: string;
  atsProvider?: string;
  checkedAt?: string;
  /** Straight line miles from the person's home base. Null when either end has no coordinates. */
  distanceMiles?: number | null;
  /** When this listing was first shown to the signed in person. Newest to them is shown first. */
  shownAt?: string;
  /** Already shown to this person once, so it stays in their matches whatever the rules say later. */
  kept?: boolean;
}

/* ------------------------------------------------------------------ */
/* Category templates. Specific jobs override these.                   */
/* ------------------------------------------------------------------ */

const TEMPLATES: Record<Category, { resp: string[]; req: string[]; nice: string[] }> = {
  "Operations": {
    resp: ["Own day to day operations across multiple sites or teams", "Track and report weekly KPIs to leadership", "Build and improve standard operating procedures", "Hire, train, and coach supervisors and frontline staff", "Partner with finance on budget and labor planning"],
    req: ["5+ years of operations leadership", "Experience managing managers", "Strong Excel and reporting skills", "Comfort with P&L and labor budgets"],
    nice: ["Lean or Six Sigma training", "Multi state experience"],
  },
  "Supply Chain & Logistics": {
    resp: ["Monitor inventory levels and replenishment across locations", "Coordinate with carriers and vendors on schedules and exceptions", "Analyze KPIs such as fill rate, on time delivery, and inventory turns", "Lead continuous improvement projects", "Resolve damaged goods and short shipment claims"],
    req: ["3+ years in supply chain, logistics, or inventory management", "Advanced Excel", "Vendor or carrier management experience", "Clear written communication"],
    nice: ["WMS or TMS experience", "APICS certification", "SQL or Power BI"],
  },
  "Program Management": {
    resp: ["Plan and run cross functional programs from kickoff to launch", "Keep timelines, owners, and risks visible to stakeholders", "Run weekly status meetings and write clear updates", "Measure program outcomes and share what you learn", "Standardize how projects get planned and tracked"],
    req: ["4+ years coordinating projects or operations", "Experience working across departments", "Strong organizational and written skills", "Comfort presenting to leadership"],
    nice: ["PMP or CAPM", "Experience with Smartsheet, Asana, or Jira"],
  },
  "Customer Success": {
    resp: ["Own a book of customer accounts after onboarding", "Run check ins and business reviews", "Spot accounts at risk and build save plans", "Partner with product on customer feedback", "Train customers on best practices"],
    req: ["3+ years in a customer facing role", "Strong relationship building", "Comfort with data and reporting", "Excellent written and verbal communication"],
    nice: ["SaaS experience", "CRM experience"],
  },
  "Healthcare Admin": {
    resp: ["Manage front desk, scheduling, and patient flow", "Supervise administrative staff", "Track operational metrics such as wait times and no show rates", "Work with clinical leadership on staffing and supplies", "Ensure compliance with privacy and safety policies"],
    req: ["3+ years supervising staff", "Strong organizational skills", "Customer service leadership", "Comfort with scheduling systems"],
    nice: ["EHR experience", "Healthcare background"],
  },
  "Sales Operations": {
    resp: ["Maintain sales reporting and dashboards", "Support territory planning and quota tracking", "Keep CRM data clean and useful", "Coordinate between sales, finance, and operations", "Analyze pipeline and forecast accuracy"],
    req: ["3+ years in operations, analysis, or sales support", "Advanced Excel", "Attention to detail", "Comfort presenting data"],
    nice: ["Salesforce or CRM administration", "SQL"],
  },
  "Project Coordination": {
    resp: ["Coordinate schedules, vendors, and tasks for multiple projects", "Track budgets and deliverables", "Prepare status reports and meeting notes", "Flag risks early to project leads", "Keep documentation organized"],
    req: ["2+ years coordinating projects or operations", "Strong organizational skills", "Clear communication", "Comfort juggling deadlines"],
    nice: ["CAPM or project management coursework", "Project tool experience"],
  },
};

interface Seed {
  id: string;
  title: string;
  co: keyof typeof COMPANIES;
  loc: string;
  mode: WorkMode;
  sal: [number, number] | null;
  cat: Category;
  target: TargetField;
  match: number;
  industry: number;
  applicants: number;
  ccf: boolean;
  why: string;
  summary: string;
  gaps: (keyof typeof GAPS)[];
  signals: LegitSignals;
  apply: ApplyMethod;
  manualReason?: string;
  resp?: string[];
  req?: string[];
  nice?: string[];
  closes?: number;
  isNew?: boolean;
}

const fri = () => {
  const d = daysUntilWeekday(5);
  return d === 0 ? 7 : d;
};

const MANUAL_PORTAL =
  "This employer's application portal requires you to create an account and complete a timed assessment. CareerQuest does not create accounts or take assessments on your behalf, so you will submit this one yourself. We saved your answers so you can copy them over.";
const MANUAL_CAPTCHA =
  "This employer's site blocks automated submissions with a bot check. We respect that. Your answers are ready to copy, and the direct link is below.";

const SEEDS: Seed[] = [
  {
    id: "j01", title: "Operations Manager", co: "northvale", loc: "Warwick, RI", mode: "Hybrid", sal: [82000, 96000], cat: "Operations", target: "supply",
    match: 91, industry: 70, applicants: 34, ccf: true, closes: fri(), isNew: true,
    why: "Your 6 store inventory and vendor work maps directly to their first three requirements.",
    summary: "Northvale is hiring an Operations Manager to run its Warwick distribution operation, which ships to 900 independent retailers across New England. You will lead three supervisors, own inventory accuracy and replenishment, and manage relationships with inbound vendors and outbound carriers. This role reports to the VP of Operations.",
    resp: ["Lead daily operations for a 220,000 square foot distribution facility", "Own inventory forecasting and replenishment planning for 14,000 SKUs", "Manage relationships with 40+ inbound vendors and 6 regional carriers", "Build weekly KPI reporting on fill rate, accuracy, labor, and on time shipping", "Lead continuous improvement projects using Lean methods", "Hire, coach, and develop three shift supervisors"],
    req: ["5+ years of multi site or multi shift operations leadership", "Inventory forecasting and replenishment experience", "Vendor and carrier management", "KPI reporting in Excel or a BI tool", "Experience with a warehouse management system", "3+ years in a distribution center environment"],
    nice: ["Lean Six Sigma training", "SQL or Power BI", "APICS CPIM or CSCP"],
    gaps: ["wms", "dc", "sql", "apics"],
    signals: { firstPostedDaysAgo: 2, reposts90: 0, companySite: "confirmed", checkedHoursAgo: 3, poster: "employer", salaryListed: true, applicantTrend: "rising" },
    apply: "auto",
  },
  {
    id: "j02", title: "Supply Chain Analyst", co: "cedarline", loc: "Boston, MA", mode: "Hybrid", sal: [70000, 82000], cat: "Supply Chain & Logistics", target: "supply",
    match: 84, industry: 60, applicants: 58, ccf: true,
    why: "Your weekly shrink and labor reports are the same analysis they describe, just in a different building.",
    summary: "Cedarline's analytics team supports 30 client brands. The analyst builds inventory and fulfillment reports, spots problems in the data, and walks client managers through what changed and why.",
    gaps: ["sql", "bi", "wms"],
    signals: { firstPostedDaysAgo: 4, reposts90: 0, companySite: "confirmed", checkedHoursAgo: 8, poster: "employer", salaryListed: true, applicantTrend: "rising" },
    apply: "auto",
  },
  {
    id: "j03", title: "Inventory Control Manager", co: "fieldstone", loc: "Worcester, MA", mode: "Onsite", sal: [75000, 88000], cat: "Supply Chain & Logistics", target: "supply",
    match: 93, industry: 88, applicants: 21, ccf: true, isNew: true,
    why: "You cut shrink from 2.1% to 1.3%. That is exactly the result this role is hired to produce.",
    summary: "Fieldstone Grocers is creating a new Inventory Control Manager role to reduce shrink and improve count accuracy across 58 stores. You will design cycle count programs, train store teams, and report results to the VP of Store Operations.",
    resp: ["Design and run cycle count programs across 58 stores", "Analyze shrink by store, department, and cause", "Train store managers on receiving and inventory standards", "Partner with loss prevention and finance on monthly results", "Report inventory accuracy and shrink trends to leadership"],
    req: ["5+ years of retail or inventory operations experience", "Proven shrink reduction results", "Advanced Excel", "Experience training store teams"],
    nice: ["Grocery experience", "SQL or Power BI"],
    gaps: ["bi", "sql"],
    signals: { firstPostedDaysAgo: 1, reposts90: 0, companySite: "confirmed", checkedHoursAgo: 5, poster: "employer", salaryListed: true, applicantTrend: "rising" },
    apply: "auto",
  },
  {
    id: "j04", title: "Distribution Center Operations Supervisor", co: "oakmere", loc: "Fall River, MA", mode: "Onsite", sal: [68000, 76000], cat: "Supply Chain & Logistics", target: "supply",
    match: 86, industry: 62, applicants: 44, ccf: true,
    why: "Supervising 120 associates across 6 stores is bigger than this team. They will notice.",
    summary: "Supervise second shift receiving and outbound teams of 35 associates in a food and household goods DC. This is a common first step into distribution for multi site retail leaders.",
    gaps: ["wms", "dc"],
    signals: { firstPostedDaysAgo: 6, reposts90: 0, companySite: "unconfirmed", poster: "employer", salaryListed: true, applicantTrend: "steady" },
    apply: "prefill",
  },
  {
    id: "j05", title: "Regional Operations Manager", co: "harborlight", loc: "Hartford, CT", mode: "Hybrid", sal: [95000, 112000], cat: "Operations", target: "supply",
    match: 96, industry: 78, applicants: 29, ccf: true, isNew: true,
    why: "Same title you held, same multi site scope, and their ops leadership program takes retail managers.",
    summary: "Harborlight is hiring a Regional Operations Manager to oversee five distribution branches that deliver fresh prepared foods to grocery partners. You will own branch performance, lead branch managers, and drive consistency in how the branches run.",
    resp: ["Lead five branch managers and their teams of roughly 140 people", "Own branch KPIs: on time delivery, waste, labor, and safety", "Standardize operating procedures across branches", "Manage the regional operating budget", "Partner with sales on new grocery accounts"],
    req: ["6+ years of multi site operations leadership", "Experience leading managers", "P&L or budget ownership", "Strong reporting and Excel skills"],
    nice: ["Food or perishables experience", "Lean training"],
    gaps: ["tms"],
    signals: { firstPostedDaysAgo: 3, reposts90: 0, companySite: "confirmed", checkedHoursAgo: 2, poster: "employer", salaryListed: true, applicantTrend: "rising" },
    apply: "auto",
  },
  {
    id: "j06", title: "Logistics Coordinator", co: "tidewell", loc: "Providence, RI", mode: "Onsite", sal: [55000, 62000], cat: "Supply Chain & Logistics", target: "supply",
    match: 78, industry: 55, applicants: 67, ccf: true,
    why: "Your vendor delivery scheduling with 14 vendors is the core of this job.",
    summary: "Coordinate daily pickups and deliveries for a regional LTL carrier. You will work with dispatch, drivers, and customers to keep freight moving and resolve exceptions.",
    gaps: ["tms"],
    signals: { firstPostedDaysAgo: 12, reposts90: 1, companySite: "unconfirmed", poster: "employer", salaryListed: true, applicantTrend: "steady" },
    apply: "prefill",
  },
  {
    id: "j07", title: "Supply Chain Operations Associate (Remote)", co: "talentbridge", loc: "Remote (US)", mode: "Remote", sal: null, cat: "Supply Chain & Logistics", target: "supply",
    match: 72, industry: 60, applicants: 1480, ccf: false,
    why: "The duties overlap with your inventory work, but the listing is vague and the client is not named.",
    summary: "Our client, a fast growing company, is looking for a Supply Chain Operations Associate to join its dynamic team. Responsibilities include supporting supply chain processes and other duties as assigned. Competitive pay.",
    resp: ["Support supply chain processes", "Work with cross functional teams", "Other duties as assigned"],
    req: ["Experience in supply chain or related field", "Strong communication skills", "Self starter"],
    nice: [],
    gaps: ["wms"],
    signals: { firstPostedDaysAgo: 74, reposts90: 4, companySite: "unconfirmed", poster: "agency", salaryListed: false, applicantTrend: "stalled" },
    apply: "prefill",
  },
  {
    id: "j08", title: "Fulfillment Operations Manager", co: "lumenbirch", loc: "Remote (US)", mode: "Remote", sal: [88000, 104000], cat: "Operations", target: "supply",
    match: 89, industry: 84, applicants: 112, ccf: true,
    why: "Home goods, inventory, vendors, and 3PL oversight. You have run the store end of this for eight years.",
    summary: "Lumen & Birch ships furniture and home goods from three 3PL partners. The Fulfillment Operations Manager owns performance across those partners: accuracy, speed, damages, and cost.",
    gaps: ["wms", "sql"],
    signals: { firstPostedDaysAgo: 2, reposts90: 0, companySite: "confirmed", checkedHoursAgo: 11, poster: "employer", salaryListed: true, applicantTrend: "rising" },
    apply: "auto",
  },
  {
    id: "j09", title: "Procurement Specialist", co: "copperline", loc: "New Haven, CT", mode: "Hybrid", sal: [62000, 72000], cat: "Supply Chain & Logistics", target: "supply",
    match: 71, industry: 50, applicants: 39, ccf: true,
    why: "Your $210K in vendor credits shows you can negotiate and hold suppliers accountable.",
    summary: "Buy raw materials and MRO supplies for two plants. Manage purchase orders, supplier performance, and pricing reviews.",
    gaps: ["forecast", "sql"],
    signals: { firstPostedDaysAgo: 9, reposts90: 1, companySite: "confirmed", checkedHoursAgo: 20, poster: "employer", salaryListed: true, applicantTrend: "steady" },
    apply: "manual", manualReason: MANUAL_PORTAL,
  },
  {
    id: "j10", title: "Demand Planning Analyst", co: "wayfarer", loc: "Portland, ME", mode: "Hybrid", sal: [72000, 85000], cat: "Supply Chain & Logistics", target: "supply",
    match: 69, industry: 82, applicants: 210, ccf: false,
    why: "Replenishment is next door to forecasting, but this one leans hard on statistical models.",
    summary: "Build demand forecasts for 40 stores and the wholesale channel, and work with buyers to set inventory targets.",
    gaps: ["forecast", "sql", "bi"],
    signals: { firstPostedDaysAgo: 38, reposts90: 3, companySite: "confirmed", checkedHoursAgo: 14, poster: "employer", salaryListed: true, applicantTrend: "steady" },
    apply: "auto",
  },
  {
    id: "j11", title: "Last Mile Operations Lead", co: "evergreenhd", loc: "Stamford, CT", mode: "Onsite", sal: [64000, 74000], cat: "Operations", target: "supply",
    match: 80, industry: 65, applicants: 26, ccf: true,
    why: "Scheduling 120 people and handling escalated customers is most of this job.",
    summary: "Lead a hub of delivery crews for white glove furniture delivery. Own route performance, customer escalations, and crew scheduling.",
    gaps: ["tms"],
    signals: { firstPostedDaysAgo: 5, reposts90: 0, companySite: "confirmed", checkedHoursAgo: 9, poster: "employer", salaryListed: true, applicantTrend: "steady" },
    apply: "auto",
  },
  {
    id: "j12", title: "Warehouse Operations Manager", co: "bluefin", loc: "North Kingstown, RI", mode: "Onsite", sal: [78000, 90000], cat: "Supply Chain & Logistics", target: "supply",
    match: 82, industry: 58, applicants: 95, ccf: false,
    why: "Strong on leadership and inventory, but they want warehouse experience specifically.",
    summary: "Manage cross dock and warehouse operations at a port adjacent facility. Lead 60 associates across two shifts.",
    gaps: ["wms", "dc", "tms"],
    signals: { firstPostedDaysAgo: 44, reposts90: 1, companySite: "confirmed", checkedHoursAgo: 20, poster: "employer", salaryListed: true, applicantTrend: "steady" },
    apply: "prefill",
  },
  {
    id: "j13", title: "Operations Associate, Remote", co: "apex", loc: "Remote (US)", mode: "Remote", sal: null, cat: "Operations", target: "program",
    match: 64, industry: 55, applicants: 2600, ccf: false,
    why: "Generic duties with no named employer. We would not spend time here.",
    summary: "We are always looking for talented operations professionals to join our clients. Apply now to be considered for current and future openings.",
    resp: ["Support operations for a variety of clients", "Maintain records and reports", "Other duties as needed"],
    req: ["Operations experience", "Positive attitude"],
    nice: [],
    gaps: [],
    signals: { firstPostedDaysAgo: 190, reposts90: 2, companySite: "missing", poster: "agency", salaryListed: false, applicantTrend: "stalled", evergreen: true },
    apply: "prefill",
  },
  {
    id: "j14", title: "Program Operations Manager", co: "quarrylane", loc: "Boston, MA", mode: "Hybrid", sal: [98000, 118000], cat: "Program Management", target: "program",
    match: 85, industry: 45, applicants: 88, ccf: true,
    why: "Their product runs store scheduling. You rolled out a scheduling process that cut overtime 18%.",
    summary: "Quarry Lane builds scheduling software for multi location retailers. The Program Operations Manager runs customer rollout programs, coordinating product, support, and customer store teams through go live.",
    resp: ["Run rollout programs for new retail customers from contract to go live", "Build rollout plans, timelines, and risk logs", "Coordinate product, support, and customer operations teams", "Train customer district and store leaders", "Report program health to leadership weekly"],
    req: ["5+ years of operations or program experience", "Experience rolling out new processes or systems to large teams", "Excellent stakeholder communication", "Comfort with data and reporting"],
    nice: ["Retail operations background", "Project tool experience"],
    gaps: ["saas", "pmtools", "pmp"],
    signals: { firstPostedDaysAgo: 3, reposts90: 0, companySite: "confirmed", checkedHoursAgo: 4, poster: "employer", salaryListed: true, applicantTrend: "rising" },
    apply: "auto",
  },
  {
    id: "j15", title: "Program Coordinator", co: "stonebridge", loc: "Pawtucket, RI", mode: "Hybrid", sal: [54000, 61000], cat: "Program Management", target: "program",
    match: 88, industry: 48, applicants: 31, ccf: true,
    why: "Coordinating 7 clinics is like running a region. Your scheduling and training work fits.",
    summary: "Coordinate a grant funded community health program across seven clinics: schedules, reporting, supplies, and training.",
    gaps: ["pmtools", "ehr"],
    signals: { firstPostedDaysAgo: 7, reposts90: 0, companySite: "unconfirmed", poster: "employer", salaryListed: true, applicantTrend: "steady" },
    apply: "prefill",
  },
  {
    id: "j16", title: "Operations Program Manager", co: "kinetic", loc: "Remote (US)", mode: "Remote", sal: [105000, 125000], cat: "Program Management", target: "program",
    match: 79, industry: 58, applicants: 140, ccf: false,
    why: "Scope fits your regional role. They prefer parcel or logistics experience.",
    summary: "Drive network programs such as new facility launches and peak season readiness across a regional parcel network.",
    gaps: ["pmp", "dc", "sql"],
    signals: { firstPostedDaysAgo: 1, reposts90: 0, companySite: "confirmed", checkedHoursAgo: 6, poster: "employer", salaryListed: true, applicantTrend: "rising" },
    apply: "auto", isNew: true,
  },
  {
    id: "j17", title: "Associate Program Manager, Store Experience", co: "anchoroak", loc: "Remote (US)", mode: "Remote", sal: [80000, 92000], cat: "Program Management", target: "program",
    match: 90, industry: 86, applicants: 76, ccf: true,
    why: "You coordinated a full store remodel with no missed opening days. They are remodeling 30 showrooms.",
    summary: "Help run the showroom remodel program across 30 locations: timelines, vendors, store communication, and opening readiness.",
    gaps: ["pmtools", "pmp"],
    signals: { firstPostedDaysAgo: 10, reposts90: 0, companySite: "unconfirmed", poster: "employer", salaryListed: true, applicantTrend: "steady" },
    apply: "prefill",
  },
  {
    id: "j18", title: "Program Manager, Workforce Development", co: "beaconfdn", loc: "Boston, MA", mode: "Hybrid", sal: [72000, 84000], cat: "Program Management", target: "program",
    match: 66, industry: 40, applicants: 54, ccf: true,
    why: "Your training record helps, but grant management is a large part of this role.",
    summary: "Manage a portfolio of job training grants: partner check ins, outcomes reporting, and site visits.",
    gaps: ["pmtools", "pmp"],
    signals: { firstPostedDaysAgo: 16, reposts90: 0, companySite: "confirmed", checkedHoursAgo: 18, poster: "employer", salaryListed: true, applicantTrend: "steady" },
    apply: "auto",
  },
  {
    id: "j19", title: "Customer Success Manager", co: "ledgerly", loc: "Remote (US)", mode: "Remote", sal: [75000, 90000], cat: "Customer Success", target: "cs",
    match: 76, industry: 42, applicants: 190, ccf: true,
    why: "Their customers are small retailers. You speak their language better than most applicants.",
    summary: "Own a book of 80 small retail and restaurant customers after onboarding. Drive adoption, renewals, and expansion.",
    gaps: ["saas", "salesforce"],
    signals: { firstPostedDaysAgo: 5, reposts90: 0, companySite: "confirmed", checkedHoursAgo: 12, poster: "employer", salaryListed: true, applicantTrend: "rising" },
    apply: "auto",
  },
  {
    id: "j20", title: "Customer Success Operations Specialist", co: "trellis", loc: "New York, NY", mode: "Hybrid", sal: [78000, 90000], cat: "Customer Success", target: "cs",
    match: 70, industry: 38, applicants: 120, ccf: false,
    why: "Your reporting and process work fits. Healthcare software background is strongly preferred.",
    summary: "Build the reporting, playbooks, and tooling that the customer success team runs on.",
    gaps: ["saas", "salesforce", "sql"],
    signals: { firstPostedDaysAgo: 11, reposts90: 1, companySite: "confirmed", checkedHoursAgo: 16, poster: "employer", salaryListed: true, applicantTrend: "steady" },
    apply: "manual", manualReason: MANUAL_CAPTCHA,
  },
  {
    id: "j21", title: "Implementation Specialist", co: "parcelpoint", loc: "Remote (US)", mode: "Remote", sal: [68000, 80000], cat: "Customer Success", target: "cs",
    match: 81, industry: 55, applicants: 65, ccf: true,
    why: "They onboard mid size retailers. Half their team came from operations, like you.",
    summary: "Guide new retail customers through setup of shipping and returns software, from kickoff to live.",
    gaps: ["saas", "pmtools"],
    signals: { firstPostedDaysAgo: 4, reposts90: 0, companySite: "unconfirmed", poster: "employer", salaryListed: true, applicantTrend: "rising" },
    apply: "prefill",
  },
  {
    id: "j22", title: "Client Operations Manager", co: "meridian", loc: "Providence, RI", mode: "Hybrid", sal: [80000, 92000], cat: "Operations", target: "cs",
    match: 83, industry: 60, applicants: 47, ccf: true,
    why: "Multi location retail pharmacy operations, 15 minutes from home.",
    summary: "Manage operations and service quality for long term care facility clients across Rhode Island, including delivery schedules and escalations.",
    gaps: ["ehr"],
    signals: { firstPostedDaysAgo: 2, reposts90: 0, companySite: "confirmed", checkedHoursAgo: 7, poster: "employer", salaryListed: true, applicantTrend: "rising" },
    apply: "auto",
  },
  {
    id: "j23", title: "Customer Experience Manager", co: "sunhaven", loc: "Newport, RI", mode: "Onsite", sal: [62000, 70000], cat: "Customer Success", target: "cs",
    match: 74, industry: 45, applicants: 22, ccf: true,
    why: "Eleven straight quarters above district NPS is the headline here.",
    summary: "Lead resident and family experience at a 180 unit community. Manage concierge and hospitality staff.",
    gaps: ["ehr"],
    signals: { firstPostedDaysAgo: 20, reposts90: 1, companySite: "confirmed", checkedHoursAgo: 22, poster: "employer", salaryListed: true, applicantTrend: "steady" },
    apply: "auto",
  },
  {
    id: "j24", title: "Practice Operations Manager", co: "pinecrest", loc: "Cranston, RI", mode: "Onsite", sal: [70000, 82000], cat: "Healthcare Admin", target: "health",
    match: 87, industry: 48, applicants: 36, ccf: true,
    why: "Three of their practice managers came from retail. They care about running a tight operation.",
    summary: "Run day to day operations for two primary care practices: staffing, scheduling, patient flow, supplies, and budgets. You partner with the lead physician at each site.",
    resp: ["Manage front desk, medical assistants' schedules, and patient flow at two practices", "Own practice budgets, supply ordering, and vendor relationships", "Track wait times, no show rates, and patient satisfaction", "Hire, train, and coach a team of 18", "Keep the practices compliant with privacy and safety policies"],
    req: ["4+ years managing a multi person team", "Budget or P&L experience", "Strong customer service leadership", "Excellent organizational skills"],
    nice: ["Healthcare or EHR experience", "Multi site management"],
    gaps: ["ehr"],
    signals: { firstPostedDaysAgo: 3, reposts90: 0, companySite: "confirmed", checkedHoursAgo: 10, poster: "employer", salaryListed: true, applicantTrend: "rising" },
    apply: "auto",
  },
  {
    id: "j25", title: "Patient Access Supervisor", co: "riverbend", loc: "Springfield, MA", mode: "Onsite", sal: [58000, 66000], cat: "Healthcare Admin", target: "health",
    match: 73, industry: 42, applicants: 51, ccf: true,
    why: "Supervising a front line team and handling escalations transfers well.",
    summary: "Supervise registration and scheduling staff in the emergency department and outpatient areas.",
    gaps: ["ehr", "revcycle"],
    signals: { firstPostedDaysAgo: 8, reposts90: 0, companySite: "confirmed", checkedHoursAgo: 15, poster: "employer", salaryListed: true, applicantTrend: "steady" },
    apply: "manual", manualReason: MANUAL_PORTAL,
  },
  {
    id: "j26", title: "Clinic Operations Coordinator", co: "graniteharbor", loc: "Portsmouth, NH", mode: "Onsite", sal: [52000, 58000], cat: "Healthcare Admin", target: "health",
    match: 77, industry: 45, applicants: 19, ccf: true,
    why: "A new clinic opening, like your remodel project, with scheduling at the center.",
    summary: "Coordinate operations for a new primary care clinic opening this winter: supplies, scheduling templates, and front desk training.",
    gaps: ["ehr"],
    signals: { firstPostedDaysAgo: 5, reposts90: 0, companySite: "confirmed", checkedHoursAgo: 13, poster: "employer", salaryListed: true, applicantTrend: "steady" },
    apply: "auto",
  },
  {
    id: "j27", title: "Healthcare Supply Chain Coordinator", co: "summitridge", loc: "Burlington, VT", mode: "Hybrid", sal: [60000, 68000], cat: "Supply Chain & Logistics", target: "health",
    match: 88, industry: 52, applicants: 28, ccf: true,
    why: "Inventory counts, replenishment, and vendor claims, applied to clinical supplies.",
    summary: "Coordinate supply replenishment for 40 clinics as the health system centralizes its supply chain.",
    gaps: ["wms", "ehr"],
    signals: { firstPostedDaysAgo: 6, reposts90: 0, companySite: "confirmed", checkedHoursAgo: 4, poster: "employer", salaryListed: true, applicantTrend: "rising" },
    apply: "auto",
  },
  {
    id: "j28", title: "Revenue Cycle Operations Lead", co: "brightwater", loc: "Remote (US)", mode: "Remote", sal: [72000, 84000], cat: "Healthcare Admin", target: "health",
    match: 61, industry: 38, applicants: 340, ccf: false,
    why: "Your team leadership fits. The billing knowledge they require is a real gap.",
    summary: "Lead a team of billing specialists and own claim throughput metrics for physician group clients.",
    gaps: ["revcycle", "ehr", "sql"],
    signals: { firstPostedDaysAgo: 33, reposts90: 2, companySite: "unconfirmed", poster: "employer", salaryListed: true, applicantTrend: "stalled" },
    apply: "prefill",
  },
  {
    id: "j29", title: "Sales Operations Analyst", co: "halyard", loc: "Boston, MA", mode: "Hybrid", sal: [68000, 78000], cat: "Sales Operations", target: "program",
    match: 75, industry: 55, applicants: 60, ccf: true,
    why: "Your weekly sales and labor reports are sales ops work under a different name.",
    summary: "Own sales reporting, territory data, and commission calculations for a 40 person sales team.",
    gaps: ["salesforce", "sql"],
    signals: { firstPostedDaysAgo: 4, reposts90: 0, companySite: "confirmed", checkedHoursAgo: 19, poster: "employer", salaryListed: true, applicantTrend: "steady" },
    apply: "auto",
  },
  {
    id: "j30", title: "Revenue Operations Coordinator", co: "ledgerly", loc: "Remote (US)", mode: "Remote", sal: [62000, 70000], cat: "Sales Operations", target: "program",
    match: 68, industry: 40, applicants: 150, ccf: false,
    why: "Some reporting overlap. Mostly a CRM administration role.",
    summary: "Keep the CRM clean, build reports, and support the sales and success teams with data.",
    gaps: ["salesforce", "saas", "sql"],
    signals: { firstPostedDaysAgo: 14, reposts90: 1, companySite: "confirmed", checkedHoursAgo: 21, poster: "employer", salaryListed: true, applicantTrend: "steady" },
    apply: "auto",
  },
  {
    id: "j31", title: "Sales Operations Manager, Retail Channel", co: "wayfarer", loc: "Portland, ME", mode: "Hybrid", sal: [90000, 105000], cat: "Sales Operations", target: "program",
    match: 86, industry: 84, applicants: 42, ccf: true,
    why: "They sell to 600 retailers. You ran the retail side and know what stores need.",
    summary: "Run operations for the wholesale retail channel: order flow, partner reporting, and planning with the sales team.",
    gaps: ["salesforce", "bi"],
    signals: { firstPostedDaysAgo: 2, reposts90: 0, companySite: "confirmed", checkedHoursAgo: 3, poster: "employer", salaryListed: true, applicantTrend: "rising" },
    apply: "auto",
  },
  {
    id: "j32", title: "Territory Operations Specialist", co: "crestview", loc: "Albany, NY", mode: "Onsite", sal: [58000, 66000], cat: "Sales Operations", target: "supply",
    match: 72, industry: 70, applicants: 33, ccf: true,
    why: "Account visits, merchandising, and delivery issues across grocery accounts.",
    summary: "Support a sales territory of 120 grocery and convenience accounts: orders, delivery issues, and shelf compliance.",
    gaps: ["salesforce"],
    signals: { firstPostedDaysAgo: 9, reposts90: 0, companySite: "unconfirmed", poster: "employer", salaryListed: true, applicantTrend: "steady" },
    apply: "prefill",
  },
  {
    id: "j33", title: "Project Coordinator, Store Openings", co: "fieldstone", loc: "Worcester, MA", mode: "Hybrid", sal: [58000, 66000], cat: "Project Coordination", target: "project",
    match: 92, industry: 88, applicants: 24, ccf: true, isNew: true,
    why: "Four new stores this year. You coordinated a full remodel without missing an opening day.",
    summary: "Coordinate the timelines, vendors, and store team readiness for four new grocery store openings.",
    gaps: ["pmtools", "pmp"],
    signals: { firstPostedDaysAgo: 3, reposts90: 0, companySite: "confirmed", checkedHoursAgo: 5, poster: "employer", salaryListed: true, applicantTrend: "rising" },
    apply: "auto",
  },
  {
    id: "j34", title: "Operations Project Coordinator", co: "beaconhill", loc: "Boston, MA", mode: "Hybrid", sal: [60000, 68000], cat: "Project Coordination", target: "project",
    match: 74, industry: 50, applicants: 48, ccf: true,
    why: "Vendor coordination and schedules across many buildings, like your six stores.",
    summary: "Coordinate capital projects and vendor work across a portfolio of residential buildings.",
    gaps: ["pmtools"],
    signals: { firstPostedDaysAgo: 13, reposts90: 0, companySite: "confirmed", checkedHoursAgo: 17, poster: "employer", salaryListed: true, applicantTrend: "steady" },
    apply: "auto",
  },
  {
    id: "j35", title: "Project Coordinator (Contract to Hire)", co: "staffnorth", loc: "Hartford, CT", mode: "Hybrid", sal: [45000, 90000], cat: "Project Coordination", target: "project",
    match: 58, industry: 50, applicants: 890, ccf: false,
    why: "The range is unusually wide and the client is not named. Proceed carefully.",
    summary: "Exciting opportunity with a leading organization. Seeking a project coordinator for a contract to hire role. Pay depends on experience.",
    resp: ["Coordinate projects", "Communicate with stakeholders", "Other duties as assigned"],
    req: ["Project coordination experience", "Microsoft Office"],
    nice: [],
    gaps: ["pmtools"],
    signals: { firstPostedDaysAgo: 95, reposts90: 4, companySite: "unconfirmed", poster: "agency", salaryListed: true, applicantTrend: "stalled" },
    apply: "prefill",
  },
  {
    id: "j36", title: "PMO Coordinator", co: "trellis", loc: "Remote (US)", mode: "Remote", sal: [65000, 75000], cat: "Project Coordination", target: "project",
    match: 67, industry: 38, applicants: 130, ccf: false,
    why: "Coordination skills fit. They want someone who already knows software delivery.",
    summary: "Support the program management office with status reporting, resource tracking, and meeting coordination.",
    gaps: ["pmtools", "saas", "pmp"],
    signals: { firstPostedDaysAgo: 5, reposts90: 0, companySite: "confirmed", checkedHoursAgo: 8, poster: "employer", salaryListed: true, applicantTrend: "steady" },
    apply: "auto",
  },
  {
    id: "j37", title: "Facilities Project Coordinator", co: "stonebridge", loc: "Pawtucket, RI", mode: "Onsite", sal: [55000, 62000], cat: "Project Coordination", target: "project",
    match: 71, industry: 48, applicants: 17, ccf: true,
    why: "Remodel coordination and vendor scheduling are the core of this role.",
    summary: "Coordinate renovation and maintenance projects across seven clinic buildings.",
    gaps: ["pmtools"],
    signals: { firstPostedDaysAgo: 18, reposts90: 0, companySite: "confirmed", checkedHoursAgo: 23, poster: "employer", salaryListed: true, applicantTrend: "steady" },
    apply: "auto",
  },
  {
    id: "j38", title: "Operations Manager, Pharmacy Network", co: "meridian", loc: "Remote (Northeast)", mode: "Remote", sal: [92000, 108000], cat: "Operations", target: "supply",
    match: 84, industry: 62, applicants: 70, ccf: true,
    why: "Twelve new locations to open and standardize. Your multi site playbook fits.",
    summary: "Standardize operations across a growing network of pharmacy locations: inventory, staffing models, and openings.",
    gaps: ["ehr", "bi"],
    signals: { firstPostedDaysAgo: 7, reposts90: 0, companySite: "unconfirmed", poster: "employer", salaryListed: true, applicantTrend: "rising" },
    apply: "prefill",
  },
  {
    id: "j39", title: "Vendor Operations Specialist", co: "lumenbirch", loc: "Remote (US)", mode: "Remote", sal: [65000, 76000], cat: "Supply Chain & Logistics", target: "supply",
    match: 79, industry: 84, applicants: 260, ccf: true,
    why: "Vendor claims and delivery schedules, which you already do well.",
    summary: "Manage day to day vendor performance: late shipments, damages, and chargebacks for home goods suppliers.",
    gaps: ["sql"],
    signals: { firstPostedDaysAgo: 36, reposts90: 1, companySite: "confirmed", checkedHoursAgo: 12, poster: "employer", salaryListed: true, applicantTrend: "steady" },
    apply: "auto",
  },
  {
    id: "j40", title: "Supply Chain Planner", co: "harborlight", loc: "Hartford, CT", mode: "Hybrid", sal: [74000, 86000], cat: "Supply Chain & Logistics", target: "supply",
    match: 83, industry: 72, applicants: 38, ccf: true,
    why: "Replenishment planning for perishables. Your 22% stockout reduction is the proof point.",
    summary: "Plan ingredient and packaging replenishment for two production kitchens. Work closely with purchasing and production.",
    gaps: ["forecast", "sql"],
    signals: { firstPostedDaysAgo: 2, reposts90: 0, companySite: "confirmed", checkedHoursAgo: 6, poster: "employer", salaryListed: true, applicantTrend: "rising" },
    apply: "auto",
  },
];

function breakdownFor(seed: Seed, idx: number) {
  const avg = (seed.match - 0.1 * seed.industry) / 0.9;
  const d = (idx % 5) - 2;
  const clamp = (n: number) => Math.max(20, Math.min(99, Math.round(n)));
  let experience = clamp(avg + d);
  let skills = clamp(avg - 4 - d);
  const transferable = clamp(avg + 4);
  const industry = seed.industry;
  const weighted = () => 0.3 * experience + 0.3 * skills + 0.1 * industry + 0.3 * transferable;
  // Clamping can pull the total off target. Push the difference into the component with the most room.
  for (let i = 0; i < 6 && Math.round(weighted()) !== seed.match; i++) {
    const step = Math.sign(seed.match - weighted());
    if (step > 0) {
      if (experience < 99) experience++;
      else if (skills < 99) skills++;
    } else if (skills > 20) skills--;
    else experience--;
  }
  const match = Math.round(weighted());
  return { breakdown: { experience, skills, industry, transferable }, match };
}

export const MATCH_WEIGHTS = { experience: 0.3, skills: 0.3, industry: 0.1, transferable: 0.3 };

export const JOBS: Job[] = SEEDS.map((s, i) => {
  const t = TEMPLATES[s.cat];
  const { breakdown, match } = breakdownFor(s, i);
  const company = COMPANIES[s.co];
  return {
    id: s.id,
    title: s.title,
    company,
    location: s.loc,
    mode: s.mode,
    salary: s.sal,
    postedDaysAgo: s.signals.firstPostedDaysAgo,
    applicants: s.applicants,
    category: s.cat,
    careerChangerFriendly: s.ccf,
    why: s.why,
    summary: s.summary,
    responsibilities: s.resp ?? t.resp,
    requirements: s.req ?? t.req,
    niceToHave: s.nice ?? t.nice,
    gaps: s.gaps.map((g) => GAPS[g]),
    target: s.target,
    applyMethod: s.apply,
    manualReason: s.manualReason,
    source:
      s.signals.poster === "agency"
        ? "Staffing agency post on a job board"
        : s.signals.companySite === "confirmed"
          ? `${company.name} careers page`
          : "Job board aggregator",
    closesInDays: s.closes,
    signals: s.signals,
    legit: computeLegitimacy(s.signals),
    breakdown,
    match,
    isNew: s.isNew,
  };
});

export const jobById = (id: string) => JOBS.find((j) => j.id === id);

export const CATEGORIES: Category[] = [
  "Operations",
  "Supply Chain & Logistics",
  "Program Management",
  "Customer Success",
  "Healthcare Admin",
  "Sales Operations",
  "Project Coordination",
];

export const LEGIT_META: Record<LegitBadge, { label: string; short: string; tone: "success" | "info" | "warning" | "danger"; help: string }> = {
  verified: { label: "Verified Live", short: "Verified", tone: "success", help: "Confirmed on the company's own careers page within the last 24 hours." },
  active: { label: "Likely Active", short: "Active", tone: "info", help: "Posted recently on a job board. Not yet confirmed on the company's own site." },
  stale: { label: "Stale", short: "Stale", tone: "warning", help: "Older than 30 days, or reposted more than twice in 90 days." },
  ghost: { label: "Ghost Risk", short: "Ghost risk", tone: "danger", help: "Evergreen posting, an agency reposting the same role repeatedly, or no matching role on the company site." },
};

export function salaryText(s: Job["salary"]) {
  if (!s) return "Salary not listed";
  const k = (n: number) => `$${Math.round(n / 1000)}K`;
  return `${k(s[0])} to ${k(s[1])}`;
}

export function salaryMarket(job: Job) {
  const base = job.salary ? (job.salary[0] + job.salary[1]) / 2 : 70000;
  const seed = (parseInt(job.id.slice(1), 10) % 7) - 3;
  const median = Math.round((base * (1 + seed * 0.012)) / 1000) * 1000;
  return {
    p25: Math.round((median * 0.86) / 1000) * 1000,
    median,
    p75: Math.round((median * 1.14) / 1000) * 1000,
    sample: 140 + parseInt(job.id.slice(1), 10) * 11,
  };
}

/* ------------------------------------------------------------------ */
/* Live data swap. Demo accounts see the seeded jobs, real accounts    */
/* see listings loaded from the database. Same screens, real data.     */
/* ------------------------------------------------------------------ */

export const DEMO_JOBS: Job[] = [...JOBS];
export const demoJobById = (id: string) => DEMO_JOBS.find((j) => j.id === id);

let version = 0;
const listeners = new Set<() => void>();
const bump = () => {
  version++;
  listeners.forEach((l) => l());
};

export const jobsVersion = () => version;
export function subscribeJobs(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function setLiveJobs(list: Job[]) {
  JOBS.splice(0, JOBS.length, ...list);
  bump();
}

export function restoreDemoJobs() {
  JOBS.splice(0, JOBS.length, ...DEMO_JOBS);
  bump();
}

/** Replace one job in place (for example after its full analysis arrives). */
export function patchJob(job: Job) {
  const i = JOBS.findIndex((j) => j.id === job.id);
  if (i >= 0) JOBS[i] = job;
  else JOBS.push(job);
  bump();
}
