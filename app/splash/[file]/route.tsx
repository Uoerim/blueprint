import { ImageResponse } from "next/og";
import { SPLASH_BG, SPLASH_MARK, SPLASHES } from "@/lib/splash";

// Built once at deploy time for the fixed list of iPhone screens; any other
// name is a 404, so nobody can make the server draw images of arbitrary sizes.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return SPLASHES.map((s) => ({ file: s.file }));
}

const mark = (ink: string) =>
  `data:image/svg+xml;base64,${Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">' +
      `<rect x="2.75" y="6.75" width="14.5" height="14.5" rx="3.5" stroke="${ink}" stroke-width="1.5"/>` +
      '<path d="M8 16 L18.5 5.5" stroke="#6366F1" stroke-width="1.8" stroke-linecap="round"/>' +
      '<path d="M12.5 5.25h6.25v6.25" stroke="#6366F1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg>",
  ).toString("base64")}`;

export async function GET(_req: Request, { params }: RouteContext<"/splash/[file]">) {
  const { file } = await params;
  const s = SPLASHES.find((x) => x.file === file);
  if (!s) return new Response("Not found", { status: 404 });
  const size = SPLASH_MARK * s.dpr;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: SPLASH_BG[s.theme] }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mark(s.theme === "dark" ? "#FAFAFA" : "#18181B")} width={size} height={size} alt="" />
      </div>
    ),
    { width: s.width * s.dpr, height: s.height * s.dpr, headers: { "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400" } },
  );
}
