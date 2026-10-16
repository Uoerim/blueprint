import { guardRead, json, withErrors } from "@/lib/api";
import { db } from "@/lib/db";
import { usernameSchema } from "@/lib/validations";

export const GET = withErrors(async (req: Request): Promise<Response> => {
  const guard = await guardRead(req, "username");
  if (guard.error) return guard.error;

  const raw = new URL(req.url).searchParams.get("u") ?? "";
  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success) {
    return json(
      { available: false, reason: parsed.error.issues[0]?.message ?? "Invalid username" },
      200,
      guard.headers,
    );
  }
  const taken = await db.user.findUnique({
    where: { username: parsed.data },
    select: { id: true },
  });
  const available = !taken || taken.id === guard.viewer.id;
  return json(
    { available, username: parsed.data, reason: available ? null : "Already taken" },
    200,
    guard.headers,
  );
});
