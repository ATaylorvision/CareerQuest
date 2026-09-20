import { daysAgo, daysFromNow } from "@/lib/date";
import { jobById, type Job } from "./jobs";
import { BASE_RESUME } from "./user";

export type Column = "saved" | "applied" | "screening" | "interview" | "offer" | "closed";
export type Method = "submitted" | "prefilled" | "manual";
export type EventType =
  | "saved"
  | "prepared"
  | "submitted"
  | "confirmed"
  | "viewed"
  | "review"
  | "screen"
  | "interview"
  | "offer"
  | "rejected"
  | "noresponse"
  | "note";

export interface TimelineEvent {
  id: string;
  type: EventType;
  at: string;
  note?: string;
  future?: boolean;
}

export interface Receipt {
  method: Method;
  destination: "company" | "board";
  destinationLabel: string;
  submittedAt: string | null;
  resumeVersionId: string;
  coverLetter: string;
  fields: { q: string; a: string }[];
  confirmation: { verified: boolean; code?: string; source?: string; userUpload?: string };
}

export interface Application {
  id: string;
  jobId: string;
  column: Column;
  savedAt: string;
  receipt?: Receipt;
  events: TimelineEvent[];
  nextStep?: string;
}

export const COLUMNS: { id: Column; label: string; hint: string }[] = [
  { id: "saved", label: "Saved", hint: "Not sent yet" },
  { id: "applied", label: "Applied", hint: "Waiting to hear" },
  { id: "screening", label: "Screening", hint: "Recruiter contact" },
  { id: "interview", label: "Interview", hint: "Talking to the team" },
  { id: "offer", label: "Offer", hint: "Decision time" },
  { id: "closed", label: "Closed", hint: "Rejected, withdrawn, or no response" },
];

export const METHOD_META: Record<Method, { label: string; tone: "success" | "info" | "warning"; help: string }> = {
  submitted: { label: "Submitted by CareerQuest", tone: "success", help: "CareerQuest completed and submitted this application, and captured the confirmation." },
  prefilled: { label: "Prefilled, you submitted", tone: "info", help: "CareerQuest filled in the form. You reviewed it and pressed submit yourself." },
  manual: { label: "Manual required", tone: "warning", help: "This employer blocks automation. You submit it yourself. We give you the link and your answers." },
};

