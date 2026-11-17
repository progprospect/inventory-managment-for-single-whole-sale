# Deployment runbook

## Environments

Create separate Supabase projects for development and production and use separate Vercel environments/projects. Never point development builds at production data. Keep migration files in version control and apply them to the target database before deploying application code that depends on them.

## Supabase setup

1. Apply all `supabase/migrations` in order. Review each migration and verify its policies in the target project.
2. Configure Auth `Site URL` and redirect allow-list for the local app and production domain. Use the production URL only in production.
3. Disable public sign-ups for this single-shop application. Add staff accounts through an administrator-controlled invite process.
4. Create the initial owner and use the one-time controlled procedure at `supabase/bootstrap/owner.sql`.
5. Confirm RLS is enabled for all exposed tables, verify policies with each role, and ensure RPC execute grants match the role checks inside the functions.
6. Configure the Supabase Storage bucket and policies before enabling logo upload (logo upload is not implemented yet).

## Vercel setup

Set these environment variables for the appropriate Vercel environment:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (or legacy `SUPABASE_ANON_KEY`)
- `SITE_URL`

The app uses Supabase only from server code and middleware, so these variables do not need a `NEXT_PUBLIC_` prefix. The publishable key is safe to expose by design, but keeping it server-only avoids bundling it into browser assets. The app does not need the Supabase service-role key. Never expose a service-role/secret key to client code. Configure production Auth redirect URLs to the final domain and redeploy after changing environment variables.

## Release checklist

- Apply reviewed migrations to the intended project; confirm version history and RLS policies.
- Create the owner account and business settings; verify GSTIN, state code, invoice prefix, and starting sequence with the shop owner/accountant.
- Verify each role using separate accounts and test both allowed and denied operations against the live database.
- Reconcile stock balances to movement sums; test duplicate purchase/sale posting and concurrent invoice creation.
- Review GST test cases with the shop’s accountant before issuing live tax invoices.
- Generate sample invoices; check PDF and 58mm/80mm print margins and character rendering on target printers.
- Configure monitoring and alerting. No external error-monitoring service is configured in this repository yet; review Vercel and Supabase logs during initial rollout.
- Confirm backup configuration and complete a restoration rehearsal before launch.

## Rollback

Prefer a forward migration for schema changes. For an application release rollback, restore the previous Vercel deployment only if its schema compatibility is understood. Do not delete or edit posted financial transactions directly; use an approved reversal/return workflow.
