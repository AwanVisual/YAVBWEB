-- Setup database untuk POS Toko Kelontong

-- 1. Tabel Products
create table if not exists public.products (
    id uuid default uuid_generate_v4() primary key,
    sku text unique not null,
    name text not null,
    description text,
    price decimal(10,2) not null default 0,
    stock int not null default 0,
    category text not null,
    min_stock int default 10,
    created_at timestamptz default now()
);

-- 2. Tabel Transactions
create table if not exists public.transactions (
    id uuid default uuid_generate_v4() primary key,
    cashier_id uuid references auth.users(id) not null,
    total_amount decimal(10,2) not null default 0,
    status text not null default 'completed',
    items jsonb not null,
    created_at timestamptz default now()
);

-- 3. Tabel Price Logs
create table if not exists public.price_logs (
    id uuid default uuid_generate_v4() primary key,
    product_id uuid references public.products(id) not null,
    old_price decimal(10,2) not null,
    new_price decimal(10,2) not null,
    user_id uuid references auth.users(id) not null,
    created_at timestamptz default now()
);

-- 4. Tabel Stock Logs
create table if not exists public.stock_logs (
    id uuid default uuid_generate_v4() primary key,
    product_id uuid references public.products(id) not null,
    change_amount int not null,
    note text,
    user_id uuid references auth.users(id) not null,
    created_at timestamptz default now()
);

-- Enable Row Level Security (RLS)
alter table public.products enable row level security;
alter table public.transactions enable row level security;
alter table public.price_logs enable row level security;
alter table public.stock_logs enable row level security;

-- RLS Policies untuk Products
create policy "Enable read access for authenticated users"
on public.products for select
using (auth.role() = 'authenticated');

create policy "Enable insert for authenticated users"
on public.products for insert
with check (auth.role() = 'authenticated');

create policy "Enable update for authenticated users"
on public.products for update
using (auth.role() = 'authenticated');

create policy "Enable delete for authenticated users"
on public.products for delete
using (auth.role() = 'authenticated');

-- RLS Policies untuk Transactions
create policy "Enable read access for authenticated users"
on public.transactions for select
using (auth.role() = 'authenticated');

create policy "Enable insert for authenticated users"
on public.transactions for insert
with check (auth.role() = 'authenticated');

-- RLS Policies untuk Price Logs
create policy "Enable read access for authenticated users"
on public.price_logs for select
using (auth.role() = 'authenticated');

create policy "Enable insert for authenticated users"
on public.price_logs for insert
with check (auth.role() = 'authenticated');

-- RLS Policies untuk Stock Logs
create policy "Enable read access for authenticated users"
on public.stock_logs for select
using (auth.role() = 'authenticated');

create policy "Enable insert for authenticated users"
on public.stock_logs for insert
with check (auth.role() = 'authenticated');

-- Grant permissions untuk role authenticated
grant all on public.products to authenticated;
grant all on public.transactions to authenticated;
grant all on public.price_logs to authenticated;
grant all on public.stock_logs to authenticated;

-- Tambahkan data contoh untuk products (opsional)
insert into public.products (sku, name, description, price, stock, category) values
('SKU001', 'Indomie Goreng', 'Mie instant goreng', 3500, 100, 'Makanan'),
('SKU002', 'Aqua 600ml', 'Air mineral', 4000, 50, 'Minuman'),
('SKU003', 'Lifebuoy', 'Sabun mandi', 3500, 30, 'Perlengkapan Mandi'),
('SKU004', 'Rinso Sachet', 'Deterjen', 1500, 80, 'Rumah Tangga');

-- Catatan:
-- 1. Jalankan SQL ini di Supabase SQL Editor
-- 2. Pastikan extension uuid-ossp sudah diaktifkan
-- 3. Hapus data contoh jika tidak diperlukan
-- 4. Backup data sebelum menjalankan SQL ini jika database sudah ada 