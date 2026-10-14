-- DINESMART SUPABASE DATABASE SCHEMA
-- Execute this script in your Supabase SQL Editor to set up all tables.

-- Disable Row Level Security (RLS) or enable public read/write access on all tables for the anon key.

-- 1. MENU ITEMS
CREATE TABLE IF NOT EXISTS public.menu_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    category TEXT NOT NULL,
    image TEXT,
    rating NUMERIC DEFAULT 5.0,
    reviews_count INTEGER DEFAULT 0,
    is_veg BOOLEAN DEFAULT TRUE,
    spicy_level INTEGER DEFAULT 0,
    is_special BOOLEAN DEFAULT FALSE,
    calories INTEGER,
    prep_time TEXT,
    description TEXT,
    available BOOLEAN DEFAULT TRUE
);
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON public.menu_items FOR ALL USING (true) WITH CHECK (true);

-- 2. ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC NOT NULL,
    gst NUMERIC NOT NULL,
    discount NUMERIC DEFAULT 0,
    tip NUMERIC DEFAULT 0,
    total NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'Confirmed',
    payment_status TEXT NOT NULL DEFAULT 'Pending',
    payment_method TEXT,
    customer_phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON public.orders FOR ALL USING (true) WITH CHECK (true);

-- 3. WAITER REQUESTS
CREATE TABLE IF NOT EXISTS public.waiter_requests (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL,
    request_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.waiter_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON public.waiter_requests FOR ALL USING (true) WITH CHECK (true);

-- 4. LOYALTY PROFILES
CREATE TABLE IF NOT EXISTS public.loyalty_profiles (
    phone TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    points INTEGER DEFAULT 0,
    tier TEXT DEFAULT 'Bronze'
);
ALTER TABLE public.loyalty_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON public.loyalty_profiles FOR ALL USING (true) WITH CHECK (true);

-- 5. FEEDBACK
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL,
    food_rating NUMERIC NOT NULL,
    service_rating NUMERIC NOT NULL,
    ambience_rating NUMERIC NOT NULL,
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON public.feedback FOR ALL USING (true) WITH CHECK (true);

-- 6. INVENTORY
CREATE TABLE IF NOT EXISTS public.inventory (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    stock NUMERIC DEFAULT 0,
    min_stock NUMERIC DEFAULT 0,
    unit TEXT NOT NULL,
    cost NUMERIC DEFAULT 0
);
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON public.inventory FOR ALL USING (true) WITH CHECK (true);

-- 7. STAFF
CREATE TABLE IF NOT EXISTS public.staff (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mobile TEXT,
    role TEXT NOT NULL,
    shift TEXT NOT NULL DEFAULT 'Morning',
    salary NUMERIC DEFAULT 0,
    attendance NUMERIC DEFAULT 100,
    performance JSONB NOT NULL DEFAULT '{"score": 90, "ordersDelivered": 0, "avgServingTime": "N/A", "ratings": 5.0, "tips": 0}'::jsonb,
    empid TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
);
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON public.staff FOR ALL USING (true) WITH CHECK (true);

-- 8. TABLES
CREATE TABLE IF NOT EXISTS public.tables (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Available',
    customer_name TEXT,
    capacity INTEGER DEFAULT 4,
    qr_token TEXT
);
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON public.tables FOR ALL USING (true) WITH CHECK (true);

-- 9. PROMOTIONS
CREATE TABLE IF NOT EXISTS public.promotions (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount NUMERIC NOT NULL,
    type TEXT NOT NULL DEFAULT 'Fixed',
    min_bill NUMERIC DEFAULT 0,
    active BOOLEAN DEFAULT TRUE
);
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON public.promotions FOR ALL USING (true) WITH CHECK (true);

-- 10. REVIEWS
CREATE TABLE IF NOT EXISTS public.reviews (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    rating NUMERIC NOT NULL,
    comment TEXT,
    date TEXT NOT NULL,
    reply TEXT
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON public.reviews FOR ALL USING (true) WITH CHECK (true);

-- 11. ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id TEXT PRIMARY KEY,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    timestamp TEXT NOT NULL
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

-- 12. PENDING STAFF (WAITERS & STAFF ONBOARDING)
CREATE TABLE IF NOT EXISTS public.pending_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    email TEXT NOT NULL,
    photo TEXT,
    role TEXT DEFAULT 'Waiter',
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.pending_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON public.pending_staff FOR ALL USING (true) WITH CHECK (true);

