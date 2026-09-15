-- ==============================================================================
-- CENEXA SYSTEMS BILLING SYSTEM - SUPABASE SCHEMA & RLS POLICIES
-- ==============================================================================

-- 0. ENABLE REQUIRED EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. PROFILES TABLE (User Roles & Profile Metadata)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')) DEFAULT 'staff',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current authenticated user is an Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles RLS Policies:
DROP POLICY IF EXISTS "Users can read own profile or admin read all" ON public.profiles;
CREATE POLICY "Users can read own profile or admin read all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own profile or admin insert" ON public.profiles;
CREATE POLICY "Users can insert own profile or admin insert"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admins can update all profiles or user update own" ON public.profiles;
CREATE POLICY "Admins can update all profiles or user update own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- Trigger to automatically create or update profile when a user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role TEXT;
  user_full_name TEXT;
BEGIN
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  assigned_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    CASE WHEN NEW.email ILIKE '%admin%' THEN 'admin' ELSE 'staff' END
  );

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, user_full_name, assigned_role)
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = CASE 
      WHEN public.profiles.role = 'admin' THEN 'admin'
      ELSE EXCLUDED.role
    END,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. PRODUCTS TABLE (Inventory & Pricing)
CREATE TABLE IF NOT EXISTS public.products (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT,
  category TEXT DEFAULT 'General',
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0,
  gst NUMERIC(5, 2) NOT NULL DEFAULT 18,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Products RLS Policies:
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
CREATE POLICY "Authenticated users can view products"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Only admins can insert products" ON public.products;
CREATE POLICY "Only admins can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can update product stock" ON public.products;
CREATE POLICY "Authenticated users can update product stock"
  ON public.products FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Only admins can delete products" ON public.products;
CREATE POLICY "Only admins can delete products"
  ON public.products FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- 3. BILLS / INVOICES TABLE
CREATE TABLE IF NOT EXISTS public.bills (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  invoice TEXT NOT NULL UNIQUE,
  customer TEXT NOT NULL DEFAULT 'Walk-in Customer',
  phone TEXT DEFAULT '',
  date TEXT NOT NULL,
  items JSONB NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  gst NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment TEXT NOT NULL DEFAULT 'UPI',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on bills
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- Bills RLS Policies:
DROP POLICY IF EXISTS "Authenticated users can view bills" ON public.bills;
CREATE POLICY "Authenticated users can view bills"
  ON public.bills FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert bills" ON public.bills;
CREATE POLICY "Authenticated users can insert bills"
  ON public.bills FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Only admins can update bills" ON public.bills;
CREATE POLICY "Only admins can update bills"
  ON public.bills FOR UPDATE
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Only admins can delete bills" ON public.bills;
CREATE POLICY "Only admins can delete bills"
  ON public.bills FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- 4. SEED DATA (Demo Products)
INSERT INTO public.products (name, sku, barcode, category, price, stock, gst)
VALUES
  ('Premium A4 Paper',  'PAP-001', 'PAP-001', 'Stationery', 320.00, 48, 18),
  ('Blue Ball Pen Pack', 'PEN-014', 'PEN-014', 'Stationery', 120.00, 85, 12),
  ('Wireless Mouse',    'TEC-031', 'TEC-031', 'Electronics', 650.00, 16, 18),
  ('USB-C Cable',       'TEC-044', 'TEC-044', 'Electronics', 399.00, 27, 18),
  ('Notebook A5',       'NB-005',  'NB-005',  'Stationery', 85.00,  7,  12),
  ('Office Stapler',    'OFF-011', 'OFF-011', 'Office',     260.00, 11, 18)
ON CONFLICT (sku) DO NOTHING;


-- 5. SEED AUTH USERS: ADMIN & STAFF (Password: Cenexa@2026)
-- Creates users directly in auth.users with confirmed email and bcrypt hashed password.
DO $$
DECLARE
  v_admin_id UUID := 'a0000000-0000-0000-0000-000000000001';
  v_staff_id UUID := 's0000000-0000-0000-0000-000000000002';
BEGIN
  -- 5A. Insert Admin user (admin@cenexa.com / Cenexa@2026)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@cenexa.com') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud,
      confirmation_token
    ) VALUES (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'admin@cenexa.com',
      crypt('Cenexa@2026', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"admin","full_name":"Admin User"}'::jsonb,
      now(),
      now(),
      'authenticated',
      'authenticated',
      ''
    );
  ELSE
    -- If user exists, update password to ensure it matches Cenexa@2026
    UPDATE auth.users
    SET 
      encrypted_password = crypt('Cenexa@2026', gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_user_meta_data = raw_user_meta_data || '{"role":"admin","full_name":"Admin User"}'::jsonb
    WHERE email = 'admin@cenexa.com';
  END IF;

  -- 5B. Insert Staff user (staff@cenexa.com / Cenexa@2026)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'staff@cenexa.com') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud,
      confirmation_token
    ) VALUES (
      v_staff_id,
      '00000000-0000-0000-0000-000000000000',
      'staff@cenexa.com',
      crypt('Cenexa@2026', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"staff","full_name":"Billing Staff"}'::jsonb,
      now(),
      now(),
      'authenticated',
      'authenticated',
      ''
    );
  ELSE
    -- If user exists, update password to ensure it matches Cenexa@2026
    UPDATE auth.users
    SET 
      encrypted_password = crypt('Cenexa@2026', gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_user_meta_data = raw_user_meta_data || '{"role":"staff","full_name":"Billing Staff"}'::jsonb
    WHERE email = 'staff@cenexa.com';
  END IF;

  -- 5C. Ensure Profiles match in public.profiles table
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES
    ((SELECT id FROM auth.users WHERE email = 'admin@cenexa.com'), 'admin@cenexa.com', 'Admin User', 'admin'),
    ((SELECT id FROM auth.users WHERE email = 'staff@cenexa.com'), 'staff@cenexa.com', 'Billing Staff', 'staff')
  ON CONFLICT (id) DO UPDATE
  SET 
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = now();

END $$;
