export type QCategory = "Behavioral" | "Situational" | "Role specific" | "Career change" | "Layoff";

export interface Question {
  id: string;
  text: string;
  category: QCategory;
  roleType: string;
  companyId?: string;
  why: string;
  tip: string;
  outline: string[];
  reported?: boolean; // reported by candidates for this company
}

export const ROLE_TYPES = ["Operations management", "Supply chain", "Program management", "Healthcare administration", "Customer success"];

export const PREP_COMPANIES = [
  { id: "pinecrest", name: "Pinecrest Medical Group", role: "Practice Operations Manager", when: "Onsite in 3 days" },
  { id: "quarrylane", name: "Quarry Lane Software", role: "Program Operations Manager", when: "Panel in 5 days" },
  { id: "northvale", name: "Northvale Supply Co.", role: "Operations Manager", when: "Saved" },
  { id: "cedarline", name: "Cedarline Logistics", role: "Supply Chain Analyst", when: "Screening" },
  { id: "harborlight", name: "Harborlight Foods", role: "Regional Operations Manager", when: "Matched" },
];

const Q = (q: Question) => q;

export const QUESTIONS: Question[] = [
  // Universal career change and layoff questions
  Q({ id: "q1", text: "Walk me through your background and why you are moving out of retail.", category: "Career change", roleType: "All", why: "They want to see that the move is a choice with a reason, not an escape.", tip: "Keep it to 60 to 90 seconds. Past, pivot, present.", outline: ["Eight years at Harbor & Pine, store ops to regional ops", "The part you liked most: inventory, vendors, fixing processes", "Why this field is where that work lives full time", "Why this role, specifically"] }),
  Q({ id: "q2", text: "Tell me about leaving your last role.", category: "Layoff", roleType: "All", why: "They are checking that it was not about performance and that you are not carrying it into the room.", tip: "Under 30 seconds. Name the business reason, one proof point, then look forward.", outline: ["Restructuring removed the regional layer in May", "Proud of results: 22% fewer stockouts, $210K recovered", "Used the time to be deliberate about the next step"] }),
  Q({ id: "q3", text: "You have not worked in this industry. Why should we take the chance?", category: "Career change", roleType: "All", why: "The real question is risk. Answer with evidence that you ramp fast.", tip: "Do not argue the gap away. Acknowledge it, then show your ramp speed.", outline: ["Acknowledge the gap plainly", "Kronos rollout: learned the system, trained 120 people", "Store to regional promotion: took on 5 more stores and ran them well", "What you would do in the first 30 days"] }),
  Q({ id: "q4", text: "What would your former director say is your biggest weakness?", category: "Behavioral", roleType: "All", why: "Self awareness. They want a real weakness and a real fix.", tip: "Pick something true that is not core to the role.", outline: ["A real weakness, for example taking on too much instead of delegating", "A specific moment it cost you", "What you changed and how you know it worked"] }),

  // Operations management
  Q({ id: "q5", text: "Tell me about a time you improved a process that was broken.", category: "Behavioral", roleType: "Operations management", why: "Continuous improvement is the core of most ops roles.", tip: "Use numbers. Before, after, and how you measured it.", outline: ["Situation: shrink at 2.1% in Warwick", "Task: find the leak", "Action: redesigned receiving checks and cycle counts", "Result: shrink down to 1.3%"] }),
  Q({ id: "q6", text: "How do you manage managers who are not hitting their numbers?", category: "Behavioral", roleType: "Operations management", why: "Managing through managers is different from managing a crew.", tip: "Show a process, not a personality.", outline: ["Weekly one on ones with the six store managers", "Shared KPI report so the numbers were never a surprise", "A specific manager, the plan you agreed on, and the outcome"] }),
  Q({ id: "q7", text: "How do you decide what to fix first when everything is on fire?", category: "Situational", roleType: "Operations management", why: "Prioritization under pressure.", tip: "Name a framework, then give a real example.", outline: ["Safety first, then customer impact, then cost", "Example: holiday week with a missed truck and two call outs", "What you let slide on purpose"] }),

  // Supply chain
  Q({ id: "q8", text: "Walk me through how you would handle a vendor who keeps shipping late.", category: "Situational", roleType: "Supply chain", why: "Vendor management is daily work in supply chain.", tip: "Show you escalate with data, not frustration.", outline: ["Track the misses with dates and cost", "Direct conversation with the vendor rep", "Your $210K in recovered credits as proof you hold vendors accountable"] }),
  Q({ id: "q9", text: "What inventory metrics did you track, and what did you do with them?", category: "Role specific", roleType: "Supply chain", why: "They want to hear their vocabulary coming from you.", tip: "Translate retail terms: stockouts are fill rate, shrink is inventory accuracy.", outline: ["Weekly counts and replenishment for 6 stores", "Stockouts (fill rate) and shrink (accuracy)", "The 22% stockout reduction and how you got it"] }),
  Q({ id: "q10", text: "Have you used a warehouse management system?", category: "Role specific", roleType: "Supply chain", why: "A common screen. Honesty here builds trust.", tip: "Say no clearly, then show the closest equivalent and what you are doing about it.", outline: ["No dedicated WMS", "Oracle Retail for receiving, counts, replenishment across 6 sites", "Currently working through WMS fundamentals"] }),

  // Program management
  Q({ id: "q11", text: "Tell me about a project you delivered on a fixed deadline.", category: "Behavioral", roleType: "Program management", why: "Programs live and die by dates.", tip: "Describe how you kept it on track, not just that it finished.", outline: ["Full store remodel while the store stayed open", "Weekly plan with vendors, store team, and corporate", "No missed opening days"] }),
  Q({ id: "q12", text: "How do you get people to adopt a change they did not ask for?", category: "Behavioral", roleType: "Program management", why: "Rollouts fail on adoption, not planning.", tip: "Your Kronos rollout is a perfect story here.", outline: ["New Kronos scheduling process across 6 stores", "Trained managers first, then let them train teams", "Overtime down 18%, which made believers of skeptics"] }),

  // Healthcare administration
  Q({ id: "q13", text: "How would you reduce patient wait times at a busy practice?", category: "Situational", roleType: "Healthcare administration", why: "Patient flow is the job.", tip: "Show you would diagnose before you fix.", outline: ["Watch the flow for a week, measure each step", "Find the bottleneck, check in, rooming, or checkout", "Same approach you used for receiving at Warwick"] }),
  Q({ id: "q14", text: "Tell me about handling an upset customer. How would that change with a patient?", category: "Behavioral", roleType: "Healthcare administration", why: "They want empathy plus process.", tip: "Acknowledge that the stakes are higher, then show the same core skills.", outline: ["11 quarters above district NPS", "A specific escalation you resolved", "What changes with patients: privacy, fear, and clinical boundaries"] }),

  // Customer success
  Q({ id: "q15", text: "How would you spot a customer who is about to leave?", category: "Role specific", roleType: "Customer success", why: "Churn prevention is the heart of CS.", tip: "Relate it to store level warning signs you watched.", outline: ["Usage drops, fewer logins, slower responses", "Retail parallel: traffic and basket size trends", "Early outreach and a plan, not a discount"] }),

  // Company specific: Pinecrest
  Q({ id: "q16", text: "Why healthcare, and why now?", category: "Career change", roleType: "Healthcare administration", companyId: "pinecrest", reported: true, why: "Pinecrest asks every career changer this. Three of their practice managers came from retail.", tip: "Be specific and personal if you can. Generic answers stand out here.", outline: ["What draws you to healthcare specifically", "The overlap: people, flow, supplies, standards", "Why Pinecrest: two new practices opening, you like building"] }),
  Q({ id: "q17", text: "Our front desk turnover is high. What would you do in your first 90 days?", category: "Situational", roleType: "Healthcare administration", companyId: "pinecrest", reported: true, why: "Reported by candidates in the last two months. It is a real problem they are hiring to fix.", tip: "Listen first, then fix. Mention your promotion track record.", outline: ["First 30 days: stay interviews with every front desk staff member", "Find the top 2 reasons people leave", "Your record: 5 associates promoted, people stayed"] }),
  Q({ id: "q18", text: "How would you manage a practice budget when supply costs go up?", category: "Role specific", roleType: "Healthcare administration", companyId: "pinecrest", why: "Practice managers own the budget.", tip: "Use your vendor recovery story.", outline: ["Review usage and par levels", "Renegotiate or consolidate vendors", "$210K recovered from vendors at Harbor & Pine"] }),

  // Quarry Lane
  Q({ id: "q19", text: "Our customers are district managers like you used to be. What would frustrate you about our software?", category: "Role specific", roleType: "Program management", companyId: "quarrylane", reported: true, why: "They hire former operators for this insight. Be honest.", tip: "Name real frustrations. Then say how a rollout team can reduce them.", outline: ["Schedules that ignore local reality", "Training that happens once and then disappears", "How you would design rollouts to prevent that"] }),
  Q({ id: "q20", text: "Walk us through how you would run a rollout for a 200 store customer.", category: "Situational", roleType: "Program management", companyId: "quarrylane", reported: true, why: "Panel round question. They want structure.", tip: "Phases, owners, risks, and how you measure success.", outline: ["Pilot with 5 stores, then waves by district", "Managers trained first, champions in each district", "Success measures: adoption, overtime, schedule accuracy"] }),

  // Northvale
  Q({ id: "q21", text: "You have not run a distribution center. What would your first month look like?", category: "Career change", roleType: "Supply chain", companyId: "northvale", why: "This is their biggest concern about you. Answer it before they ask.", tip: "Show humility and a plan.", outline: ["Walk every shift, every process", "Learn from the three supervisors before changing anything", "Pick one measurable win by day 30"] }),
  Q({ id: "q22", text: "How would you forecast replenishment for 14,000 SKUs?", category: "Role specific", roleType: "Supply chain", companyId: "northvale", why: "Requirement #2 in their posting.", tip: "Be honest that forecasting is a stretch, and show the foundation.", outline: ["You did replenishment, not statistical forecasting", "Segment SKUs by velocity, focus on the top movers", "Learning forecasting methods now"] }),

  // Cedarline
  Q({ id: "q23", text: "Tell me about a report you built that changed a decision.", category: "Behavioral", roleType: "Supply chain", companyId: "cedarline", reported: true, why: "Analyst roles exist to change decisions.", tip: "Name the decision and the number.", outline: ["Weekly sales, shrink, and labor report", "A pattern you spotted", "The decision it changed and the result"] }),

  // Harborlight
  Q({ id: "q24", text: "How would you get five branches running the same way without killing what works locally?", category: "Situational", roleType: "Operations management", companyId: "harborlight", why: "Standardization is the stated goal of the role.", tip: "Balance: standard where it matters, local where it helps.", outline: ["Find the best performing branch practice first", "Standardize the few things that drive KPIs", "Let managers own the rest, review monthly"] }),
];

