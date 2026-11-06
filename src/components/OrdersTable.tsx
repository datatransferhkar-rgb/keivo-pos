"use client";

import React, { useState } from "react";
import { OrderData } from "@/types/pos";
import { formatCurrency } from "@/lib/formatters";

interface OrdersTableProps {
  orders: OrderData[];
  onProcessPayment: (order: OrderData) => void;
  onPrintTicket: (order: OrderData) => void;
  onViewDetail: (order: OrderData) => void;
}

export function OrdersTable({
  orders,
  onProcessPayment,
  onPrintTicket,
  onViewDetail,
}: OrdersTableProps) {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [kitchenFilter, setKitchenFilter] = useState<string>("");
  const [paymentFilter, setPaymentFilter] = useState<string>("");

  // Tab counts
  const countAll = orders.length;
  const countDineIn = orders.filter((o) => o.channel === "dine_in_qr").length;
  const countTakeaway = orders.filter((o) => o.channel === "takeaway_walk_in").length;
  const countOnline = orders.filter((o) => o.channel === "online_platform").length;
  const countReady = orders.filter((o) => o.kitchenStatus === "ready").length;

  const filteredOrders = orders.filter((order) => {
    // Tab filter
    if (activeTab === "dine_in" && order.channel !== "dine_in_qr") return false;
    if (activeTab === "takeaway" && order.channel !== "takeaway_walk_in") return false;
    if (activeTab === "online" && order.channel !== "online_platform") return false;
    if (activeTab === "ready" && order.kitchenStatus !== "ready") return false;

    // Kitchen dropdown filter
    if (kitchenFilter && order.kitchenStatus !== kitchenFilter) return false;

    // Payment dropdown filter
    if (paymentFilter && order.paymentStatus !== paymentFilter) return false;

    // Search filter
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      const matchNo = order.orderNumber.toLowerCase().includes(q);
      const matchTable = order.tableOrGuest.toLowerCase().includes(q);
      const matchSub = order.guestSubtext?.toLowerCase().includes(q) ?? false;
      const matchItems = order.items.some((i) => i.name.toLowerCase().includes(q));
      if (!matchNo && !matchTable && !matchSub && !matchItems) return false;
    }

    return true;
  });

  return (
    <div className="lg:col-span-8 flex flex-col gap-space-md">
      {/* Filter Tabs & Quick Search Tray */}
      <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm">
        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-space-md py-2 rounded-lg font-label-md text-label-md font-bold shrink-0 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer ${
              activeTab === "all"
                ? "bg-primary text-on-primary"
                : "bg-surface-container hover:bg-surface-container-high text-on-surface font-medium"
            }`}
          >
            <span>Semua Pesanan</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-xs ${
                activeTab === "all" ? "bg-white/20 text-on-primary" : "bg-surface-container-highest text-on-surface-variant"
              }`}
            >
              {countAll}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("dine_in")}
            className={`px-space-md py-2 rounded-lg font-label-md text-label-md shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "dine_in"
                ? "bg-primary text-on-primary font-bold"
                : "bg-surface-container hover:bg-surface-container-high text-on-surface font-medium"
            }`}
          >
            <span className="material-symbols-outlined text-base text-outline">table_restaurant</span>
            <span>Dine-In Meja</span>
            <span className="px-1.5 py-0.2 rounded-full bg-surface-container-highest text-on-surface-variant text-xs">
              {countDineIn}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("takeaway")}
            className={`px-space-md py-2 rounded-lg font-label-md text-label-md shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "takeaway"
                ? "bg-primary text-on-primary font-bold"
                : "bg-surface-container hover:bg-surface-container-high text-on-surface font-medium"
            }`}
          >
            <span className="material-symbols-outlined text-base text-outline">shopping_bag</span>
            <span>Take Away</span>
            <span className="px-1.5 py-0.2 rounded-full bg-surface-container-highest text-on-surface-variant text-xs">
              {countTakeaway}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("online")}
            className={`px-space-md py-2 rounded-lg font-label-md text-label-md shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "online"
                ? "bg-primary text-on-primary font-bold"
                : "bg-surface-container hover:bg-surface-container-high text-on-surface font-medium"
            }`}
          >
            <span className="material-symbols-outlined text-base text-outline">moped</span>
            <span>Delivery</span>
            <span className="px-1.5 py-0.2 rounded-full bg-surface-container-highest text-on-surface-variant text-xs">
              {countOnline}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("ready")}
            className={`px-space-md py-2 rounded-lg font-label-md text-label-md font-bold shrink-0 transition-colors flex items-center gap-1.5 ml-auto cursor-pointer ${
              activeTab === "ready"
                ? "bg-secondary-container text-on-secondary"
                : "bg-secondary-fixed/40 hover:bg-secondary-fixed text-on-secondary-fixed"
            }`}
          >
            <span className="material-symbols-outlined text-base text-secondary">notifications_active</span>
            <span>Siap Diambil KDS</span>
            <span className="px-1.5 py-0.2 rounded-full bg-secondary-container text-on-secondary text-xs font-extrabold">
              {countReady}
            </span>
          </button>
        </div>

        {/* Filter Dropdowns & Micro Search */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-space-xs pt-space-xs">
          <div className="sm:col-span-6 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">
              filter_alt
            </span>
            <input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-surface-container-low rounded-lg font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest shadow-inner"
              placeholder="Cari order, meja, atau nama..."
              type="text"
            />
          </div>
          <div className="sm:col-span-3">
            <select
              value={kitchenFilter}
              onChange={(e) => setKitchenFilter(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container-low rounded-lg font-body-sm text-body-sm text-on-surface focus:outline-none focus:bg-surface-container-lowest shadow-inner cursor-pointer"
            >
              <option value="">Status Dapur: Semua</option>
              <option value="new">Pesanan Baru</option>
              <option value="in_progress">Sedang Dimasak</option>
              <option value="ready">Siap Diantar</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container-low rounded-lg font-body-sm text-body-sm text-on-surface focus:outline-none focus:bg-surface-container-lowest shadow-inner cursor-pointer"
            >
              <option value="">Status Bayar: Semua</option>
              <option value="unpaid">Belum Bayar</option>
              <option value="paid">Lunas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Data Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                <th className="py-3 px-3 font-bold">No. &amp; Saluran</th>
                <th className="py-3 px-3 font-bold">Meja / Tamu</th>
                <th className="py-3 px-3 font-bold">Jam Pesan</th>
                <th className="py-3 px-3 font-bold min-w-[150px]">Menu &amp; Rincian</th>
                <th className="py-3 px-3 font-bold text-right">Total</th>
                <th className="py-3 px-3 font-bold text-center">Dapur</th>
                <th className="py-3 px-3 font-bold text-center">Status Bayar</th>
                <th className="py-3 px-3 font-bold text-center">Aksi Kasir</th>
              </tr>
            </thead>
            <tbody className="font-body-sm text-body-sm text-on-surface divide-y-0">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-outline">
                    Tidak ada pesanan yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, idx) => {
                  const isEven = idx % 2 === 1;
                  return (
                    <tr
                      key={order.id}
                      className={`hover:bg-surface-container-low/60 transition-colors ${
                        isEven ? "bg-surface-container-low/30" : ""
                      }`}
                    >
                      {/* No. & Saluran */}
                      <td className="py-3.5 px-3 align-top">
                        <div className="flex flex-col gap-1">
                          <span className="font-label-md text-label-md font-extrabold text-primary">
                            {order.orderNumber}
                          </span>
                          {order.channel === "dine_in_qr" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200/80 font-label-sm text-label-sm w-fit font-bold">
                              <span className="material-symbols-outlined text-xs text-primary">
                                table_restaurant
                              </span>
                              Dine-in ({order.tableOrGuest})
                            </span>
                          )}
                          {order.channel === "online_platform" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-900 border border-orange-200 font-label-sm text-label-sm w-fit font-extrabold">
                              <span className="material-symbols-outlined text-xs text-orange-700">moped</span>
                              Delivery ({order.channelLabel || "Platform"})
                            </span>
                          )}
                          {order.channel === "takeaway_walk_in" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 font-label-sm text-label-sm w-fit font-extrabold">
                              <span className="material-symbols-outlined text-xs text-emerald-700">shopping_bag</span>
                              Take Away
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Meja / Tamu */}
                      <td className="py-3.5 px-3 align-top">
                        <div className="flex flex-col leading-tight">
                          <span className="font-label-lg text-label-lg font-bold text-on-surface">
                            {order.tableOrGuest}
                          </span>
                          {order.guestSubtext && (
                            <span className="font-body-sm text-body-sm text-on-surface-variant">
                              {order.guestSubtext}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 font-medium mt-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/70 w-fit">
                            <span className="material-symbols-outlined text-xs text-slate-400">badge</span>
                            <span>Kasir: {order.cashierName || "Siti Rahmawati"}</span>
                          </span>
                        </div>
                      </td>

                      {/* Jam Pesan */}
                      <td className="py-3.5 px-3 align-top whitespace-nowrap">
                        <span className="font-label-md text-label-md font-semibold text-on-surface">
                          {order.orderTime}
                        </span>
                        <span className="block font-label-sm text-label-sm text-outline">
                          {order.timeAgo}
                        </span>
                      </td>

                      {/* Menu & Rincian */}
                      <td className="py-3.5 px-3 align-top">
                        <p className="font-body-sm text-body-sm text-on-surface line-clamp-2">
                          {order.items.map((it, i) => (
                            <span key={i}>
                              <strong className="font-semibold text-primary">{it.qty}x</strong>{" "}
                              {it.name}
                              {i < order.items.length - 1 ? ", " : ""}
                            </span>
                          ))}
                        </p>
                        {order.specialNote && (
                          <span className="inline-block mt-1 text-xs text-secondary font-medium bg-secondary-fixed/30 px-1.5 py-0.5 rounded">
                            {order.specialNote}
                          </span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-3 align-top text-right whitespace-nowrap">
                        <span className="font-currency-row text-currency-row font-extrabold text-on-surface">
                          {formatCurrency(order.total)}
                        </span>
                        {order.paymentNote && (
                          <span className="block font-label-sm text-label-sm text-outline">
                            {order.paymentNote}
                          </span>
                        )}
                      </td>

                      {/* Dapur */}
                      <td className="py-3.5 px-3 align-top text-center whitespace-nowrap">
                        {order.kitchenStatus === "ready" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm font-bold shadow-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span> Siap Diantar
                          </span>
                        )}
                        {order.kitchenStatus === "in_progress" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-label-sm text-label-sm font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span> Dimasak
                          </span>
                        )}
                        {order.kitchenStatus === "new" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-variant text-on-surface-variant font-label-sm text-label-sm font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-outline"></span> Pesanan Baru
                          </span>
                        )}
                      </td>

                      {/* Status Bayar */}
                      <td className="py-3.5 px-3 align-top text-center whitespace-nowrap">
                        {order.paymentStatus === "unpaid" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-bold">
                            Belum Bayar
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-sm text-label-sm font-bold">
                            {order.paymentStatusLabel || "Lunas"}
                          </span>
                        )}
                      </td>

                      {/* Aksi Kasir */}
                      <td className="py-3.5 px-3 align-top text-center whitespace-nowrap">
                        {order.paymentStatus === "unpaid" ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => onProcessPayment(order)}
                              className="px-2.5 py-1.5 rounded bg-primary hover:bg-primary-container text-on-primary font-label-sm text-label-sm font-bold shadow-xs transition-colors cursor-pointer"
                            >
                              Proses Bayar
                            </button>
                            <button
                              onClick={() => onPrintTicket(order)}
                              className="p-1.5 rounded hover:bg-surface-container text-on-surface-variant transition-colors cursor-pointer"
                              title="Cetak Tiket Meja"
                            >
                              <span className="material-symbols-outlined text-base">print</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            {order.channel === "takeaway_walk_in" ? (
                              <button
                                onClick={() => onPrintTicket(order)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-bold transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-sm">receipt</span>
                                <span>Cetak Struk</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => onViewDetail(order)}
                                className="px-2.5 py-1.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-bold transition-colors cursor-pointer"
                              >
                                Detail Tiket
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination & Operational Status Footer */}
        <div className="p-space-md bg-surface-container-low flex items-center justify-between flex-wrap gap-2">
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Menampilkan <strong>{filteredOrders.length} dari {orders.length}</strong> pesanan operasional shift ini
          </span>
          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface disabled:opacity-50">
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            <span className="px-3 py-1 font-label-sm text-label-sm font-bold bg-primary text-on-primary rounded">
              1
            </span>
            <button className="px-3 py-1 font-label-sm text-label-sm font-semibold bg-surface-container hover:bg-surface-container-high text-on-surface rounded">
              2
            </button>
            <button className="px-3 py-1 font-label-sm text-label-sm font-semibold bg-surface-container hover:bg-surface-container-high text-on-surface rounded">
              3
            </button>
            <button className="p-1.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface">
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
