-- ==============================================================================
-- CENEXA SYSTEMS BILLING SYSTEM - SUPABASE SCHEMA & RLS POLICIES
-- Copy & Paste this script into your Supabase Dashboard -> SQL Editor and Run.
-- ==============================================================================

-- 1. PROFILES TABLE (User Roles & Profile Metadata)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')) DEFAULT 'staff',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Security Definer function to check admin role without infinite recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles RLS Policies
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR id = auth.uid());

-- Trigger to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;
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

-- Products RLS Policies
CREATE POLICY "Authenticated users can view products"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins and Staff can update products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can delete products"
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

-- Bills RLS Policies
CREATE POLICY "Admins and Staff can view bills"
  ON public.bills FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create bills"
  ON public.bills FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Only admins can update bills"
  ON public.bills FOR UPDATE
  TO authenticated
  USING (public.is_admin());

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
