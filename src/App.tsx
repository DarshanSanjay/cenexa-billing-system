import { useMemo, useState } from 'react'
import { BarChart3, Bell, Boxes, Camera, ChevronRight, CircleDollarSign, FileText, LayoutDashboard, LogOut, Plus, Printer, Search, Settings, ShoppingCart, Trash2, Users, X } from 'lucide-react'
import BarcodeScanner, { ScanPayload } from './components/BarcodeScanner'

type Product = { id:number; name:string; sku:string; barcode?:string; category:string; price:number; stock:number; gst:number }
type BillItem = Product & { qty:number }
type Bill = { id:number; invoice:string; customer:string; phone:string; date:string; items:BillItem[]; subtotal:number; discount:number; gst:number; total:number; payment:string }

const seedProducts: Product[] = [
 {id:1,name:'Premium A4 Paper',sku:'PAP-001',barcode:'PAP-001',category:'Stationery',price:320,stock:48,gst:18},
 {id:2,name:'Blue Ball Pen Pack',sku:'PEN-014',barcode:'PEN-014',category:'Stationery',price:120,stock:85,gst:12},
 {id:3,name:'Wireless Mouse',sku:'TEC-031',barcode:'TEC-031',category:'Electronics',price:650,stock:16,gst:18},
 {id:4,name:'USB-C Cable',sku:'TEC-044',barcode:'TEC-044',category:'Electronics',price:399,stock:27,gst:18},
 {id:5,name:'Notebook A5',sku:'NB-005',barcode:'NB-005',category:'Stationery',price:85,stock:7,gst:12},
 {id:6,name:'Office Stapler',sku:'OFF-011',barcode:'OFF-011',category:'Office',price:260,stock:11,gst:18},
]

const seedBills: Bill[] = [
 {id:1,invoice:'CEN-2026-0001',customer:'Arun Kumar',phone:'9876543210',date:'13 Sep 2026, 10:42 PM',items:[{...seedProducts[2],qty:1}],subtotal:650,discount:0,gst:117,total:767,payment:'UPI'},
 {id:2,invoice:'CEN-2026-0002',customer:'Priya Stores',phone:'9840012345',date:'13 Sep 2026, 04:18 PM',items:[{...seedProducts[0],qty:2},{...seedProducts[4],qty:4}],subtotal:980,discount:50,gst:170.4,total:1100.4,payment:'Card'},
 {id:3,invoice:'CEN-2026-0003',customer:'Walk-in Customer',phone:'',date:'12 Sep 2026, 06:20 PM',items:[{...seedProducts[1],qty:1},{...seedProducts[5],qty:1}],subtotal:380,discount:0,gst:43.2,total:423.2,payment:'Cash'},
]

const money=(n:number)=>`₹${n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`

