/** The guided tours. Shared by the server (what's done) and the browser (what to show). */
export const TOURS = ["welcome", "team"] as const;
export type TourId = (typeof TOURS)[number];

export const isTourId = (v: unknown): v is TourId => TOURS.includes(v as TourId);
