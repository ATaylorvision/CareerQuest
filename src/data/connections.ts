// Fictional people. Initials avatars only, no photos, no real contact details.

export type ReasonType = "former-employer" | "shared-pivot" | "school" | "region";
export type OutreachStatus = "none" | "drafted" | "sent" | "replied" | "meeting";

export interface Connection {
  id: string;
  name: string;
  title: string;
  companyId: string;
  company: string;
  reasonType: ReasonType;
  reason: string;
  detail: string;
  strength: number; // 0 to 100
  openJobs: string[];
  draft: string;
  status: OutreachStatus;
  lastTouch?: number; // days ago
  followUpIn?: number;
  hue: number;
}

export const REASON_META: Record<ReasonType, { label: string; weight: string }> = {
  "former-employer": { label: "Shared former employer", weight: "Strongest signal" },
  "shared-pivot": { label: "Made the same pivot", weight: "Strong signal" },
  school: { label: "Same school", weight: "Moderate signal" },
  region: { label: "Same local network", weight: "Light signal" },
};

export const OUTREACH_META: Record<OutreachStatus, { label: string; tone: "muted" | "info" | "success" | "warning" }> = {
  none: { label: "Not contacted", tone: "muted" },
  drafted: { label: "Draft ready", tone: "warning" },
  sent: { label: "Sent", tone: "info" },
  replied: { label: "Replied", tone: "success" },
  meeting: { label: "Call scheduled", tone: "success" },
};

export const SEED_CONNECTIONS: Connection[] = [
  {
    id: "p1", name: "Marcus Reyes", title: "Inbound Operations Manager", companyId: "cedarline", company: "Cedarline Logistics",
    reasonType: "former-employer", reason: "You both worked at Harbor & Pine Home", detail: "Marcus was a store manager in the Massachusetts region from 2016 to 2021, then moved to Cedarline. He made the retail to logistics move you are making.",
    strength: 94, openJobs: ["j02"], status: "drafted", hue: 214,
    draft: "Hi Marcus, I am Renee Castillo. I ran the Rhode Island region at Harbor & Pine until the restructuring in May. I saw you made the move to Cedarline a few years ago, and I am working on the same kind of move now. I am in process for the Supply Chain Analyst role on your team. Would you be open to a 15 minute call about what the transition was like? No pressure either way.",
  },
  {
    id: "p2", name: "Alicia Monteiro", title: "Director of Operations", companyId: "northvale", company: "Northvale Supply Co.",
    reasonType: "shared-pivot", reason: "Moved from retail district management to distribution in 2021", detail: "Spent nine years in grocery store operations before joining Northvale. She now leads the team hiring for the Operations Manager role.",
    strength: 88, openJobs: ["j01"], status: "none", hue: 160,
    draft: "Hi Alicia, I am Renee Castillo, a regional operations manager coming out of eight years in multi store retail. I noticed you made the jump from grocery operations to distribution, which is the move I am making now. I am applying for the Operations Manager role in Warwick and I would value ten minutes of your perspective on what translated for you and what did not.",
  },
  {
    id: "p3", name: "Tom Brennan", title: "Senior Program Manager", companyId: "anchoroak", company: "Anchor & Oak Furniture",
    reasonType: "former-employer", reason: "You both worked at Harbor & Pine Home", detail: "Tom was a visual merchandising lead at Harbor & Pine from 2014 to 2019. He now runs the showroom remodel program.",
    strength: 86, openJobs: ["j17"], status: "sent", lastTouch: 4, followUpIn: 3, hue: 25,
    draft: "Hi Tom, Renee Castillo here, formerly Regional Ops at Harbor & Pine. I remember the Warwick remodel crossed paths with your team back in 2019. I saw Anchor & Oak is remodeling 30 showrooms and the Associate Program Manager role looks like a strong fit for what I did on our remodel. Would you be up for a quick call about the team?",
  },
  {
    id: "p4", name: "Priya Natarajan", title: "Practice Manager", companyId: "pinecrest", company: "Pinecrest Medical Group",
    reasonType: "shared-pivot", reason: "Moved from retail store management into healthcare administration in 2022", detail: "Former store manager for a pharmacy chain. One of three Pinecrest practice managers who came from retail.",
    strength: 82, openJobs: ["j24"], status: "replied", lastTouch: 2, hue: 140,
    draft: "Hi Priya, I am Renee Castillo. I am interviewing for the Practice Operations Manager role at Pinecrest and I noticed you came over from retail management too. I would love to hear what surprised you most in your first six months.",
  },
  {
    id: "p5", name: "Kevin Oduya", title: "Supply Chain Manager", companyId: "summitridge", company: "Summit Ridge Health",
    reasonType: "shared-pivot", reason: "Went from retail inventory control to healthcare supply chain", detail: "Kevin led inventory control for a home improvement chain before Summit Ridge centralized its supply chain.",
    strength: 78, openJobs: ["j27"], status: "none", hue: 120,
    draft: "Hi Kevin, I am Renee Castillo. I applied for the Healthcare Supply Chain Coordinator role and saw that you also came from retail inventory control. I would appreciate hearing what the team values most in someone making that switch.",
  },
  {
    id: "p6", name: "Jenna Albright", title: "Customer Success Lead", companyId: "ledgerly", company: "Ledgerly",
    reasonType: "school", reason: "University of Rhode Island, Communications", detail: "Graduated two years after you, same major. Was a restaurant general manager before moving to Ledgerly.",
    strength: 64, openJobs: ["j19"], status: "none", hue: 190,
    draft: "Hi Jenna, fellow URI Communications grad here. I am Renee Castillo, coming from eight years in retail operations. I saw you moved from restaurant management into customer success, and I am exploring the same path. Would you share how you framed your background when you applied?",
  },
  {
    id: "p7", name: "Luis Carvalho", title: "Regional Operations Director", companyId: "harborlight", company: "Harborlight Foods",
    reasonType: "former-employer", reason: "You both worked at Harbor & Pine Home", detail: "Luis was your district's loss prevention partner from 2018 to 2020.",
    strength: 90, openJobs: ["j05", "j40"], status: "meeting", lastTouch: 1, hue: 12,
    draft: "Hi Luis, it has been a while. Renee from the Harbor & Pine Rhode Island stores. After the restructuring I am looking at regional operations roles, and I saw Harborlight has one open in Hartford. Would you have time for a coffee or a call?",
  },
  {
    id: "p8", name: "Sam Whitaker", title: "Operations Coordinator", companyId: "fieldstone", company: "Fieldstone Grocers",
    reasonType: "region", reason: "Both in the Providence operations meetup group", detail: "Active in the regional operations professionals group you joined in July.",
    strength: 48, openJobs: ["j03", "j33"], status: "none", hue: 130,
    draft: "Hi Sam, I am Renee Castillo from the Providence operations group. I am applying for the Inventory Control Manager role at Fieldstone and would love any advice on the team and the hiring process.",
  },
];
