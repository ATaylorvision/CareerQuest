/**
 * Where to go to do a Roadmap step.
 *
 * Two kinds of link, and nothing made up:
 *  - a direct page, for steps where we know a real, stable one (a provider's own hub, a public textbook);
 *  - the provider's own search for the step, for everything else, so the person lands on real options
 *    for exactly what they need instead of on an address we guessed.
 */

export interface StepLink {
  label: string;
  url: string;
  kind: "video" | "course" | "read" | "program" | "practice" | "search";
}

const enc = encodeURIComponent;
const youtube = (q: string): StepLink => ({ label: "Watch on YouTube", url: `https://www.youtube.com/results?search_query=${enc(q)}`, kind: "video" });
const coursera = (q: string): StepLink => ({ label: "Find a course", url: `https://www.coursera.org/search?query=${enc(q)}`, kind: "course" });
const web = (q: string): StepLink => ({ label: "Search the web", url: `https://www.google.com/search?q=${enc(q)}`, kind: "search" });

/** Known good destinations for the steps in our own library. Keyed by step id. */
const DIRECT: Record<string, StepLink[]> = {
  "sql-1": [
    { label: "SQLBolt, interactive lessons", url: "https://sqlbolt.com/", kind: "practice" },
    { label: "Khan Academy, intro to SQL", url: "https://www.khanacademy.org/computing/computer-programming/sql", kind: "course" },
  ],
  "bi-1": [{ label: "Microsoft Learn, Power BI", url: "https://learn.microsoft.com/en-us/training/powerplatform/power-bi", kind: "course" }],
  "apics-1": [{ label: "ASCM learning", url: "https://www.ascm.org/learning-development/", kind: "program" }],
  "apics-2": [
    { label: "CareerOneStop, find training", url: "https://www.careeronestop.org/FindTraining/find-training.aspx", kind: "program" },
    { label: "Find your American Job Center", url: "https://www.careeronestop.org/LocalHelp/AmericanJobCenters/find-american-job-centers.aspx", kind: "program" },
  ],
  "pmp-1": [{ label: "Google Project Management Certificate", url: "https://www.coursera.org/professional-certificates/google-project-management", kind: "course" }],
  "sf-1": [{ label: "Salesforce Trailhead", url: "https://trailhead.salesforce.com/", kind: "practice" }],
  "ehr-2": [{ label: "HHS, HIPAA training materials", url: "https://www.hhs.gov/hipaa/for-professionals/training/index.html", kind: "read" }],
  "fc-2": [{ label: "Forecasting: Principles and Practice (free online)", url: "https://otexts.com/fpp3/", kind: "read" }],
  "pt-1": [
    { label: "Trello", url: "https://trello.com/", kind: "practice" },
    { label: "Asana", url: "https://asana.com/", kind: "practice" },
  ],
};

const VIDEO = /video|webinar|watch|lessons?|series|walkthrough|demo\b/i;
const COURSE = /course|certificate|certification|mooc|learning path|path\b|trail|training|class|bootcamp|program\b|exam|self study/i;
const READ = /textbook|read|reading|guide|primer|basics|article/i;
// Things you do rather than study. A search link would not help with these.
const PEOPLE = /ask (a|an|your)|call|contact|target .* roles|write a one page|document your|rebuild|publish one|build a simple/i;

/** Links for one Roadmap step, most direct first. Always at least one when the step is something you can learn or watch. */
export function linksFor(step: { id: string; title: string; detail?: string; cost?: string }): StepLink[] {
  const direct = DIRECT[step.id];
  if (direct) return direct;

  const text = `${step.title} ${step.detail ?? ""}`;
  const query = step.title
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(free|audit|track|beginner|intro to|introduction to)\b/gi, " ")
    .replace(/[:,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!query || PEOPLE.test(step.title)) return [];

  const out: StepLink[] = [];
  if (VIDEO.test(text)) out.push(youtube(query));
  if (COURSE.test(text)) out.push(coursera(query));
  if (!out.length && READ.test(text)) out.push(web(`${query} free guide`));
  if (!out.length) out.push(web(query), youtube(query));
  return out.slice(0, 2);
}
