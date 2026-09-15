import { useEffect, useMemo, useState, type ComponentType, type Dispatch, type SetStateAction } from 'react'
import {
  AlertTriangle, BarChart3, Bell, Boxes, Camera, CheckCircle2, ChevronRight,
  CircleDollarSign, Download, Eye, EyeOff, FileText, KeyRound, LayoutDashboard,
  Lock, LogIn, LogOut, Mail, MapPin, Phone, Plus, Printer, Receipt, Search,
  Settings, ShieldAlert, ShieldCheck, ShoppingCart, Trash2, User, UserCheck,
  UserPlus, Users, X,
} from 'lucide-react'
import BarcodeScanner from './components/BarcodeScanner'
import type { ScanPayload } from './components/BarcodeScanner'
import { supabase, isSupabaseConfigured, type UserRole, type UserProfile, type DbProduct, type DbBill } from './lib/supabase'

const COMPANY_DETAILS = {
  name: import.meta.env.VITE_COMPANY_NAME || 'CENEXA SYSTEMS',
  proprietor: import.meta.env.VITE_PROPRIETOR || 'B. Lalith Kumar',
  phone1: import.meta.env.VITE_PHONE_PRIMARY || '+91 89253 06434',
  phone2: import.meta.env.VITE_PHONE_SECONDARY || '+91 99949 81576',
  email: import.meta.env.VITE_EMAIL || 'cenexasystems@gmail.com',
  address:
    import.meta.env.VITE_ADDRESS ||
    'Sri Venkateswara Complex, Mahalakshmi Nagar, G.N.T Road, Redhills, Chennai – 600052',
  tagline:
    'Technology-driven digital solutions company focused on building innovative, scalable, and efficient systems that simplify business processes and enhance user experience.',
  services: [
    'Web Applications',
    'Automation Systems',
    'AI-Powered Tools',
    'Scalable Business Solutions',
  ],
  invoicePrefix: import.meta.env.VITE_INVOICE_PREFIX || 'CEN',
  currency: 'Indian Rupee (₹)',
}

type Product = {
  id: number
  name: string
  sku: string
  barcode?: string
  category: string
  price: number
  stock: number
  gst: number
}
type BillItem = Product & { qty: number }
type Bill = {
  id: number
  invoice: string
  customer: string
  phone: string
  date: string
  items: BillItem[]
  subtotal: number
  discount: number
  gst: number
  total: number
  payment: string
  created_by?: string
}

const seedProducts: Product[] = [
  { id: 1, name: 'Premium A4 Paper',  sku: 'PAP-001', barcode: 'PAP-001', category: 'Stationery', price: 320, stock: 48, gst: 18 },
  { id: 2, name: 'Blue Ball Pen Pack', sku: 'PEN-014', barcode: 'PEN-014', category: 'Stationery', price: 120, stock: 85, gst: 12 },
  { id: 3, name: 'Wireless Mouse',    sku: 'TEC-031', barcode: 'TEC-031', category: 'Electronics', price: 650, stock: 16, gst: 18 },
  { id: 4, name: 'USB-C Cable',       sku: 'TEC-044', barcode: 'TEC-044', category: 'Electronics', price: 399, stock: 27, gst: 18 },
  { id: 5, name: 'Notebook A5',       sku: 'NB-005',  barcode: 'NB-005',  category: 'Stationery', price: 85,  stock: 7,  gst: 12 },
  { id: 6, name: 'Office Stapler',    sku: 'OFF-011', barcode: 'OFF-011', category: 'Office',     price: 260, stock: 11, gst: 18 },
]

const seedBills: Bill[] = [
  { id: 1, invoice: 'CEN-2026-0001', customer: 'Arun Kumar',       phone: '9876543210', date: '13 Sep 2026, 10:42 PM', items: [{ ...seedProducts[2], qty: 1 }],                                       subtotal: 650,  discount: 0,  gst: 117,   total: 767,    payment: 'UPI'  },
  { id: 2, invoice: 'CEN-2026-0002', customer: 'Priya Stores',     phone: '9840012345', date: '13 Sep 2026, 04:18 PM', items: [{ ...seedProducts[0], qty: 2 }, { ...seedProducts[4], qty: 4 }], subtotal: 980,  discount: 50, gst: 170.4, total: 1100.4, payment: 'Card' },
  { id: 3, invoice: 'CEN-2026-0003', customer: 'Walk-in Customer', phone: '',           date: '12 Sep 2026, 06:20 PM', items: [{ ...seedProducts[1], qty: 1 }, { ...seedProducts[5], qty: 1 }], subtotal: 380,  discount: 0,  gst: 43.2,  total: 423.2,  payment: 'Cash' },
]