export const EVENT_META: Record<EventType, { label: string; tone: "success" | "info" | "warning" | "danger" | "muted" }> = {
  saved: { label: "Saved", tone: "muted" },
  prepared: { label: "Prepared, waiting on you", tone: "warning" },
  submitted: { label: "Submitted", tone: "info" },
  confirmed: { label: "Confirmation received", tone: "success" },
  viewed: { label: "Viewed by employer", tone: "info" },
  review: { label: "Moved to review", tone: "info" },
  screen: { label: "Recruiter screen", tone: "info" },
  interview: { label: "Interview", tone: "success" },
  offer: { label: "Offer", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  noresponse: { label: "No response after 14 days", tone: "muted" },
  note: { label: "Note", tone: "muted" },
};

/* ------------------------------------------------------------------ */

export function coverLetterFor(job: Job, tone: "warm" | "direct" | "formal" = "warm") {
  const co = job.company.name;
  const opener =
    tone === "formal"
      ? `Dear ${co} Hiring Team,`
      : tone === "direct"
        ? `Hello ${co} team,`
        : `Hi ${co} team,`;
  const intro =
    tone === "direct"
      ? `I am applying for the ${job.title} role. For eight years I ran retail operations at Harbor & Pine Home, most recently six stores and about 120 people across Rhode Island and southeastern Massachusetts.`
      : tone === "formal"
        ? `I am writing to apply for the ${job.title} position. Over eight years at Harbor & Pine Home, I progressed from Store Operations Manager to Regional Operations Manager, overseeing six locations with combined annual revenue of $38M.`
        : `I am applying for the ${job.title} role. I spent eight years running retail operations at Harbor & Pine Home, most recently six stores with about 120 people, and the work you describe is work I have been doing under a different title.`;
  const proof =
    job.target === "supply"
      ? "I managed weekly inventory counts and replenishment for six locations and cut stockouts by 22% in 2024. I also worked with 14 vendors on delivery schedules and damaged goods claims, recovering $210K in credits over two years."
      : job.target === "cs"
        ? "I kept store NPS above the district average for 11 straight quarters and handled escalated customer issues directly. I also worked with 14 vendors on schedules and claims, recovering $210K in credits."
        : job.target === "health"
          ? "I led a team of six store managers and about 120 hourly associates, rolled out a new scheduling process that reduced overtime by 18%, and kept customer satisfaction above district average for 11 straight quarters."
          : "I coordinated seasonal floor sets and a full store remodel with no missed opening days, and I rolled out a new Kronos scheduling process across six stores that reduced overtime by 18%.";
  const gap = job.gaps[0] ? job.gaps[0].coverLetterLine : "";
  const why =
    tone === "direct"
      ? `I was laid off in a restructuring in May. I am moving toward ${job.category.toLowerCase()} work on purpose, because it is the part of my old job I was best at.`
      : `My role was eliminated in a restructuring this spring. I am using the change to move toward ${job.category.toLowerCase()} work, which was always the part of my job I liked most.`;
  const close =
    tone === "formal"
      ? `Thank you for your consideration. I would welcome the opportunity to discuss how my experience fits ${co}'s needs.\n\nSincerely,\nRenee Castillo`
      : `I would like to talk about how I could help. Thank you for reading.\n\nRenee Castillo`;
  return [opener, intro, proof, gap, why, close].filter(Boolean).join("\n\n");
}

function fieldsFor(job: Job, versionName: string) {
  if (job.live) {
    // Only what we actually know. Work authorization, salary, and screening answers are the user's to give on the employer's form.
    return [
      { q: "Full name", a: BASE_RESUME.name },
      { q: "Email", a: BASE_RESUME.email },
      { q: "Phone", a: BASE_RESUME.phone },
      { q: "Location", a: BASE_RESUME.location },
      { q: "Resume", a: `${versionName}.pdf` },
    ].filter((f) => f.a);
  }
  const desired = job.salary ? `$${(Math.round((job.salary[0] + job.salary[1]) / 2 / 1000) * 1000).toLocaleString()}` : "$85,000";
  const f = [
    { q: "Full name", a: BASE_RESUME.name },
    { q: "Email", a: BASE_RESUME.email },
    { q: "Phone", a: BASE_RESUME.phone },
    { q: "Location", a: BASE_RESUME.location },
    { q: "Resume", a: `${versionName}.pdf` },
    { q: "Are you legally authorized to work in the United States?", a: "Yes" },
    { q: "Will you now or in the future require visa sponsorship?", a: "No" },
    { q: "Desired salary", a: desired },
    { q: "Years of operations management experience", a: "8" },
    { q: "Earliest start date", a: "Two weeks from offer" },
  ];
  if (job.gaps.some((g) => g.id === "wms")) {
    f.push({ q: "Do you have experience with a warehouse management system (WMS)?", a: "No. I have used Oracle Retail for inventory, receiving, and cycle counts across six locations." });
  }
  if (job.gaps.some((g) => g.id === "ehr")) {
    f.push({ q: "Do you have EHR experience?", a: "No. I rolled out a new Kronos scheduling process to about 120 associates and I learn software quickly." });
  }
  f.push({ q: "How did you hear about this role?", a: job.signals.companySite === "confirmed" ? "Company careers page" : "Job board" });
  return f;
}

interface AppSeed {
  id: string;
  jobId: string;
  column: Column;
  savedDaysAgo: number;
  method?: Method;
  submittedDaysAgo?: number;
  version?: string;
  verified?: boolean;
  code?: string;
  confirmSource?: string;
  events?: [EventType, number, string?][];
  future?: [EventType, number, string?][];
  nextStep?: string;
}

const VERSION_NAMES: Record<string, string> = {
  "v-base": "Renee_Castillo_Resume",
  "v-supply": "Renee_Castillo_Resume_SupplyChainOps_v2",
  "v-program": "Renee_Castillo_Resume_ProgramCoordinator_v1",
};

const APP_SEEDS: AppSeed[] = [
  { id: "a01", jobId: "j01", column: "saved", savedDaysAgo: 1, nextStep: "Tailor your resume. Closes Friday." },
  { id: "a02", jobId: "j03", column: "saved", savedDaysAgo: 0, nextStep: "Strong match. Tailor and send this week." },
  { id: "a03", jobId: "j17", column: "saved", savedDaysAgo: 3, nextStep: "Ask Copilot about the remodel story." },

  { id: "a04", jobId: "j08", column: "applied", savedDaysAgo: 3, method: "submitted", submittedDaysAgo: 2, version: "v-supply", verified: true, code: "LB-20931", confirmSource: "On screen confirmation captured", events: [["confirmed", 2]] },
  { id: "a05", jobId: "j27", column: "applied", savedDaysAgo: 5, method: "submitted", submittedDaysAgo: 4, version: "v-supply", verified: true, code: "SRH-77410", confirmSource: "On screen confirmation captured", events: [["confirmed", 4], ["viewed", 2]] },
  { id: "a06", jobId: "j09", column: "applied", savedDaysAgo: 7, method: "manual", submittedDaysAgo: 6, version: "v-supply", verified: false, nextStep: "Add your confirmation email to verify this one." },
  { id: "a07", jobId: "j04", column: "applied", savedDaysAgo: 7, method: "prefilled", submittedDaysAgo: 6, version: "v-supply", verified: true, code: "OAK-3318", confirmSource: "Confirmation email matched", events: [["confirmed", 6]] },
  { id: "a08", jobId: "j22", column: "applied", savedDaysAgo: 2, method: "submitted", submittedDaysAgo: 1, version: "v-supply", verified: true, code: "MRP-55102", confirmSource: "On screen confirmation captured", events: [["confirmed", 1]] },

  { id: "a09", jobId: "j02", column: "screening", savedDaysAgo: 13, method: "submitted", submittedDaysAgo: 12, version: "v-supply", verified: true, code: "CDL-11873", confirmSource: "On screen confirmation captured", events: [["confirmed", 12], ["viewed", 10], ["review", 8], ["screen", 1, "30 minute phone screen with Dana, recruiter. Went well. She asked about WMS and the layoff."]], nextStep: "Hiring manager decision expected next week." },
  { id: "a10", jobId: "j15", column: "screening", savedDaysAgo: 16, method: "prefilled", submittedDaysAgo: 15, version: "v-program", verified: true, code: "SCH-4410", confirmSource: "Confirmation email matched", events: [["confirmed", 15], ["viewed", 12], ["review", 9], ["screen", 4, "Recruiter emailed to schedule a screen."]], nextStep: "Screen call Tuesday at 10:00." },

  { id: "a11", jobId: "j24", column: "interview", savedDaysAgo: 19, method: "submitted", submittedDaysAgo: 18, version: "v-supply", verified: true, code: "PMG-90215", confirmSource: "On screen confirmation captured", events: [["confirmed", 18], ["viewed", 15], ["review", 13], ["screen", 9, "Phone screen with HR. Moved forward."]], future: [["interview", 3, "Onsite interview with the lead physician and the regional director, 2 hours."]], nextStep: "Onsite interview in 3 days. Prep is ready." },
  { id: "a12", jobId: "j14", column: "interview", savedDaysAgo: 21, method: "submitted", submittedDaysAgo: 20, version: "v-program", verified: true, code: "QLS-6632", confirmSource: "On screen confirmation captured", events: [["confirmed", 20], ["viewed", 18], ["screen", 14, "Recruiter screen."], ["interview", 6, "Round 1 with the Director of Customer Operations. Asked about the Kronos rollout."]], future: [["interview", 5, "Round 2 panel interview, with product and support leads."]], nextStep: "Panel interview in 5 days." },

  { id: "a13", jobId: "j26", column: "offer", savedDaysAgo: 31, method: "submitted", submittedDaysAgo: 30, version: "v-supply", verified: true, code: "GHH-2291", confirmSource: "On screen confirmation captured", events: [["confirmed", 30], ["viewed", 27], ["screen", 22], ["interview", 15, "Interview with the clinic director."], ["interview", 9, "Final interview with the COO."], ["offer", 2, "Offer: $54,000 base, start in 3 weeks. Response due in 5 days."]], nextStep: "Offer response due in 5 days. Talk it through with Copilot." },

  { id: "a14", jobId: "j12", column: "closed", savedDaysAgo: 36, method: "submitted", submittedDaysAgo: 35, version: "v-base", verified: true, code: "BFS-1027", confirmSource: "On screen confirmation captured", events: [["confirmed", 35], ["viewed", 31], ["rejected", 20, "They chose a candidate with warehouse experience. Recruiter said to reapply for supervisor roles."]] },
  { id: "a15", jobId: "j28", column: "closed", savedDaysAgo: 41, method: "prefilled", submittedDaysAgo: 40, version: "v-base", verified: false, events: [["noresponse", 26]] },
];

export function buildSeedApplications(): Application[] {
  return APP_SEEDS.map((s) => {
    const job = jobById(s.jobId)!;
    const events: TimelineEvent[] = [{ id: `${s.id}-e0`, type: "saved", at: daysAgo(s.savedDaysAgo, 19, 12) }];
    let receipt: Receipt | undefined;
    if (s.method) {
      const submittedAt = daysAgo(s.submittedDaysAgo!, 9 + (parseInt(s.id.slice(1)) % 8), 14 + (parseInt(s.id.slice(1)) * 7) % 40);
      if (s.method === "manual") {
        events.push({ id: `${s.id}-ep`, type: "prepared", at: daysAgo(s.submittedDaysAgo! + 1, 20, 5), note: "Answers prepared. Employer portal blocks automation." });
      }
      events.push({
        id: `${s.id}-es`,
        type: "submitted",
        at: submittedAt,
        note: s.method === "manual" ? "You marked this as submitted on the employer's portal." : s.method === "prefilled" ? "Prefilled by CareerQuest. You reviewed and pressed submit." : "Submitted by CareerQuest on the company careers page.",
      });
      (s.events ?? []).forEach(([type, d, note], i) => events.push({ id: `${s.id}-x${i}`, type, at: daysAgo(d, 11 + i, 5 * i), note }));
      (s.future ?? []).forEach(([type, d, note], i) => events.push({ id: `${s.id}-f${i}`, type, at: daysFromNow(d), note, future: true }));
      const destination = s.method === "prefilled" ? "board" : "company";
      receipt = {
        method: s.method,
        destination,
        destinationLabel:
          destination === "company"
            ? `${job.company.name} careers page (direct)`
            : "Third party job board (aggregator listing)",
        submittedAt,
        resumeVersionId: s.version!,
        coverLetter: coverLetterFor(job),
        fields: fieldsFor(job, VERSION_NAMES[s.version!]),
        confirmation: { verified: !!s.verified, code: s.code, source: s.confirmSource },
      };
    }
    return { id: s.id, jobId: s.jobId, column: s.column, savedAt: daysAgo(s.savedDaysAgo), receipt, events, nextStep: s.nextStep };
  });
}

export function newApplicationFromJob(job: Job, method: Method, versionId: string, coverLetter: string, versionName: string): Application {
  const id = `a${Date.now().toString(36)}`;
  const at = new Date().toISOString();
  const events: TimelineEvent[] = [{ id: `${id}-e0`, type: "saved", at }];
  const verified = method !== "manual";
  events.push({
    id: `${id}-es`,
    type: method === "manual" ? "prepared" : "submitted",
    at,
    note:
      method === "manual"
        ? "Answers prepared. Employer portal blocks automation. Submit it yourself, then mark it here."
        : method === "prefilled"
          ? "Prefilled by CareerQuest. You reviewed and pressed submit."
          : "Submitted by CareerQuest on the company careers page.",
  });
  if (verified) events.push({ id: `${id}-ec`, type: "confirmed", at, note: method === "submitted" ? "On screen confirmation captured." : "Confirmation screen captured after you submitted." });
  const code = `${job.company.initials}-${Math.floor(10000 + Math.random() * 89999)}`;
  return {
    id,
    jobId: job.id,
    column: method === "manual" ? "saved" : "applied",
    savedAt: at,
    events,
    receipt: {
      method,
      destination: job.live ? (job.signals.companySite === "confirmed" ? "company" : "board") : method === "prefilled" ? "board" : "company",
      destinationLabel: job.live
        ? job.signals.companySite === "confirmed"
          ? `${job.company.name} careers page (direct)`
          : "Third party job board (listing link)"
        : method === "prefilled"
          ? "Third party job board (aggregator listing)"
          : `${job.company.name} careers page (direct)`,
      submittedAt: method === "manual" ? null : at,
      resumeVersionId: versionId,
      coverLetter,
      fields: fieldsFor(job, versionName),
      confirmation: verified ? { verified: true, code, source: "On screen confirmation captured" } : { verified: false },
    },
    nextStep: method === "manual" ? "Submit on the employer's site, then mark it submitted." : "Most employers respond within 7 to 10 business days.",
  };
}
