import { daysAgo } from "@/lib/date";

export const COPILOT_NAME = "Wren";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
}

export interface Conversation {
  id: string;
  title: string;
  topic: string;
  updatedAt: string;
  messages: ChatMessage[];
}

const m = (id: string, role: "user" | "assistant", text: string, d: number, h: number): ChatMessage => ({ id, role, text, at: daysAgo(d, h, (id.length * 7) % 60) });

export const SEED_CONVERSATIONS: Conversation[] = [
  {
    id: "c-layoff",
    title: "Talking about the layoff in interviews",
    topic: "Interviews",
    updatedAt: daysAgo(1, 20),
    messages: [
      m("l1", "user", "I have the Pinecrest onsite this week. How do I explain the layoff without sounding bitter or desperate?", 1, 20),
      m("l2", "assistant", "Short, factual, and then pivot forward. Interviewers are not looking for a story. They want to know it was not about performance and that you are over it.\n\nHere is a version built from your actual history:\n\n**\"Harbor & Pine restructured in May and eliminated the regional layer, including my role. I was proud of the results in my region, we cut stockouts 22% and recovered $210K from vendors. I have used the time to be intentional about what is next, and operations roles like this one are where my experience does the most good.\"**\n\nThree things that make this work:\n- It names the business reason, which is true and not about you\n- It gives one proof point with a number\n- It ends facing their job, not your past\n\nKeep it under 30 seconds. If they ask a follow up, answer it plainly and stop. You do not need to defend the decision someone else made.", 1, 20),
      m("l3", "user", "What if they ask why it has taken four months?", 1, 20),
      m("l4", "assistant", "Fair question, and a normal gap. Four months is close to the average search length right now for manager level roles.\n\nTry: **\"I have been selective. I am moving from retail into healthcare and supply chain operations, so I took time to figure out where my experience fits best, and I have been interviewing with a few organizations.\"**\n\nIt is true, it shows judgment, and it quietly signals other interest. Do not apologize for the time.", 1, 21),
    ],
  },
  {
    id: "c-negotiate",
    title: "Negotiating the Granite Harbor offer",
    topic: "Salary",
    updatedAt: daysAgo(2, 18),
    messages: [
      m("n1", "user", "Granite Harbor offered $54,000 for the Clinic Operations Coordinator role. My old salary was $78K. I am scared to push and lose it.", 2, 18),
      m("n2", "assistant", "That fear makes sense. Here is the reality: offers are almost never withdrawn for a polite, specific counter. It happens, but it is rare, and usually a sign of an employer you would not want anyway.\n\n**What the data says for this role in Portsmouth:**\n- 25th percentile: $49,000\n- Median: $55,000\n- 75th percentile: $62,000\n\nTheir offer is right at median. You have leverage from two things they cannot easily find: multi site management and a remodel you delivered on time, which matters because this clinic is opening this winter.\n\n**A reasonable counter is $59,000 to $60,000.** Try this:\n\n\"Thank you, I am excited about this role and the clinic opening. Given that I have led six sites and delivered a full remodel on schedule, I was hoping for something closer to $60,000. Is there flexibility there?\"\n\nThen stop talking and let them respond.", 2, 18),
      m("n3", "user", "And if they say no?", 2, 18),
      m("n4", "assistant", "Then ask about the things that cost them less:\n- A salary review at six months, in writing\n- A signing bonus of $2,000 to $3,000\n- An extra week of PTO\n- A start date that gives you two more weeks for your other interviews\n\nOne honest note: $54K is a big step down from $78K. It is worth asking yourself whether this is a bridge job or a destination. You have Pinecrest and Quarry Lane still in play, both with higher ranges. You can ask Granite Harbor for until next Friday to decide. That is a normal request.", 2, 19),
    ],
  },
  {
    id: "c-gaps",
    title: "Gaps for the Northvale Operations Manager role",
    topic: "Gap analysis",
    updatedAt: daysAgo(3, 10),
    messages: [
      m("g1", "user", "Am I actually qualified for the Northvale Operations Manager job or am I kidding myself?", 3, 10),
      m("g2", "assistant", "You are a real candidate. You are a 91 percent match. Here is the honest breakdown.\n\n**Where you are strong**\n- Multi site leadership: 6 locations, 126 people. They ask for 5+ years, you have 8.\n- Inventory and replenishment: your 22% stockout reduction is exactly the result they want.\n- Vendor management: 14 vendors and $210K recovered.\n- KPI reporting: you built weekly reports on sales, shrink, and labor.\n\n**Gaps, ranked by risk**\n1. **3+ years in a distribution center.** Likely a dealbreaker for some screeners. Address it directly in your cover letter. Your receiving and stockroom work is the closest match.\n2. **WMS experience.** Likely trainable. Oracle Retail covers the same concepts.\n3. **SQL and APICS.** Both listed as preferred. Not worth delaying for.\n\nMy take: apply, and lead your cover letter with the six site scope. Also, Alicia Monteiro on their team made the grocery to distribution move herself. She is in your Insider Connections.", 3, 10),
    ],
  },
  {
    id: "c-resume",
    title: "Feedback on Supply Chain Ops, v2",
    topic: "Resume feedback",
    updatedAt: daysAgo(6, 14),
    messages: [
      m("r1", "user", "Can you look at my Supply Chain Ops v2 resume and tell me what is weak?", 6, 14),
      m("r2", "assistant", "It is solid. ATS score 88, and it has the best response rate of your three versions, 3 responses from 7 sends. Here is what I would still fix.\n\n**1. Your summary still says \"retail.\"** The first word a recruiter reads frames everything. \"Operations manager\" is accurate and does not hide anything, your employer name makes the industry clear.\n\n**2. The team bullet has no outcome.** \"Led a team of 6 store managers and about 120 hourly associates\" tells scope but not results. Do you have anything true to add, like turnover, promotions, or engagement scores? If not, leave it. I will not invent one.\n\n**3. Skills order.** Oracle Retail is buried. For supply chain roles it is your closest thing to a WMS, so move it up.\n\n**4. Length is good.** One page. Keep it that way.\n\nWant me to open the Studio with these as suggested changes? You can accept or reject each one.", 6, 14),
      m("r3", "user", "For #2, 5 of my store associates got promoted. Can that go in?", 6, 14),
      m("r4", "assistant", "Yes, and it is already in your resume under the Store Operations Manager role, so Truth Mode can use it. The honest version for the regional bullet would need regional numbers. Do you know how many promotions happened across your six stores? If you do, add it to your base resume first, then I can use it. If not, we keep the promotions line where it is.", 6, 15),
    ],
  },
  {
    id: "c-stepback",
    title: "Is a coordinator role a step back?",
    topic: "Strategy",
    updatedAt: daysAgo(9, 16),
    messages: [
      m("s1", "user", "Some of my best matches are coordinator roles that pay way less. Is taking one a step back?", 9, 16),
      m("s2", "assistant", "Sometimes it is a step back. Sometimes it is a side door. The difference is where it leads in 18 months.\n\n**It is a side door when:**\n- The company promotes from within, and you can see people who did it\n- The role puts you inside the industry you want\n- The gap between you and the next level is experience, not credentials\n\n**It is a step back when:**\n- The title is a dead end at that company\n- The pay forces you into financial stress that affects how you perform\n- You would take it only to stop the search, not because of what it opens\n\nFor you specifically: Fieldstone's Project Coordinator role is a 92 percent match and Fieldstone has a history of moving store leaders into corporate roles. That looks like a side door. A generic coordinator role at a company with no path upward is a step back.\n\nIf it helps, set a floor. You told me your salary floor is $65,000. Want me to hide roles below it by default?", 9, 16),
    ],
  },
];

