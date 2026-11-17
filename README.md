# Wholesale Desk

Single-shop wholesale inventory and billing application for India. The UI uses Next.js App Router, TypeScript, Tailwind CSS, and Supabase Auth/PostgreSQL. Financial posting and stock changes are validated in PostgreSQL RPC functions; balances are derived from the stock movement ledger.

## Implementation status

Implemented modules include authentication and role assignment, business settings, products/categories/units, stock adjustments and history, suppliers and purchase receipts, customers and billing, GST snapshots, invoice numbering, PDF and thermal print layouts, returns, dashboard metrics, reports/CSV export, and audit logs. Migrations, app-side validation, and unit tests are included.

This is not production-ready until connected to a Supabase project and the migrations have been applied and validated there. Database/RLS integration and concurrency testing, accountant review of GST behavior, physical printer QA, backup restoration rehearsal, and Vercel production deployment still require environment-specific setup. See [architecture](docs/architecture.md), [deployment](docs/deployment.md), and [backup and restore](docs/backup-restore.md).

## Local development

Requirements: Node.js 20.9+, npm, and a Supabase project. For a local database, install the [Supabase CLI](https://supabase.com/docs/guides/cli) and Docker.

1. Copy `.env.example` to `.env.local`; set the Supabase project URL and publishable/anon key.
2. Run `npm install`.
3. For a local Supabase stack, run `supabase start`, then `supabase db reset` to apply migrations and seed catalog demo data. To use a hosted development project, link that project and run `supabase db push`.
4. Create the first Auth user, then run the controlled owner bootstrap in `supabase/bootstrap/owner.sql` with that user’s UUID. Create subsequent users through the Supabase Auth dashboard/invite flow, then assign roles in the app.
5. Run `npm run dev` and open `http://localhost:3000`.

Never put the service-role key in a `NEXT_PUBLIC_*` variable or browser code. New users default to the least-privileged billing role. Public self-registration should remain disabled for a single-shop deployment.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

These checks do not replace live database, RLS, transaction concurrency, GST/accountant, printer, backup/restore, or deployment validation.

## Scope notes

- Demo seed data contains catalog, suppliers, customers, and opening stock only; it creates no fabricated financial transactions.
- Invoice PDF generation uses bundled Noto Sans fonts. Thermal 58mm and 80mm styles are available for browser printing; verify wrapping and margins on the shop’s actual printer models.
- Logo upload/storage, ongoing collection of payment against an already posted invoice, archival/edit workflows for supplier/customer records, and cancellation/reversal UI are not yet implemented.
- See `docs/architecture.md` for the schema, role matrix, routes, and phased checklist.
