import "server-only";
import { ALL_SCOPES, mcpUrl, originOf } from "./oauth";

/** RFC 9728: where the MCP endpoint's tokens come from. */
export function protectedResourceMetadata(req: Request) {
  const origin = originOf(req);
  return Response.json(
    {
      resource: mcpUrl(origin),
      authorization_servers: [origin],
      scopes_supported: ALL_SCOPES,
      bearer_methods_supported: ["header"],
      resource_name: "Blueprint",
      resource_documentation: `${origin}/dashboard/connections`,
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}

/** RFC 8414: how to register, sign in and get tokens. */
export function authorizationServerMetadata(req: Request) {
  const origin = originOf(req);
  return Response.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/connect`,
      token_endpoint: `${origin}/api/oauth/token`,
      registration_endpoint: `${origin}/api/oauth/register`,
      revocation_endpoint: `${origin}/api/oauth/revoke`,
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      revocation_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ALL_SCOPES,
      service_documentation: `${origin}/dashboard/connections`,
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