const money = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function App() {
  // ── Authentication & Role State ─────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // ── Application State ───────────────────────────────────────────────────────
  const [page, setPage] = useState('dashboard')
  const [products, setProducts] = useState<Product[]>(seedProducts)
  const [bills, setBills] = useState<Bill[]>(seedBills)
  const [profilesList, setProfilesList] = useState<UserProfile[]>([])
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<BillItem[]>([])
  const [customer, setCustomer] = useState('')
  const [phone, setPhone] = useState('')
  const [discount, setDiscount] = useState(0)
  const [payment, setPayment] = useState('UPI')
  const [invoiceOpen, setInvoiceOpen] = useState<Bill | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanMessage, setScanMessage] = useState('')

  // ── 1. Check & Synchronize Auth State on Boot ───────────────────────────────
  useEffect(() => {
    let isMounted = true

    async function initAuth() {
      if (isSupabaseConfigured) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user && isMounted) {
            await loadProfile(session.user.id, session.user.email ?? '')
          }
        } catch (err) {
          console.warn('Supabase auth session lookup failed:', err)
        }
      } else {
        // Local/Demo Session Restore
        const cachedUser = localStorage.getItem('cenexa_user')
        if (cachedUser && isMounted) {
          try {
            const parsed = JSON.parse(cachedUser)
            setCurrentUser(parsed)
            setPage(parsed.role === 'admin' ? 'dashboard' : 'billing')
          } catch {
            localStorage.removeItem('cenexa_user')
          }
        }
      }

      if (isMounted) setAuthLoading(false)
    }

    initAuth()

    // Listen to Supabase auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          await loadProfile(session.user.id, session.user.email ?? '')
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null)
          localStorage.removeItem('cenexa_user')
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Helper to load profile and role from Supabase or fallback
  const loadProfile = async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (data && !error) {
        const userProfile: UserProfile = {
          id: data.id,
          email: data.email || email,
          full_name: data.full_name || email.split('@')[0],
          role: data.role as UserRole,
        }
        setCurrentUser(userProfile)
        setPage(userProfile.role === 'admin' ? 'dashboard' : 'billing')
      } else {
        // If profile row doesn't exist yet, infer from metadata or default to staff
        const fallbackRole: UserRole = email.toLowerCase().includes('admin') ? 'admin' : 'staff'
        const userProfile: UserProfile = {
          id: userId,
          email,
          full_name: email.split('@')[0],
          role: fallbackRole,
        }
        setCurrentUser(userProfile)
        setPage(fallbackRole === 'admin' ? 'dashboard' : 'billing')
      }
    } catch {
      const fallbackRole: UserRole = email.toLowerCase().includes('admin') ? 'admin' : 'staff'
      const userProfile: UserProfile = {
        id: userId,
        email,
        full_name: email.split('@')[0],
        role: fallbackRole,
      }
      setCurrentUser(userProfile)
      setPage(fallbackRole === 'admin' ? 'dashboard' : 'billing')
    }
  }

  // ── 2. Fetch Products, Bills, & Profiles from Supabase ──────────────────────
  useEffect(() => {
    if (!currentUser || !isSupabaseConfigured) return

    async function loadData() {
      // Load products
      try {
        const { data: prodData } = await supabase
          .from('products')
          .select('*')
          .order('id', { ascending: true })

        if (prodData && prodData.length > 0) {
          setProducts(
            prodData.map((p: DbProduct) => ({
              id: Number(p.id),
              name: p.name,
              sku: p.sku,
              barcode: p.barcode || undefined,
              category: p.category || 'General',
              price: Number(p.price),
              stock: Number(p.stock),
              gst: Number(p.gst),
            }))
          )
        }
      } catch (err) {
        console.warn('Failed to load products from Supabase:', err)
      }

      // Load bills
      try {
        const { data: billData } = await supabase
          .from('bills')
          .select('*')
          .order('id', { ascending: false })

        if (billData && billData.length > 0) {
          setBills(
            billData.map((b: DbBill) => ({
              id: Number(b.id),
              invoice: b.invoice,
              customer: b.customer,
              phone: b.phone || '',
              date: b.date,
              items: b.items || [],
              subtotal: Number(b.subtotal),
              discount: Number(b.discount),
              gst: Number(b.gst),
              total: Number(b.total),
              payment: b.payment,
              created_by: b.created_by,
            }))
          )
        }
      } catch (err) {
        console.warn('Failed to load bills from Supabase:', err)
      }

      // Load profiles if admin
      if (currentUser.role === 'admin') {
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false })

          if (profileData) {
            setProfilesList(profileData as UserProfile[])
          }
        } catch (err) {
          console.warn('Failed to load profiles:', err)
        }
      }
    }

    loadData()
  }, [currentUser])

  // ── 3. Role-Based Page Access Guard ─────────────────────────────────────────
  // Staff users can ONLY access billing. If state points to admin page, redirect.
  useEffect(() => {
    if (currentUser && currentUser.role === 'staff' && page !== 'billing') {
      setPage('billing')
    }
  }, [currentUser, page])

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut()
    }
    setCurrentUser(null)
    localStorage.removeItem('cenexa_user')
    setCart([])
    setPage('dashboard')
  }

  // ── Billing Calculations ───────────────────────────────────────────────────
  const filteredProducts = useMemo(
    () =>
      products.filter(p =>
        `${p.name} ${p.sku} ${p.barcode ?? ''} ${p.category}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [products, query],
  )

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const gst = cart.reduce((s, i) => s + i.price * i.qty * (i.gst / 100), 0)
  const total = Math.max(0, subtotal - discount + gst)

  const add = (p: Product) =>
    setCart(c => {
      const f = c.find(i => i.id === p.id)
      return f ? c.map(i => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i)) : [...c, { ...p, qty: 1 }]
    })

  const remove = (id: number) => setCart(c => c.filter(i => i.id !== id))

  const handleScan = (scan: ScanPayload) => {
    const value = scan.value.trim().toLowerCase()
    const product = products.find(p =>
      [p.barcode, p.sku]
        .filter((code): code is string => Boolean(code))
        .some(code => code.toLowerCase() === value),
    )
    if (product) {
      add(product)
      setScanMessage(`${product.name} added · ${scan.format}`)
    } else {
      setQuery(scan.value)
      setScanMessage(`No product matched ${scan.value}. Search results updated.`)
    }
  }

  const checkout = async () => {
    if (!cart.length) return
    const bill: Bill = {
      id: Date.now(),
      invoice: `${COMPANY_DETAILS.invoicePrefix}-2026-${String(bills.length + 1).padStart(4, '0')}`,
      customer: customer || 'Walk-in Customer',
      phone,
      date: new Date().toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }),
      items: cart,
      subtotal,
      discount,
      gst,
      total,
      payment,
      created_by: currentUser?.id,
    }

    // Update Local State
    setBills(b => [bill, ...b])
    setProducts(ps =>
      ps.map(p => {
        const item = cart.find(i => i.id === p.id)
        return item ? { ...p, stock: Math.max(0, p.stock - item.qty) } : p
      }),
    )

    // Save to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        await supabase.from('bills').insert({
          invoice: bill.invoice,
          customer: bill.customer,
          phone: bill.phone,
          date: bill.date,
          items: bill.items,
          subtotal: bill.subtotal,
          discount: bill.discount,
          gst: bill.gst,
          total: bill.total,
          payment: bill.payment,
          created_by: currentUser?.id,
        })

        // Decrement stock in DB
        for (const item of cart) {
          const prod = products.find(p => p.id === item.id)
          if (prod) {
            await supabase
              .from('products')
              .update({ stock: Math.max(0, prod.stock - item.qty) })
              .eq('id', item.id)
          }
        }
      } catch (err) {
        console.warn('Failed to insert bill into Supabase:', err)
      }
    }

    setInvoiceOpen(bill)
    setCart([])
    setCustomer('')
    setPhone('')
    setDiscount(0)
  }

  // ── Role-Appropriate Navigation ─────────────────────────────────────────────
  type NavEntry = [key: string, label: string, Icon: ComponentType<{ size?: number }>]

  const nav: NavEntry[] = useMemo(() => {
    if (currentUser?.role === 'staff') {
      return [
        ['billing', 'New Bill / POS', ShoppingCart],
      ]
    }
    // Admin gets full menu
    return [
      ['dashboard', 'Dashboard',   LayoutDashboard],
      ['billing',   'New Bill',    ShoppingCart],
      ['products',  'Products',    Boxes],
      ['customers', 'Customers',   Users],
      ['reports',   'Reports',     BarChart3],
      ['users',     'User Roles',  UserCheck],
      ['settings',  'Settings',    Settings],
    ]
  }, [currentUser])

  // ── Loading Screen ──────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="loginPage">
        <div style={{ textAlign: 'center', color: '#38bdf8' }}>
          <div className="loginLogoImg" style={{ margin: '0 auto 16px', display: 'grid', placeItems: 'center' }}>
            <img src="/cenexa-logo.png" alt="Cenexa Logo" style={{ width: '100%', height: '100%', borderRadius: 12 }} />
          </div>
          <h3 style={{ margin: 0, color: '#fff' }}>Connecting to Cenexa Billing...</h3>
          <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: 6 }}>Authenticating session</p>
        </div>
      </div>
    )
  }

  // ── Auth / Login Screen ─────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <LoginPage
        onLogin={(profile) => {
          setCurrentUser(profile)
          localStorage.setItem('cenexa_user', JSON.stringify(profile))
          setPage(profile.role === 'admin' ? 'dashboard' : 'billing')
        }}
      />
    )
  }

  // ── Main App Shell ──────────────────────────────────────────────────────────
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src="/cenexa-logo.png" alt="Cenexa Systems Logo" className="brandLogoImg" />
          <div>
            <div className="brandName">Cenexa Systems</div>
            <div className="brandSub">
              {currentUser.role === 'admin' ? 'Admin Portal' : 'Staff POS Station'}
            </div>
          </div>
        </div>

        <div className="sideLabel">
          {currentUser.role === 'admin' ? 'ADMIN MENU' : 'STAFF MENU'}
        </div>

        <nav>
          {nav.map(([key, label, Icon]) => (
            <button key={key} className={page === key ? 'nav active' : 'nav'} onClick={() => setPage(key)}>
              <Icon size={19} />
              <span>{label}</span>
              {key === 'billing' && <span className="newBadge">NEW</span>}
            </button>
          ))}
        </nav>

        <div className="sidebarBottom">
          <div className="userCardSidebar">
            <div className="userAvatarMini">
              {currentUser.full_name?.[0]?.toUpperCase() || currentUser.email[0].toUpperCase()}
            </div>
            <div className="userInfoMini">
              <span className="userEmailMini" title={currentUser.email}>{currentUser.email}</span>
              <span className={`roleBadge ${currentUser.role}`}>{currentUser.role}</span>
            </div>
          </div>

          <button className="logoutBtn" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <div className="eyebrow">
              {COMPANY_DETAILS.name} / {currentUser.role === 'admin' ? 'ADMINISTRATION' : 'POS TERMINAL'}
            </div>
            <h1>
              {page === 'dashboard'
                ? 'Dashboard'
                : page === 'billing'
                ? 'Create New Bill'
                : page === 'users'
                ? 'User Roles & Access Control'
                : page[0].toUpperCase() + page.slice(1)}
            </h1>
          </div>
          <div className="topActions">
            <div className="contactChip">
              <Phone size={14} />
              <span>{COMPANY_DETAILS.phone1}</span>
            </div>
            <div className={`roleBadge ${currentUser.role}`}>
              {currentUser.role === 'admin' ? <ShieldCheck size={13} /> : <UserCheck size={13} />}
              <span>{currentUser.role}</span>
            </div>
            <div className="avatar" title={`${currentUser.email} (${currentUser.role})`}>
              {currentUser.full_name?.[0]?.toUpperCase() || currentUser.email[0].toUpperCase()}
            </div>
          </div>
        </header>

        {/* ── Role Protection: Render pages according to permissions ────────── */}
        {page === 'dashboard' && (
          currentUser.role === 'admin' ? (
            <Dashboard setPage={setPage} bills={bills} products={products} />
          ) : (
            <AccessDenied setPage={setPage} />
          )
        )}

        {page === 'billing' && (
          <Billing
            products={filteredProducts}
            query={query}
            setQuery={setQuery}
            cart={cart}
            add={add}
            remove={remove}
            customer={customer}
            phone={phone}
            setCustomer={setCustomer}
            setPhone={setPhone}
            discount={discount}
            setDiscount={setDiscount}
            payment={payment}
            setPayment={setPayment}
            subtotal={subtotal}
            gst={gst}
            total={total}
            checkout={checkout}
            openScanner={() => { setScanMessage(''); setScannerOpen(true) }}
            scanMessage={scanMessage}
          />
        )}

        {page === 'products' && (
          currentUser.role === 'admin' ? (
            <Products products={products} setProducts={setProducts} />
          ) : (
            <AccessDenied setPage={setPage} />
          )
        )}

        {page === 'customers' && (
          currentUser.role === 'admin' ? (
            <Customers bills={bills} />
          ) : (
            <AccessDenied setPage={setPage} />
          )
        )}

        {page === 'reports' && (
          currentUser.role === 'admin' ? (
            <Reports bills={bills} />
          ) : (
            <AccessDenied setPage={setPage} />
          )
        )}

        {page === 'users' && (
          currentUser.role === 'admin' ? (
            <UsersManagement profiles={profilesList} setProfiles={setProfilesList} currentUser={currentUser} />
          ) : (
            <AccessDenied setPage={setPage} />
          )
        )}

        {page === 'settings' && (
          currentUser.role === 'admin' ? (
            <SettingsPage />
          ) : (
            <AccessDenied setPage={setPage} />
          )
        )}

        {invoiceOpen && <InvoiceModal bill={invoiceOpen} close={() => setInvoiceOpen(null)} />}
        <BarcodeScanner
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onDetected={handleScan}
        />
      </main>
    </div>
  )
}

// ── Login Component ───────────────────────────────────────────────────────────

function LoginPage({ onLogin }: { onLogin: (p: UserProfile) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [signUpRole, setSignUpRole] = useState<UserRole>('staff')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)

    if (isSupabaseConfigured) {
      if (isSignUp) {
        // Sign Up with Supabase
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: signUpRole,
              full_name: email.split('@')[0],
            },
          },
        })

        if (error) {
          setErrorMsg(error.message)
          setLoading(false)
          return
        }

        if (data.user) {
          const profile: UserProfile = {
            id: data.user.id,
            email: data.user.email ?? email,
            full_name: email.split('@')[0],
            role: signUpRole,
          }
          onLogin(profile)
        }
      } else {
        // Sign In with Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          setErrorMsg(error.message)
          setLoading(false)
          return
        }

        if (data.user) {
          // Fetch user role from profiles table
          try {
            const { data: prof } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .single()

            const role: UserRole = (prof?.role as UserRole) || (email.toLowerCase().includes('admin') ? 'admin' : 'staff')
            const profile: UserProfile = {
              id: data.user.id,
              email: data.user.email ?? email,
              full_name: prof?.full_name || email.split('@')[0],
              role,
            }
            onLogin(profile)
          } catch {
            const fallbackRole: UserRole = email.toLowerCase().includes('admin') ? 'admin' : 'staff'
            onLogin({
              id: data.user.id,
              email: data.user.email ?? email,
              full_name: email.split('@')[0],
              role: fallbackRole,
            })
          }
        }
      }
    } else {
      // Local Demo Authentication Mode (Immediate testing)
      setTimeout(() => {
        if (!email || !password) {
          setErrorMsg('Please enter both email and password.')
          setLoading(false)
          return
        }

        const role: UserRole = isSignUp ? signUpRole : email.toLowerCase().includes('admin') ? 'admin' : 'staff'
        const profile: UserProfile = {
          id: `demo-${Date.now()}`,
          email,
          full_name: email.split('@')[0],
          role,
        }
        onLogin(profile)
      }, 300)
    }

    setLoading(false)
  }

  const quickDemoLogin = (demoRole: UserRole) => {
    const demoEmail = demoRole === 'admin' ? 'admin@cenexa.com' : 'staff@cenexa.com'
    setEmail(demoEmail)
    setPassword('Cenexa@2026')
    setIsSignUp(false)
  }

  return (
    <div className="loginPage">
      <div className="loginGlow" />
      <div className="loginCard">
        <div className="loginHeader">
          <img src="/cenexa-logo.png" alt="Cenexa Systems Logo" className="loginLogoImg" />
          <h2>{COMPANY_DETAILS.name}</h2>
          <p>Secure Role-Based Billing & POS System</p>
        </div>

        <form className="loginForm" onSubmit={handleSubmit}>
          {errorMsg && (
            <div className="loginError">
              <AlertTriangle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="inputGroup">
            <label>Work Email</label>
            <div className="inputWrapper">
              <Mail size={16} color="#64748b" />
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="inputGroup">
            <label>Password</label>
            <div className="inputWrapper">
              <Lock size={16} color="#64748b" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                style={{ border: 0, background: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {isSignUp && (
            <div className="inputGroup">
              <label>Assign Initial Role</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                <button
                  type="button"
                  className={`demoRoleBtn ${signUpRole === 'staff' ? 'active' : ''}`}
                  style={{ flex: 1, borderColor: signUpRole === 'staff' ? '#38bdf8' : undefined }}
                  onClick={() => setSignUpRole('staff')}
                >
                  <UserCheck size={15} /> Staff (POS Only)
                </button>
                <button
                  type="button"
                  className={`demoRoleBtn ${signUpRole === 'admin' ? 'active' : ''}`}
                  style={{ flex: 1, borderColor: signUpRole === 'admin' ? '#38bdf8' : undefined }}
                  onClick={() => setSignUpRole('admin')}
                >
                  <ShieldCheck size={15} /> Admin (Full Access)
                </button>
              </div>
            </div>
          )}

          <button type="submit" className="loginSubmitBtn" disabled={loading}>
            <LogIn size={16} />
            <span>{loading ? 'Authenticating...' : isSignUp ? 'Create Account' : 'Sign In to Portal'}</span>
          </button>
        </form>

        {/* Quick Demo Credentials */}
        <div className="loginDemoSection">
          <div className="loginDemoTitle">Quick Demo Accounts</div>
          <div className="demoRoleButtons">
            <button className="demoRoleBtn" onClick={() => quickDemoLogin('admin')}>
              <ShieldCheck size={15} color="#38bdf8" />
              <span>Admin Login</span>
              <small>Full Access</small>
            </button>
            <button className="demoRoleBtn" onClick={() => quickDemoLogin('staff')}>
              <UserCheck size={15} color="#4ade80" />
              <span>Staff Login</span>
              <small>POS Only</small>
            </button>
          </div>
        </div>

        <div className="loginFootNote">
          <span>{isSignUp ? 'Already have an account? ' : "Need to register a new user? "}</span>
          <button className="authModeToggle" onClick={() => { setIsSignUp(!isSignUp); setErrorMsg('') }}>
            {isSignUp ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Access Denied Guard Component ─────────────────────────────────────────────

function AccessDenied({ setPage }: { setPage: (p: string) => void }) {
  return (
    <div className="page">
      <div className="accessDeniedCard">
        <div className="accessDeniedIcon">
          <ShieldAlert size={28} />
        </div>
        <h3>Access Restricted</h3>
        <p>
          You are signed in with a <b>Staff</b> role. Access to analytics, reports, settings,
          and inventory management is restricted to <b>Administrators</b>.
        </p>
        <button className="primary" onClick={() => setPage('billing')}>
          <ShoppingCart size={16} /> Return to POS Billing Terminal
        </button>
      </div>
    </div>
  )
}

// ── Users & Role Management (Admin Only) ──────────────────────────────────────

function UsersManagement({
  profiles,
  setProfiles,
  currentUser,
}: {
  profiles: UserProfile[]
  setProfiles: Dispatch<SetStateAction<UserProfile[]>>
  currentUser: UserProfile
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('staff')
  const [openModal, setOpenModal] = useState(false)

  const handleAddUser = async () => {
    if (!email) return
    const newProfile: UserProfile = {
      id: `usr-${Date.now()}`,
      email,
      full_name: email.split('@')[0],
      role,
    }

    setProfiles(prev => [newProfile, ...prev])

    if (isSupabaseConfigured) {
      try {
        await supabase.from('profiles').insert({
          id: newProfile.id,
          email: newProfile.email,
          full_name: newProfile.full_name,
          role: newProfile.role,
        })
      } catch (err) {
        console.warn('Failed to insert user profile to Supabase:', err)
      }
    }

    setEmail('')
    setOpenModal(false)
  }

  const toggleRole = async (userId: string, currentRole: UserRole) => {
    const nextRole: UserRole = currentRole === 'admin' ? 'staff' : 'admin'
    setProfiles(prev =>
      prev.map(p => (p.id === userId ? { ...p, role: nextRole } : p))
    )

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('profiles')
          .update({ role: nextRole })
          .eq('id', userId)
      } catch (err) {
        console.warn('Failed to update role in Supabase:', err)
      }
    }
  }

  return (
    <div className="page">
      <div className="card">
        <div className="sectionTop">
          <div>
            <h3>User Roles & Permissions</h3>
            <p>Manage Admin and Staff accounts and their system permissions.</p>
          </div>
          <button className="primary" onClick={() => setOpenModal(true)}>
            <UserPlus size={17} /> Add Staff / Admin
          </button>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>User / Email</th>
                <th>Current Role</th>
                <th>Permissions</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {/* Current Active User */}
              <tr>
                <td>
                  <b>{currentUser.email}</b>
                  <small style={{ display: 'block', color: '#0284c7' }}>(Current Session)</small>
                </td>
                <td>
                  <span className={`roleBadge ${currentUser.role}`}>{currentUser.role}</span>
                </td>
                <td>Full system administrator access</td>
                <td><span style={{ fontSize: '11px', color: '#64748b' }}>Primary Admin</span></td>
              </tr>

              {/* Other Registered Users */}
              {profiles
                .filter(p => p.email !== currentUser.email)
                .map(p => (
                  <tr key={p.id}>
                    <td><b>{p.email}</b></td>
                    <td>
                      <span className={`roleBadge ${p.role}`}>{p.role}</span>
                    </td>
                    <td>
                      {p.role === 'admin'
                        ? 'Full system access (Dashboard, Reports, Inventory, Users)'
                        : 'POS Billing Terminal only (Create bills, print receipts)'}
                    </td>
                    <td>
                      <button
                        className="textBtn"
                        onClick={() => toggleRole(p.id, p.role)}
                      >
                        Change to {p.role === 'admin' ? 'Staff' : 'Admin'}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {openModal && (
        <div className="modalOverlay">
          <div className="modal">
            <div className="modalHead">
              <div>
                <h3>Add New User</h3>
                <p>Assign email and permissions role.</p>
              </div>
              <button onClick={() => setOpenModal(false)}><X /></button>
            </div>
            <input
              placeholder="user@cenexa.com"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`demoRoleBtn ${role === 'staff' ? 'active' : ''}`}
                style={{ flex: 1, borderColor: role === 'staff' ? '#38bdf8' : undefined }}
                onClick={() => setRole('staff')}
              >
                <UserCheck size={15} /> Staff Role (POS)
              </button>
              <button
                type="button"
                className={`demoRoleBtn ${role === 'admin' ? 'active' : ''}`}
                style={{ flex: 1, borderColor: role === 'admin' ? '#38bdf8' : undefined }}
                onClick={() => setRole('admin')}
              >
                <ShieldCheck size={15} /> Admin Role (Full)
              </button>
            </div>
            <button className="primary full" disabled={!email} onClick={handleAddUser}>
              Save User
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard({
  setPage,
  bills,
  products,
}: {
  setPage: (p: string) => void
  bills: Bill[]
  products: Product[]
}) {
  const sales = bills.reduce((s, b) => s + b.total, 0)
  const low = products.filter(p => p.stock < 10).length

  return (
    <div className="page">
      <div className="hero">
        <div>
          <div className="heroKicker">Welcome to {COMPANY_DETAILS.name}</div>
          <h2>Ready for today's business?</h2>
          <p>
            {COMPANY_DETAILS.proprietor} · {COMPANY_DETAILS.address} · Contact: {COMPANY_DETAILS.phone1}
          </p>
        </div>
        <button className="primary big" onClick={() => setPage('billing')}>
          <Plus size={18} /> Create New Bill
        </button>
      </div>

      <div className="stats">
        <Stat icon={CircleDollarSign} label="Total Sales"   value={money(sales)}                   delta="+12.8% this week" />
        <Stat icon={FileText}         label="Invoices"       value={String(bills.length)}             delta="3 processed today" />
        <Stat icon={ShoppingCart}     label="Average Bill"   value={bills.length ? money(sales / bills.length) : money(0)} delta="Healthy basket size" />
        <Stat icon={Boxes}            label="Low Stock"      value={String(low)}                    delta={low ? 'Attention required' : 'All good'} danger={!!low} />
      </div>

      <div className="grid2">
        <section className="card">
          <div className="cardHead">
            <div>
              <h3>Recent Bills</h3>
              <p>Latest transactions across {COMPANY_DETAILS.name}</p>
            </div>
            <button className="textBtn" onClick={() => setPage('reports')}>
              View all <ChevronRight size={16} />
            </button>
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Payment</th><th>Total</th></tr>
              </thead>
              <tbody>
                {bills.slice(0, 5).map(b => (
                  <tr key={b.id}>
                    <td><b>{b.invoice}</b></td>
                    <td>{b.customer}</td>
                    <td>{b.date}</td>
                    <td><span className="pill">{b.payment}</span></td>
                    <td><b>{money(b.total)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="cardHead">
            <div>
              <h3>Inventory Snapshot</h3>
              <p>Products that need attention</p>
            </div>
            <button className="textBtn" onClick={() => setPage('products')}>
              Manage <ChevronRight size={16} />
            </button>
          </div>
          <div className="stockList">
            {products
              .slice()
              .sort((a, b) => a.stock - b.stock)
              .slice(0, 5)
              .map(p => (
                <div className="stockRow" key={p.id}>
                  <div className="productIcon">{p.name[0]}</div>
                  <div className="stockInfo">
                    <b>{p.name}</b>
                    <span>{p.sku} · {p.category}</span>
                  </div>
                  <div className={p.stock < 10 ? 'stock low' : 'stock'}>{p.stock} left</div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function Stat({
  icon: Icon,
  label,
  value,
  delta,
  danger = false,
}: {
  icon: ComponentType<{ size?: number }>
  label: string
  value: string
  delta: string
  danger?: boolean
}) {
  return (
    <div className="stat">
      <div className="statIcon"><Icon size={20} /></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small className={danger ? 'dangerText' : ''}>{delta}</small>
      </div>
    </div>
  )
}

// ── Billing ───────────────────────────────────────────────────────────────────

type BillingProps = {
  products: Product[]
  query: string
  setQuery: (q: string) => void
  cart: BillItem[]
  add: (p: Product) => void
  remove: (id: number) => void
  customer: string
  phone: string
  setCustomer: (v: string) => void
  setPhone: (v: string) => void
  discount: number
  setDiscount: (v: number) => void
  payment: string
  setPayment: (v: string) => void
  subtotal: number
  gst: number
  total: number
  checkout: () => void
  openScanner: () => void
  scanMessage: string
}

function Billing(props: BillingProps) {
  return (
    <div className="billingLayout page">
      <section className="card productPane">
        <div className="sectionTop">
          <div>
            <h3>Select Products</h3>
            <p>Scan a retail barcode or search the catalogue.</p>
          </div>
          <div className="billingSearchRow">
            <div className="search">
              <Search size={17} />
              <input
                value={props.query}
                onChange={e => props.setQuery(e.target.value)}
                placeholder="Search product, SKU or barcode…"
              />
            </div>
            <button className="scanButton" onClick={props.openScanner}>
              <Camera size={17} /> Scan
            </button>
          </div>
        </div>

        {props.scanMessage && <div className="scanNotice">{props.scanMessage}</div>}

        <div className="productGrid">
          {props.products.map(p => (
            <button className="productTile" key={p.id} onClick={() => props.add(p)}>
              <div className="tileIcon">
                {p.name.split(' ').map(x => x[0]).slice(0, 2).join('')}
              </div>
              <div className="tileBody">
                <b>{p.name}</b>
                <span>{p.sku} · {p.category}{p.barcode ? ` · ${p.barcode}` : ''}</span>
                <strong>{money(p.price)}</strong>
              </div>
              <Plus className="tilePlus" size={18} />
            </button>
          ))}
          {!props.products.length && (
            <div className="noProducts">
              No products found. Scan a barcode or check the product catalogue.
            </div>
          )}
        </div>
      </section>

      <aside className="card cartPane">
        <div className="cartHead">
          <div>
            <h3>Current Invoice</h3>
            <span>{props.cart.length} line item{props.cart.length === 1 ? '' : 's'}</span>
          </div>
          <div className="invoiceTag">POS TERMINAL</div>
        </div>

        <div className="customerFields">
          <input
            value={props.customer}
            onChange={e => props.setCustomer(e.target.value)}
            placeholder="Customer name"
          />
          <input
            value={props.phone}
            onChange={e => props.setPhone(e.target.value)}
            placeholder="Phone number"
            inputMode="tel"
          />
        </div>

        <div className="cartItems">
          {props.cart.length ? (
            <>
              {props.cart.map(i => (
                <div className="cartItem" key={i.id}>
                  <div>
                    <b>{i.name}</b>
                    <span>{money(i.price)} × {i.qty}</span>
                  </div>
                  <strong>{money(i.price * i.qty)}</strong>
                  <button onClick={() => props.remove(i.id)} aria-label={`Remove ${i.name}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </>
          ) : (
            <div className="empty">
              <ShoppingCart size={28} />
              <b>No items yet</b>
              <span>Scan or select products to start the bill.</span>
            </div>
          )}
        </div>

        <div className="totals">
          <div><span>Subtotal</span><b>{money(props.subtotal)}</b></div>
          <div>
            <span>Discount</span>
            <div className="discountBox">
              <span>₹</span>
              <input
                type="number"
                min="0"
                value={props.discount || ''}
                onChange={e => props.setDiscount(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <div><span>GST</span><b>{money(props.gst)}</b></div>
          <div className="grand">
            <span>Total</span>
            <strong>{money(props.total)}</strong>
          </div>
        </div>

        <div className="payment">
          <span>Payment method</span>
          <div className="payButtons">
            {(['UPI', 'Cash', 'Card'] as const).map(x => (
              <button
                key={x}
                className={props.payment === x ? 'selected' : ''}
                onClick={() => props.setPayment(x)}
              >
                {x}
              </button>
            ))}
          </div>
        </div>

        <button
          className="primary checkout"
          disabled={!props.cart.length}
          onClick={props.checkout}
        >
          <FileText size={18} /> Generate Invoice
        </button>
      </aside>
    </div>
  )
}

