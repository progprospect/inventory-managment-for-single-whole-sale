# Repository assessment and architecture

## Repository assessment

The workspace was empty at the start: no application, package manifest, migrations, docs, or Git metadata existed. The application and database foundation were created from scratch. A Supabase project, credentials, CLI, PostgreSQL server, and target printers are not available in this workspace, so database migrations have not been applied to a live instance.

## Architecture

- Next.js App Router and TypeScript. Server components are the default; client components handle interactive forms.
- Supabase Auth with request-scoped `@supabase/ssr` clients. Browser code uses only the public URL and anon/publishable key.
- PostgreSQL is the source of truth. RPC functions validate and post purchases, sales, returns, invoice numbers, stock movements, and reports transactionally.
- Stock balances come from the movement ledger; financial and stock totals are computed server-side with PostgreSQL `numeric`.
- RLS restricts exposed tables. RPCs and server actions perform role checks as well.
- Ordered migrations are under `supabase/migrations`. `supabase/seed.sql` adds non-financial development catalog data and opening stock.
- Posted transactions are protected from direct writes; corrections should use a return/reversal workflow.

## Database schema

All tables use UUID primary keys where applicable, foreign keys, timestamps, numeric money/quantity fields, and role-based RLS. Identity columns are used only for display sequences such as purchase/return numbers.

| Migration | Tables and behavior |
| --- | --- |
| `202611170001_foundation.sql` | `profiles`, `user_roles`, singleton `business_settings`, `audit_logs`; auth trigger, role helpers, owner role-change/login RPCs |
| `202611170002_products_inventory.sql` | `categories`, `units`, `products`, append-only `stock_movements`, derived `product_stock`; transactional product creation and stock adjustment |
| `202611170003_purchasing.sql` | `suppliers`, `purchase_receipts`, `purchase_items`; draft calculation and idempotent purchase posting |
| `202611170004_customers_sales.sql` | `customers`, `sales_invoices`, `sales_items`, `payments`; immutable snapshots, GST calculations, row locking, idempotent posting, sequence allocation |
| `202611170005_returns.sql` | `returns`, `return_items`, `return_payments`; quantity limits, source-document locking, stock updates, idempotency |
| `202611170006_dashboard_reports.sql` | Dashboard summary and date-bounded sales/report functions |

Products hold catalog prices and GST rates; posted document lines retain snapshots. Stock movement source and idempotency keys prevent duplicate ledger effects. The business profile is a singleton; there is no tenant switching or subscription model.

## RLS and permission matrix

| Capability | Owner/Admin | Manager | Billing staff | Inventory staff |
| --- | --- | --- | --- | --- |
| Business settings and role assignment | Manage | Read business settings | — | — |
| Products, stock, categories, units | Manage | Manage | Read products/stock | Manage |
| Suppliers and purchase receipts | Manage | Manage | — | Manage |
| Customers and sales invoices | Manage | Manage | Manage | — |
| Sales returns | Manage | Manage | Manage | — |
| Purchase returns | Manage | Manage | — | Manage |
| Reports | All available reports | All available reports | Sales-facing | Stock/purchase-facing |
| Audit logs | Read | Read | — | — |

Database policies and RPC role checks are authoritative. The UI hides links by role, but this is not a security boundary. New Auth users receive `billing_staff`; initial owner provisioning is documented in `supabase/bootstrap/owner.sql`.

## Application routes

```text
/                              dashboard
/login, /forgot-password, /reset-password
/products, /products/new, /products/[id], /products/[id]/history
/categories, /units, /inventory
/suppliers, /purchases, /purchases/new, /purchases/[id]
/customers, /billing, /invoices, /invoices/[id], /invoices/[id]/print
/returns, /returns/new, /returns/[id]
/reports, /audit-logs
/settings/business, /settings/users
/api/invoices/[id]/pdf, /api/reports/export
```

## Development task breakdown and current status

1. **Foundation — implemented:** App Router, environment example, Auth/password flows, session refresh, business settings, role management, migration/RLS foundation.
2. **Products and inventory — implemented:** categories/units/products, SKU/barcode constraints, opening stock, adjustments, history, low/out-of-stock views.
3. **Purchasing — implemented:** supplier creation, purchase drafts, posting and ledger updates.
4. **Customers and sales — implemented:** customer creation, keyboard-friendly billing, server-side calculation, payment capture, invoice posting.
5. **GST and printing — implemented in code:** intra/inter-state tax split, inclusive/exclusive pricing, invoice sequence, PDF, print layouts. Requires accountant review and actual printer QA.
6. **Returns and reports — implemented in code:** bounded returns, stock adjustments, dashboard, date-filtered reports, CSV, audit log.
7. **Launch readiness — outstanding:** live Supabase migration/RLS/integration and concurrency verification, dependency/security review, target-printer testing, monitoring configuration, backup restoration rehearsal, production deployment.

## Known gaps

- No live Supabase instance is configured; SQL syntax, RLS, transaction behavior, and concurrency have not been validated against PostgreSQL.
- Logo Storage upload and invoice logo rendering are not implemented.
- Posted invoice payment collection, supplier/customer edit/archive screens, and transaction cancellation/reversal UI are not implemented.
- Audit events cover key record changes and logins; comprehensive per-field before/after and all attempted-access events are not implemented.
- Physical thermal printer models, accountant-approved GST cases, and production backup/recovery expectations are unknown and must be validated by the shop.
