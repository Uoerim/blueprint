import type { MetadataRoute } from "next";
import { LEGAL_UPDATED } from "@/components/legal-constants";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const legal = new Date(LEGAL_UPDATED);
  return [
    { url: new URL("/", base).toString(), changeFrequency: "weekly", priority: 1 },
    { url: new URL("/privacy", base).toString(), lastModified: legal, changeFrequency: "yearly", priority: 0.3 },
    { url: new URL("/terms", base).toString(), lastModified: legal, changeFrequency: "yearly", priority: 0.3 },
  ];
}
