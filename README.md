# KEIVO POS - Restaurant Point of Sale & Dine-In QR Ordering System

A modern Point of Sale (POS) and Dine-In Table Ordering web application built with **Next.js**, **React**, **TypeScript**, **Tailwind CSS**, and **Prisma ORM**.

## ✨ Features

- **Cashier POS Interface**:
  - Interactive table map (Dine-in) & Quick Takeaway ordering
  - Category and product menu browsing with live search
  - Split order & custom payment modal (Cash, Static QRIS, and Multi-Bank Transfer with 1-click copy)
  - Receipt printing simulation & change calculator (quick cash buttons)
- **Promo & Discount Engine**:
  - Voucher Transaksi (Order-Level / bill discounts)
  - Promo Menu / Produk (Item-Level discounts with promotional badges & strikethrough prices)
  - Proportional non-stackable discount rules
- **Dine-In Customer QR Menu**:
  - Mobile-friendly customer self-service menu accessible via table QR tokens (`/menu/[tableToken]`)
  - Live active product promotions carousel & cards
  - Real-time customer cart, order notes, and order status tracking
- **Master Data & Settings**:
  - Menu catalog management (dishes, pricing, categories, stock availability)
  - Table management with auto-generated QR tokens
  - Payment accounts management (Upload static QRIS & manage multi-bank transfer accounts)
  - Customer & membership tiers management

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ or 20+
- npm, pnpm, or yarn

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/datatransferhkar-rgb/keivo-pos.git
   cd keivo-pos
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

4. **Initialize Database (SQLite)**:
   ```bash
   npx prisma db push
   npm run db:seed
   ```

5. **Run the Development Server**:
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database / ORM**: SQLite (Prisma ORM) / MySQL migration ready
- **Utilities**: QR Code generator, SheetJS (XLSX)

## 📄 License

Private - All rights reserved.
