# Security policy

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Email **support@raqameen.com** with:

- what you found and where (URL, route or file);
- the steps to reproduce it;
- what an attacker could do with it.

You'll get a reply within 7 days. Please give us a reasonable chance to fix the problem before talking about it publicly. We won't take action against good-faith research that respects people's privacy, avoids damaging data or degrading the service, and stops at the minimum needed to show the problem.

## Scope

- The official hosted service at [blueprint.raqameen.com](https://blueprint.raqameen.com).
- The code in this repository, including Connect Claude (the OAuth endpoints under `/api/oauth`, `/connect` and the MCP endpoint `/api/mcp`).

Out of scope: denial-of-service and volume testing against the hosted service, social engineering, and findings in third-party services (Clerk, Neon, Vercel, Anthropic and Claude itself) that should go to those vendors.

## Supported versions

Only the latest commit on `main` (what runs at blueprint.raqameen.com) gets security fixes. Self-hosted copies should stay up to date with it.

## How Blueprint is protected

The full design (edge screening, rate limits, CSP, team isolation, field encryption and the append-only audit trail) is documented in the [Security architecture](./README.md#security-architecture) section of the README, and the Connect Claude model (OAuth 2.1 with PKCE, rotating refresh tokens, scopes and per-team switches) in [Connect Claude](./README.md#connect-claude).