export const QUICK_PROMPTS = [
  "Review my resume for the Northvale role",
  "What are my biggest gaps right now?",
  "How do I negotiate the Granite Harbor offer?",
  "How do I talk about my layoff?",
  "Write a note to Alicia Monteiro",
];

const RESPONSES: { test: RegExp; reply: string }[] = [
  {
    test: /resume|ats|bullet|tailor/i,
    reply:
      "Here is what I see in your current version for the Northvale Operations Manager role.\n\n**Keep:** your 22% stockout reduction and the $210K vendor recovery. Those are your two best proof points for supply chain work.\n\n**Change:**\n- Lead with multi site scope. Change \"stores\" to \"sites\" in your first bullet. Same facts, different frame.\n- Move the replenishment bullet to the top of your regional role. It is their requirement #2.\n- Put your Lean Six Sigma Yellow Belt under its own Certifications heading so screening software reads it.\n\nThe Studio already has these queued as suggested changes with reasons. You accept or reject each one. Nothing goes in without you.",
  },
  {
    test: /gap|missing|qualif|skill/i,
    reply:
      "Across the open jobs in your tracker, these gaps show up most:\n\n1. **Warehouse management system (WMS)**, in 5 roles. Likely trainable. About two weeks to be credible.\n2. **EHR systems**, in 5 roles, all healthcare. Clinics expect to train you, so this matters less than it looks.\n3. **SQL or data querying**, in 4 roles. Usually listed as preferred.\n\nThe one real risk is **distribution center experience**. It shows up in only 2 roles, but it cannot be closed quickly. Address it in your cover letter rather than hiding it.\n\nIf you only do one thing this month, do the WMS fundamentals series. It unlocks the most supply chain roles for the least time. Your Skill Gap Roadmap has the free options.",
  },
  {
    test: /negotiat|salary|offer|pay|counter/i,
    reply:
      "For the Granite Harbor offer at $54,000, market data for this role in Portsmouth puts the median at $55,000 and the 75th percentile at $62,000.\n\nA reasonable counter is **$59,000 to $60,000**, anchored on your six site experience and the remodel you delivered on time. Their clinic opens this winter, so that story matters to them.\n\nScript:\n\"I am excited about this role. Given my experience leading six sites and delivering a full remodel on schedule, I was hoping for something closer to $60,000. Is there flexibility?\"\n\nIf base is fixed, ask for a six month review in writing, a signing bonus, or more time off.",
  },
  {
    test: /layoff|laid off|let go|fired|gap in|unemploy/i,
    reply:
      "Keep it under 30 seconds and end facing forward:\n\n**\"Harbor & Pine restructured in May and eliminated the regional layer, including my role. I am proud of what my region did, we cut stockouts 22% and recovered $210K from vendors. I have used the time to be deliberate about my next step, and roles like this one are where my experience fits best.\"**\n\nThen stop. Do not over explain, and do not apologize. A restructuring is a business decision, and interviewers hear this every week.",
  },
  {
    test: /interview|prep|question/i,
    reply:
      "Your Pinecrest onsite is in 3 days. Based on their postings and what candidates report, expect questions in three areas:\n\n1. **Patient flow and scheduling.** Use your Kronos rollout: the problem, what you changed, the 18% overtime reduction.\n2. **Managing people through change.** Your six store managers and 120 associates.\n3. **Why healthcare.** Be specific. Their practice managers from retail tend to say it is the same job with higher stakes, and that is a fine answer if it is true for you.\n\nInterview Prep has a Pinecrest question set with practice mode. Try three questions tonight. It takes 20 minutes.",
  },
  {
    test: /note|message|reach out|outreach|network|alicia|marcus/i,
    reply:
      "Here is a draft in your voice for Alicia Monteiro at Northvale:\n\n\"Hi Alicia, I am Renee Castillo, a regional operations manager coming out of eight years in multi store retail. I noticed you made the jump from grocery operations to distribution, which is the move I am making now. I am applying for the Operations Manager role in Warwick and would value ten minutes of your perspective on what translated for you and what did not.\"\n\nIt is short, specific, and asks for something small. You can edit and track it in Insider Connections.",
  },
  {
    test: /cover letter|letter/i,
    reply:
      "For cover letters, the rule I follow is the same as your resume: nothing that is not already true. The strongest structure for a career changer is:\n\n1. One sentence on what you did, in their language\n2. One or two proof points with numbers\n3. One honest sentence about your biggest gap and how you will close it\n4. Why this company, specifically\n\nThe Studio builds this from your resume and shows the source for every claim.",
  },
  {
    test: /sad|tired|discourag|hopeless|stress|anxious|overwhelm/i,
    reply:
      "That is a heavy thing to carry, and four months in is exactly when it tends to hit. For what it is worth, your numbers are good: you have two interviews and an offer in hand, and your response rate is well above the benchmark for career changers.\n\nFor today, pick one small thing from your plan and let that be enough. If it would help to talk to someone, many states offer free career counseling through workforce centers for laid off workers, and if things feel heavier than job stress, please reach out to a doctor or a crisis line like 988 in the US.",
  },
];

const DEFAULT_REPLY =
  "Good question. Here is how I would think about it with what I know about your search.\n\nYou are strongest in roles that value multi site operations, inventory, and vendor work, and your best performing resume is Supply Chain Ops, v2. Your open threads right now are the Granite Harbor offer, the Pinecrest onsite, and the Quarry Lane panel.\n\nTell me a bit more about what you are weighing and I can get specific. I can also review a resume, draft a note, or walk through a question you expect in an interview.";

export function copilotReply(text: string) {
  return RESPONSES.find((r) => r.test.test(text))?.reply ?? DEFAULT_REPLY;
}
