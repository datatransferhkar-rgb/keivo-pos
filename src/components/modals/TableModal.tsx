"use client";

import React, { useState, useEffect } from "react";
import { OrderData, Customer } from "@/types/pos";

interface TableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTable: (order: OrderData) => void;
  existingTables: string[];
}

export function TableModal({
  isOpen,
  onClose,
  onOpenTable,
  existingTables,
}: TableModalProps) {
  const [selectedTable, setSelectedTable] = useState("Meja 05");
  const [customerName, setCustomerName] = useState("");
  const [guestCount, setGuestCount] = useState(2);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    fetch("/api/customers?active=true")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setCustomers(data);
      })
      .catch(() => {});
  }, []);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert("Nama pelanggan/tamu wajib diisi untuk membuka sesi meja!");
      return;
    }

    const orderNum = `#PN-${Math.floor(1000 + Math.random() * 9000)}`;

    const newOrder: OrderData = {
      id: "ord-" + Date.now(),
      orderNumber: orderNum,
      channel: "dine_in_qr",
      channelLabel: "Dine-in",
      tableOrGuest: selectedTable,
      guestSubtext: `${customerName.trim()} (${guestCount} Tamu)`,
      customerId: selectedCustomer?.id,
      customerPhone: selectedCustomer?.phone,
      customerTier: selectedCustomer?.tier,
      specialNote: selectedCustomer?.notes || undefined,
      orderTime: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }) + " WIB",
      timeAgo: "Baru saja",
      items: [
        { name: "Sesi Meja Dibuka", qty: 1, price: 0 },
        { name: "Menunggu pesanan dari QR Meja", qty: 1, price: 0 },
      ],
      total: 0,
      kitchenStatus: "new",
      kitchenStatusLabel: "Pesanan Baru",
      paymentStatus: "unpaid",
      paymentStatusLabel: "Belum Bayar",
    };

    onOpenTable(newOrder);
    setCustomerName("");
    onClose();
  };

  const tables = Array.from({ length: 20 }, (_, i) => {
    const num = i + 1 < 10 ? `0${i + 1}` : `${i + 1}`;
    return `Meja ${num}`;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-surface-container-lowest p-6 shadow-xl flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl text-primary">table_restaurant</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              Buka Meja Baru (Dine-in)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-container text-outline"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
              Pilih Nomor Meja:
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-40 overflow-y-auto p-1 bg-surface-container-low rounded-xl">
              {tables.map((t) => {
                const isOccupied = existingTables.includes(t);
                const isSelected = selectedTable === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTable(t)}
                    className={`py-2 px-1 rounded-lg text-center font-label-md text-label-md font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-primary text-on-primary shadow-sm"
                        : isOccupied
                        ? "bg-surface-container-highest text-on-surface-variant/50 line-through cursor-not-allowed"
                        : "bg-surface-container-lowest hover:bg-surface-container text-on-surface"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant block">
                Nama Pelanggan / Tamu *:
              </label>
              {selectedCustomer && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  selectedCustomer.tier === "vip" ? "bg-purple-100 text-purple-900" :
                  selectedCustomer.tier === "gold" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"
                }`}>
                  {selectedCustomer.tier.toUpperCase()} • ★ {selectedCustomer.points} Poin
                </span>
              )}
            </div>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                const matched = customers.find(c => c.name.toLowerCase() === e.target.value.toLowerCase());
                setSelectedCustomer(matched || null);
              }}
              placeholder="Ketik nama atau pilih member..."
              className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none border border-outline-variant font-body-sm text-xs"
            />
            {/* Quick Member Suggestions */}
            {customerName.trim() && !selectedCustomer && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-36 overflow-y-auto">
                {customers
                  .filter(c => c.name.toLowerCase().includes(customerName.toLowerCase()) || c.phone.includes(customerName))
                  .slice(0, 4)
                  .map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCustomerName(c.name);
                        setSelectedCustomer(c);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 flex items-center justify-between border-b last:border-0 border-slate-100 cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{c.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{c.phone}</span>
                      </div>
                      <span className="text-[10px] font-bold text-amber-700">★ {c.points} Poin</span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
              Jumlah Tamu:
            </label>
            <div className="flex items-center gap-3">
              {[1, 2, 4, 6, 8, 10].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setGuestCount(num)}
                  className={`w-9 h-9 rounded-lg font-bold text-sm transition-colors cursor-pointer ${
                    guestCount === num
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 bg-surface-container-low rounded-xl text-body-sm text-on-surface-variant flex items-start gap-2">
            <span className="material-symbols-outlined text-primary text-lg shrink-0 mt-0.5">
              qr_code_scanner
            </span>
            <p>
              Setelah sesi meja dibuka, tamu dapat langsung memindai QR code di meja untuk melihat
              katalog menu dan memesan mandiri dari ponsel mereka.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-surface-container-high">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-bold shadow-sm"
            >
              Buka Sesi Meja
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
