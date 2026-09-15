import { createClient } from '@supabase/supabase-js'

export type UserRole = 'admin' | 'staff'

export type UserProfile = {
  id: string
  email: string
  full_name?: string
  role: UserRole
  created_at?: string
}

export type DbProduct = {
  id: number
  name: string
  sku: string
  barcode?: string
  category: string
  price: number
  stock: number
  gst: number
  created_at?: string
}

export type DbBill = {
  id: number
  invoice: string
  customer: string
  phone: string
  date: string
  items: Array<DbProduct & { qty: number }>
  subtotal: number
  discount: number
  gst: number
  total: number
  payment: string
  created_by?: string
  created_at?: string
}

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('your-project') &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseAnonKey.includes('your-anon-key') &&
  !supabaseAnonKey.includes('placeholder')
)

// Create Supabase Client
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)

