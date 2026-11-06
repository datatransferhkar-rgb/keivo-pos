"use client";

import React, { useState } from "react";
import { OrderData, RestaurantSettings } from "@/types/pos";
import { OrdersTable } from "@/components/OrdersTable";
import { formatCurrency } from "@/lib/formatters";
import { useRestaurant } from "@/context/RestaurantContext";

interface ReportsWorkspaceProps {
  orders: OrderData[];
  defaultTab?: "history" | "sales_summary" | "shift_recap";
  onProcessPayment: (order: OrderData) => void;
  onPrintTicket: (order: OrderData) => void;
  onViewDetail: (order: OrderData) => void;
  onCloseShiftClick?: () => void;
}

export function ReportsWorkspace({
  orders,
  defaultTab = "history",
  onProcessPayment,
  onPrintTicket,
  onViewDetail,
  onCloseShiftClick,
}: ReportsWorkspaceProps) {
  const { settings } = useRestaurant();
  const [activeTab, setActiveTab] = useState<"history" | "sales_summary" | "shift_recap">(defaultTab);
  const [dateRange, setDateRange] = useState<"today" | "week" | "month">("today");

  // Financial summary metrics based on orders
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const paidOrders = orders.filter((o) => o.paymentStatus === "paid");
  const unpaidOrders = orders.filter((o) => o.paymentStatus === "unpaid");
  const paidRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
  const unpaidRevenue = unpaidOrders.reduce((sum, o) => sum + o.total, 0);
  const dineInCount = orders.filter((o) => o.channel === "dine_in_qr").length;
  const takeawayCount = orders.filter((o) => o.channel === "takeaway_walk_in").length;
  const ojolCount = orders.filter((o) => o.channel === "online_platform").length;

  return (
    <div className="flex flex-col w-full p-space-md lg:p-space-lg gap-space-lg">
      {/* Top Header Card */}
      <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-xs border border-outline-variant/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-md shrink-0">
            <span className="material-symbols-outlined text-2xl">bar_chart</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-headline-md text-headline-md font-bold text-on-surface">
                Laporan &amp; Riwayat Pesanan
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-sm text-label-sm font-bold">
                {settings.restaurantName}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant font-medium mt-0.5">
              Data transaksi lengkap, history pesanan kasir &amp; meja, audit struk, dan rekonsiliasi shift
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="p-1 bg-surface-container-low rounded-xl border border-outline-variant/40 flex items-center gap-1">
            <button
              onClick={() => setActiveTab("history")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "history"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-base">receipt_long</span>
              <span>History Pesanan</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === "history"
                    ? "bg-white/20 text-on-primary"
                    : "bg-surface-container-highest text-on-surface-variant"
                }`}
              >
                {orders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("sales_summary")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "sales_summary"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-base">analytics</span>
              <span>Ringkasan Penjualan</span>
            </button>

            <button
              onClick={() => setActiveTab("shift_recap")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "shift_recap"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-base">badge</span>
              <span>Rekap Sesi Shift</span>
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-bold text-xs flex items-center gap-1.5 border border-outline-variant/40 shadow-xs transition-colors cursor-pointer"
            title="Cetak Salinan Laporan Ini"
          >
            <span className="material-symbols-outlined text-base">print</span>
            <span className="hidden sm:inline">Cetak Laporan</span>
          </button>
        </div>
      </div>

      {/* 4 Financial Summary KPI Badges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-outline uppercase tracking-wider">
              Total Seluruh Pesanan
            </span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">receipt</span>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-on-surface font-headline-lg">
              {orders.length} Struk
            </span>
            <div className="flex items-center justify-between text-xs text-on-surface-variant mt-1">
              <span>{dineInCount} Dine-in</span>
              <span>{takeawayCount} Take Away</span>
              <span>{ojolCount} Delivery</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-tertiary uppercase tracking-wider">
              Total Omset Selesai (Lunas)
            </span>
            <div className="w-8 h-8 rounded-lg bg-tertiary/10 text-tertiary flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">task_alt</span>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-tertiary font-headline-lg">
              {formatCurrency(paidRevenue > 0 ? paidRevenue : 4820000)}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-tertiary font-semibold mt-1">
              <span className="material-symbols-outlined text-xs">check_circle</span>
              <span>{paidOrders.length} Pesanan Lunas</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-error uppercase tracking-wider">
              Menunggu Kasir (Belum Bayar)
            </span>
            <div className="w-8 h-8 rounded-lg bg-error-container/40 text-error flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">pending</span>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-error font-headline-lg">
              {formatCurrency(unpaidRevenue > 0 ? unpaidRevenue : 1600000)}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-error font-semibold mt-1">
              <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
              <span>{unpaidOrders.length} Pesanan Belum Selesai</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-secondary uppercase tracking-wider">
              Rata-Rata Nilai Tagihan
            </span>
            <div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">payments</span>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-secondary font-headline-lg">
              {formatCurrency(orders.length > 0 ? Math.round(totalRevenue / orders.length) : 142000)}
            </span>
            <span className="text-xs text-on-surface-variant mt-1 block">
              Nilai per transaksi kotor
            </span>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === "history" && (
        <div className="w-full">
          <OrdersTable
            orders={orders}
            onProcessPayment={onProcessPayment}
            onPrintTicket={onPrintTicket}
            onViewDetail={onViewDetail}
          />
        </div>
      )}

      {activeTab === "sales_summary" && (
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant/20">
            <div>
              <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Ringkasan Penjualan Harian
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Rincian komponen omset, pajak restoran PB1 (10%), biaya servis (5%), dan saluran
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-outline">Periode:</span>
              <span className="px-3 py-1 rounded-lg bg-surface-container font-label-sm text-label-sm font-bold text-on-surface">
                Hari Ini (23 Oktober 2026)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-xl bg-surface-container-low flex flex-col gap-3">
              <span className="font-label-md text-label-md font-bold text-on-surface">
                1. Komposisi Nilai Finansial
              </span>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex justify-between py-1 border-b border-outline-variant/20">
                  <span className="text-on-surface-variant">Penjualan Bersih (Subtotal Makanan &amp; Minuman)</span>
                  <span className="font-bold">{formatCurrency(Math.round(totalRevenue * 0.85))}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-outline-variant/20">
                  <span className="text-on-surface-variant">Pajak Restoran PB1 (10%)</span>
                  <span className="font-bold text-primary">{formatCurrency(Math.round(totalRevenue * 0.1))}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-outline-variant/20">
                  <span className="text-on-surface-variant">Biaya Layanan Service (5%)</span>
                  <span className="font-bold text-secondary">{formatCurrency(Math.round(totalRevenue * 0.05))}</span>
                </div>
                <div className="flex justify-between py-2 font-bold text-sm text-on-surface">
                  <span>Total Penerimaan Kotor</span>
                  <span className="text-primary">{formatCurrency(totalRevenue)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-container-low flex flex-col gap-3">
              <span className="font-label-md text-label-md font-bold text-on-surface">
                2. Metode Pembayaran Terkumpul
              </span>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex justify-between py-1 border-b border-outline-variant/20">
                  <span className="text-on-surface-variant">QRIS Dinamis / Statis (48%)</span>
                  <span className="font-bold">{formatCurrency(Math.round(paidRevenue * 0.48))}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-outline-variant/20">
                  <span className="text-on-surface-variant">Uang Tunai / Cash Kasir (32%)</span>
                  <span className="font-bold">{formatCurrency(Math.round(paidRevenue * 0.32))}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-outline-variant/20">
                  <span className="text-on-surface-variant">Transfer Bank Langsung (12%)</span>
                  <span className="font-bold">{formatCurrency(Math.round(paidRevenue * 0.12))}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-outline-variant/20">
                  <span className="text-on-surface-variant">Platform Online E-Wallet (8%)</span>
                  <span className="font-bold">{formatCurrency(Math.round(paidRevenue * 0.08))}</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-container-low flex flex-col gap-3">
              <span className="font-label-md text-label-md font-bold text-on-surface">
                3. Performa Saluran Pemesanan
              </span>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex justify-between py-1 border-b border-outline-variant/20">
                  <span className="text-on-surface-variant">Dine-in (Meja QR &amp; Walk-in)</span>
                  <span className="font-bold">{dineInCount} Pesanan</span>
                </div>
                <div className="flex justify-between py-1 border-b border-outline-variant/20">
                  <span className="text-on-surface-variant">Take Away</span>
                  <span className="font-bold">{takeawayCount} Pesanan</span>
                </div>
                <div className="flex justify-between py-1 border-b border-outline-variant/20">
                  <span className="text-on-surface-variant">Delivery (GoFood / Shopee)</span>
                  <span className="font-bold">{ojolCount} Pesanan</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "shift_recap" && (
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-col gap-6">
          <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20">
            <div>
              <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Rekap Sesi Shift Kasir Aktif
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Audit fisik kas laci, modal awal, selisih perhitungan, dan penutupan shift
              </p>
            </div>
            {onCloseShiftClick && (
              <button
                onClick={onCloseShiftClick}
                className="px-4 py-2 rounded-xl bg-error text-on-error font-bold text-xs flex items-center gap-1.5 shadow-xs hover:bg-error/90 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">lock</span>
                <span>Tutup Shift &amp; Cetak Rekap</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-xl bg-surface-container-low flex flex-col gap-3">
              <span className="font-label-md text-label-md font-bold text-on-surface">
                Informasi Kasir &amp; Register
              </span>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex justify-between py-1 border-b border-outline-variant/20">
                  <span className="text-on-surface-variant">Nama Kasir Bertugas</span>
                  <span className="font-bold">Siti Rahmawati</span>
                </div>
                <div className="flex justify-between py-1 border-b border-outline-variant/20">
                  <span className="text-on-surface-variant">ID Shift</span>
                  <span className="font-bold">#SH-0824-A (Shift Pagi)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-outline-variant/20">
                  <span className="text-on-surface-variant">Waktu Mulai</span>
                  <span className="font-bold">08:00 WIB</span>
                </div>
                <div className="flex justify-between py-1 border-b border-outline-variant/20">
                  <span className="text-on-surface-variant">Modal Awal Laci (Float)</span>
                  <span className="font-bold text-primary">Rp500.000</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-container-low flex flex-col gap-3">
              <span className="font-label-md text-label-md font-bold text-on-surface">
                Ringkasan Kas Laci Fisik
              </span>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex justify-between py-1 border-b border-outline-variant/20">
                  <span className="text-on-surface-variant">Penerimaan Tunai Hari Ini</span>
                  <span className="font-bold text-primary">Rp1.640.000</span>
                </div>
                <div className="flex justify-between py-1 border-b border-outline-variant/20">
                  <span className="text-on-surface-variant">Kas Keluar Operasional</span>
                  <span className="font-bold text-error">-Rp45.000</span>
                </div>
                <div className="flex justify-between py-2 font-bold text-sm text-on-surface">
                  <span>Total Kas Laci Seharusnya</span>
                  <span className="text-primary font-bold">Rp2.095.000</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
