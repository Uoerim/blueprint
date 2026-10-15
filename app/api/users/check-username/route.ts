import { guardRead, json } from "@/lib/api";
import { db } from "@/lib/db";
import { usernameSchema } from "@/lib/validations";

export async function GET(req: Request) {
  const guard = await guardRead(req, "search");
  if ("error" in guard) return guard.error;

  const raw = new URL(req.url).searchParams.get("u") ?? "";
  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success) {
    return json(
      { available: false, reason: parsed.error.issues[0]?.message ?? "Invalid handle" },
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
}
