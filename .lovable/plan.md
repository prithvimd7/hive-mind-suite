# Add secure Agent Integrations (MCP)

## What will be built
- Add an OAuth-protected MCP server named **Business Command Center** at `/mcp`.
- Add read-only tools for executive summary, sales, ad performance, inventory, and production batches.
- Run every tool as the connected Company OS user so existing roles and backend access policies remain authoritative.
- Add an app-native authorization screen showing the connecting client and requested access.
- Preserve the authorization request through Google sign-in and return users to the consent screen.

## Technical details
- Register `@lovable.dev/mcp-js` with the existing Vite setup.
- Use the managed OAuth issuer and forward its verified access token to the database.
- Keep the MCP entry import-safe for build-time catalog extraction and the serverless runtime.
- Generate and validate the MCP manifest, then verify the consent route and existing app preview.

## Acceptance checks
- MCP discovery advertises the five tools and OAuth protection.
- Unauthenticated callers receive an OAuth challenge rather than business data.
- Signed-in consent can approve or cancel without a blank screen.
- Existing dashboards and Google sign-in continue to work.