export function scoreAnswer(answer: string, q: Question) {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  const hasNumber = /\d/.test(answer);
  const hasResult = /(result|so that|which|led to|cut|reduc|increas|improv|saved|recovered|%)/i.test(answer);
  const hasI = /\bI\b/.test(answer);
  const onTopic = q.outline.some((o) => o.toLowerCase().split(/\W+/).filter((w) => w.length > 5).some((w) => answer.toLowerCase().includes(w)));

  const structure = Math.min(100, (words >= 60 ? 40 : words * 0.66) + (hasResult ? 35 : 10) + (hasI ? 25 : 10));
  const specificity = Math.min(100, (hasNumber ? 60 : 15) + (onTopic ? 30 : 10) + (words > 80 ? 10 : 0));
  const length = words < 40 ? 40 : words <= 220 ? 95 : 60;

  const notes: string[] = [];
  if (!hasNumber) notes.push("Add a number. You have good ones: 22% fewer stockouts, $210K recovered, 18% less overtime.");
  if (!hasResult) notes.push("End with the result. Interviewers remember the last thing you say.");
  if (!hasI) notes.push("Say \"I\" for what you did personally. \"We\" is generous but hides your role.");
  if (words < 40) notes.push("A bit short. Aim for 60 to 90 seconds spoken, about 150 to 220 words.");
  if (words > 220) notes.push("A little long. Cut the setup and get to your action faster.");
  if (onTopic) notes.push("Good. You used real material from your background.");
  if (notes.length === 1 && onTopic) notes.push("This is interview ready. Practice it out loud twice.");

  return {
    structure: Math.round(structure),
    specificity: Math.round(specificity),
    length,
    overall: Math.round((structure + specificity + length) / 3),
    notes,
    words,
  };
}
