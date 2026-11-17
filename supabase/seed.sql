-- Development-only catalogue data. `supabase db push` does not run this seed.
insert into public.categories (id, name, description) values
  ('10000000-0000-4000-8000-000000000001', 'Grains and pulses', 'Rice, lentils, beans, and staples'),
  ('10000000-0000-4000-8000-000000000002', 'Oils and condiments', 'Cooking oils and pantry items'),
  ('10000000-0000-4000-8000-000000000003', 'Household supplies', 'Cleaning and everyday shop goods')
on conflict (id) do nothing;

insert into public.suppliers (id, name, contact_person, phone, email, address, state, state_code, gstin)
values ('20000000-0000-4000-8000-000000000001', 'Metro Wholesale Distributors', 'R. Patel', '9876500101', 'accounts@metro.example', 'Market Yard, Pune', 'Maharashtra', '27', '27ABCDE1234F1Z5')
on conflict (id) do nothing;

insert into public.customers (id, name, phone, billing_address, state, state_code, customer_type)
values ('30000000-0000-4000-8000-000000000001', 'Shree General Stores', '9876500202', 'Station Road, Pune', 'Maharashtra', '27', 'wholesale')
on conflict (id) do nothing;

insert into public.products (id, sku, barcode, name, description, category_id, unit_id, purchase_price, wholesale_price, gst_rate, hsn_code, minimum_stock)
select '40000000-0000-4000-8000-000000000001', 'DEMO-DAL-001', '8901000000011', 'Toor Dal', 'Toor dal, loose wholesale stock', '10000000-0000-4000-8000-000000000001', u.id, 118.00, 132.00, 5, '07136000', 40
from public.units u where u.abbreviation='kg'
on conflict (id) do nothing;
insert into public.products (id, sku, barcode, name, description, category_id, unit_id, purchase_price, wholesale_price, gst_rate, hsn_code, minimum_stock)
select '40000000-0000-4000-8000-000000000002', 'DEMO-RICE-001', '8901000000028', 'Basmati Rice', 'Premium long grain rice', '10000000-0000-4000-8000-000000000001', u.id, 82.00, 95.00, 5, '10063020', 50
from public.units u where u.abbreviation='kg'
on conflict (id) do nothing;
insert into public.products (id, sku, barcode, name, description, category_id, unit_id, purchase_price, wholesale_price, gst_rate, hsn_code, minimum_stock)
select '40000000-0000-4000-8000-000000000003', 'DEMO-OIL-001', '8901000000035', 'Mustard Oil', 'Filtered mustard oil', '10000000-0000-4000-8000-000000000002', u.id, 142.00, 158.00, 5, '15149120', 30
from public.units u where u.abbreviation='L'
on conflict (id) do nothing;
insert into public.products (id, sku, barcode, name, description, category_id, unit_id, purchase_price, wholesale_price, gst_rate, hsn_code, minimum_stock)
select '40000000-0000-4000-8000-000000000004', 'DEMO-SOAP-001', '8901000000042', 'Laundry Soap Carton', 'Laundry soap, 24 pieces per carton', '10000000-0000-4000-8000-000000000003', u.id, 410.00, 468.00, 18, '34011942', 8
from public.units u where u.abbreviation='ctn'
on conflict (id) do nothing;

insert into public.stock_movements (product_id, quantity_delta, movement_type, reason, source_type, idempotency_key)
values
  ('40000000-0000-4000-8000-000000000001', 120, 'opening', 'Development sample opening balance', 'seed', 'seed:opening:DEMO-DAL-001'),
  ('40000000-0000-4000-8000-000000000002', 36, 'opening', 'Development sample opening balance', 'seed', 'seed:opening:DEMO-RICE-001'),
  ('40000000-0000-4000-8000-000000000003', 75, 'opening', 'Development sample opening balance', 'seed', 'seed:opening:DEMO-OIL-001'),
  ('40000000-0000-4000-8000-000000000004', 18, 'opening', 'Development sample opening balance', 'seed', 'seed:opening:DEMO-SOAP-001')
on conflict (idempotency_key) do nothing;
