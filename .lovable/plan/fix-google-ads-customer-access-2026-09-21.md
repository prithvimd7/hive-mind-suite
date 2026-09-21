# Fix Google Ads customer access

## Goal
Make Google Ads sync work when the authorized Google user has direct access to the client account, while preserving manager-account access.

## Changes
- Keep the configured manager account request as the primary path.
- If Google returns a customer-permission error, retry that customer once without the manager header to support direct account access.
- If both paths fail, return a concise message identifying the two settings to verify: the authorized Google user must have access to the client account, and the saved manager account must manage that client account.
- Redeploy `sync-google-ads` and verify the latest diagnostics.

## Security
- Do not expose stored account IDs, OAuth tokens, or developer credentials.
- Do not weaken the existing CEO-only manual sync authorization.
