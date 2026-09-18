# Shopify sales dashboard sync

## Goal
Make Shopify order sync feed the Sales Dashboard immediately and keep Today’s Sales, Month Sales, and Revenue Trend current.

## Changes
- Extend the sales data query to calculate today’s revenue and current calendar-month revenue from `sales_imports`, including rows written by Shopify sync.
- Show dedicated **Today’s Sales** and **Month Sales** values on the Sales Dashboard while preserving orders, average order value, channel totals, and the revenue trend.
- Keep the existing Shopify “Sync now” flow, then refresh all sales and executive dashboard queries after a successful sync so visible figures update without reloading the app.
- Confirm Shopify rows remain idempotent by source and date, preventing duplicate totals when the same period is synced again.

## Validation
- Verify the app builds successfully.
- Check the Sales Dashboard renders the two new totals and revenue trend at desktop and mobile widths.
- Confirm the sync completion path invalidates both sales and executive dashboard data.

## Technical details
- Reuse the existing `sales_imports` dataset and React Query keys; no new table is required.
- Current-month totals use local calendar boundaries, while the trend continues to follow its displayed range.
