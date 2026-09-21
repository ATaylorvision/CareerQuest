import { HttpError, admin, body, route } from "../_lib/http.js";

/** Permanently deletes the signed in user, their files, and (via cascade) all their data. */
export default route(async (req, _res, user) => {
  const { confirm } = body<{ confirm?: string }>(req);
  if (confirm !== "DELETE") throw new HttpError(400, "Type DELETE to confirm.");
  const db = admin();

  for (const bucket of ["resumes", "confirmations"]) {
    const { data } = await db.storage.from(bucket).list(user.id, { limit: 1000 });
    if (data?.length) await db.storage.from(bucket).remove(data.map((f) => `${user.id}/${f.name}`));
  }
  // Applications point at jobs and refuse to let one go, so they go first, then the jobs this person added.
  await db.from("applications").delete().eq("user_id", user.id);
  await db.from("jobs").delete().eq("owner_id", user.id);
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) throw new HttpError(500, "We could not delete the account. Please try again.");
  return { deleted: true };
});