// ── Products (Inventory Management - Admin Only) ──────────────────────────────

function Products({
  products,
  setProducts,
}: {
  products: Product[]
  setProducts: Dispatch<SetStateAction<Product[]>>
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [barcode, setBarcode] = useState('')

  const saveProduct = async () => {
    const newProduct: Product = {
      id: Date.now(),
      name,
      sku: barcode || `CEN-${Date.now().toString().slice(-4)}`,
      barcode: barcode || undefined,
      category: 'General',
      price: Number(price),
      stock: 10,
      gst: 18,
    }

    setProducts(x => [...x, newProduct])

    if (isSupabaseConfigured) {
      try {
        await supabase.from('products').insert({
          name: newProduct.name,
          sku: newProduct.sku,
          barcode: newProduct.barcode,
          category: newProduct.category,
          price: newProduct.price,
          stock: newProduct.stock,
          gst: newProduct.gst,
        })
      } catch (err) {
        console.warn('Failed to insert product in Supabase:', err)
      }
    }

    setName('')
    setPrice('')
    setBarcode('')
    setOpen(false)
  }

  const deleteProduct = async (id: number) => {
    setProducts(x => x.filter(i => i.id !== id))

    if (isSupabaseConfigured) {
      try {
        await supabase.from('products').delete().eq('id', id)
      } catch (err) {
        console.warn('Failed to delete product in Supabase:', err)
      }
    }
  }

  return (
    <div className="page">
      <div className="card">
        <div className="sectionTop">
          <div>
            <h3>Product Catalogue & Inventory</h3>
            <p>Manage prices, stock, GST rates and barcode scanner codes.</p>
          </div>
          <button className="primary" onClick={() => setOpen(true)}>
            <Plus size={17} /> Add Product
          </button>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Product</th><th>SKU</th><th>Barcode</th><th>Category</th>
                <th>Price</th><th>GST</th><th>Stock</th><th></th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td><b>{p.name}</b></td>
                  <td>{p.sku}</td>
                  <td>{p.barcode ?? '—'}</td>
                  <td>{p.category}</td>
                  <td>{money(p.price)}</td>
                  <td>{p.gst}%</td>
                  <td><span className={p.stock < 10 ? 'stock low' : 'stock'}>{p.stock}</span></td>
                  <td>
                    <button
                      className="iconBtn"
                      onClick={() => deleteProduct(p.id)}
                      aria-label="Delete Product"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="modalOverlay">
          <div className="modal">
            <div className="modalHead">
              <div>
                <h3>Add Product</h3>
                <p>Create a catalogue item with its barcode.</p>
              </div>
              <button onClick={() => setOpen(false)}><X /></button>
            </div>
            <input placeholder="Product name" value={name} onChange={e => setName(e.target.value)} />
            <input placeholder="SKU / Barcode" value={barcode} onChange={e => setBarcode(e.target.value)} />
            <input placeholder="Price" type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} />
            <button className="primary full" disabled={!name || !price} onClick={saveProduct}>
              Save Product
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Customers (Admin Only) ───────────────────────────────────────────────────

function Customers({ bills }: { bills: Bill[] }) {
  const customers = Array.from(new Map(bills.map(b => [b.customer, b])).values())
  return (
    <div className="page">
      <div className="card">
        <div className="sectionTop">
          <div>
            <h3>Customer Profiles</h3>
            <p>Customer accounts and billing history.</p>
          </div>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr><th>Customer</th><th>Phone</th><th>Last Invoice</th><th>Last Purchase</th></tr>
            </thead>
            <tbody>
              {customers.map(b => (
                <tr key={b.customer}>
                  <td><b>{b.customer}</b></td>
                  <td>{b.phone || '—'}</td>
                  <td>{b.invoice}</td>
                  <td>{money(b.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Reports (Admin Only) ──────────────────────────────────────────────────────

function Reports({ bills }: { bills: Bill[] }) {
  const sales = bills.reduce((s, b) => s + b.total, 0)
  return (
    <div className="page">
      <div className="stats">
        <Stat icon={CircleDollarSign} label="Gross Sales"      value={money(sales)}        delta="All recorded transactions" />
        <Stat icon={FileText}         label="Invoices"          value={String(bills.length)} delta="Successful transactions" />
        <Stat
          icon={ShoppingCart}
          label="UPI / Cash / Card"
          value={`${bills.filter(b => b.payment === 'UPI').length} / ${bills.filter(b => b.payment === 'Cash').length} / ${bills.filter(b => b.payment === 'Card').length}`}
          delta="Payment mix"
        />
      </div>
      <div className="card">
        <div className="sectionTop">
          <div>
            <h3>Sales & Transaction Report</h3>
            <p>Detailed invoice logs stored in Supabase.</p>
          </div>
          <button className="primary" onClick={() => window.print()}>
            <Printer size={17} /> Print Report
          </button>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Payment</th><th>Total</th></tr>
            </thead>
            <tbody>
              {bills.map(b => (
                <tr key={b.id}>
                  <td>{b.invoice}</td>
                  <td>{b.customer}</td>
                  <td>{b.date}</td>
                  <td>{b.payment}</td>
                  <td><b>{money(b.total)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Settings (Admin Only) ────────────────────────────────────────────────────

function SettingsPage() {
  return (
    <div className="page">
      <div className="card settingsCard">
        <div className="companyProfileHeader">
          <img src="/cenexa-logo.png" alt="Cenexa Systems Logo" className="companyProfileLogo" />
          <div className="companyProfileInfo">
            <h2>{COMPANY_DETAILS.name}</h2>
            <div className="person">{COMPANY_DETAILS.proprietor}</div>
            <p>{COMPANY_DETAILS.tagline}</p>
          </div>
        </div>

        <div className="settingRow">
          <span>Company name</span>
          <b>{COMPANY_DETAILS.name}</b>
        </div>
        <div className="settingRow">
          <span>Proprietor / Contact</span>
          <b>{COMPANY_DETAILS.proprietor}</b>
        </div>
        <div className="settingRow">
          <span>Phone Numbers</span>
          <b>{COMPANY_DETAILS.phone1} / {COMPANY_DETAILS.phone2} (WhatsApp)</b>
        </div>
        <div className="settingRow">
          <span>Email Address</span>
          <b>{COMPANY_DETAILS.email}</b>
        </div>
        <div className="settingRow">
          <span>Office Address</span>
          <b>{COMPANY_DETAILS.address}</b>
        </div>
        <div className="settingRow">
          <span>Services</span>
          <b>{COMPANY_DETAILS.services.join(' • ')}</b>
        </div>
        <div className="settingRow">
          <span>Database Mode</span>
          <b>{isSupabaseConfigured ? '🟢 Supabase Cloud Database Connected' : '🟡 Local / Standby Mode (Set keys in .env)'}</b>
        </div>
        <div className="settingRow">
          <span>Currency</span>
          <b>{COMPANY_DETAILS.currency}</b>
        </div>

        <div className="businessCardPreview">
          <img src="/cenexa-card.png" alt="Cenexa Systems Official Business Card" className="businessCardImg" />
        </div>
      </div>
    </div>
  )
}

// ── Invoice Modal with Dual View: Full Tax Invoice & POS Thermal Receipt ───────

function InvoiceModal({ bill, close }: { bill: Bill; close: () => void }) {
  const [viewMode, setViewMode] = useState<'full' | 'receipt'>('full')

  const handlePrint = (mode: 'receipt' | 'invoice') => {
    const originalTitle = document.title
    const safeCustomer = (bill.customer || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_')

    if (mode === 'receipt') {
      document.title = `Receipt_${bill.invoice}`
      document.body.classList.add('printing-receipt')
      document.body.classList.remove('printing-invoice')
    } else {
      document.title = `${bill.invoice}_${safeCustomer}_Tax_Invoice_Cenexa_Systems`
      document.body.classList.add('printing-invoice')
      document.body.classList.remove('printing-receipt')
    }

    setTimeout(() => {
      window.print()
    }, 50)

    const restore = () => {
      document.title = originalTitle
      document.body.classList.remove('printing-receipt')
      document.body.classList.remove('printing-invoice')
      window.removeEventListener('afterprint', restore)
    }

    window.addEventListener('afterprint', restore)
  }

  return (
    <div className="modalOverlay invoiceModalOverlay">
      <div className="invoiceModalContainer">
        {/* Modal Navigation Switcher: Toggle Preview */}
        <div className="receiptTabSwitcher">
          <div className="tabBtnGroup">
            <button
              className={`tabBtn ${viewMode === 'full' ? 'active' : ''}`}
              onClick={() => setViewMode('full')}
            >
              <FileText size={14} /> Full Tax Invoice (A4)
            </button>
            <button
              className={`tabBtn ${viewMode === 'receipt' ? 'active' : ''}`}
              onClick={() => setViewMode('receipt')}
            >
              <Receipt size={14} /> Thermal POS Receipt
            </button>
          </div>
          <button className="invoiceCloseBtn" onClick={close} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* ── 1. FULL TAX INVOICE (A4) ─────────────────────────────────── */}
        <div className="fullInvoice" style={{ display: viewMode === 'full' ? 'block' : 'none' }}>
          <div className="invoiceHeaderSection">
            <div className="invoiceCompanyBrand">
              <img src="/cenexa-logo.png" alt="Cenexa Systems Logo" className="invoiceLogoImg" />
              <div>
                <h2 className="invoiceCompanyName">{COMPANY_DETAILS.name}</h2>
                <div className="invoiceCompanyPerson">{COMPANY_DETAILS.proprietor}</div>
                <div className="invoiceCompanyContact">
                  <span>
                    <Phone size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                    {COMPANY_DETAILS.phone1} | {COMPANY_DETAILS.phone2}
                  </span>
                  <span>
                    <Mail size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                    {COMPANY_DETAILS.email}
                  </span>
                  <span>
                    <MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                    {COMPANY_DETAILS.address}
                  </span>
                </div>
              </div>
            </div>

            <div className="invoiceBadgeArea">
              <div className="invoiceTypeTitle">TAX INVOICE</div>
              <div className="paidBadge">PAID</div>
            </div>
          </div>

          {/* Invoice Meta Grid */}
          <div className="invoiceMetaGrid">
            <div className="invoiceMetaBlock">
              <span>Bill To (Customer)</span>
              <b>{bill.customer}</b>
              <small>{bill.phone ? `Phone: ${bill.phone}` : 'Walk-in customer'}</small>
            </div>
            <div className="invoiceMetaBlock">
              <span>Invoice Details</span>
              <b>{bill.invoice}</b>
              <small>Date: {bill.date} · Mode: {bill.payment}</small>
            </div>
          </div>

          {/* Line Items Table */}
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item Description</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>GST %</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {bill.items.map((i, idx) => (
                <tr key={i.id}>
                  <td>{idx + 1}</td>
                  <td>
                    <b>{i.name}</b>
                    <small style={{ display: 'block', color: '#64748b', fontSize: '10px' }}>
                      {i.sku} {i.barcode ? `· Barcode: ${i.barcode}` : ''}
                    </small>
                  </td>
                  <td>{i.qty}</td>
                  <td>{money(i.price)}</td>
                  <td>{i.gst}%</td>
                  <td style={{ textAlign: 'right' }}>{money(i.qty * i.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals Section */}
          <div className="invoiceTotal">
            <div><span>Subtotal</span><b>{money(bill.subtotal)}</b></div>
            {bill.discount > 0 && (
              <div><span>Discount</span><b>-{money(bill.discount)}</b></div>
            )}
            <div><span>GST</span><b>{money(bill.gst)}</b></div>
            <div className="final">
              <span>Total Amount</span>
              <strong>{money(bill.total)}</strong>
            </div>
          </div>

          {/* Company Footer with Services & Address */}
          <div className="invoiceCompanyFooter">
            <div className="invoiceServicesPills">
              {COMPANY_DETAILS.services.map(s => (
                <span key={s} className="invoiceServiceTag">{s}</span>
              ))}
            </div>
            <div className="invoiceAddressNote">
              {COMPANY_DETAILS.address}
            </div>
            <div className="invoiceThanks">
              Thank you for doing business with {COMPANY_DETAILS.name}!
            </div>
          </div>
        </div>

        {/* ── 2. THERMAL POS RECEIPT LAYOUT ────────────────────────────── */}
        <div className="thermalReceipt" style={{ display: viewMode === 'receipt' ? 'block' : 'none' }}>
          <div className="posHeader">
            <div className="posTitle">{COMPANY_DETAILS.name}</div>
            <div className="posSub">Digital Solutions & Retail Systems</div>
            <div className="posContact">Prop: {COMPANY_DETAILS.proprietor}</div>
            <div className="posContact">Ph: {COMPANY_DETAILS.phone1} / {COMPANY_DETAILS.phone2}</div>
            <div className="posContact">{COMPANY_DETAILS.address}</div>
          </div>

          <div className="posDivider">----------------------------------------</div>
          <div className="posReceiptTag">TAX INVOICE / POS RECEIPT</div>
          <div className="posDivider">----------------------------------------</div>

          <div className="posMetaRow">
            <span>INVOICE :</span>
            <b>{bill.invoice}</b>
          </div>
          <div className="posMetaRow">
            <span>DATE    :</span>
            <span>{bill.date}</span>
          </div>
          <div className="posMetaRow">
            <span>CUSTOMER:</span>
            <b>{bill.customer}</b>
          </div>
          {bill.phone && (
            <div className="posMetaRow">
              <span>PHONE   :</span>
              <span>{bill.phone}</span>
            </div>
          )}
          <div className="posMetaRow">
            <span>PAYMENT :</span>
            <b>{bill.payment}</b>
          </div>

          <div className="posDivider">----------------------------------------</div>

          <div className="posTableHeader">
            <span className="posColItem">ITEM</span>
            <span className="posColQty">QTY</span>
            <span className="posColTotal">TOTAL</span>
          </div>
          <div className="posDivider">- - - - - - - - - - - - - - - - - - - - </div>

          <div className="posItemsList">
            {bill.items.map(i => (
              <div key={i.id} className="posItemBlock">
                <div className="posItemLine1">
                  <span className="posItemName">{i.name}</span>
                  <span className="posItemQty">{i.qty}</span>
                  <span className="posItemTotal">{money(i.price * i.qty)}</span>
                </div>
                <div className="posItemLine2">
                  {i.sku} · Rate: {money(i.price)} (GST {i.gst}%)
                </div>
              </div>
            ))}
          </div>

          <div className="posDivider">----------------------------------------</div>

          <div className="posTotals">
            <div className="posTotalRow">
              <span>SUBTOTAL:</span>
              <span>{money(bill.subtotal)}</span>
            </div>
            {bill.discount > 0 && (
              <div className="posTotalRow">
                <span>DISCOUNT:</span>
                <span>-{money(bill.discount)}</span>
              </div>
            )}
            <div className="posTotalRow">
              <span>TOTAL GST:</span>
              <span>{money(bill.gst)}</span>
            </div>
            <div className="posDividerDouble">========================================</div>
            <div className="posGrandTotalRow">
              <span>GRAND TOTAL:</span>
              <strong>{money(bill.total)}</strong>
            </div>
            <div className="posDividerDouble">========================================</div>
            <div className="posMetaRow" style={{ marginTop: 4 }}>
              <span>TOTAL ITEMS: {bill.items.length}</span>
              <span>TOTAL QTY: {bill.items.reduce((s, i) => s + i.qty, 0)}</span>
            </div>
          </div>

          <div className="posFooter">
            <div className="posDivider">----------------------------------------</div>
            <div className="posFooterTag">Web Apps • Automation • AI Tools</div>
            <div className="posFooterMsg">*** THANK YOU FOR YOUR VISIT! ***</div>
            <div className="posFooterMsg">*** PLEASE VISIT AGAIN ***</div>
            <div className="posDivider">========================================</div>
          </div>
        </div>

        {/* Action Buttons: Print Thermal Receipt vs Download Full PDF */}
        <div className="invoiceActions">
          <button className="primary" onClick={() => handlePrint('receipt')}>
            <Printer size={16} /> Print Receipt (POS Thermal)
          </button>
          <button className="secondaryBtn" onClick={() => handlePrint('invoice')}>
            <Download size={16} /> Download PDF (Full Invoice)
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
