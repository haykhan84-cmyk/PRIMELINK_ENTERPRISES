# Primelink Enterprises ERP

A robust, full-stack Enterprise Resource Planning (ERP) application designed specifically for distribution businesses in the Swat region. This application handles everything from inventory and batch management to fleet logistics, employee commissions, and financial settlements.

## 🚀 Features

- **Dashboard Intelligence**: Real-time sales vs expense tracking, inventory valuation, and outstanding receivables.
- **Inventory & Batch Tracking**: Manage SKUs with batch numbers and expiry dates. Automatic stock valuation.
- **Fleet & Logistics**: Track vehicle fuel, maintenance costs, and mileage.
- **Territory Management**: Organise customers by route and territory with credit limit tracking.
- **Employee & Salesman Portal**: Manage roles (SPO, Salesman, Warehouse), track performance, targets, and commissions.
- **Financial Settlements**: PRS (Product Return/Settlement) workflow for salesmen returning from routes.
- **Treasury Management**: Track Multiple Bank Accounts and Counter Cash (Physical Pot).
- **Procurment & Payables**: Supplier onboarding and ledger management.
- **Reporting Engine**: Detailed sales reports, stock status, returns, receivables, payables, and daily expenses.

## 🛠 Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Framer Motion.
- **Backend**: Node.js (Express), Better-SQLite3.
- **Database**: SQLite (Local, file-based).

## 📦 Getting Started

### Prerequisites

- Node.js (v18+)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd primelink-erp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. For production:
   ```bash
   npm run build
   npm start
   ```

## 📂 Project Structure

- `server.ts`: Express server and SQLite database initialization/API routes.
- `src/App.tsx`: Main application routing and sidebar navigation.
- `src/components/`: Modular React components for each business function.
- `erp.db`: The SQLite database file (created on first run).

## 🔒 Security & Best Practices

- Uses SQLite WAL (Write-Ahead Logging) for concurrent access.
- Transactional integrity for complex financial operations (Settlements, Bank Deposits).
- Responsive UI designed for both Desktop and Mobile (essential for warehouse/field staff).

## 📄 License

MIT
