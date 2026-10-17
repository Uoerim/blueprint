import { protectedResourceMetadata } from "@/lib/oauth-metadata";

// The same document at the path-suffixed address some clients look for (RFC 9728 §3.1).
export const GET = protectedResourceMetadata;
