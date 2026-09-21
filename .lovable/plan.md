# Handle Google Ads permission failures safely

## Goal
Keep the Integrations page usable when Google rejects an account, while clearly showing the account action required.

## Changes
- Return provider sync failures as a normal sync result instead of throwing them through the app runtime.
- Show the Google account-access message in the existing notification flow.
- Keep sign-in authorization failures protected and unchanged.
- Verify the page remains visible after a rejected sync.

## External requirement
Google must still grant the refresh-token user access to the client account, either directly or through the configured manager account. No code change can override Google account permissions.