function App(){
 const [page,setPage]=useState('dashboard')
 const [products,setProducts]=useState(seedProducts)
 const [bills,setBills]=useState(seedBills)
 const [query,setQuery]=useState('')
 const [cart,setCart]=useState<BillItem[]>([])
 const [customer,setCustomer]=useState('')
 const [phone,setPhone]=useState('')
 const [discount,setDiscount]=useState(0)
 const [payment,setPayment]=useState('UPI')
 const [invoiceOpen,setInvoiceOpen]=useState<Bill|null>(null)
 const [scannerOpen,setScannerOpen]=useState(false)
 const [scanMessage,setScanMessage]=useState('')

 const filteredProducts=useMemo(()=>products.filter(p=>`${p.name} ${p.sku} ${p.barcode||''} ${p.category}`.toLowerCase().includes(query.toLowerCase())),[products,query])
 const subtotal=cart.reduce((s,i)=>s+i.price*i.qty,0)
 const gst=cart.reduce((s,i)=>s+i.price*i.qty*i.gst/100,0)
 const total=Math.max(0,subtotal-discount+gst)

 const add=(p:Product)=>setCart(c=>{const f=c.find(i=>i.id===p.id); return f?c.map(i=>i.id===p.id?{...i,qty:i.qty+1}:i):[...c,{...p,qty:1}]})
 const remove=(id:number)=>setCart(c=>c.filter(i=>i.id!==id))
 const handleScan=(scan:ScanPayload)=>{
   const value=scan.value.trim().toLowerCase()
   const product=products.find(p=>[p.barcode,p.sku].filter(Boolean).some(code=>code!.toLowerCase()===value))
   if(product){ add(product); setScanMessage(`${product.name} added · ${scan.format}`) }
   else { setQuery(scan.value); setScanMessage(`No product matched ${scan.value}. Search results updated.`) }
 }
 const checkout=()=>{ if(!cart.length)return; const bill:Bill={id:Date.now(),invoice:`CEN-2026-${String(bills.length+1).padStart(4,'0')}`,customer:customer||'Walk-in Customer',phone,date:new Date().toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}),items:cart,subtotal,discount,gst,total,payment}; setBills(b=>[bill,...b]); setProducts(ps=>ps.map(p=>{const item=cart.find(i=>i.id===p.id);return item?{...p,stock:Math.max(0,p.stock-item.qty)}:p}));setInvoiceOpen(bill);setCart([]);setCustomer('');setPhone('');setDiscount(0);}
 const nav=[['dashboard','Dashboard',LayoutDashboard],['billing','New Bill',ShoppingCart],['products','Products',Boxes],['customers','Customers',Users],['reports','Reports',BarChart3],['settings','Settings',Settings]] as const
 return <div className="app">
   <aside className="sidebar"><div className="brand"><div className="logoMark">C</div><div><div className="brandName">Cenexa</div><div className="brandSub">Billing System</div></div></div>
   <div className="sideLabel">MAIN MENU</div><nav>{nav.map(([key,label,Icon])=><button key={key} className={page===key?'nav active':'nav'} onClick={()=>setPage(key)}><Icon size={19}/><span>{label}</span>{key==='billing'&&<span className="newBadge">NEW</span>}</button>)}</nav>
   <div className="sidebarBottom"><div className="miniCard"><Bell size={17}/><div><b>System Ready</b><span>All services operational</span></div></div><button className="nav"><LogOut size={18}/><span>Logout</span></button></div></aside>
   <main className="content"><header className="topbar"><div><div className="eyebrow">CENEXA / BUSINESS OPERATIONS</div><h1>{page==='dashboard'?'Dashboard':page==='billing'?'Create New Bill':page[0].toUpperCase()+page.slice(1)}</h1></div><div className="topActions"><div className="status"><span></span> Online</div><div className="avatar">D</div></div></header>
   {page==='dashboard'&&<Dashboard setPage={setPage} bills={bills} products={products}/>} 
   {page==='billing'&&<Billing products={filteredProducts} query={query} setQuery={setQuery} cart={cart} add={add} remove={remove} customer={customer} phone={phone} setCustomer={setCustomer} setPhone={setPhone} discount={discount} setDiscount={setDiscount} payment={payment} setPayment={setPayment} subtotal={subtotal} gst={gst} total={total} checkout={checkout} openScanner={()=>{setScanMessage('');setScannerOpen(true)}} scanMessage={scanMessage}/>} 
   {page==='products'&&<Products products={products} setProducts={setProducts}/>} 
   {page==='customers'&&<Customers bills={bills}/>} 
   {page==='reports'&&<Reports bills={bills}/>} 
   {page==='settings'&&<SettingsPage/>}
   {invoiceOpen&&<InvoiceModal bill={invoiceOpen} close={()=>setInvoiceOpen(null)}/>} 
   <BarcodeScanner open={scannerOpen} onClose={()=>setScannerOpen(false)} onDetected={handleScan}/>
 </main></div>
}

function Dashboard({setPage,bills,products}:{setPage:(p:string)=>void;bills:Bill[];products:Product[]}){ const sales=bills.reduce((s,b)=>s+b.total,0);const low=products.filter(p=>p.stock<10).length;return <div className="page"><div className="hero"><div><div className="heroKicker">Good evening</div><h2>Ready for today's business?</h2><p>Manage invoices, products and customer payments from one place.</p></div><button className="primary big" onClick={()=>setPage('billing')}><Plus size={18}/> Create New Bill</button></div>
 <div className="stats"><Stat icon={CircleDollarSign} label="Total Sales" value={money(sales)} delta="+12.8% this week"/><Stat icon={FileText} label="Invoices" value={String(bills.length)} delta="3 processed today"/><Stat icon={ShoppingCart} label="Average Bill" value={money(sales/bills.length)} delta="Healthy basket size"/><Stat icon={Boxes} label="Low Stock" value={String(low)} delta={low?'Attention required':'All good'} danger={!!low}/></div>
 <div className="grid2"><section className="card"><div className="cardHead"><div><h3>Recent Bills</h3><p>Latest transactions across Cenexa</p></div><button className="textBtn" onClick={()=>setPage('reports')}>View all <ChevronRight size={16}/></button></div><div className="tableWrap"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Payment</th><th>Total</th></tr></thead><tbody>{bills.slice(0,5).map(b=><tr key={b.id}><td><b>{b.invoice}</b></td><td>{b.customer}</td><td>{b.date}</td><td><span className="pill">{b.payment}</span></td><td><b>{money(b.total)}</b></td></tr>)}</tbody></table></div></section>
 <section className="card"><div className="cardHead"><div><h3>Inventory Snapshot</h3><p>Products that need attention</p></div><button className="textBtn" onClick={()=>setPage('products')}>Manage <ChevronRight size={16}/></button></div><div className="stockList">{products.slice().sort((a,b)=>a.stock-b.stock).slice(0,5).map(p=><div className="stockRow" key={p.id}><div className="productIcon">{p.name[0]}</div><div className="stockInfo"><b>{p.name}</b><span>{p.sku} · {p.category}</span></div><div className={p.stock<10?'stock low':'stock'}>{p.stock} left</div></div>)}</div></section></div>
 </div>}

