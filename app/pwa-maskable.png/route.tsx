import { brandIcon } from "@/lib/brand-icon";

export const dynamic = "force-static";

// Android adaptive icon: full-bleed background, mark inside the safe zone.
export function GET() {
  return brandIcon(512, { maskable: true });
}
