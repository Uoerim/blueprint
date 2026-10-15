import { ImageResponse } from "next/og";

/** The Blueprint mark (square + arrow) as a standalone SVG, for generated PNG icons. */
const MARK =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">' +
  '<rect x="2.75" y="6.75" width="14.5" height="14.5" rx="3.5" stroke="#FAFAFA" stroke-width="1.5"/>' +
  '<path d="M8 16 L18.5 5.5" stroke="#6366F1" stroke-width="1.8" stroke-linecap="round"/>' +
  '<path d="M12.5 5.25h6.25v6.25" stroke="#6366F1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
  "</svg>";
const MARK_URI = `data:image/svg+xml;base64,${Buffer.from(MARK).toString("base64")}`;

/**
 * PNG app icon: the mark on the app's dark background. `maskable` keeps the
 * mark inside Android's safe zone and fills the whole square edge to edge.
 */
export function brandIcon(size: number, { maskable = false, rounded = true } = {}) {
  const mark = Math.round(size * (maskable ? 0.52 : 0.66));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090B",
          borderRadius: maskable || !rounded ? 0 : Math.round(size * 0.22),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MARK_URI} width={mark} height={mark} alt="" />
      </div>
    ),
    { width: size, height: size },
  );
}