function Stat({icon:Icon,label,value,delta,danger=false}:{icon:any;label:string;value:string;delta:string;danger?:boolean}){return <div className="stat"><div className="statIcon"><Icon size={20}/></div><div><span>{label}</span><strong>{value}</strong><small className={danger?'dangerText':''}>{delta}</small></div></div>}

function Billing(props:any){return <div className="billingLayout page"><section className="card productPane"><div className="sectionTop"><div><h3>Select Products</h3><p>Scan a retail barcode or search the catalogue.</p></div><div className="billingSearchRow"><div className="search"><Search size={17}/><input value={props.query} onChange={e=>props.setQuery(e.target.value)} placeholder="Search product, SKU or barcode..."/></div><button className="scanButton" onClick={props.openScanner}><Camera size={17}/> Scan</button></div></div>{props.scanMessage&&<div className="scanNotice">{props.scanMessage}</div>}<div className="productGrid">{props.products.map((p:Product)=><button className="productTile" key={p.id} onClick={()=>props.add(p)}><div className="tileIcon">{p.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div className="tileBody"><b>{p.name}</b><span>{p.sku} · {p.category}{p.barcode&&` · ${p.barcode}`}</span><strong>{money(p.price)}</strong></div><Plus className="tilePlus" size={18}/></button>)}{!props.products.length&&<div className="noProducts">No products found. Scan a barcode or check the product catalogue.</div>}</div></section>
 <aside className="card cartPane"><div className="cartHead"><div><h3>Current Invoice</h3><span>{props.cart.length} line item{props.cart.length===1?'':'s'}</span></div><div className="invoiceTag">DRAFT</div></div>
 <div className="customerFields"><input value={props.customer} onChange={e=>props.setCustomer(e.target.value)} placeholder="Customer name"/><input value={props.phone} onChange={e=>props.setPhone(e.target.value)} placeholder="Phone number" inputMode="tel"/></div>
 <div className="cartItems">{props.cart.length?<>{props.cart.map((i:BillItem)=><div className="cartItem" key={i.id}><div><b>{i.name}</b><span>{money(i.price)} × {i.qty}</span></div><strong>{money(i.price*i.qty)}</strong><button onClick={()=>props.remove(i.id)} aria-label={`Remove ${i.name}`}><Trash2 size={15}/></button></div>)}</>:<div className="empty"><ShoppingCart size={28}/><b>No items yet</b><span>Scan or select products to start the bill.</span></div>}</div>
 <div className="totals"><div><span>Subtotal</span><b>{money(props.subtotal)}</b></div><div><span>Discount</span><div className="discountBox"><span>₹</span><input type="number" min="0" value={props.discount||''} onChange={e=>props.setDiscount(Number(e.target.value)||0)}/></div></div><div><span>GST</span><b>{money(props.gst)}</b></div><div className="grand"><span>Total</span><strong>{money(props.total)}</strong></div></div>
 <div className="payment"><span>Payment method</span><div className="payButtons">{['UPI','Cash','Card'].map((x)=><button key={x} className={props.payment===x?'selected':''} onClick={()=>props.setPayment(x)}>{x}</button>)}</div></div>
 <button className="primary checkout" disabled={!props.cart.length} onClick={props.checkout}><FileText size={18}/> Generate Invoice</button></aside></div>}

function Products({products,setProducts}:{products:Product[];setProducts:any}){const [open,setOpen]=useState(false);const [name,setName]=useState('');const [price,setPrice]=useState('');const [barcode,setBarcode]=useState('');return <div className="page"><div className="card"><div className="sectionTop"><div><h3>Product Catalogue</h3><p>Manage prices, stock, GST and scan codes.</p></div><button className="primary" onClick={()=>setOpen(true)}><Plus size={17}/> Add Product</button></div><div className="tableWrap"><table><thead><tr><th>Product</th><th>SKU</th><th>Barcode</th><th>Category</th><th>Price</th><th>GST</th><th>Stock</th><th></th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td><b>{p.name}</b></td><td>{p.sku}</td><td>{p.barcode||'—'}</td><td>{p.category}</td><td>{money(p.price)}</td><td>{p.gst}%</td><td><span className={p.stock<10?'stock low':'stock'}>{p.stock}</span></td><td><button className="iconBtn" onClick={()=>setProducts((x:Product[])=>x.filter(i=>i.id!==p.id))}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div></div>{open&&<div className="modalOverlay"><div className="modal"><div className="modalHead"><div><h3>Add Product</h3><p>Create a catalogue item with its barcode.</p></div><button onClick={()=>setOpen(false)}><X/></button></div><input placeholder="Product name" value={name} onChange={e=>setName(e.target.value)}/><input placeholder="SKU" value={barcode} onChange={e=>setBarcode(e.target.value)}/><input placeholder="Price" type="number" min="0" value={price} onChange={e=>setPrice(e.target.value)}/><button className="primary full" disabled={!name||!price} onClick={()=>{setProducts((x:Product[])=>[...x,{id:Date.now(),name,sku:barcode||`CEN-${Date.now().toString().slice(-4)}`,barcode:barcode||undefined,category:'General',price:Number(price),stock:0,gst:18}]);setName('');setPrice('');setBarcode('');setOpen(false)}}>Save Product</button></div></div>}</div>}

function Customers({bills}:{bills:Bill[]}){const customers=Array.from(new Map(bills.map(b=>[b.customer,b])).values());return <div className="page"><div className="card"><div className="sectionTop"><div><h3>Customers</h3><p>Customer profiles from billing activity.</p></div></div><div className="tableWrap"><table><thead><tr><th>Customer</th><th>Phone</th><th>Last Invoice</th><th>Last Purchase</th></tr></thead><tbody>{customers.map(b=><tr key={b.customer}><td><b>{b.customer}</b></td><td>{b.phone||'—'}</td><td>{b.invoice}</td><td>{money(b.total)}</td></tr>)}</tbody></table></div></div></div>}
function Reports({bills}:{bills:Bill[]}){const sales=bills.reduce((s,b)=>s+b.total,0);return <div className="page"><div className="stats"><Stat icon={CircleDollarSign} label="Gross Sales" value={money(sales)} delta="All recorded demo bills"/><Stat icon={FileText} label="Invoices" value={String(bills.length)} delta="Successful transactions"/><Stat icon={ShoppingCart} label="UPI / Cash / Card" value={`${bills.filter(b=>b.payment==='UPI').length} / ${bills.filter(b=>b.payment==='Cash').length} / ${bills.filter(b=>b.payment==='Card').length}`} delta="Payment mix"/></div><div className="card"><div className="sectionTop"><div><h3>Sales Report</h3><p>Invoice-level summary for the current demo dataset.</p></div><button className="primary" onClick={()=>window.print()}><Printer size={17}/> Print Report</button></div><div className="tableWrap"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Payment</th><th>Total</th></tr></thead><tbody>{bills.map(b=><tr key={b.id}><td>{b.invoice}</td><td>{b.customer}</td><td>{b.date}</td><td>{b.payment}</td><td><b>{money(b.total)}</b></td></tr>)}</tbody></table></div></div></div>}
function SettingsPage(){return <div className="page"><div className="card settingsCard"><Settings size={32}/><h3>Cenexa Configuration</h3><p>Company profile, invoice preferences, taxes and user permissions can live here in the production version.</p><div className="settingRow"><span>Company name</span><b>Cenexa</b></div><div className="settingRow"><span>Invoice prefix</span><b>CEN</b></div><div className="settingRow"><span>Currency</span><b>Indian Rupee (₹)</b></div><div className="settingRow"><span>Barcode scanner</span><b>Camera + manual fallback</b></div></div></div>}
function InvoiceModal({bill,close}:{bill:Bill;close:()=>void}){return <div className="modalOverlay"><div className="invoice"><div className="invoiceTop"><div><div className="invoiceLogo">C</div><div><b>Cenexa</b><span>Billing System</span></div></div><button onClick={close}><X/></button></div><div className="invoiceTitle"><div><span>TAX INVOICE</span><h2>{bill.invoice}</h2></div><div className="paid">PAID</div></div><div className="invoiceMeta"><div><span>Bill To</span><b>{bill.customer}</b><small>{bill.phone||'Phone not provided'}</small></div><div><span>Date</span><b>{bill.date}</b><small>Payment: {bill.payment}</small></div></div><table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{bill.items.map(i=><tr key={i.id}><td>{i.name}</td><td>{i.qty}</td><td>{money(i.price)}</td><td>{money(i.qty*i.price)}</td></tr>)}</tbody></table><div className="invoiceTotal"><div><span>Subtotal</span><b>{money(bill.subtotal)}</b></div><div><span>Discount</span><b>-{money(bill.discount)}</b></div><div><span>GST</span><b>{money(bill.gst)}</b></div><div className="final"><span>Total</span><strong>{money(bill.total)}</strong></div></div><div className="invoiceFoot">Thank you for doing business with Cenexa.</div><button className="primary full" onClick={()=>window.print()}><Printer size={17}/> Print Invoice</button></div></div>}

export default App
