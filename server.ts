import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const getFilename = () => {
  if (typeof import.meta !== "undefined" && import.meta.url) {
    return fileURLToPath(import.meta.url);
  }
  if (typeof module !== "undefined" && module.filename) {
    return module.filename;
  }
  return "";
};

const getDirname = () => {
  const fn = getFilename();
  if (fn) {
    return path.dirname(fn);
  }
  if (typeof __dirname !== "undefined") {
    return __dirname;
  }
  return "";
};

const __filename = getFilename();
const __dirname = getDirname();

const db = new Database("erp.db");
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS skus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    price_per_case REAL,
    price_per_unit REAL,
    units_per_case INTEGER,
    cogs_per_case REAL,
    cogs_per_unit REAL,
    supplier_id INTEGER,
    gst_rate REAL DEFAULT 18,
    is_third_schedule INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku_id INTEGER,
    batch_number TEXT,
    expiry_date TEXT,
    quantity_cases INTEGER,
    quantity_units INTEGER,
    sync_status TEXT DEFAULT 'synced',
    server_timestamp TEXT,
    FOREIGN KEY(sku_id) REFERENCES skus(id)
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    shop_name TEXT,
    route TEXT,
    territory TEXT,
    contact TEXT,
    is_filer INTEGER DEFAULT 0,
    credit_limit REAL DEFAULT 0,
    discount_pc REAL DEFAULT 0,
    balance REAL DEFAULT 0,
    lat REAL,
    lng REAL
  );`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      territory TEXT,
      assigned_days TEXT,
      salesman_id INTEGER,
      driver_id INTEGER,
      isActive INTEGER DEFAULT 1,
      FOREIGN KEY(salesman_id) REFERENCES employees(id),
      FOREIGN KEY(driver_id) REFERENCES employees(id)
    );
  `);

  try {
    db.prepare("ALTER TABLE customers ADD COLUMN shop_name TEXT").run();
  } catch (e) {
    // Column might already exist
  }

  try {
    db.prepare("ALTER TABLE customers ADD COLUMN isActive INTEGER DEFAULT 1").run();
  } catch (e) {
    // Column might already exist
  }

  try {
    db.prepare("ALTER TABLE skus ADD COLUMN isActive INTEGER DEFAULT 1").run();
  } catch (e) {
    // Column might already exist
  }

  try {
    db.prepare("ALTER TABLE employees ADD COLUMN isActive INTEGER DEFAULT 1").run();
  } catch (e) {
    // Column might already exist
  }

  db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT, -- Salesman, Deliveryman, Driver, Office Boy, Accountant, etc
    contact TEXT,
    agreement_accepted INTEGER DEFAULT 0,
    agreement_timestamp TEXT,
    device_id TEXT,
    base_salary REAL DEFAULT 0,
    commission_pc REAL DEFAULT 0,
    food_allowance REAL DEFAULT 0,
    working_days INTEGER DEFAULT 26,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS salesmen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    target_threshold REAL,
    FOREIGN KEY(employee_id) REFERENCES employees(id)
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    type TEXT, -- Asset, Liability, Equity, Income, Expense
    parent_id INTEGER,
    balance REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_no TEXT UNIQUE,
    type TEXT, -- CPV, BPV, CRV, BRV, JV
    date TEXT DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    status TEXT DEFAULT 'posted'
  );

  CREATE TABLE IF NOT EXISTS voucher_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_id INTEGER,
    account_id INTEGER,
    debit REAL DEFAULT 0,
    credit REAL DEFAULT 0,
    FOREIGN KEY(voucher_id) REFERENCES vouchers(id),
    FOREIGN KEY(account_id) REFERENCES accounts(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    salesman_id INTEGER,
    driver_id INTEGER,
    order_date TEXT DEFAULT CURRENT_TIMESTAMP,
    total_amount REAL,
    tax_amount REAL DEFAULT 0,
    further_tax REAL DEFAULT 0,
    is_paid INTEGER DEFAULT 0,
    is_dummy INTEGER DEFAULT 0,
    delivery_status TEXT DEFAULT 'pending', -- 'pending', 'dispatched', 'delivered'
    sync_status TEXT DEFAULT 'synced',
    FOREIGN KEY(customer_id) REFERENCES customers(id),
    FOREIGN KEY(salesman_id) REFERENCES salesmen(id),
    FOREIGN KEY(driver_id) REFERENCES employees(id)
  );

  CREATE TABLE IF NOT EXISTS route_settlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    salesman_id INTEGER,
    date TEXT DEFAULT CURRENT_TIMESTAMP,
    stock_issued_val REAL,
    returns_val REAL,
    booked_val REAL,
    cash_recovered REAL,
    variance REAL,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY(salesman_id) REFERENCES salesmen(id)
  );

  CREATE TABLE IF NOT EXISTS salesman_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    salesman_id INTEGER,
    customer_id INTEGER,
    interaction_date TEXT DEFAULT CURRENT_TIMESTAMP,
    type TEXT,
    notes TEXT,
    status TEXT DEFAULT 'completed',
    FOREIGN KEY(salesman_id) REFERENCES salesmen(id),
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    sku_id INTEGER,
    cases INTEGER,
    units INTEGER,
    price REAL,
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(sku_id) REFERENCES skus(id)
  );

  CREATE TABLE IF NOT EXISTS returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    sku_id INTEGER,
    type TEXT, -- Damaged, Expired, Short
    quantity INTEGER,
    date TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id),
    FOREIGN KEY(sku_id) REFERENCES skus(id)
  );

  CREATE TABLE IF NOT EXISTS fleet (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_number TEXT UNIQUE,
    model TEXT,
    current_km INTEGER,
    last_service_km INTEGER
  );

  CREATE TABLE IF NOT EXISTS fleet_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER,
    type TEXT, -- Fuel, Oil, Tires, Brakes
    amount REAL,
    km_at_log INTEGER,
    date TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(vehicle_id) REFERENCES fleet(id)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT,
    amount REAL,
    category TEXT,
    payment_method TEXT,
    date TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS absences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    reason TEXT,
    deduction_amount REAL DEFAULT 0,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  );

  CREATE TABLE IF NOT EXISTS salary_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    month TEXT NOT NULL,
    payment_date TEXT DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'Paid',
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  );

  CREATE TABLE IF NOT EXISTS employee_loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    date TEXT DEFAULT CURRENT_TIMESTAMP,
    type TEXT NOT NULL, -- 'Loan' or 'Advance'
    status TEXT DEFAULT 'Pending', -- 'Pending', 'Active', 'Settled'
    description TEXT,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    category TEXT,
    balance REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER,
    sku_id INTEGER,
    batch_number TEXT,
    quantity INTEGER,
    type TEXT, -- Damage, Expiry, Leakage
    description TEXT,
    status TEXT DEFAULT 'pending', -- pending, sent, settled
    date TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (sku_id) REFERENCES skus(id)
  );

  CREATE TABLE IF NOT EXISTS supplier_ledgers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'Purchase' or 'Payment'
    amount REAL NOT NULL,
    date TEXT DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  );

  CREATE TABLE IF NOT EXISTS bank_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_name TEXT NOT NULL,
    account_number TEXT UNIQUE,
    account_title TEXT,
    balance REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS bank_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'Deposit' or 'Withdrawal'
    amount REAL NOT NULL,
    date TEXT DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    reference TEXT,
    FOREIGN KEY (account_id) REFERENCES bank_accounts(id)
  );

  CREATE TABLE IF NOT EXISTS counter_cash (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    balance REAL DEFAULT 0
  );

  INSERT OR IGNORE INTO counter_cash (id, balance) VALUES (1, 0);

  CREATE TABLE IF NOT EXISTS counter_cash_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'In' or 'Out'
    amount REAL NOT NULL,
    date TEXT DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    source TEXT -- 'Settlement', 'Deposit to Bank', etc.
  );

  CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    order_date TEXT NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Received', 'Cancelled'
    notes TEXT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id INTEGER NOT NULL,
    sku_id INTEGER NOT NULL,
    cases INTEGER NOT NULL,
    units INTEGER NOT NULL,
    price_per_case REAL NOT NULL,
    price_per_unit REAL NOT NULL,
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (sku_id) REFERENCES skus(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE,
    customer_id INTEGER NOT NULL,
    salesman_id INTEGER,
    route TEXT,
    invoice_date TEXT NOT NULL,
    subtotal REAL NOT NULL,
    discount_amount REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    total_amount REAL NOT NULL,
    previous_balance REAL DEFAULT 0,
    status TEXT DEFAULT 'Pending', -- 'Pending', 'Paid', 'Cancelled'
    payment_method TEXT DEFAULT 'Credit', -- 'Cash', 'Credit'
    is_consolidated INTEGER DEFAULT 0,
    is_batch_generated INTEGER DEFAULT 0,
    notes TEXT,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY(salesman_id) REFERENCES salesmen(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    sku_id INTEGER NOT NULL,
    cases INTEGER NOT NULL DEFAULT 0,
    units INTEGER NOT NULL DEFAULT 0,
    trade_price_per_case REAL NOT NULL,
    trade_price_per_unit REAL NOT NULL,
    retail_price REAL DEFAULT 0,
    discount_percentage REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    line_total REAL NOT NULL,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY(sku_id) REFERENCES skus(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS invoice_consolidated_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consolidated_invoice_id INTEGER NOT NULL,
    child_invoice_id INTEGER NOT NULL,
    FOREIGN KEY(consolidated_invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY(child_invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
  );

  INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sys_ready', '1');
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS roznamcha (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_no TEXT NOT NULL UNIQUE,
    entry_type TEXT NOT NULL,
    category TEXT NOT NULL,
    narration TEXT,
    debit REAL DEFAULT 0,
    credit REAL DEFAULT 0,
    employee_id INTEGER,
    customer_id INTEGER,
    photo_url TEXT,
    is_locked INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(employee_id) REFERENCES employees(id),
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS roznamcha_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    close_date TEXT NOT NULL UNIQUE,
    opening_balance REAL DEFAULT 0,
    total_cash_in REAL DEFAULT 0,
    total_cash_out REAL DEFAULT 0,
    closing_balance REAL DEFAULT 0,
    closed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    closed_by TEXT
  );
`);

// Run one-time updates only if not already done
const runMigrations = () => {
  const v1Status = db.prepare("SELECT value FROM app_settings WHERE key = 'migrations_v1'").get() as { value: string } | undefined;
  if (v1Status?.value !== 'done') {
    console.log('Running migration v1 (cleanup)...');
    db.transaction(() => {
      // One-time update requested by user: Set all credit limits to 1000 and fix capitalization
      db.prepare("UPDATE customers SET credit_limit = 1000").run();

      const customers = db.prepare("SELECT id, name, route FROM customers").all() as any[];
      const toTitleCase = (str: string) => str.toLowerCase().split(' ').map(word => Math.max(0, word.length) > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : '').join(' ');
      
      const stmt = db.prepare("UPDATE customers SET name = ?, route = ? WHERE id = ?");
      for (const row of customers) {
        stmt.run(toTitleCase(row.name || ''), toTitleCase(row.route || ''), row.id);
      }

      db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('migrations_v1', 'done')").run();
    })();
    console.log('Migration v1 complete.');
  }

  const v2Status = db.prepare("SELECT value FROM app_settings WHERE key = 'migrations_v2'").get() as { value: string } | undefined;
  if (v2Status?.value !== 'done') {
    console.log('Running migration v2 (inventory seed)...');
    
    const products = [
      { name: "SATT 40GM", price: 210, company: "Healthy Habits", group: "SATT" },
      { name: "SATT 20GM", price: 105, company: "Healthy Habits", group: "SATT" },
      { name: "SATT JAR 100GM", price: 530, company: "Healthy Habits", group: "SATT" },
      { name: "BESAN 1000GM", price: 300, company: "Healthy Habits", group: "FLOURS" },
      { name: "BESAN 500GM", price: 175, company: "Healthy Habits", group: "FLOURS" },
      { name: "CORN FLOUR 300GM", price: 115, company: "Healthy Habits", group: "FLOURS" },
      { name: "GINSENG BLACK 330ML", price: 250, company: "Volker Life", group: "Energy Drinks" },
      { name: "STIMULANT BLUE 330ML", price: 250, company: "Volker Life", group: "Energy Drinks" },
      { name: "MINT 330ML", price: 160, company: "Volker Life", group: "CSD" },
      { name: "PEACH S/F 330ML", price: 160, company: "Volker Life", group: "CSD" },
      { name: "POME 330ML", price: 160, company: "Volker Life", group: "CSD" },
      { name: "ZOR PI 1.5L", price: 65, company: "Volker Life", group: "ALKALINE Water" },
      { name: "ZOR PI 500ML", price: 32.5, company: "Volker Life", group: "ALKALINE Water" },
      { name: "ALOVERA GEL 100GM", price: 406.2, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "ALOVERA SHAMPOO 250ML", price: 473.97, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "ANTI LICE 100ML", price: 246.42, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "ANTI LICE 200ML", price: 369.63, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "ANTI-DANDRUFF SHAMPOO", price: 473.97, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "BABY BATH 200ML", price: 410.7, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "BABY LOTION", price: 410.7, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "BABY OIL 120 ML", price: 360.75, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "BABY OIL 200ML", price: 369.56, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "BABY POWDER 200GM", price: 492.84, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "BABY RASH CREAM", price: 123.21, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "BABY RASH POWDER 200GM", price: 410.7, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "BABY SHAMPOO 200ML", price: 410.7, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "BAMBOO SHAMPOO", price: 473.62, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "BODY SPRAY EDEN 120ML", price: 669.33, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "BODY SPRAY LUSH 120ML", price: 669.33, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "BODY SPRAY ROSE", price: 669.33, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "BODY WASH CHERRY BLOSSOM", price: 843.6, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "BODY WASH PLUM", price: 843.6, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "BODY WASH ROSE 400ML", price: 843.6, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "BODY WASH SEAWEED", price: 843.6, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "CRACK CREAM", price: 205.35, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "DAMAGE REPAIR SHAMPOO", price: 473.97, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "FACE WASH LEMON", price: 410.71, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "FACE WASH NEEM", price: 394.05, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "FACE WASH ORANGE", price: 410.7, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "FACE WASH ROSE", price: 410.7, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "FACEWASH SEA WEED", price: 410.7, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "FOOT CREAM 100ML", price: 533.91, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "ANTI HAIR FALL OIL 120ML", price: 490, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "HAND CREAM 100ML", price: 533.91, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "HAND WASH ALOEVERA", price: 426.24, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "HAND WASH LAVENDER", price: 426.24, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "HAND WASH ROSE", price: 426.24, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "HAND WASH SEAWEED", price: 426.24, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "HONEY LOTION 100ML", price: 288.6, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "HONEY LOTION 200ML", price: 381.78, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "PRICKLT HEAT POWDER", price: 369.63, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "ROSE WATER", price: 197.58, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "SEA WEED WHITENING", price: 184.26, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "SERUM HYDRATING ACID 2%", price: 1355.31, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "SERUM ILLUMINATING NIACINAMIDE", price: 1149.96, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "SERUM TEA TREE", price: 1273.17, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "SHINE LOCK SHAMPOO", price: 473.97, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "SUN BLOCK 100ML", price: 492.84, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "SUN BLOCK 25M", price: 205.35, company: "Herbion Naturals", group: "Cosmetic" },
      { name: "Jumbo Roll 1000 Sheets", price: 252, company: "ZAMS Group", group: "Tissues" },
      { name: "Jumbo Roll - 1500 Sheets", price: 457, company: "ZAMS Group", group: "Tissues" },
      { name: "Jumbo Roll - 600 Grams", price: 290, company: "ZAMS Group", group: "Tissues" },
      { name: "Jumbo Roll 500 Gm", price: 246, company: "ZAMS Group", group: "Tissues" },
      { name: "Luxury Facial Tissue 150P", price: 246, company: "ZAMS Group", group: "Tissues" },
      { name: "Luxury Facial Tissue 250P", price: 265, company: "ZAMS Group", group: "Tissues" },
      { name: "Luxury Premium 150 x 3 Ply", price: 302, company: "ZAMS Group", group: "Tissues" },
      { name: "Party Pack Pink 500 Sheets", price: 155, company: "ZAMS Group", group: "Tissues" },
      { name: "Party Pack White 500 Sheets", price: 190, company: "ZAMS Group", group: "Tissues" },
      { name: "Pop up Facial Tissue 150P", price: 141, company: "ZAMS Group", group: "Tissues" },
      { name: "Popup Premium 150 x 3 Ply", price: 190, company: "ZAMS Group", group: "Tissues" },
      { name: "Premium Kitchen Roll", price: 750, company: "ZAMS Group", group: "Tissues" },
      { name: "Premium Toilet Roll", price: 99, company: "ZAMS Group", group: "Tissues" },
      { name: "Single Toilet Roll", price: 55, company: "ZAMS Group", group: "Tissues" },
      { name: "Slim Premium 150 x 3 Ply", price: 129, company: "ZAMS Group", group: "Tissues" },
      { name: "Smart Soft Pack 100P", price: 120, company: "ZAMS Group", group: "Tissues" },
      { name: "Smart Premium 100 x 3 Ply", price: 237, company: "ZAMS Group", group: "Tissues" },
      { name: "Softo Slim 50 x 2 Ply", price: 86, company: "ZAMS Group", group: "Tissues" },
      { name: "Toilet Roll - Maxoo 10S", price: 98, company: "ZAMS Group", group: "Tissues" },
      { name: "Toilet Roll -Eco Pack Maxoo", price: 65, company: "ZAMS Group", group: "Tissues" },
      { name: "Toilet Roll -Eco Pack - White", price: 35, company: "ZAMS Group", group: "Tissues" },
      { name: "Toilet Roll-White10S", price: 50.8, company: "ZAMS Group", group: "Tissues" }
    ];

    db.transaction(() => {
      const insertSku = db.prepare(`
        INSERT INTO skus (name, category, price_per_unit, units_per_case, price_per_case, cogs_per_case, gst_rate)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const p of products) {
        const unitsPerCase = 12; // Default assumption
        const pricePerCase = p.price * unitsPerCase;
        const cogsPerCase = Math.round(pricePerCase * 0.7); // Estimate COGS
        insertSku.run(p.name, p.group, p.price, unitsPerCase, pricePerCase, cogsPerCase, 18);
      }
      
      db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('migrations_v2', 'done')").run();
    })();
    console.log(`Seeded ${products.length} inventory items.`);
  }

  const v3Status = db.prepare("SELECT value FROM app_settings WHERE key = 'migrations_v4'").get() as { value: string } | undefined;
  if (v3Status?.value !== 'done') {
    console.log('Running migration v4 (Cleaning up duplicate suppliers and linking)...');
    db.transaction(() => {
      // 1. Get all suppliers
      const allSuppliers = db.prepare("SELECT id, name FROM suppliers").all() as {id: number, name: string}[];
      const seenNames = new Map<string, number>();
      
      for (const s of allSuppliers) {
        const name = s.name.trim();
        if (seenNames.has(name)) {
          // Keep the first one, delete the duplicate and remap SKUs
          const originalId = seenNames.get(name)!;
          db.prepare("UPDATE skus SET supplier_id = ? WHERE supplier_id = ?").run(originalId, s.id);
          db.prepare("UPDATE supplier_ledgers SET supplier_id = ? WHERE supplier_id = ?").run(originalId, s.id);
          db.prepare("DELETE FROM suppliers WHERE id = ?").run(s.id);
        } else {
          seenNames.set(name, s.id);
        }
      }

      // 2. Ensure the 4 core ones exist if not there
      const coreSuppliers = [
        { name: "Healthy Habits", category: "General" },
        { name: "Volker Life Marketing Services", category: "Energy Drinks / CSD" },
        { name: "Herbion Naturals", category: "Cosmetic" },
        { name: "ZAMS Group", category: "Tissues" }
      ];

      const insertSup = db.prepare("INSERT INTO suppliers (name, category) VALUES (?, ?)");
      const supMap: Record<string, number> = {};

      for (const s of coreSuppliers) {
        let existing = db.prepare("SELECT id FROM suppliers WHERE name = ?").get(s.name) as {id: number} | undefined;
        if (!existing) {
          const info = insertSup.run(s.name, s.category);
          supMap[s.name] = info.lastInsertRowid as number;
        } else {
          supMap[s.name] = existing.id;
        }
      }

      // Link categories to these suppliers if not linked
      db.prepare("UPDATE skus SET supplier_id = ? WHERE supplier_id IS NULL AND category IN ('SATT', 'FLOURS')").run(supMap["Healthy Habits"]);
      db.prepare("UPDATE skus SET supplier_id = ? WHERE supplier_id IS NULL AND category IN ('Energy Drinks', 'CSD', 'ALKALINE Water')").run(supMap["Volker Life Marketing Services"]);
      db.prepare("UPDATE skus SET supplier_id = ? WHERE supplier_id IS NULL AND category = 'Cosmetic'").run(supMap["Herbion Naturals"]);
      db.prepare("UPDATE skus SET supplier_id = ? WHERE supplier_id IS NULL AND category = 'Tissues'").run(supMap["ZAMS Group"]);

      db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('migrations_v4', 'done')").run();
    })();
    console.log('Migration v4 complete.');
  }
};
runMigrations();

  // Migrations / Ensure columns exist
  const tables = [
    { name: 'customers', col: 'balance', type: 'REAL DEFAULT 0' },
    { name: 'customers', col: 'discount_pc', type: 'REAL DEFAULT 0' },
    { name: 'suppliers', col: 'balance', type: 'REAL DEFAULT 0' },
    { name: 'bank_accounts', col: 'balance', type: 'REAL DEFAULT 0' },
    { name: 'counter_cash', col: 'balance', type: 'REAL DEFAULT 0' },
    { name: 'skus', col: 'cogs_per_unit', type: 'REAL DEFAULT 0' },
    { name: 'skus', col: 'supplier_id', type: 'INTEGER' },
    { name: 'skus', col: 'gst_rate', type: 'REAL DEFAULT 18' },
    { name: 'orders', col: 'driver_id', type: 'INTEGER' },
    { name: 'orders', col: 'delivery_status', type: "TEXT DEFAULT 'pending'" },
    { name: 'employees', col: 'food_allowance', type: 'REAL DEFAULT 0' },
    { name: 'employees', col: 'working_days', type: 'INTEGER DEFAULT 26' },
    { name: 'employees', col: 'status', type: "TEXT DEFAULT 'active'" }
  ];
  for (const table of tables) {
    try {
      const columns = db.prepare(`PRAGMA table_info(${table.name})`).all() as any[];
      if (!columns.find(c => c.name === table.col)) {
        db.prepare(`ALTER TABLE ${table.name} ADD COLUMN ${table.col} ${table.type}`).run();
      }
    } catch (e) {
      // Table might not exist yet, handled by schema init
    }
  }


  // Strict, auto-incrementing sequential ID system (Shortcodes) for the ERP MDM module
  console.log("[BOOT] Verifying structured sequential IDs for Products and Routes...");
  db.transaction(() => {
    // 1. Products: Seed/Verify Ginseng id=1 and Stimulant id=2
    const p1 = db.prepare("SELECT id, name FROM skus WHERE id = 1").get() as { id: number; name: string } | undefined;
    if (!p1) {
      db.prepare(`
        INSERT INTO skus (id, name, category, price_per_unit, units_per_case, price_per_case, cogs_per_unit, cogs_per_case, gst_rate, isActive)
        VALUES (1, 'Ginseng', 'Energy Drinks', 250, 12, 3000, 175, 2100, 18, 1)
      `).run();
      console.log("[SEED] Assigned SKU ID 1 to 'Ginseng'");
    } else if (p1.name !== 'Ginseng') {
      db.prepare("UPDATE skus SET name = 'Ginseng' WHERE id = 1").run();
      console.log("[SEED] Updated SKU ID 1 to 'Ginseng'");
    }

    const p2 = db.prepare("SELECT id, name FROM skus WHERE id = 2").get() as { id: number; name: string } | undefined;
    if (!p2) {
      db.prepare(`
        INSERT INTO skus (id, name, category, price_per_unit, units_per_case, price_per_case, cogs_per_unit, cogs_per_case, gst_rate, isActive)
        VALUES (2, 'Stimulant', 'Energy Drinks', 250, 12, 3000, 175, 2100, 18, 1)
      `).run();
      console.log("[SEED] Assigned SKU ID 2 to 'Stimulant'");
    } else if (p2.name !== 'Stimulant') {
      db.prepare("UPDATE skus SET name = 'Stimulant' WHERE id = 2").run();
      console.log("[SEED] Updated SKU ID 2 to 'Stimulant'");
    }

    // 2. Routes: Seed/Verify Mingora id=1 and Khwazakhela id=2
    const r1 = db.prepare("SELECT id, name FROM routes WHERE id = 1").get() as { id: number; name: string } | undefined;
    if (!r1) {
      db.prepare(`
        INSERT INTO routes (id, name, territory, assigned_days, isActive)
        VALUES (1, 'Mingora', 'Mingora Valley', 'Monday,Wednesday,Friday', 1)
      `).run();
      console.log("[SEED] Assigned Route ID 1 to 'Mingora'");
    } else if (r1.name !== 'Mingora') {
      db.prepare("UPDATE routes SET name = 'Mingora' WHERE id = 1").run();
      console.log("[SEED] Updated Route ID 1 to 'Mingora'");
    }

    const r2 = db.prepare("SELECT id, name FROM routes WHERE id = 2").get() as { id: number; name: string } | undefined;
    if (!r2) {
      db.prepare(`
        INSERT INTO routes (id, name, territory, assigned_days, isActive)
        VALUES (2, 'Khwazakhela', 'Khwazakhela District', 'Tuesday,Thursday,Saturday', 1)
      `).run();
      console.log("[SEED] Assigned Route ID 2 to 'Khwazakhela'");
    } else if (r2.name !== 'Khwazakhela') {
      db.prepare("UPDATE routes SET name = 'Khwazakhela' WHERE id = 2").run();
      console.log("[SEED] Updated Route ID 2 to 'Khwazakhela'");
    }
  })();

  // Seed some data if completely empty
  const employeeCountRow = db.prepare("SELECT count(*) as count FROM employees").get() as { count: number };
  const customerCountRow = db.prepare("SELECT count(*) as count FROM customers").get() as { count: number };
  
  console.log(`[BOOT] Database Status: ${customerCountRow.count} Customers, ${employeeCountRow.count} Employees found.`);

  if (employeeCountRow.count === 0 && customerCountRow.count <= 2) {
    console.log("[BOOT] System empty. Seeding defaults...");
    
    // Clear default customers if only the sample ones exist to avoid duplicates
    if (customerCountRow.count > 0) {
       db.prepare("DELETE FROM customers WHERE id IN (1, 2)").run();
    }

    db.prepare(`INSERT INTO skus (name, category, price_per_case, price_per_unit, units_per_case, cogs_per_case, gst_rate) VALUES 
      ('ZOR Energy 250ml', 'Energy Drink', 1200, 50, 24, 900, 18),
      ('Sparkling Water 500ml', 'Water', 800, 35, 24, 600, 18),
      ('Alkaline Water 1L', 'Water', 1000, 85, 12, 750, 18)
    `).run();

    db.prepare(`INSERT INTO customers (id, name, route, territory, contact, credit_limit, is_filer, discount_pc) VALUES 
      (1, 'Swat General Store', 'Main Bazaar', 'Mingora', '0312-1234567', 50000, 1, 2),
      (2, 'Kalam Valley Hotel', 'Kalam Rd', 'Kalam', '0312-7654321', 100000, 0, 0)
    `).run();

    const aliId = db.prepare(`INSERT INTO employees (name, role, base_salary, commission_pc) VALUES ('Ali Khan', 'Salesman', 35000, 2.5)`).run().lastInsertRowid;
    const zeeshanId = db.prepare(`INSERT INTO employees (name, role, base_salary, commission_pc) VALUES ('Zeeshan Ahmad', 'Salesman', 40000, 3.0)`).run().lastInsertRowid;

    db.prepare(`INSERT INTO salesmen (employee_id, target_threshold) VALUES (?, ?)`).run(aliId, 500000);
    db.prepare(`INSERT INTO salesmen (employee_id, target_threshold) VALUES (?, ?)`).run(zeeshanId, 700000);

    // Initialize CoA (Chart of Accounts)
    db.prepare(`INSERT INTO accounts (code, name, type) VALUES 
      ('1000', 'Cash in Hand', 'Asset'),
      ('1001', 'Bank Alfalah', 'Asset'),
      ('2000', 'Accounts Payable', 'Liability'),
      ('3000', 'Owners Equity', 'Equity'),
      ('4000', 'Sales Revenue', 'Income'),
      ('5000', 'Cost of Goods Sold', 'Expense'),
      ('5100', 'Fuel Expense', 'Expense')
    `).run();

    db.prepare(`INSERT INTO inventory (sku_id, batch_number, expiry_date, quantity_cases, quantity_units) VALUES 
      (1, 'BN-001', '2026-12-31', 50, 0),
      (1, 'BN-002', '2025-05-15', 10, 0),
      (2, 'BN-099', '2025-08-01', 100, 0),
      (3, 'BN-102', '2026-01-10', 25, 0)
    `).run();
  }

  // Seed Roznamcha records if the table is currently empty
  const roznamchaCountRow = db.prepare("SELECT count(*) as count FROM roznamcha").get() as { count: number };
  if (roznamchaCountRow.count === 0) {
    console.log("[BOOT] Roznamcha table is empty. Seeding yesterday's records...");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yyyy = yesterday.getFullYear();
    const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const dd = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayStr = `${yyyy}-${mm}-${dd}`;

    const seedRoznamcha = [
      {
        voucher_no: 'ROZ-00001',
        entry_type: 'Cash In',
        category: 'Opening Balance Correction',
        narration: 'Initial cash in hand opening balance setup',
        debit: 250000,
        credit: 0,
        is_locked: 1,
        created_at: `${yesterdayStr} 09:00:00`
      },
      {
        voucher_no: 'ROZ-00002',
        entry_type: 'Cash In',
        category: 'Sales Recovery',
        narration: 'Ref 0023 - Cash collection recovery Swat General Store',
        debit: 45000,
        credit: 0,
        customer_id: 1,
        is_locked: 1,
        created_at: `${yesterdayStr} 11:30:00`
      },
      {
        voucher_no: 'ROZ-00003',
        entry_type: 'Cash Out',
        category: 'Route Gas & Fuel',
        narration: 'Fuel tank allowance fill up for delivery truck Khyber-2',
        debit: 0,
        credit: 12500,
        employee_id: 1,
        is_locked: 1,
        created_at: `${yesterdayStr} 14:15:00`
      },
      {
        voucher_no: 'ROZ-00004',
        entry_type: 'Cash Out',
        category: 'Tolls & Taxes',
        narration: 'Motorway toll tax charges paid in cash',
        debit: 0,
        credit: 1500,
        employee_id: 1,
        is_locked: 1,
        created_at: `${yesterdayStr} 15:00:00`
      },
      {
        voucher_no: 'ROZ-00005',
        entry_type: 'Cash In',
        category: 'Sales Recovery',
        narration: 'Cash recovery received from Kalam Valley Hotel',
        debit: 35000,
        credit: 0,
        customer_id: 2,
        is_locked: 1,
        created_at: `${yesterdayStr} 17:30:00`
      }
    ];

    const insertStmt = db.prepare(`
      INSERT INTO roznamcha (voucher_no, entry_type, category, narration, debit, credit, employee_id, customer_id, is_locked, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of seedRoznamcha) {
      insertStmt.run(
        item.voucher_no,
        item.entry_type,
        item.category,
        item.narration,
        item.debit,
        item.credit,
        item.employee_id || null,
        item.customer_id || null,
        item.is_locked,
        item.created_at
      );
    }

    // Seed into roznamcha_days as well to match yesterday's lock state
    db.prepare(`
      INSERT OR REPLACE INTO roznamcha_days (close_date, opening_balance, total_cash_in, total_cash_out, closing_balance, closed_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      yesterdayStr,
      250000,
      80000,
      14000,
      316000,
      'System Admin'
    );
    console.log("[BOOT] Seeded Roznamcha yesterday entries and close-day log.");
  }

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Request logger
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
    });
    next();
  });

  // Global Error Handler for API
  app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`API Error at ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  // API Routes
  // --- ROZNAMCHA ENDPOINTS & HELPERS ---
  function insertRoznamcha(entry: {
    entry_type: string;
    category: string;
    narration: string;
    debit: number;
    credit: number;
    employee_id?: number | null;
    customer_id?: number | null;
    photo_url?: string | null;
    created_at?: string;
  }) {
    const lastRow = db.prepare("SELECT id FROM roznamcha ORDER BY id DESC LIMIT 1").get() as any;
    const nextId = lastRow ? lastRow.id + 1 : 1;
    const voucher_no = "ROZ-" + String(nextId).padStart(5, '0');

    db.prepare(`
      INSERT INTO roznamcha (voucher_no, entry_type, category, narration, debit, credit, employee_id, customer_id, photo_url, is_locked, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, COALESCE(?, datetime('now')))
    `).run(
      voucher_no,
      entry.entry_type,
      entry.category,
      entry.narration,
      entry.debit,
      entry.credit,
      entry.employee_id || null,
      entry.customer_id || null,
      entry.photo_url || null,
      entry.created_at || null
    );
  }

  app.get("/api/roznamcha", (req, res) => {
    try {
      // 1. Fetch entries log
      const entries = db.prepare(`
        SELECT r.*, e.name as employee_name, c.shop_name as customer_name
        FROM roznamcha r
        LEFT JOIN employees e ON r.employee_id = e.id
        LEFT JOIN customers c ON r.customer_id = c.id
        ORDER BY r.id ASC
      `).all() as any[];

      // 2. Calculate dynamic running balance in database sequence (id ASC)
      let currentBal = 0;
      const calculatedSeq = entries.map(row => {
        currentBal += (row.debit - row.credit);
        return {
          ...row,
          running_balance: currentBal
        };
      });

      // 3. Get open session metrics:
      // Opening Balance is sum of all historic locked entries:
      const openingBalRow = db.prepare("SELECT COALESCE(SUM(debit) - SUM(credit), 0) as balance FROM roznamcha WHERE is_locked = 1").get() as any;
      const openingBalance = openingBalRow ? openingBalRow.balance : 0;

      // Active day totals (unlocked transactions)
      const dayTotals = db.prepare(`
        SELECT 
          COALESCE(SUM(debit), 0) as total_cash_in,
          COALESCE(SUM(credit), 0) as total_cash_out
        FROM roznamcha 
        WHERE is_locked = 0
      `).get() as any;

      const totalCashIn = dayTotals ? dayTotals.total_cash_in : 0;
      const totalCashOut = dayTotals ? dayTotals.total_cash_out : 0;
      const closingBalance = openingBalance + totalCashIn - totalCashOut;

      res.json({
        entries: calculatedSeq.reverse(), // reverse to show latest at top in table, but keep balance running history correct
        summary: {
          opening_balance: openingBalance,
          total_cash_in: totalCashIn,
          total_cash_out: totalCashOut,
          closing_balance: closingBalance
        }
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/roznamcha", (req, res) => {
    const { entry_type, category, narration, debit, credit, employee_id, customer_id, photo_url, created_at } = req.body;
    try {
      insertRoznamcha({
        entry_type,
        category,
        narration,
        debit: Number(debit) || 0,
        credit: Number(credit) || 0,
        employee_id: employee_id ? Number(employee_id) : null,
        customer_id: customer_id ? Number(customer_id) : null,
        photo_url: photo_url || null,
        created_at
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/roznamcha/close-day", (req, res) => {
    const { closed_by } = req.body;
    try {
      db.transaction(() => {
        // Compute last state
        // Opening balance sum of existing locked
        const openingBalRow = db.prepare("SELECT COALESCE(SUM(debit) - SUM(credit), 0) as balance FROM roznamcha WHERE is_locked = 1").get() as any;
        const openingBalance = openingBalRow ? openingBalRow.balance : 0;

        const dayTotals = db.prepare(`
          SELECT 
            COALESCE(SUM(debit), 0) as total_cash_in,
            COALESCE(SUM(credit), 0) as total_cash_out
          FROM roznamcha 
          WHERE is_locked = 0
        `).get() as any;

        const totalCashIn = dayTotals ? dayTotals.total_cash_in : 0;
        const totalCashOut = dayTotals ? dayTotals.total_cash_out : 0;
        const closingBalance = openingBalance + totalCashIn - totalCashOut;

        const todayStr = new Date().toISOString().split('T')[0];

        // Insert into roznamcha_days
        db.prepare(`
          INSERT OR REPLACE INTO roznamcha_days (close_date, opening_balance, total_cash_in, total_cash_out, closing_balance, closed_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(todayStr, openingBalance, totalCashIn, totalCashOut, closingBalance, closed_by || 'Admin');

        // Lock all current entries
        db.prepare("UPDATE roznamcha SET is_locked = 1 WHERE is_locked = 0").run();
      })();

      res.json({ success: true, message: "Daybook successfully closed and locked." });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/invoices/:id/payment", (req, res) => {
    const { id } = req.params;
    const { remarks } = req.body;
    try {
      db.transaction(() => {
        const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id) as any;
        if (!invoice) throw new Error("Invoice not found");
        if (invoice.status === 'Paid') throw new Error("Invoice is already paid");

        db.prepare("UPDATE invoices SET status = 'Paid' WHERE id = ?").run(id);

        // Decrement/settle customer outstanding ledger if payment method was credit
        if (invoice.payment_method === 'Credit') {
          db.prepare("UPDATE customers SET balance = MAX(0, balance - ?) WHERE id = ?").run(invoice.total_amount, invoice.customer_id);
        }

        const customer = db.prepare("SELECT shop_name FROM customers WHERE id = ?").get(invoice.customer_id) as any;
        const shopName = customer ? customer.shop_name : 'Customer';
        const narration = `Auto-Recovery: Cash recovery registered for Invoice #${invoice.invoice_number} from ${shopName}. ${remarks || ''}`;

        insertRoznamcha({
          entry_type: 'Cash In',
          category: 'Sales Recovery',
          narration,
          debit: invoice.total_amount,
          credit: 0,
          employee_id: invoice.salesman_id,
          customer_id: invoice.customer_id
        });
      })();

      res.json({ success: true, message: "Invoice marked as paid and posted to Roznamcha." });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/skus", (req, res) => {
    const { name, category, price_per_case, price_per_unit, units_per_case, cogs_per_case, cogs_per_unit, gst_rate, supplier_id, isActive } = req.body;
    try {
      const info = db.prepare(`
        INSERT INTO skus (name, category, price_per_case, price_per_unit, units_per_case, cogs_per_case, cogs_per_unit, gst_rate, supplier_id, isActive)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name, category, price_per_case || 0, price_per_unit || 0, units_per_case || 12, cogs_per_case || 0, cogs_per_unit || 0, gst_rate || 18, supplier_id || null, isActive === undefined ? 1 : isActive);
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/skus", (req, res) => {
    try {
      const { activeOnly } = req.query;
      let queryStr = `
        SELECT s.*, 
               (SELECT name FROM suppliers WHERE id = s.supplier_id) as supplier_name,
               (SELECT SUM(quantity_cases) FROM inventory WHERE sku_id = s.id) as current_stock_cases,
               (SELECT SUM(quantity_units) FROM inventory WHERE sku_id = s.id) as current_stock_units
        FROM skus s
      `;
      if (activeOnly === 'true') {
        queryStr += " WHERE s.isActive = 1 OR s.isActive IS NULL";
      }
      const skus = db.prepare(queryStr).all();
      res.json(skus);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/skus/bulk", (req, res) => {
    const skus = req.body;
    if (!Array.isArray(skus)) {
      return res.status(400).json({ error: "Invalid data format. Expected an array." });
    }

    const insertSku = db.prepare(`
      INSERT INTO skus (name, category, price_per_case, price_per_unit, units_per_case, cogs_per_case, cogs_per_unit, supplier_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertInventory = db.prepare(`
      INSERT INTO inventory (sku_id, batch_number, expiry_date, quantity_cases, quantity_units)
      VALUES (?, ?, ?, ?, ?)
    `);

    const process = db.transaction((data) => {
      for (const s of data) {
        const info = insertSku.run(
          s.name, 
          s.category || 'General', 
          s.price_per_case || 0, 
          s.price_per_unit || 0, 
          s.units_per_case || 1, 
          s.cogs_per_case || 0,
          s.cogs_per_unit || 0,
          s.supplier_id ? parseInt(s.supplier_id.toString()) : null
        );
        
        const skuId = info.lastInsertRowid;

        // Create initial inventory record if batch info is provided
        if (s.initial_batch && s.initial_quantity > 0) {
          insertInventory.run(
            skuId,
            s.initial_batch,
            s.initial_expiry || null,
            0, // quantity_cases
            s.initial_quantity // quantity_units (pieces)
          );

          // Record purchase from supplier
          if (s.supplier_id) {
            const sid = parseInt(s.supplier_id.toString());
            const totalCost = s.initial_quantity * (s.cogs_per_unit || 0);
            if (totalCost > 0) {
              db.prepare("INSERT INTO supplier_ledgers (supplier_id, type, amount, description) VALUES (?, 'Purchase', ?, ?)")
                .run(sid, totalCost, `Initial stock for ${s.name} (${s.initial_quantity} pieces)`);
              db.prepare("UPDATE suppliers SET balance = balance + ? WHERE id = ?").run(totalCost, sid);
            }
          }
        }
      }
    });

    try {
      process(skus);
      res.json({ success: true, count: skus.length });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/inventory/receipt", (req, res) => {
    const { supplier_id, invoice_number, date, items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "Invalid items format." });
    }

    try {
      db.transaction(() => {
        const insertSku = db.prepare(`
          INSERT INTO skus (name, category, units_per_case, price_per_unit, price_per_case, cogs_per_unit, cogs_per_case, supplier_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertInventory = db.prepare(`
          INSERT INTO inventory (sku_id, batch_number, expiry_date, quantity_cases, quantity_units)
          VALUES (?, ?, ?, ?, ?)
        `);

        let totalReceiptValue = 0;

        for (const item of items) {
          let skuId = item.sku_id;

          // 1. Create SKU if it's new
          if (!skuId) {
            const info = insertSku.run(
              item.name,
              item.category || 'General',
              item.units_per_case || 1,
              item.price_per_unit || 0,
              (item.price_per_unit || 0) * (item.units_per_case || 1),
              item.cogs_per_unit || 0,
              (item.cogs_per_unit || 0) * (item.units_per_case || 1),
              supplier_id
            );
            skuId = info.lastInsertRowid;
          }

          // 2. Add to inventory
          insertInventory.run(
            skuId,
            item.batch_number || `INV-${invoice_number}`,
            item.expiry_date || null,
            0, // quantity_cases
            item.quantity_units || 0
          );

          // 3. Track value for ledger
          const lineValue = (item.quantity_units || 0) * (item.cogs_per_unit || 0);
          totalReceiptValue += lineValue;
        }

        // 4. Update Supplier Ledger & Balance
        if (supplier_id && totalReceiptValue > 0) {
          db.prepare("INSERT INTO supplier_ledgers (supplier_id, type, amount, date, description) VALUES (?, 'Purchase', ?, ?, ?)")
            .run(supplier_id, totalReceiptValue, date || new Date().toISOString(), `Receipt from Invoice #${invoice_number}`);
          db.prepare("UPDATE suppliers SET balance = balance + ? WHERE id = ?").run(totalReceiptValue, supplier_id);
        }
      })();

      res.json({ success: true });
    } catch (err) {
      console.error("Receipt error:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put("/api/skus/:id", (req, res) => {
    const { id } = req.params;
    const { name, category, price_per_case, price_per_unit, units_per_case, cogs_per_case, cogs_per_unit, gst_rate, supplier_id, isActive } = req.body;
    try {
      db.prepare(`
        UPDATE skus 
        SET name = ?, category = ?, price_per_case = ?, price_per_unit = ?, units_per_case = ?, cogs_per_case = ?, cogs_per_unit = ?, gst_rate = ?, supplier_id = ?, isActive = ?
        WHERE id = ?
      `).run(name, category, price_per_case, price_per_unit, units_per_case, cogs_per_case, cogs_per_unit, gst_rate || 18, supplier_id || null, isActive === undefined ? 1 : isActive, id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/customers", (req, res) => {
    const { activeOnly } = req.query;
    let qStr = "SELECT * FROM customers";
    if (activeOnly === 'true') {
      qStr += " WHERE isActive = 1 OR isActive IS NULL";
    }
    qStr += " ORDER BY name ASC";
    try {
      const customers = db.prepare(qStr).all();
      res.json(customers);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/customers", (req, res) => {
    const { name, shop_name, route, contact, credit_limit, discount_pc, isActive } = req.body;
    const toTitleCase = (str: string) => str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    try {
      const info = db.prepare("INSERT INTO customers (name, shop_name, route, contact, credit_limit, discount_pc, isActive) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
        toTitleCase(name), toTitleCase(shop_name || ""), toTitleCase(route), contact, credit_limit || 50000, discount_pc || 0, isActive === undefined ? 1 : isActive
      );
      res.json({ id: info.lastInsertRowid });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/customers/bulk", (req, res) => {
    const customers = req.body; // Expecting an array of objects
    if (!Array.isArray(customers)) {
      return res.status(400).json({ error: "Invalid data format. Expected an array." });
    }

    const toTitleCase = (str: any) => {
      if (!str) return "";
      return String(str)
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };

    const insert = db.prepare("INSERT INTO customers (name, shop_name, route, contact, credit_limit, discount_pc, isActive) VALUES (?, ?, ?, ?, ?, ?, 1)");
    const insertMany = db.transaction((data) => {
      for (const c of data) {
        if (!c.name) continue; 
        insert.run(
          toTitleCase(c.name), 
          toTitleCase(c.shop_name || ""),
          toTitleCase(c.route || ""), 
          c.contact || "", 
          c.credit_limit || 50000,
          c.discount_pc || 0
        );
      }
    });

    try {
      insertMany(customers);
      res.json({ success: true, count: customers.length });
    } catch (err) {
      console.error("Bulk Import Error:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put("/api/customers/:id", (req, res) => {
    const { id } = req.params;
    const { name, shop_name, route, contact, credit_limit, discount_pc, balance, isActive } = req.body;
    const toTitleCase = (str: string) => str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    try {
      db.prepare("UPDATE customers SET name = ?, shop_name = ?, route = ?, contact = ?, credit_limit = ?, discount_pc = ?, balance = ?, isActive = ? WHERE id = ?").run(
        toTitleCase(name), toTitleCase(shop_name || ""), toTitleCase(route), contact, credit_limit || 50000, discount_pc || 0, balance, isActive === undefined ? 1 : isActive, id
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete("/api/customers/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("UPDATE customers SET isActive = 0 WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete("/api/skus/:id", (req, res) => {
    const { id } = req.params;
    console.log(`Server: Request to soft delete SKU id=${id}`);
    try {
      db.prepare("UPDATE skus SET isActive = 0 WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (err) {
      console.error(`Server: Error soft deleting SKU ${id}:`, err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete("/api/suppliers/:id", (req, res) => {
    const { id } = req.params;
    console.log(`Server: Request to delete supplier id=${id}`);
    try {
      db.transaction(() => {
        // 1. Unlink SKUs from this supplier
        db.prepare("UPDATE skus SET supplier_id = NULL WHERE supplier_id = ?").run(id);
        // 2. Delete ledger history
        db.prepare("DELETE FROM supplier_ledgers WHERE supplier_id = ?").run(id);
        // 3. Then delete the supplier record
        const info = db.prepare("DELETE FROM suppliers WHERE id = ?").run(id);
        console.log(`Server: Deleted supplier ${id}. Rows affected: ${info.changes}`);
      })();
      res.json({ success: true });
    } catch (err) {
      console.error(`Server: Error deleting supplier ${id}:`, err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put("/api/suppliers/:id", (req, res) => {
    const { id } = req.params;
    const { name, contact_person, phone, email, address, category } = req.body;
    try {
      db.prepare(`
        UPDATE suppliers 
        SET name = ?, contact_person = ?, phone = ?, email = ?, address = ?, category = ? 
        WHERE id = ?
      `).run(name, contact_person, phone, email, address, category, id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put("/api/inventory/:id", (req, res) => {
    const { id } = req.params;
    const { batch_number, expiry_date, quantity_cases, quantity_units } = req.body;
    try {
      db.prepare(`
        UPDATE inventory 
        SET batch_number = ?, expiry_date = ?, quantity_cases = ?, quantity_units = ? 
        WHERE id = ?
      `).run(batch_number, expiry_date, quantity_cases, quantity_units, id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete("/api/inventory/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM inventory WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/inventory/bulk", (req, res) => {
    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "Invalid data format. Expected an array." });
    }

    const insertInventory = db.prepare(`
      INSERT INTO inventory (sku_id, batch_number, expiry_date, quantity_cases, quantity_units)
      VALUES (?, ?, ?, ?, ?)
    `);

    const process = db.transaction((data) => {
      for (const item of data) {
        insertInventory.run(
          item.sku_id,
          item.batch_number,
          item.expiry_date || null,
          item.quantity_cases || 0,
          item.quantity_units || 0
        );
      }
    });

    try {
      process(items);
      res.json({ success: true, count: items.length });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/customers/reset-credit-limits", (req, res) => {
    const { limit } = req.body;
    try {
      db.prepare("UPDATE customers SET credit_limit = ?").run(limit || 1000);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/inventory", (req, res) => {
    const inventory = db.prepare(`
      SELECT i.*, s.name as sku_name, s.category, s.supplier_id, sup.name as supplier_name, sup.email as supplier_email
      FROM inventory i 
      JOIN skus s ON i.sku_id = s.id 
      LEFT JOIN suppliers sup ON s.supplier_id = sup.id
      ORDER BY i.expiry_date ASC
    `).all();
    res.json(inventory);
  });

  app.get("/api/claims", (req, res) => {
    try {
      const claims = db.prepare(`
        SELECT c.*, s.name as sku_name, sup.name as supplier_name 
        FROM claims c
        JOIN skus s ON c.sku_id = s.id
        JOIN suppliers sup ON c.supplier_id = sup.id
        ORDER BY c.date DESC
      `).all();
      res.json(claims);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/claims", (req, res) => {
    const { supplier_id, sku_id, batch_number, quantity, type, description } = req.body;
    try {
      const info = db.prepare(`
        INSERT INTO claims (supplier_id, sku_id, batch_number, quantity, type, description)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(supplier_id, sku_id, batch_number, quantity, type, description);
      res.json({ id: info.lastInsertRowid });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/claims/:id/status", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
      db.prepare("UPDATE claims SET status = ? WHERE id = ?").run(status, id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/salesmen", (req, res) => {
    const salesmen = db.prepare(`
      SELECT s.*, e.name 
      FROM salesmen s
      JOIN employees e ON s.employee_id = e.id
    `).all();
    res.json(salesmen);
  });

  app.get("/api/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM app_settings").all();
    res.json(settings);
  });

  app.get("/api/backup/download", (req, res) => {
    const backupPath = path.join(process.cwd(), "erp_backup.db");
    try {
      // Use better-sqlite3 physical backup to ensure consistent state
      db.backup(backupPath)
        .then(() => {
          res.download(backupPath, "erp_backup.db", (err) => {
            if (err) {
              console.error("Backup download error:", err);
            }
          });
        })
        .catch((err) => {
          res.status(500).json({ error: "Failed to create backup: " + err.message });
        });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/settings", (req, res) => {
    const { key, value } = req.body;
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(key, value);
    res.json({ status: "ok" });
  });

  app.get("/api/dashboard/stats", (req, res) => {
    // Total Sales
    const totalSales = db.prepare("SELECT SUM(total_amount) as total FROM orders").get() as { total: number };
    // Total Tax
    const totalTax = db.prepare("SELECT SUM(tax_amount) as tax FROM orders").get() as { tax: number };
    // Total Expenses
    const totalExpenses = db.prepare("SELECT SUM(amount) as exp FROM expenses").get() as { exp: number };
    // Fleet Costs
    const totalFleet = db.prepare("SELECT SUM(amount) as fleet FROM fleet_logs").get() as { fleet: number };
    // COGS estimation (simplified for this query)
    const totalCogs = db.prepare(`
      SELECT SUM(oi.cases * s.cogs_per_case) as cogs 
      FROM order_items oi 
      JOIN skus s ON oi.sku_id = s.id
    `).get() as { cogs: number };

    res.json({
      sales: totalSales.total || 0,
      tax: totalTax.tax || 0,
      expenses: totalExpenses.exp || 0,
      fleet: totalFleet.fleet || 0,
      cogs: totalCogs.cogs || 0,
      netProfit: (totalSales.total || 0) - (totalTax.tax || 0) - (totalCogs.cogs || 0) - (totalExpenses.exp || 0) - (totalFleet.fleet || 0),
      totalOrders: (db.prepare("SELECT COUNT(*) as count FROM orders").get() as { count: number }).count,
      activeEmployees: (db.prepare("SELECT COUNT(*) as count FROM employees").get() as { count: number }).count,
      inventoryValue: (db.prepare("SELECT SUM(i.quantity_cases * s.cogs_per_case) as val FROM inventory i JOIN skus s ON i.sku_id = s.id").get() as { val: number }).val || 0,
      outstandingReceivables: (db.prepare("SELECT SUM(balance) as bal FROM customers").get() as { bal: number }).bal || 0,
      counterCash: (db.prepare("SELECT balance FROM counter_cash WHERE id = 1").get() as { balance: number }).balance || 0
    });
  });

  app.get("/api/dashboard/salesman/:id", (req, res) => {
    try {
      const salesmanId = req.params.id;

      // Salesman and employee details
      const salesman = db.prepare(`
        SELECT s.*, e.name, e.contact, e.role 
        FROM salesmen s
        JOIN employees e ON s.employee_id = e.id
        WHERE s.id = ?
      `).get(salesmanId) as { id: number, name: string, target_threshold: number, role: string } | undefined;

      if (!salesman) {
        return res.status(404).json({ error: "Salesman not found" });
      }

      // Current month sales
      const currentMonthSales = db.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count 
        FROM orders 
        WHERE salesman_id = ? AND is_dummy = 0
      `).get(salesmanId) as { total: number, count: number };

      // Case count for current month
      const totalCases = db.prepare(`
        SELECT COALESCE(SUM(oi.cases), 0) as total_cases
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE o.salesman_id = ? AND o.is_dummy = 0
      `).get(salesmanId) as { total_cases: number };

      // Target progress details
      const target = salesman.target_threshold || 500000;
      const progressPercent = target > 0 ? (currentMonthSales.total / target) * 100 : 0;

      // Recent customer interactions (either orders or logged visits)
      const interactions = db.prepare(`
        SELECT i.*, c.name as customer_name, c.shop_name, c.contact as customer_contact 
        FROM salesman_interactions i 
        JOIN customers c ON i.customer_id = c.id 
        WHERE i.salesman_id = ? 
        ORDER BY i.interaction_date DESC 
        LIMIT 10
      `).all(salesmanId);

      // Recent orders for customer reference
      const recentOrders = db.prepare(`
        SELECT o.id, o.total_amount, o.order_date, o.delivery_status, c.name as customer_name, c.shop_name 
        FROM orders o 
        JOIN customers c ON o.customer_id = c.id 
        WHERE o.salesman_id = ? AND o.is_dummy = 0
        ORDER BY o.order_date DESC 
        LIMIT 5
      `).all(salesmanId);

      res.json({
        salesman,
        stats: {
          sales: currentMonthSales.total,
          ordersCount: currentMonthSales.count,
          totalCases: totalCases.total_cases,
          targetThreshold: target,
          progressPercent: Math.min(Math.round(progressPercent * 10) / 10, 100)
        },
        interactions,
        recentOrders
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to load salesman stats", message: err.message });
    }
  });

  app.post("/api/dashboard/salesman/:id/interactions", (req, res) => {
    try {
      const salesmanId = req.params.id;
      const { customer_id, type, notes, status } = req.body;

      if (!customer_id || !type || !notes) {
        return res.status(400).json({ error: "Missing required fields (customer_id, type, notes)" });
      }

      const info = db.prepare(`
        INSERT INTO salesman_interactions (salesman_id, customer_id, type, notes, status)
        VALUES (?, ?, ?, ?, ?)
      `).run(salesmanId, customer_id, type, notes, status || 'completed');

      res.json({ id: info.lastInsertRowid, success: true, message: "Interaction logged successfully" });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to log interaction", message: err.message });
    }
  });

  app.post("/api/orders", (req, res) => {
    const { customer_id, salesman_id, items, total_amount, tax_amount, further_tax, is_dummy } = req.body;
    
    const transaction = db.transaction((orderData: any) => {
      const info = db.prepare("INSERT INTO orders (customer_id, salesman_id, total_amount, tax_amount, further_tax, is_dummy) VALUES (?, ?, ?, ?, ?, ?)").run(
        orderData.customer_id, 
        orderData.salesman_id, 
        orderData.total_amount, 
        orderData.tax_amount, 
        orderData.further_tax || 0,
        orderData.is_dummy || 0
      );
      const orderId = info.lastInsertRowid;

      for (const item of orderData.items) {
        db.prepare("INSERT INTO order_items (order_id, sku_id, cases, units, price) VALUES (?, ?, ?, ?, ?)").run(
          orderId, item.sku_id, item.cases, item.units, item.price
        );
      }

      // Update customer balance
      if (orderData.is_dummy === 0) {
        db.prepare("UPDATE customers SET balance = balance + ? WHERE id = ?").run(orderData.total_amount, orderData.customer_id);
      }

      return orderId;
    });

    try {
      const orderId = transaction({ customer_id, salesman_id, items, total_amount, tax_amount, further_tax, is_dummy });
      res.json({ orderId });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/orders", (req, res) => {
    const { delivery_status, customer_id } = req.query;
    try {
      let query = `
        SELECT o.*, c.name as customer_name, c.shop_name as customer_shop, e.name as salesman_name
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN salesmen s ON o.salesman_id = s.id
        LEFT JOIN employees e ON s.employee_id = e.id
        WHERE 1=1
      `;
      const params: any[] = [];
      if (delivery_status) {
        query += " AND o.delivery_status = ?";
        params.push(delivery_status);
      }
      if (customer_id) {
        query += " AND o.customer_id = ?";
        params.push(Number(customer_id));
      }
      query += " ORDER BY o.id DESC";
      const orders = db.prepare(query).all(params);
      res.json(orders);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/orders/:id", (req, res) => {
    const { id } = req.params;
    try {
      const order = db.prepare(`
        SELECT 
          o.*, 
          c.name as customer_name,
          c.route,
          e.name as salesman_name
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN salesmen s ON o.salesman_id = s.id
        LEFT JOIN employees e ON s.employee_id = e.id
        WHERE o.id = ?
      `).get(id) as any;

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      const items = db.prepare(`
        SELECT 
          oi.*, 
          s.name as sku_name,
          s.price_per_case,
          s.price_per_unit,
          s.units_per_case
        FROM order_items oi
        JOIN skus s ON oi.sku_id = s.id
        WHERE oi.order_id = ?
      `).all(id) as any[];

      res.json({ ...order, items });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/orders/:id/dispatch", (req, res) => {
    const { id } = req.params;
    const { driver_id } = req.body;
    try {
      db.prepare("UPDATE orders SET driver_id = ?, delivery_status = 'dispatched' WHERE id = ?")
        .run(driver_id, id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/orders/:id/deliver", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("UPDATE orders SET delivery_status = 'delivered' WHERE id = ?")
        .run(id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete("/api/orders/:id", (req, res) => {
    const { id } = req.params;
    console.log(`[DELETE ORDER] Attempting to delete order ID: ${id}`);
    try {
      db.transaction(() => {
        const order = db.prepare("SELECT id, customer_id, total_amount, is_dummy FROM orders WHERE id = ?").get(id) as any;
        if (order) {
          console.log(`[DELETE ORDER] Found order:`, order);
          if (order.is_dummy === 0) {
            db.prepare("UPDATE customers SET balance = balance - ? WHERE id = ?").run(order.total_amount, order.customer_id);
            console.log(`[DELETE ORDER] Reverted customer balance by ${order.total_amount}`);
          }
          const itemDeleteRes = db.prepare("DELETE FROM order_items WHERE order_id = ?").run(id);
          console.log(`[DELETE ORDER] Deleted ${itemDeleteRes.changes} order items`);
          const orderDeleteRes = db.prepare("DELETE FROM orders WHERE id = ?").run(id);
          console.log(`[DELETE ORDER] Order deletion result: ${orderDeleteRes.changes} rows affected`);
        } else {
          console.warn(`[DELETE ORDER] Order ID ${id} not found`);
        }
      })();
      res.json({ success: true });
    } catch (err) {
      console.error(`[DELETE ORDER] Error:`, err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put("/api/orders/:id", (req, res) => {
    const { id } = req.params;
    const { items, total_amount, tax_amount, further_tax } = req.body;

    try {
      db.transaction(() => {
        const oldOrder = db.prepare("SELECT customer_id, total_amount, is_dummy FROM orders WHERE id = ?").get(id) as any;
        if (!oldOrder) throw new Error("Order not found");

        // Update customer balance: subtract old total, add new total
        if (oldOrder.is_dummy === 0) {
          db.prepare("UPDATE customers SET balance = balance - ? WHERE id = ?").run(oldOrder.total_amount, oldOrder.customer_id);
          db.prepare("UPDATE customers SET balance = balance + ? WHERE id = ?").run(total_amount, oldOrder.customer_id);
        }

        // Update order headers
        db.prepare("UPDATE orders SET total_amount = ?, tax_amount = ?, further_tax = ? WHERE id = ?")
          .run(total_amount, tax_amount, further_tax || 0, id);

        // Replace items
        db.prepare("DELETE FROM order_items WHERE order_id = ?").run(id);
        for (const item of items) {
          db.prepare("INSERT INTO order_items (order_id, sku_id, cases, units, price) VALUES (?, ?, ?, ?, ?)")
            .run(id, item.sku_id, item.cases, item.units, item.price);
        }
      })();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Reporting Routes
  app.get("/api/reports/sales", (req, res) => {
    const sales = db.prepare(`
      SELECT 
        o.id as id,
        o.order_date as order_date,
        c.name as customer_name,
        e.name as salesman_name,
        o.total_amount as total_amount,
        o.tax_amount as tax_amount,
        o.is_paid as is_paid,
        o.is_dummy as is_dummy
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN salesmen s ON o.salesman_id = s.id
      LEFT JOIN employees e ON s.employee_id = e.id
      ORDER BY o.order_date DESC
    `).all();
    res.json(sales);
  });

  app.get("/api/reports/loading-sheet", (req, res) => {
    const sales = db.prepare(`
      SELECT 
        o.id as id,
        o.order_date as order_date,
        c.name as customer_name,
        e.name as salesman_name,
        o.total_amount as total_amount,
        o.tax_amount as tax_amount,
        o.is_paid as is_paid,
        o.is_dummy as is_dummy
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN salesmen s ON o.salesman_id = s.id
      LEFT JOIN employees e ON s.employee_id = e.id
      WHERE o.delivery_status = 'pending'
      ORDER BY o.order_date DESC
    `).all();
    res.json(sales);
  });

  app.get("/api/reports/batch-invoices", (req, res) => {
    const sales = db.prepare(`
      SELECT 
        o.id as id,
        o.order_date as order_date,
        c.name as customer_name,
        e.name as salesman_name,
        o.total_amount as total_amount,
        o.tax_amount as tax_amount,
        o.is_paid as is_paid,
        o.is_dummy as is_dummy
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN salesmen s ON o.salesman_id = s.id
      LEFT JOIN employees e ON s.employee_id = e.id
      ORDER BY o.order_date DESC
    `).all();
    res.json(sales);
  });

  app.get("/api/reports/stock", (req, res) => {
    const stock = db.prepare(`
      SELECT 
        s.id,
        s.name,
        s.category,
        s.units_per_case,
        s.price_per_case,
        s.cogs_per_case,
        sup.name as supplier_name,
        COALESCE(SUM(i.quantity_cases), 0) as total_cases,
        COALESCE(SUM(i.quantity_units), 0) as total_units
      FROM skus s
      LEFT JOIN inventory i ON s.id = i.sku_id
      LEFT JOIN suppliers sup ON s.supplier_id = sup.id
      GROUP BY s.id
    `).all();
    res.json(stock);
  });

  app.get("/api/reports/returns", (req, res) => {
    const returnsSummary = db.prepare(`
      SELECT 
        r.id,
        r.date,
        c.name as customer_name,
        s.name as sku_name,
        r.type,
        r.quantity
      FROM returns r
      JOIN customers c ON r.customer_id = c.id
      JOIN skus s ON r.sku_id = s.id
      ORDER BY r.date DESC
    `).all();
    res.json(returnsSummary);
  });

  app.get("/api/reports/receivables", (req, res) => {
    const receivables = db.prepare(`
      SELECT id, name, shop_name, route, contact, credit_limit, balance
      FROM customers
      WHERE balance > 0
      ORDER BY balance DESC
    `).all();
    res.json(receivables);
  });

  app.get("/api/reports/payables", (req, res) => {
    const payables = db.prepare(`
      SELECT id, name, category, balance
      FROM suppliers
      WHERE balance > 0
      ORDER BY balance DESC
    `).all();
    res.json(payables);
  });

  // Fleet routes
  app.get("/api/fleet", (req, res) => {
    const fleet = db.prepare("SELECT * FROM fleet").all();
    res.json(fleet);
  });

  app.post("/api/fleet", (req, res) => {
    const { vehicle_number, model, current_km, last_service_km } = req.body;
    try {
      db.prepare("INSERT INTO fleet (vehicle_number, model, current_km, last_service_km) VALUES (?, ?, ?, ?)")
        .run(vehicle_number, model, current_km || 0, last_service_km || 0);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete("/api/fleet/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.transaction(() => {
        db.prepare("DELETE FROM fleet_logs WHERE vehicle_id = ?").run(id);
        db.prepare("DELETE FROM fleet WHERE id = ?").run(id);
      })();
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/fleet/:id/logs", (req, res) => {
    const { id } = req.params;
    const logs = db.prepare("SELECT * FROM fleet_logs WHERE vehicle_id = ? ORDER BY date DESC").all(id);
    res.json(logs);
  });

  app.post("/api/fleet/log", (req, res) => {
    const { vehicle_id, type, amount, km } = req.body;
    db.prepare("INSERT INTO fleet_logs (vehicle_id, type, amount, km_at_log) VALUES (?, ?, ?, ?)").run(vehicle_id, type, amount, km);
    // Update vehicle KM
    db.prepare("UPDATE fleet SET current_km = ? WHERE id = ?").run(km, vehicle_id);
    res.json({ status: "ok" });
  });

  app.get("/api/settlements", (req, res) => {
    try {
      const settlements = db.prepare(`
        SELECT rs.*, e.name as salesman_name
        FROM route_settlements rs
        LEFT JOIN salesmen s ON rs.salesman_id = s.id
        LEFT JOIN employees e ON s.employee_id = e.id
        ORDER BY rs.date DESC
      `).all();
      res.json(settlements);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/settlements", (req, res) => {
    const { salesman_id, stock_issued_val, returns_val, booked_val, cash_recovered, variance } = req.body;
    
    db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO route_settlements (salesman_id, stock_issued_val, returns_val, booked_val, cash_recovered, variance)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(salesman_id, stock_issued_val, returns_val, booked_val, cash_recovered, variance);

      // Add recovered cash to counter cash
      db.prepare("UPDATE counter_cash SET balance = balance + ? WHERE id = 1").run(cash_recovered);
      db.prepare("INSERT INTO counter_cash_logs (type, amount, description, source) VALUES ('In', ?, ?, 'Settlement')")
        .run(cash_recovered, `Cash recovery from salesman ID: ${salesman_id}`);
    })();
    
    res.json({ status: "ok" });
  });

  app.get("/api/backup/export", (req, res) => {
    try {
      const tables = [
        "skus", "inventory", "customers", "employees", "salesmen", 
        "accounts", "app_settings", "suppliers", "vouchers", 
        "voucher_entries", "orders", "order_items", "returns", 
        "fleet", "fleet_logs", "route_settlements", "counter_cash", 
        "bank_accounts", "expenses", "absences", "salary_payments", 
        "employee_loans", "supplier_ledgers", "bank_transactions", "counter_cash_logs"
      ];
      const backup: any = {};
      for (const table of tables) {
        try {
           backup[table] = db.prepare(`SELECT * FROM ${table}`).all();
        } catch (e) {
           backup[table] = [];
        }
      }
      res.json(backup);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/backup/import", (req, res) => {
    const backup = req.body;
    if (!backup || Object.keys(backup).length === 0) {
      return res.status(400).json({ error: "Empty or invalid backup payload received." });
    }
    console.log("[Restore] Starting nuclear restoration. Tables detected:", Object.keys(backup));
    
    try {
      // Disable foreign keys temporarily outside transaction
      db.prepare("PRAGMA foreign_keys = OFF").run();

      // Execute restore in a single transaction
      db.transaction(() => {
        for (const [table, rows] of Object.entries(backup)) {
          if (!Array.isArray(rows)) continue;
          
          // Check if table exists
          const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
          if (!tableCheck || table === 'sqlite_sequence') {
            console.warn(`[Restore] Skipping table ${table} (Missing or internal)`);
            continue;
          }

          console.log(`[Restore] Table ${table}: Clearing ${(db.prepare(`SELECT count(*) as count FROM ${table}`).get() as any).count} rows...`);
          db.prepare(`DELETE FROM ${table}`).run();
          
          if (rows.length === 0) continue;
          
          // Get current table columns to prevent errors if schema changed
          const tableInfo = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
          const validColumns = tableInfo.map(col => col.name);
          
          // Identify intersecting keys
          const sampleRow = rows[0];
          const keysInBackup = Object.keys(sampleRow);
          const columnsToInsert = keysInBackup.filter(k => validColumns.includes(k));
          
          if (columnsToInsert.length === 0) {
            console.warn(`[Restore] No valid columns for table ${table}. Skipping insertion.`);
            continue;
          }

          console.log(`[Restore] Table ${table}: Inserting ${rows.length} rows using columns: ${columnsToInsert.join(', ')}`);
          
          const placeholders = columnsToInsert.map(() => '?').join(',');
          const sql = `INSERT INTO ${table} (${columnsToInsert.join(',')}) VALUES (${placeholders})`;
          const stmt = db.prepare(sql);
          
          let insertedCount = 0;
          for (const row of rows as any[]) {
            try {
              // Skip if row is null or not an object
              if (!row || typeof row !== 'object') continue;
              
              // Validate mandatory fields for critical tables
              if (table === 'customers' && !row.name) {
                console.warn("[Restore] Skipping customer row missing mandatory name");
                continue;
              }
              if (table === 'skus' && !row.name) {
                console.warn("[Restore] Skipping SKU row missing mandatory name");
                continue;
              }

              const values = columnsToInsert.map(k => row[k] ?? null);
              stmt.run(...values);
              insertedCount++;
            } catch (rowErr) {
              console.warn(`[Restore] Skipping row in ${table} due to error:`, (rowErr as Error).message);
            }
          }
          console.log(`[Restore] Table ${table}: Successfully re-instated ${insertedCount}/${rows.length} rows.`);
        }
      })();
      
      // Re-enable foreign keys
      db.prepare("PRAGMA foreign_keys = ON").run();
      
      console.log("[Restore] SUCCESS: All data re-instated and validated.");
      res.json({ success: true });
    } catch (err) {
      console.error("[Restore] FATAL ERROR:", err);
      // Try to re-enable keys even on failure
      try { db.prepare("PRAGMA foreign_keys = ON").run(); } catch(fke) {}
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/counter-cash", (req, res) => {
    const balance = db.prepare("SELECT balance FROM counter_cash WHERE id = 1").get();
    const logs = db.prepare("SELECT * FROM counter_cash_logs ORDER BY date DESC LIMIT 50").all();
    res.json({ balance: (balance as any).balance, logs });
  });

  app.post("/api/counter-cash/deposit", (req, res) => {
    const { amount, bank_account_id, description } = req.body;
    db.transaction(() => {
      // 1. Deduct from counter cash
      db.prepare("UPDATE counter_cash SET balance = balance - ? WHERE id = 1").run(amount);
      db.prepare("INSERT INTO counter_cash_logs (type, amount, description, source) VALUES ('Out', ?, ?, 'Bank Deposit')")
        .run(amount, `Deposit to bank account ID: ${bank_account_id}. ${description}`);
      
      // 2. Add to bank account
      db.prepare("INSERT INTO bank_transactions (account_id, type, amount, description, reference) VALUES (?, 'Deposit', ?, ?, 'Counter Cash Deposit')")
        .run(bank_account_id, amount, description);
      db.prepare("UPDATE bank_accounts SET balance = balance + ? WHERE id = ?").run(amount, bank_account_id);
    })();
    res.json({ status: "ok" });
  });

  app.get("/api/suppliers", (req, res) => {
    const suppliers = db.prepare("SELECT * FROM suppliers").all();
    res.json(suppliers);
  });

  app.post("/api/suppliers", (req, res) => {
    const { name, contact_person, phone, email, address, category } = req.body;
    db.prepare("INSERT INTO suppliers (name, contact_person, phone, email, address, category) VALUES (?, ?, ?, ?, ?, ?)")
      .run(name, contact_person, phone, email, address, category);
    res.json({ status: "ok" });
  });

  app.get("/api/suppliers/:id/ledger", (req, res) => {
    const { id } = req.params;
    const ledger = db.prepare("SELECT * FROM supplier_ledgers WHERE supplier_id = ? ORDER BY date DESC").all(id);
    res.json(ledger);
  });

  app.post("/api/suppliers/:id/pay", (req, res) => {
    const { id } = req.params;
    const { amount, description, bank_account_id } = req.body;
    
    db.transaction(() => {
      // 1. Record supplier payment
      db.prepare("INSERT INTO supplier_ledgers (supplier_id, type, amount, description) VALUES (?, 'Payment', ?, ?)")
        .run(id, amount, description);
      
      // 2. Update supplier balance
      db.prepare("UPDATE suppliers SET balance = balance - ? WHERE id = ?").run(amount, id);
      
      // 3. Optional: Deduct from bank if specified
      if (bank_account_id) {
        db.prepare("INSERT INTO bank_transactions (account_id, type, amount, description) VALUES (?, 'Withdrawal', ?, ?)")
          .run(bank_account_id, amount, `Payment to supplier: ${description}`);
        db.prepare("UPDATE bank_accounts SET balance = balance - ? WHERE id = ?").run(amount, bank_account_id);
      }
    })();
    
    res.json({ status: "ok" });
  });

  app.get("/api/purchase-orders", (req, res) => {
    try {
      const orders = db.prepare(`
        SELECT po.*, s.name as supplier_name 
        FROM purchase_orders po 
        JOIN suppliers s ON po.supplier_id = s.id 
        ORDER BY po.id DESC
      `).all();
      res.json(orders);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/purchase-orders/:id", (req, res) => {
    const { id } = req.params;
    try {
      const order = db.prepare(`
        SELECT po.*, s.name as supplier_name 
        FROM purchase_orders po 
        JOIN suppliers s ON po.supplier_id = s.id 
        WHERE po.id = ?
      `).get(id) as any;
      if (!order) {
        return res.status(404).json({ error: "Purchase order not found" });
      }
      const items = db.prepare(`
        SELECT poi.*, sk.name as sku_name 
        FROM purchase_order_items poi 
        JOIN skus sk ON poi.sku_id = sk.id 
        WHERE poi.purchase_order_id = ?
      `).all(id);
      res.json({ ...order, items });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/purchase-orders", (req, res) => {
    const { supplier_id, order_date, total_amount, notes, items } = req.body;
    try {
      db.transaction(() => {
        const info = db.prepare(`
          INSERT INTO purchase_orders (supplier_id, order_date, total_amount, notes, status)
          VALUES (?, ?, ?, ?, 'Pending')
        `).run(supplier_id, order_date, total_amount, notes);
        
        const poId = info.lastInsertRowid;
        const insertItem = db.prepare(`
          INSERT INTO purchase_order_items (purchase_order_id, sku_id, cases, units, price_per_case, price_per_unit)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        for (const item of items) {
          insertItem.run(poId, item.sku_id, item.cases, item.units, item.price_per_case, item.price_per_unit);
         }
      })();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put("/api/purchase-orders/:id/status", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
      db.transaction(() => {
        const currentPo = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(id) as any;
        if (!currentPo) {
          throw new Error("Purchase Order not found");
        }
        
        if (currentPo.status !== 'Pending') {
          throw new Error("Only pending purchase orders can have their status updated.");
        }
        
        db.prepare("UPDATE purchase_orders SET status = ? WHERE id = ?").run(status, id);
        
        if (status === 'Received') {
          const items = db.prepare("SELECT * FROM purchase_order_items WHERE purchase_order_id = ?").all(id) as any[];
          
          const insertInventory = db.prepare(`
            INSERT INTO inventory (sku_id, batch_number, expiry_date, quantity_cases, quantity_units)
            VALUES (?, ?, ?, ?, ?)
          `);
          
          for (const item of items) {
            insertInventory.run(
              item.sku_id, 
              `PO-${id}-${Date.now().toString().slice(-4)}`, 
              null, 
              item.cases, 
              item.units
            );
          }
          
          db.prepare("UPDATE suppliers SET balance = balance + ? WHERE id = ?").run(currentPo.total_amount, currentPo.supplier_id);
          
          db.prepare(`
            INSERT INTO supplier_ledgers (supplier_id, type, amount, date, description) 
            VALUES (?, 'Purchase', ?, ?, ?)
          `).run(
            currentPo.supplier_id, 
            currentPo.total_amount, 
            new Date().toISOString(), 
            `Received stock from Purchase Order #${id}`
          );
        }
      })();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ================= INVOICING MODULE ENDPOINTS =================

  // POST Convert selected pending orders to invoices in a batch
  app.post("/api/invoices/convert-orders", (req, res) => {
    const { order_ids, invoice_date, payment_method } = req.body;
    try {
      const results: number[] = [];
      db.transaction(() => {
        for (const orderId of order_ids) {
          // Fetch order
          const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as any;
          if (!order) continue;
          if (order.delivery_status === 'delivered') continue; 

          // Fetch customer
          const customer = db.prepare("SELECT balance, route FROM customers WHERE id = ?").get(order.customer_id) as any;
          if (!customer) continue;

          const prevBalance = customer.balance || 0;

          // Fetch order items
          const items = db.prepare(`
            SELECT oi.*, s.name as sku_name, s.price_per_case, s.price_per_unit, s.units_per_case
            FROM order_items oi
            JOIN skus s ON oi.sku_id = s.id
            WHERE oi.order_id = ?
          `).all(orderId) as any[];

          // Compute values
          let subtotal = 0;
          let discount_amount = 0;
          let total_amount = 0;

          const invoiceItemsToInsert: any[] = [];
          for (const item of items) {
            const cases = Number(item.cases) || 0;
            const units = Number(item.units) || 0;
            const priceC = Number(item.price_per_case) || Number(item.price) || 0;
            const priceU = Number(item.price_per_unit) || (Number(item.price) / (item.units_per_case || 12)) || 0;

            const baseTotal = (cases * priceC) + (units * priceU);
            const lineTotal = baseTotal; 

            subtotal += baseTotal;
            total_amount += lineTotal;

            invoiceItemsToInsert.push({
              sku_id: item.sku_id,
              cases,
              units,
              trade_price_per_case: priceC,
              trade_price_per_unit: priceU,
              retail_price: priceU * 1.15,
              discount_percentage: 0,
              discount_amount: 0,
              line_total: lineTotal
            });
          }

          // Compute unique invoice number
          const tempIdInfo = db.prepare("SELECT MAX(id) as maxId FROM invoices").get() as any;
          const nextId = (tempIdInfo.maxId || 0) + 1;
          const currentYear = new Date(invoice_date).getFullYear();
          const formattedNum = String(nextId).padStart(4, '0');
          const invoiceNumber = `INV-CONV-${currentYear}-${formattedNum}`;

          // Insert invoice
          const info = db.prepare(`
            INSERT INTO invoices (
              invoice_number, customer_id, salesman_id, route, invoice_date,
              subtotal, discount_amount, tax_amount, total_amount, previous_balance,
              status, payment_method, is_consolidated, is_batch_generated, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'Converted from Order Pre-booking')
          `).run(
            invoiceNumber, order.customer_id, order.salesman_id || null, customer.route || null, invoice_date,
            subtotal, discount_amount, 0, total_amount, prevBalance,
            payment_method === 'Cash' ? 'Paid' : 'Pending', payment_method || 'Credit'
          );

          const invoiceId = info.lastInsertRowid;
          results.push(Number(invoiceId));

          const insertItem = db.prepare(`
            INSERT INTO invoice_items (
              invoice_id, sku_id, cases, units, trade_price_per_case, trade_price_per_unit,
              retail_price, discount_percentage, discount_amount, line_total
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          for (const line of invoiceItemsToInsert) {
            insertItem.run(
              invoiceId, line.sku_id, line.cases, line.units,
              line.trade_price_per_case, line.trade_price_per_unit,
              line.retail_price, line.discount_percentage,
              line.discount_amount, line.line_total
            );
          }

          // Mark order as delivered so it won't be convertible again
          db.prepare("UPDATE orders SET delivery_status = 'delivered' WHERE id = ?").run(orderId);

          // Update customer ledger
          if (payment_method === 'Credit') {
            db.prepare("UPDATE customers SET balance = balance + ? WHERE id = ?").run(total_amount, order.customer_id);
          }
        }
      });

      res.json({ success: true, count: results.length, invoiceIds: results });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET all invoices with optional filters
  app.get("/api/invoices", (req, res) => {
    const { route, salesman_id, is_consolidated } = req.query;
    try {
      let query = `
        SELECT i.*, 
               c.name as customer_name, c.shop_name as customer_shop, c.contact as customer_contact, c.balance as customer_balance,
               e.name as salesman_name
        FROM invoices i
        JOIN customers c ON i.customer_id = c.id
        LEFT JOIN salesmen s ON i.salesman_id = s.id
        LEFT JOIN employees e ON s.employee_id = e.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (route) {
        query += " AND i.route = ?";
        params.push(route);
      }
      if (salesman_id) {
        query += " AND i.salesman_id = ?";
        params.push(Number(salesman_id));
      }
      if (is_consolidated !== undefined) {
        query += " AND i.is_consolidated = ?";
        params.push(is_consolidated === 'true' ? 1 : 0);
      }

      query += " ORDER BY i.id DESC";

      const invoices = db.prepare(query).all(params);
      res.json(invoices);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET single invoice with items
  app.get("/api/invoices/:id", (req, res) => {
    const { id } = req.params;
    try {
      const invoice = db.prepare(`
        SELECT i.*, 
               c.name as customer_name, c.shop_name as customer_shop, c.contact as customer_contact, c.balance as customer_balance,
               e.name as salesman_name
        FROM invoices i
        JOIN customers c ON i.customer_id = c.id
        LEFT JOIN salesmen s ON i.salesman_id = s.id
        LEFT JOIN employees e ON s.employee_id = e.id
        WHERE i.id = ?
      `).get(id) as any;

      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const items = db.prepare(`
        SELECT ii.*, s.name as sku_name, s.units_per_case
        FROM invoice_items ii
        JOIN skus s ON ii.sku_id = s.id
        WHERE ii.invoice_id = ?
      `).all(id);

      // If it is a consolidated invoice, load mapping
      let childInvoices: any[] = [];
      if (invoice.is_consolidated === 2) { // 2 = Is a Consolidated Parent Invoice
        childInvoices = db.prepare(`
          SELECT i.*, c.shop_name as customer_shop
          FROM invoice_consolidated_mapping icm
          JOIN invoices i ON icm.child_invoice_id = i.id
          JOIN customers c ON i.customer_id = c.id
          WHERE icm.consolidated_invoice_id = ?
        `).all(id);
      }

      res.json({ ...invoice, items, childInvoices });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST Create Single Invoice
  app.post("/api/invoices", (req, res) => {
    const { 
      customer_id, salesman_id, invoice_date, subtotal, 
      discount_amount, tax_amount, total_amount, payment_method, notes, items 
    } = req.body;

    try {
      let responseId: number | null = null;
      db.transaction(() => {
        // Fetch current customer to get outstanding balance as previous balance
        const customer = db.prepare("SELECT balance, route, shop_name FROM customers WHERE id = ?").get(customer_id) as any;
        if (!customer) throw new Error("Customer accounts not found.");

        const prevBalance = customer.balance || 0;

        // Auto-generate customized Invoice Number
        const tempIdInfo = db.prepare("SELECT MAX(id) as maxId FROM invoices").get() as any;
        const nextId = (tempIdInfo.maxId || 0) + 1;
        const currentYear = new Date(invoice_date).getFullYear();
        const formattedNum = String(nextId).padStart(4, '0');
        const invoiceNumber = `INV-${currentYear}-${formattedNum}`;

        // Insert invoice status: Paid or Pending
        const status = payment_method === 'Cash' ? 'Paid' : 'Pending';

        const info = db.prepare(`
          INSERT INTO invoices (
            invoice_number, customer_id, salesman_id, route, invoice_date,
            subtotal, discount_amount, tax_amount, total_amount, previous_balance,
            status, payment_method, is_consolidated, is_batch_generated, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
        `).run(
          invoiceNumber, customer_id, salesman_id || null, customer.route || null, invoice_date,
          subtotal, discount_amount || 0, tax_amount || 0, total_amount, prevBalance,
          status, payment_method, notes || ''
        );

        const invoiceId = info.lastInsertRowid;
        responseId = Number(invoiceId);

        const insertItem = db.prepare(`
          INSERT INTO invoice_items (
            invoice_id, sku_id, cases, units, trade_price_per_case, trade_price_per_unit,
            retail_price, discount_percentage, discount_amount, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of items) {
          insertItem.run(
            invoiceId, item.sku_id, item.cases || 0, item.units || 0,
            item.trade_price_per_case, item.trade_price_per_unit,
            item.retail_price || 0, item.discount_percentage || 0,
            item.discount_amount || 0, item.line_total
          );
        }

        // Apply ledger changes: Credit sales increases previous balance
        if (payment_method === 'Credit') {
          db.prepare("UPDATE customers SET balance = balance + ? WHERE id = ?").run(total_amount, customer_id);
        } else if (payment_method === 'Cash') {
          // Auto Roznamcha entry
          const lastRowRoz = db.prepare("SELECT id FROM roznamcha ORDER BY id DESC LIMIT 1").get() as any;
          const nextRozId = lastRowRoz ? lastRowRoz.id + 1 : 1;
          const voucher_no = "ROZ-" + String(nextRozId).padStart(5, '0');
          const shop_name = customer?.shop_name || "Customer Shop";
          
          db.prepare(`
            INSERT INTO roznamcha (voucher_no, entry_type, category, narration, debit, credit, employee_id, customer_id, photo_url, is_locked)
            VALUES (?, 'Cash In', 'Sales Recovery', ?, ?, 0, ?, ?, NULL, 0)
          `).run(
            voucher_no,
            `Auto-Recovery: Retail Cash Sale Receipt under Invoice #${invoiceNumber} for ${shop_name}`,
            total_amount,
            salesman_id || null,
            customer_id
          );
        }
      })();

      res.json({ success: true, invoiceId: responseId });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST Create Batch/Multiple Route Invoices
  app.post("/api/invoices/batch", (req, res) => {
    const { route, salesman_id, invoice_date, customer_ids, items } = req.body;

    try {
      const results: number[] = [];
      db.transaction(() => {
        for (const cId of customer_ids) {
          const customer = db.prepare("SELECT balance, route FROM customers WHERE id = ?").get(cId) as any;
          if (!customer) continue;

          const prevBalance = customer.balance || 0;

          // Compute Subtotal and Totals for this customer templates
          // We support Trade Pricing & Discount Scheme
          let billingSubtotal = 0;
          let billingDiscount = 0;
          let billingTotal = 0;

          const invoiceItemsToInsert: any[] = [];

          for (const item of items) {
            const cases = Number(item.cases) || 0;
            const units = Number(item.units) || 0;
            const priceC = Number(item.trade_price_per_case) || 0;
            const priceU = Number(item.trade_price_per_unit) || 0;

            const baseTotal = (cases * priceC) + (units * priceU);
            const discPc = Number(item.discount_percentage) || 0;
            const discAmt = baseTotal * (discPc / 100);
            const finalLineTotal = baseTotal - discAmt;

            billingSubtotal += baseTotal;
            billingDiscount += discAmt;
            billingTotal += finalLineTotal;

            invoiceItemsToInsert.push({
              sku_id: item.sku_id,
              cases,
              units,
              trade_price_per_case: priceC,
              trade_price_per_unit: priceU,
              retail_price: item.retail_price || 0,
              discount_percentage: discPc,
              discount_amount: discAmt,
              line_total: finalLineTotal
            });
          }

          const tempIdInfo = db.prepare("SELECT MAX(id) as maxId FROM invoices").get() as any;
          const nextId = (tempIdInfo.maxId || 0) + 1;
          const currentYear = new Date(invoice_date).getFullYear();
          const formattedNum = String(nextId).padStart(4, '0');
          const invoiceNumber = `INV-BCH-${currentYear}-${formattedNum}`;

          const info = db.prepare(`
            INSERT INTO invoices (
              invoice_number, customer_id, salesman_id, route, invoice_date,
              subtotal, discount_amount, tax_amount, total_amount, previous_balance,
              status, payment_method, is_consolidated, is_batch_generated, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'Pending', 'Credit', 0, 1, ?)
          `).run(
            invoiceNumber, cId, salesman_id || null, route, invoice_date,
            billingSubtotal, billingDiscount, billingTotal, prevBalance,
            'Batch Scheduled Route Delivery'
          );

          const invoiceId = info.lastInsertRowid;
          results.push(Number(invoiceId));

          const insertItem = db.prepare(`
            INSERT INTO invoice_items (
              invoice_id, sku_id, cases, units, trade_price_per_case, trade_price_per_unit,
              retail_price, discount_percentage, discount_amount, line_total
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          for (const line of invoiceItemsToInsert) {
            insertItem.run(
              invoiceId, line.sku_id, line.cases, line.units,
              line.trade_price_per_case, line.trade_price_per_unit,
              line.retail_price, line.discount_percentage,
              line.discount_amount, line.line_total
            );
          }

          // In batch-billing route mode, these are credit book items, so update user ledger
          db.prepare("UPDATE customers SET balance = balance + ? WHERE id = ?").run(billingTotal, cId);
        }
      })();

      res.json({ success: true, count: results.length, invoiceIds: results });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST Consolidate multiple invoices into a single monthly statement
  app.post("/api/invoices/consolidate", (req, res) => {
    const { customer_id, child_invoice_ids, invoice_date, notes } = req.body;

    try {
      let consolidatedId: number | null = null;
      db.transaction(() => {
        // Fetch children invoices
        const placeholders = child_invoice_ids.map(() => "?").join(",");
        const children = db.prepare(`
          SELECT * FROM invoices 
          WHERE id IN (${placeholders}) AND customer_id = ? AND is_consolidated = 0
        `).all(...child_invoice_ids, customer_id) as any[];

        if (children.length === 0) {
          throw new Error("No eligible un-consolidated invoices found for this customer account.");
        }

        let totalSubtotal = 0;
        let totalDiscount = 0;
        let totalTax = 0;
        let totalAmount = 0;

        for (const child of children) {
          totalSubtotal += child.subtotal;
          totalDiscount += child.discount_amount;
          totalTax += child.tax_amount;
          totalAmount += child.total_amount;
        }

        // Get max invoice id
        const tempIdInfo = db.prepare("SELECT MAX(id) as maxId FROM invoices").get() as any;
        const nextId = (tempIdInfo.maxId || 0) + 1;
        const currentYear = new Date(invoice_date).getFullYear();
        const formattedNum = String(nextId).padStart(4, '0');
        const invoiceNumber = `INV-CNS-${currentYear}-${formattedNum}`;

        const customer = db.prepare("SELECT balance, route FROM customers WHERE id = ?").get(customer_id) as any;
        const prevBalance = customer ? customer.balance : 0;

        // Insert consolidated invoice (is_consolidated = 2 implies Parent Consolidated Statement)
        const info = db.prepare(`
          INSERT INTO invoices (
            invoice_number, customer_id, salesman_id, route, invoice_date,
            subtotal, discount_amount, tax_amount, total_amount, previous_balance,
            status, payment_method, is_consolidated, is_batch_generated, notes
          ) VALUES (?, ?, null, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Credit', 2, 0, ?)
        `).run(
          invoiceNumber, customer_id, customer ? customer.route : null, invoice_date,
          totalSubtotal, totalDiscount, totalTax, totalAmount, prevBalance,
          notes || 'Consolidated Wholesale Summary Receipt'
        );

        consolidatedId = Number(info.lastInsertRowid);

        // Map child invoices as joined
        const insertMapping = db.prepare(`
          INSERT INTO invoice_consolidated_mapping (consolidated_invoice_id, child_invoice_id)
          VALUES (?, ?)
        `);

        for (const child of children) {
          insertMapping.run(consolidatedId, child.id);
          // Mark child as consolidated (is_consolidated = 1 implies Consolidated child)
          db.prepare("UPDATE invoices SET is_consolidated = 1 WHERE id = ?").run(child.id);
        }

        // Note: Children invoices already adjusted customer outstanding balances when they were originally created;
        // Consolidating is a billing layout merge, so we do NOT double-debit customer.balance.
      })();

      res.json({ success: true, consolidatedId });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // DELETE Invoice (reverts customer ledger credit)
  app.delete("/api/invoices/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.transaction(() => {
        const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id) as any;
        if (!invoice) throw new Error("Invoice record not found.");

        if (invoice.status !== 'Cancelled') {
          // If it was standard Credit sales, subtract from balance
          if (invoice.payment_method === 'Credit' && invoice.is_consolidated !== 1) {
            db.prepare("UPDATE customers SET balance = balance - ? WHERE id = ?").run(invoice.total_amount, invoice.customer_id);
          }
        }

        // If it's a consolidation parent, restore the child ones
        if (invoice.is_consolidated === 2) {
          const children = db.prepare("SELECT child_invoice_id FROM invoice_consolidated_mapping WHERE consolidated_invoice_id = ?").all(id) as any[];
          for (const ch of children) {
            db.prepare("UPDATE invoices SET is_consolidated = 0 WHERE id = ?").run(ch.child_invoice_id);
          }
        }

        db.prepare("DELETE FROM invoices WHERE id = ?").run(id);
      })();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/bank/accounts", (req, res) => {
    const accounts = db.prepare("SELECT * FROM bank_accounts").all();
    res.json(accounts);
  });

  app.post("/api/bank/accounts", (req, res) => {
    const { bank_name, account_number, account_title, initial_balance } = req.body;
    db.prepare("INSERT INTO bank_accounts (bank_name, account_number, account_title, balance) VALUES (?, ?, ?, ?)")
      .run(bank_name, account_number, account_title, initial_balance || 0);
    res.json({ status: "ok" });
  });

  app.get("/api/bank/transactions", (req, res) => {
    const txs = db.prepare(`
      SELECT t.*, a.bank_name, a.account_number 
      FROM bank_transactions t
      JOIN bank_accounts a ON t.account_id = a.id
      ORDER BY t.date DESC
    `).all();
    res.json(txs);
  });

  app.post("/api/bank/transactions", (req, res) => {
    const { account_id, type, amount, description, reference } = req.body;
    db.transaction(() => {
      db.prepare("INSERT INTO bank_transactions (account_id, type, amount, description, reference) VALUES (?, ?, ?, ?, ?)")
        .run(account_id, type, amount, description, reference);
      
      const multiplier = type === 'Deposit' ? 1 : -1;
      db.prepare("UPDATE bank_accounts SET balance = balance + ? WHERE id = ?").run(amount * multiplier, account_id);
    })();
    res.json({ status: "ok" });
  });

  app.get("/api/reports/receivables", (req, res) => {
    const data = db.prepare("SELECT id, name, shop_name, route, contact, credit_limit, balance FROM customers WHERE balance > 0 ORDER BY balance DESC").all();
    res.json(data);
  });

  app.get("/api/reports/payables", (req, res) => {
    const data = db.prepare("SELECT id, name, category, balance FROM suppliers WHERE balance > 0 ORDER BY balance DESC").all();
    res.json(data);
  });

  app.get("/api/reports/expenses/daily", (req, res) => {
    try {
      const data = db.prepare(`
        SELECT date(date) as day, category, SUM(amount) as total 
        FROM expenses 
        GROUP BY day, category 
        ORDER BY day DESC
      `).all();
      res.json(data);
    } catch (err) {
      console.error("Daily Expenses Error:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/reports/expenses/detailed", (req, res) => {
    try {
      const data = db.prepare(`
        SELECT * FROM expenses ORDER BY date DESC LIMIT 1000
      `).all();
      res.json(data);
    } catch (err) {
      console.error("Detailed Expenses Error:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/reports/master-sku", (req, res) => {
    try {
      const data = db.prepare(`
        SELECT s.id, s.name as sku_name, s.category, s.price_per_case, s.price_per_unit, s.units_per_case, 
               sup.name as supplier_name 
        FROM skus s
        LEFT JOIN suppliers sup ON s.supplier_id = sup.id
        ORDER BY sup.name, s.name
      `).all();
      res.json(data);
    } catch (err) {
      console.error("Master SKU Report Error:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/expenses/detailed', (req, res) => {
    const expenses = db.prepare("SELECT * FROM expenses ORDER BY date DESC LIMIT 100").all();
    res.json(expenses);
  });

  app.post('/api/expenses', (req, res) => {
    const { description, amount, category, bank_account_id, date, payment_method } = req.body;
    const finalDate = date || new Date().toISOString();
    const finalMethod = payment_method || (bank_account_id ? 'Online' : 'Cash');
    
    db.transaction(() => {
      // Record expense
      db.prepare("INSERT INTO expenses (description, amount, category, date, payment_method) VALUES (?, ?, ?, ?, ?)")
        .run(description, amount, category, finalDate, finalMethod);
      
      if (bank_account_id) {
        // Deduct from bank
        db.prepare("UPDATE bank_accounts SET balance = balance - ? WHERE id = ?").run(amount, bank_account_id);
        db.prepare("INSERT INTO bank_transactions (account_id, type, amount, description, date) VALUES (?, 'Withdrawal', ?, ?, ?)")
          .run(bank_account_id, amount, `Expense: ${description}`, finalDate);
      } else {
        // Deduct from counter cash
        db.prepare("UPDATE counter_cash SET balance = balance - ? WHERE id = 1").run(amount);
        db.prepare("INSERT INTO counter_cash_logs (type, amount, source, description, date) VALUES ('Out', ?, 'Expense', ?, ?)")
          .run(amount, description, finalDate);
      }
    })();
    
    res.json({ success: true });
  });

  app.post('/api/expenses/bulk', (req, res) => {
    const expenses = req.body;
    if (!Array.isArray(expenses)) {
      return res.status(400).json({ error: "Invalid data format. Expected an array." });
    }

    try {
      db.transaction(() => {
        for (const exp of expenses) {
          const { description, amount, category, bank_account_id, date, payment_method } = exp;
          const finalDate = date || new Date().toISOString();
          const finalMethod = payment_method || (bank_account_id ? 'Online' : 'Cash');
          
          // Record expense
          db.prepare("INSERT INTO expenses (description, amount, category, date, payment_method) VALUES (?, ?, ?, ?, ?)")
            .run(description, amount, category, finalDate, finalMethod);
          
          if (bank_account_id) {
            // Deduct from bank
            db.prepare("UPDATE bank_accounts SET balance = balance - ? WHERE id = ?").run(amount, bank_account_id);
            db.prepare("INSERT INTO bank_transactions (account_id, type, amount, description, date) VALUES (?, 'Withdrawal', ?, ?, ?)")
              .run(bank_account_id, amount, `Expense: ${description}`, finalDate);
          } else {
            // Deduct from counter cash
            db.prepare("UPDATE counter_cash SET balance = balance - ? WHERE id = 1").run(amount);
            db.prepare("INSERT INTO counter_cash_logs (type, amount, source, description, date) VALUES ('Out', ?, 'Expense', ?, ?)")
              .run(amount, description, finalDate);
          }
        }
      })();
      res.json({ success: true, count: expenses.length });
    } catch (err) {
      console.error("Bulk Expense Error:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/employees/:id/loans", (req, res) => {
    const { id } = req.params;
    const loans = db.prepare("SELECT * FROM employee_loans WHERE employee_id = ? ORDER BY date DESC").all(id);
    res.json(loans);
  });

  app.post("/api/employees/:id/loans", (req, res) => {
    const { id } = req.params;
    const { amount, type, description } = req.body;
    db.prepare("INSERT INTO employee_loans (employee_id, amount, type, description) VALUES (?, ?, ?, ?)")
      .run(id, amount, type, description);
    res.json({ status: "ok" });
  });

  app.get("/api/search", (req, res) => {
    try {
      const { q, type } = req.query;
      if (!type) {
        return res.status(400).json({ error: "Missing type query parameter" });
      }
      const queryStr = q ? String(q).trim() : "";
      if (!queryStr) {
        return res.json([]);
      }

      const isNumeric = /^\d+$/.test(queryStr);
      let results: any[] = [];

      if (type === 'products') {
        let exactMatch: any = null;
        if (isNumeric) {
          exactMatch = db.prepare("SELECT *, 'products' as entity_type FROM skus WHERE id = ?").get(parseInt(queryStr));
        }
        
        const fuzzyResults = db.prepare("SELECT *, 'products' as entity_type FROM skus WHERE name LIKE ?").all(`%${queryStr}%`);
        
        if (exactMatch) {
          results = [exactMatch, ...fuzzyResults.filter((r: any) => r.id !== exactMatch.id)];
        } else {
          results = fuzzyResults;
        }
      } else if (type === 'routes') {
        let exactMatch: any = null;
        if (isNumeric) {
          exactMatch = db.prepare("SELECT *, 'routes' as entity_type FROM routes WHERE id = ?").get(parseInt(queryStr));
        }

        const fuzzyResults = db.prepare("SELECT *, 'routes' as entity_type FROM routes WHERE name LIKE ? OR territory LIKE ?").all(`%${queryStr}%`, `%${queryStr}%`);

        if (exactMatch) {
          results = [exactMatch, ...fuzzyResults.filter((r: any) => r.id !== exactMatch.id)];
        } else {
          results = fuzzyResults;
        }
      } else if (type === 'customers') {
        let exactMatch: any = null;
        if (isNumeric) {
          exactMatch = db.prepare("SELECT *, 'customers' as entity_type FROM customers WHERE id = ?").get(parseInt(queryStr));
        }

        const fuzzyResults = db.prepare("SELECT *, 'customers' as entity_type FROM customers WHERE name LIKE ? OR shop_name LIKE ?").all(`%${queryStr}%`, `%${queryStr}%`);

        if (exactMatch) {
          results = [exactMatch, ...fuzzyResults.filter((r: any) => r.id !== exactMatch.id)];
        } else {
          results = fuzzyResults;
        }
      }

      res.json(results);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/routes", (req, res) => {
    try {
      const { activeOnly } = req.query;
      let qStr = `
        SELECT r.*, e1.name as salesman_name, e2.name as driver_name 
        FROM routes r
        LEFT JOIN employees e1 ON r.salesman_id = e1.id
        LEFT JOIN employees e2 ON r.driver_id = e2.id
      `;
      if (activeOnly === 'true') {
        qStr += " WHERE r.isActive = 1 OR r.isActive IS NULL";
      }
      const data = db.prepare(qStr).all();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/routes", (req, res) => {
    const { name, territory, assigned_days, salesman_id, driver_id, isActive } = req.body;
    try {
      const info = db.prepare(`
        INSERT INTO routes (name, territory, assigned_days, salesman_id, driver_id, isActive) 
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(name, territory, assigned_days || '', salesman_id || null, driver_id || null, isActive === undefined ? 1 : isActive);
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put("/api/routes/:id", (req, res) => {
    const { id } = req.params;
    const { name, territory, assigned_days, salesman_id, driver_id, isActive } = req.body;
    try {
      db.prepare(`
        UPDATE routes 
        SET name = ?, territory = ?, assigned_days = ?, salesman_id = ?, driver_id = ?, isActive = ? 
        WHERE id = ?
      `).run(name, territory, assigned_days || '', salesman_id || null, driver_id || null, isActive === undefined ? 1 : isActive, id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete("/api/routes/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("UPDATE routes SET isActive = 0 WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/employees", (req, res) => {
    try {
      const { activeOnly } = req.query;
      let qStr = `
        SELECT e.*, s.target_threshold as target
        FROM employees e
        LEFT JOIN salesmen s ON e.id = s.employee_id
      `;
      if (activeOnly === 'true') {
        qStr += " WHERE e.isActive = 1 OR e.isActive IS NULL";
      }
      const employees = db.prepare(qStr).all();
      res.json(employees);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/employees", (req, res) => {
    const { id, name, role, contact, base_salary, commission_pc, target, food_allowance, working_days, status, isActive } = req.body;
    
    try {
      db.transaction(() => {
        const resolvedIsActive = isActive === undefined ? 1 : isActive;
        const resolvedStatus = status || (resolvedIsActive ? 'active' : 'inactive');

        if (id) {
          db.prepare("UPDATE employees SET name = ?, role = ?, contact = ?, base_salary = ?, commission_pc = ?, food_allowance = ?, working_days = ?, status = ?, isActive = ? WHERE id = ?")
            .run(name, role, contact, base_salary, commission_pc, food_allowance, working_days, resolvedStatus, resolvedIsActive, id);
          
          if (role === 'Salesman') {
            const salesman = db.prepare("SELECT id FROM salesmen WHERE employee_id = ?").get(id) as { id: number } | undefined;
            if (salesman) {
              db.prepare("UPDATE salesmen SET target_threshold = ? WHERE id = ?").run(target, salesman.id);
            } else {
              db.prepare("INSERT INTO salesmen (employee_id, target_threshold) VALUES (?, ?)").run(id, target);
            }
          }
        } else {
          const info = db.prepare("INSERT INTO employees (name, role, contact, base_salary, commission_pc, food_allowance, working_days, status, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .run(name, role, contact, base_salary, commission_pc, food_allowance, working_days, resolvedStatus, resolvedIsActive);
          const newId = info.lastInsertRowid;
          
          if (role === 'Salesman') {
            db.prepare("INSERT INTO salesmen (employee_id, target_threshold) VALUES (?, ?)").run(newId, target);
          }
        }
      })();
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete("/api/employees/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("UPDATE employees SET status = 'inactive', isActive = 0 WHERE id = ?").run(id);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/employees/:id/performance", (req, res) => {
    const { id } = req.params;
    const performance = db.prepare(`
      SELECT 
        COUNT(o.id) as total_orders,
        SUM(o.total_amount) as total_sales,
        AVG(o.total_amount) as avg_order_value
      FROM orders o
      JOIN salesmen s ON o.salesman_id = s.id
      WHERE s.employee_id = ? AND o.is_dummy = 0
    `).get(id);
    res.json(performance);
  });

  app.get("/api/employees/:id/absences", (req, res) => {
    const { id } = req.params;
    const absences = db.prepare("SELECT * FROM absences WHERE employee_id = ? ORDER BY date DESC").all(id);
    res.json(absences);
  });

  app.post("/api/employees/:id/absences", (req, res) => {
    const { id } = req.params;
    const { date, reason, deduction_amount } = req.body;
    db.prepare("INSERT INTO absences (employee_id, date, reason, deduction_amount) VALUES (?, ?, ?, ?)")
      .run(id, date, reason, deduction_amount);
    res.json({ status: "ok" });
  });

  app.get("/api/employees/:id/payments", (req, res) => {
    const { id } = req.params;
    const payments = db.prepare("SELECT * FROM salary_payments WHERE employee_id = ? ORDER BY payment_date DESC").all(id);
    res.json(payments);
  });

  app.post("/api/employees/:id/payments", (req, res) => {
    const { id } = req.params;
    const { amount, month } = req.body;
    db.prepare("INSERT INTO salary_payments (employee_id, amount, month) VALUES (?, ?, ?)")
      .run(id, amount, month);
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = __dirname.endsWith("dist") ? __dirname : path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
