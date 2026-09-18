# Fix Amazon Ads sync conflict key

## What will change
- Add the missing uniqueness rule for ad-spend rows using platform, campaign, and spend date.
- Preserve existing totals by consolidating any duplicate rows before the rule is created.
- Keep the current Amazon Ads upsert behavior so repeated syncs update a campaign-day instead of duplicating it.

## Validation
- Run the database security check.
- Confirm the uniqueness rule exists on the live table.
- Re-run the Amazon Ads sync and verify the conflict error no longer occurs.

## Technical details
The sync already uses `ON CONFLICT (platform, campaign, spend_date)`. The live database does not contain the matching unique constraint, although older local migration files intended to add one. A new idempotent migration will repair the live schema without changing application behavior or access rules.
