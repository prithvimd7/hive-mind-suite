# Fix manual integration sync authentication

## Goal
Remove the app server's dependency on `CRON_SECRET` while preserving secure scheduled syncs.

## Changes
- Forward the already verified signed-in CEO token when a CEO clicks **Sync now**.
- Update the sync functions to accept either:
  - the existing `CRON_SECRET` for scheduled jobs, or
  - a valid signed-in CEO token for manual syncs.
- Keep all data writes inside the protected sync functions and preserve existing source-specific credentials.
- Replace the setup message that incorrectly asks for `CRON_SECRET` in the app server environment.
- Deploy the updated sync functions and verify diagnostics.

## Security
- A normal signed-in user cannot trigger live syncs; the function independently verifies the account has the CEO role.
- `CRON_SECRET` remains private and is still supported for scheduled jobs.
- No private credential is moved into browser code.
