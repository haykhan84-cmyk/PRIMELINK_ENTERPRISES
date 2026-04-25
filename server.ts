import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("erp.db");
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Initialize Database Schema
db.transaction(() => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS skus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      price_per_case REAL,
      price_per_unit REAL,
      units_per_case INTEGER,
      cogs_per_case REAL,
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
    route TEXT,
    territory TEXT,
    contact TEXT,
    is_filer INTEGER DEFAULT 0,
    credit_limit REAL DEFAULT 0,
    balance REAL DEFAULT 0,
    lat REAL,
    lng REAL
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT, -- SPO, Salesman, Accountant, Warehouse
    contact TEXT,
    agreement_accepted INTEGER DEFAULT 0,
    agreement_timestamp TEXT,
    device_id TEXT,
    base_salary REAL DEFAULT 0,
    commission_pc REAL DEFAULT 0
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
    order_date TEXT DEFAULT CURRENT_TIMESTAMP,
    total_amount REAL,
    tax_amount REAL DEFAULT 0,
    further_tax REAL DEFAULT 0,
    is_paid INTEGER DEFAULT 0,
    is_dummy INTEGER DEFAULT 0,
    sync_status TEXT DEFAULT 'synced',
    FOREIGN KEY(customer_id) REFERENCES customers(id),
    FOREIGN KEY(salesman_id) REFERENCES salesmen(id)
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
    date TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sys_ready', '1');
  `);

  // Migrations / Ensure columns exist
  const tables = ['customers', 'suppliers', 'bank_accounts', 'counter_cash'];
  for (const table of tables) {
    try {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
      if (!columns.find(c => c.name === 'balance')) {
        db.prepare(`ALTER TABLE ${table} ADD COLUMN balance REAL DEFAULT 0`).run();
      }
    } catch (e) {
      // Table might not exist yet, handled by schema init
    }
  }


  // Seed some data if empty
  const employeeCountRow = db.prepare("SELECT count(*) as count FROM employees").get() as { count: number };
  if (employeeCountRow.count === 0) {
    db.prepare(`INSERT INTO skus (name, category, price_per_case, price_per_unit, units_per_case, cogs_per_case, gst_rate) VALUES 
      ('ZOR Energy 250ml', 'Energy Drink', 1200, 50, 24, 900, 18),
      ('Sparkling Water 500ml', 'Water', 800, 35, 24, 600, 18),
      ('Alkaline Water 1L', 'Water', 1000, 85, 12, 750, 18)
    `).run();

    db.prepare(`INSERT INTO customers (name, route, territory, contact, credit_limit, is_filer) VALUES 
      ('Swat General Store', 'Main Bazaar', 'Mingora', '0312-1234567', 50000, 1),
      ('Kalam Valley Hotel', 'Kalam Rd', 'Kalam', '0312-7654321', 100000, 0)
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
})();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Request logger
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
    });
    next();
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  // API Routes
  app.get("/api/skus", (req, res) => {
    const skus = db.prepare("SELECT * FROM skus").all();
    res.json(skus);
  });

  app.post("/api/skus/bulk", (req, res) => {
    const skus = req.body;
    if (!Array.isArray(skus)) {
      return res.status(400).json({ error: "Invalid data format. Expected an array." });
    }

    const insert = db.prepare(`
      INSERT INTO skus (name, category, price_per_case, price_per_unit, units_per_case, cogs_per_case)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((data) => {
      for (const s of data) {
        insert.run(
          s.name, 
          s.category || 'General', 
          s.price_per_case || 0, 
          s.price_per_unit || 0, 
          s.units_per_case || 1, 
          s.cogs_per_case || 0
        );
      }
    });

    try {
      insertMany(skus);
      res.json({ success: true, count: skus.length });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/customers", (req, res) => {
    const customers = db.prepare("SELECT * FROM customers").all();
    res.json(customers);
  });

  app.post("/api/customers", (req, res) => {
    const { name, route, contact, credit_limit } = req.body;
    const info = db.prepare("INSERT INTO customers (name, route, contact, credit_limit) VALUES (?, ?, ?, ?)").run(
      name, route, contact, credit_limit
    );
    res.json({ id: info.lastInsertRowid });
  });

  app.post("/api/customers/bulk", (req, res) => {
    const customers = req.body; // Expecting an array of objects
    if (!Array.isArray(customers)) {
      return res.status(400).json({ error: "Invalid data format. Expected an array." });
    }

    const insert = db.prepare("INSERT INTO customers (name, route, contact, credit_limit) VALUES (?, ?, ?, ?)");
    const insertMany = db.transaction((data) => {
      for (const c of data) {
        insert.run(c.name, c.route, c.contact, c.credit_limit || 50000);
      }
    });

    try {
      insertMany(customers);
      res.json({ success: true, count: customers.length });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/inventory", (req, res) => {
    const inventory = db.prepare(`
      SELECT i.*, s.name as sku_name, s.category 
      FROM inventory i 
      JOIN skus s ON i.sku_id = s.id 
      ORDER BY i.expiry_date ASC
    `).all();
    res.json(inventory);
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

  // Reporting Routes
  app.get("/api/reports/sales", (req, res) => {
    const sales = db.prepare(`
      SELECT 
        o.id as order_id,
        o.order_date,
        c.name as customer_name,
        e.name as salesman_name,
        o.total_amount,
        o.tax_amount,
        o.is_paid
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      JOIN salesmen s ON o.salesman_id = s.id
      JOIN employees e ON s.employee_id = e.id
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
        COALESCE(SUM(i.quantity_cases), 0) as total_cases,
        COALESCE(SUM(i.quantity_units), 0) as total_units
      FROM skus s
      LEFT JOIN inventory i ON s.id = i.sku_id
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

  // Fleet routes
  app.get("/api/fleet", (req, res) => {
    const fleet = db.prepare("SELECT * FROM fleet").all();
    res.json(fleet);
  });

  app.post("/api/fleet/log", (req, res) => {
    const { vehicle_id, type, amount, km } = req.body;
    db.prepare("INSERT INTO fleet_logs (vehicle_id, type, amount, km_at_log) VALUES (?, ?, ?, ?)").run(vehicle_id, type, amount, km);
    // Update vehicle KM
    db.prepare("UPDATE fleet SET current_km = ? WHERE id = ?").run(km, vehicle_id);
    res.json({ status: "ok" });
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

  db.exec(`
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
  `);

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
    const data = db.prepare("SELECT id, name, route, balance FROM customers WHERE balance > 0 ORDER BY balance DESC").all();
    res.json(data);
  });

  app.get("/api/reports/payables", (req, res) => {
    const data = db.prepare("SELECT id, name, category, balance FROM suppliers WHERE balance > 0 ORDER BY balance DESC").all();
    res.json(data);
  });

  app.get("/api/reports/expenses/daily", (req, res) => {
    const data = db.prepare(`
      SELECT date, category, SUM(amount) as total 
      FROM expenses 
      GROUP BY date, category 
      ORDER BY date DESC
    `).all();
    res.json(data);
  });

  app.get('/api/expenses/detailed', (req, res) => {
    const expenses = db.prepare("SELECT * FROM expenses ORDER BY date DESC LIMIT 100").all();
    res.json(expenses);
  });

  app.post('/api/expenses', (req, res) => {
    const { description, amount, category, bank_account_id } = req.body;
    
    db.transaction(() => {
      // Record expense
      db.prepare("INSERT INTO expenses (description, amount, category, date) VALUES (?, ?, ?, datetime('now'))")
        .run(description, amount, category);
      
      if (bank_account_id) {
        // Deduct from bank
        db.prepare("UPDATE bank_accounts SET balance = balance - ? WHERE id = ?").run(amount, bank_account_id);
        db.prepare("INSERT INTO bank_transactions (account_id, type, amount, description, date) VALUES (?, 'Withdrawal', ?, ?, datetime('now'))")
          .run(bank_account_id, amount, `Expense: ${description}`);
      } else {
        // Deduct from counter cash
        db.prepare("UPDATE counter_cash SET balance = balance - ? WHERE id = 1").run(amount);
        db.prepare("INSERT INTO counter_cash_logs (type, amount, source, description, date) VALUES ('Out', ?, 'Expense', ?, datetime('now'))")
          .run(amount, description);
      }
    })();
    
    res.json({ success: true });
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

  app.get("/api/employees", (req, res) => {
    const employees = db.prepare(`
      SELECT e.*, s.target_threshold as target
      FROM employees e
      LEFT JOIN salesmen s ON e.id = s.employee_id
    `).all();
    res.json(employees);
  });

  app.post("/api/employees", (req, res) => {
    const { id, name, role, contact, base_salary, commission_pc, target } = req.body;
    
    db.transaction(() => {
      if (id) {
        db.prepare("UPDATE employees SET name = ?, role = ?, contact = ?, base_salary = ?, commission_pc = ? WHERE id = ?")
          .run(name, role, contact, base_salary, commission_pc, id);
        
        if (role === 'Salesman') {
          const salesman = db.prepare("SELECT id FROM salesmen WHERE employee_id = ?").get(id) as { id: number } | undefined;
          if (salesman) {
            db.prepare("UPDATE salesmen SET target_threshold = ? WHERE id = ?").run(target, salesman.id);
          } else {
            db.prepare("INSERT INTO salesmen (employee_id, target_threshold) VALUES (?, ?)").run(id, target);
          }
        }
      } else {
        const info = db.prepare("INSERT INTO employees (name, role, contact, base_salary, commission_pc) VALUES (?, ?, ?, ?, ?)")
          .run(name, role, contact, base_salary, commission_pc);
        const newId = info.lastInsertRowid;
        
        if (role === 'Salesman') {
          db.prepare("INSERT INTO salesmen (employee_id, target_threshold) VALUES (?, ?)").run(newId, target);
        }
      }
    })();
    
    res.json({ status: "ok" });
  });

  app.delete("/api/employees/:id", (req, res) => {
    const { id } = req.params;
    db.transaction(() => {
      db.prepare("DELETE FROM salesmen WHERE employee_id = ?").run(id);
      db.prepare("DELETE FROM employees WHERE id = ?").run(id);
    })();
    res.json({ status: "ok" });
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
    const distPath = path.join(process.cwd(), "dist");
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
