import { HttpError, admin, body, route, quota } from "../_lib/http.js";
import { checkCompanySite, findBoard } from "../_lib/ats.js";
import { computeLegitimacy, type LegitSignals } from "../../src/lib/legit.js";

/** "Verify on company site": re-checks the employer's own careers page right now. */
export default route(async (req, _res, user) => {
  await quota(user, "verify", 120, "checking employer sites");
  const { jobId } = body<{ jobId?: string }>(req);
  if (!jobId) throw new HttpError(400, "Which job?");
  const db = admin();
  const { data: job } = await db.from("jobs").select("*").eq("id", jobId).single();
  if (!job || (job.owner_id && job.owner_id !== user.id)) throw new HttpError(404, "That listing was not found.");
  if (job.owner_id) throw new HttpError(400, "You added this job yourself, so there is no employer listing for us to check.");

  const board = await findBoard(job.company);
  const check = await checkCompanySite(job.company, job.title, job.location ?? "");
  const signals: LegitSignals = { ...(job.raw?.signals as LegitSignals), companySite: check.status, checkedHoursAgo: 0 };
  const legit = computeLegitimacy(signals);

  const update = {
    company_site_status: check.status,
    company_site_checked_at: new Date().toISOString(),
    ats_provider: check.provider ?? job.ats_provider,
    apply_url: check.url ?? job.apply_url,
    description: check.description && check.description.length > (job.description?.length ?? 0) ? check.description : job.description,
    legit,
    raw: { ...job.raw, signals },
  };
  await db.from("jobs").update(update).eq("id", jobId);

  const where = board ? `${job.company}'s ${board.provider} careers page` : `${job.company}'s careers page`;
  const message =
    check.status === "confirmed"
      ? `Found on ${where} just now. Same title, still open.`
      : check.status === "missing"
        ? `${job.company} has a public careers page, and this role is not on it. We would be careful here.`
        : board
          ? `We found ${where}, but could not match this exact role. It may be listed under a different title.`
          : `${job.company} does not use a careers page we can read automatically. Open their site to check by hand.`;

  return { status: check.status, legit, message, applyUrl: update.apply_url, description: update.description, provider: check.provider ?? null, signals };
});
