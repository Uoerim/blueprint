import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

// The preview shown when a link to Blueprint is shared (and by Google Discover).
export const alt = `${SITE.name}: ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MARK = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">' +
    '<rect x="2.75" y="6.75" width="14.5" height="14.5" rx="3.5" stroke="#FAFAFA" stroke-width="1.5"/>' +
    '<path d="M8 16 L18.5 5.5" stroke="#6366F1" stroke-width="1.8" stroke-linecap="round"/>' +
    '<path d="M12.5 5.25h6.25v6.25" stroke="#6366F1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg>",
).toString("base64")}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "radial-gradient(circle at 85% 10%, rgba(99,102,241,0.28), transparent 45%), #09090B",
          color: "#FAFAFA",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MARK} width={64} height={64} alt="" />
          <span style={{ fontSize: 34, fontWeight: 600, letterSpacing: -0.5 }}>Blueprint</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 84, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02 }}>{SITE.name}</span>
          <span style={{ marginTop: 22, fontSize: 36, color: "#A1A1AA", letterSpacing: -0.5 }}>{SITE.tagline}.</span>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 24, color: "#A1A1AA" }}>
          {["Idea vault", "Task board", "Live focus", "Encrypted per team", "Free"].map((t) => (
            <span key={t} style={{ padding: "8px 16px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              {t}
            </span>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
