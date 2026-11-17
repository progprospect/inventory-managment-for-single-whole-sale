# Backup and restore guide

## Before launch

Choose and document the Supabase plan, backup retention, and recovery-point objective with the business owner. Supabase-managed database backups and point-in-time recovery availability depend on the selected plan and add-ons; confirm current terms in the [Supabase backup guide](https://supabase.com/docs/guides/platform/backups). Database backups do not include Storage objects, so separately retain any uploaded business logo or other files if Storage is enabled.

## Backup operations

- Keep development and production projects separate.
- Confirm automated backups are enabled and note the retention window and backup schedule in the shop’s operations record.
- For an additional logical backup, use the Supabase CLI/database export process documented in [Supabase backup and restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Store exports encrypted with access restricted to the business administrator.
- Retain migration files and seed data in version control. The seed file is demo-only and must not be treated as a production backup.
- Back up Storage objects separately if they are used.

## Restore rehearsal

1. Select an isolated recovery project; never restore over production for a rehearsal.
2. Restore a recent backup/export using the current Supabase instructions for the selected plan and database version.
3. Apply any required migrations in order, then verify schema version and RLS policies.
4. Create a test user and check login, role authorization, business settings, product stock, invoices, returns, and reports.
5. Reconcile each product’s stock against the sum of stock movements and compare financial report totals to posted source documents.
6. Record restore duration, recovery point, errors, and corrective actions. Repeat after major schema changes and periodically according to the owner’s recovery requirements.

No production project, backup schedule, or restore rehearsal has been configured from this workspace. Complete and record this procedure before launch.
