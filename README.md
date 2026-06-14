# Digital_Viser — FDR Investment Platform 🚀

A full-stack, high-yield investment web application for creating and managing Fixed Deposit Receipts (FDRs). 

The platform features a **premium glassmorphic dark-mode interface**, interactive calculators, automated database logs, and an integrated **Time Simulator console** to accelerate interest payouts for sandbox review.

---

## 🛠️ Tech Stack

| Component | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18 + TypeScript | Highly responsive modular SPA |
| **Build Tool** | Vite 5 | Instant dev hot-reloads |
| **Styling** | Vanilla CSS Variables | Premium custom dashboard, glassmorphism, animations |
| **Icons** | Lucide React | Clean outline iconography |
| **Backend** | Node.js + Express | RESTful API server |
| **Authentication** | JWT + bcryptjs | Token-based security & salted passwords |
| **Database** | MySQL | Robust relational transaction storage |

---

## ✨ Features

1. **User Auth & Security**: Secure registration and login. Session token checks verify JWT expiration.
2. **Deposit sandbox**: Simulated top-up form supporting Credit Card, UPI, and Bank Transfers.
3. **Custom FDR Builder**: Sliders and pickers to define deposit amount, start date, maturity date, installment cycle, and yield rates.
4. **Interactive Yield Calculator**: Real-time projection card outputs total payouts, return cycles, and ROI before purchase.
5. **Time Simulator clock**: Fast-forward virtual days at will. The backend interest engine processes accruals, logs payouts, and releases matured principals.
6. **Detailed Ledgers**: A transparent transaction grid detailing balance movements with customized status badges.

---

## 📋 Prerequisites

- **Node.js** (v18 or higher)
- **MySQL Server**
- **npm** or **yarn**

---

## 🚀 Setup Instructions

### 1. Database Creation
Start your MySQL server and execute the following statement to create the application database:
```sql
CREATE DATABASE IF NOT EXISTS digital_viser;
```

### 2. Backend Server Setup
Install dependencies and configure database parameters:
```bash
cd backend
npm install
```
Create a `.env` file inside the `backend` directory (a template `.env.example` has been created for reference):
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=digital_viser
DB_PORT=3306
JWT_SECRET=digital_viser_secret_key_2026
PORT=5000
```
Start the backend server in development mode:
```bash
npm run dev
```
The server will bind to `http://localhost:5000` and automatically initialize database tables if they do not exist.

### 3. Frontend Client Setup
Open a separate terminal window and run:
```bash
cd frontend
npm install
npm run dev
```
The client will start on `http://localhost:5173`. Any API calls to `/api` are automatically proxied to the backend on port `5000`.

---

## 📡 Backend API endpoints

### Auth Routes (`/api/auth`)
- `POST /register` — Register a new account.
- `POST /login` — Authenticate user and receive JWT.
- `GET /profile` — Retrieve authenticated session profile (JWT required).

### Wallet Routes (`/api/wallet`)
- `POST /deposit` — simulated deposit credit (JWT required).
- `GET /transactions` — retrieve full ledger list (JWT required).

### FDR Routes (`/api/fdr`)
- `POST /create` — lock principal and initiate FDR agreement (JWT required).
- `GET /my-fdrs` — fetch active and completed user FDRs (JWT required).

### Simulator Routes (`/api/simulator`)
- `GET /time` — retrieve current simulated system calendar date (JWT required).
- `POST /tick` — advance calendar clock and trigger interest scheduler (JWT required).

---

## 📁 Project Tree Structure
```
Digital_Viser/
├── backend/
│   ├── src/
│   │   ├── middleware/
│   │   │   └── auth.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── fdr.js
│   │   │   ├── simulator.js
│   │   │   └── wallet.js
│   │   ├── db.js
│   │   └── server.js
│   ├── .env
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── MetricCard.tsx
│   │   ├── views/
│   │   │   ├── Auth.tsx
│   │   │   ├── CreateFDR.tsx
│   │   │   ├── DashboardOverview.tsx
│   │   │   ├── Deposit.tsx
│   │   │   ├── MyFDRs.tsx
│   │   │   └── Transactions.tsx
│   │   ├── api.ts
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── main.tsx
│   │   └── vite-env.d.ts
│   ├── index.html
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── package.json
└── README.md
```

---

## 🛡️ License
Distributed under the MIT License. See `LICENSE` for more information.
