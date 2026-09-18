# Fix missing backend credential error

## Goal
Remove the Integrations page's dependency on an unavailable privileged credential while preserving the existing CEO and Salesperson permissions.

## Changes
- Update integration reads and writes to use the authenticated user's database connection supplied by the existing sign-in middleware.
- Keep CEO-only actions protected by the existing CEO check and database access rules.
- Preserve CSV import behavior and connection-status updates.
- Return database errors normally instead of failing while creating a privileged client.

## Verification
- Confirm no integration function imports the privileged database client.
- Check the latest build result.
- Open the signed-in Integrations page and verify its data requests no longer produce the missing-credential error.

## Technical details
The affected functions already require authentication. Their handlers will use `context.supabase`, which applies row-level permissions for the current user, instead of dynamically importing the service-role client.
