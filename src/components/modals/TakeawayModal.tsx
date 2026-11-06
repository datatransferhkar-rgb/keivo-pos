"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/lib/formatters";
import { OrderData } from "@/types/pos";

interface TakeawayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddOrder: (order: OrderData) => void;
}

const SAMPLE_MENU = [
  { name: "Nasi Liwet Komplit", price: 38000 },
  { name: "Gurame Bakar Cobek", price: 75000 },
  { name: "Bebek Goreng Kremes", price: 42000 },
  { name: "Ayam Geprek Sambal Bawang", price: 28000 },
  { name: "Nasi Goreng Kampung", price: 32000 },
  { name: "Tahu Telur Petis", price: 22000 },
  { name: "Sup Buntut Sapi", price: 65000 },
  { name: "Sate Ayam Madura (10 tsk)", price: 35000 },
  { name: "Mie Goreng Jawa", price: 28000 },
  { name: "Es Kelapa Muda", price: 15000 },
  { name: "Es Teh Manis", price: 6000 },
  { name: "Es Cendol Durian", price: 25000 },
];

export function TakeawayModal({
  isOpen,
  onClose,
  onAddOrder,
}: TakeawayModalProps) {
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<{ name: string; price: number; qty: number }[]>([]);

  if (!isOpen) return null;

  const addItem = (item: { name: string; price: number }) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.name === item.name);
      if (existing) {
        return prev.map((i) =>
          i.name === item.name ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeItem = (name: string) => {
    setCart((prev) =>
      prev
        .map((i) => (i.name === name ? { ...i, qty: i.qty - 1 } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const total = cart.reduce((acc, it) => acc + it.price * it.qty, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      alert("Pilih minimal satu menu untuk pesanan!");
      return;
    }

    const orderNum = `#PN-${Math.floor(1000 + Math.random() * 9000)}`;
    const tkNum = `#TK-0${Math.floor(80 + Math.random() * 20)}`;

    const newOrder: OrderData = {
      id: "ord-" + Date.now(),
      orderNumber: orderNum,
      channel: "takeaway_walk_in",
      channelLabel: "Take Away",
      tableOrGuest: customerName.trim() || "Pelanggan Take Away",
      guestSubtext: `Antrian ${tkNum}`,
      orderTime: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }) + " WIB",
      timeAgo: "Baru saja",
      items: cart.map((c) => ({ name: c.name, qty: c.qty, price: c.price })),
      specialNote: notes.trim() || undefined,
      total,
      kitchenStatus: "new",
      kitchenStatusLabel: "Pesanan Baru",
      paymentStatus: "unpaid",
      paymentStatusLabel: "Belum Bayar",
    };

    onAddOrder(newOrder);
    setCart([]);
    setCustomerName("");
    setNotes("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl bg-surface-container-lowest p-6 shadow-xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl text-primary">shopping_bag</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              Input Pesanan Take Away (Walk-in)
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
                Nama Pelanggan (Opsional):
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Contoh: Ibu Maya"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none border border-outline-variant font-body-sm"
              />
            </div>
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
                Catatan Khusus Pesanan:
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Sambal dipisah, bungkus rapi"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none border border-outline-variant font-body-sm"
              />
            </div>
          </div>

          <div>
            <span className="font-label-md text-label-md text-on-surface font-semibold block mb-2">
              Pilih Menu Favorit:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 bg-surface-container-low rounded-xl">
              {SAMPLE_MENU.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => addItem(item)}
                  className="p-2.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/40 flex flex-col items-start text-left transition-all cursor-pointer"
                >
                  <span className="font-label-md text-label-md font-semibold text-on-surface line-clamp-1">
                    {item.name}
                  </span>
                  <span className="font-label-sm text-label-sm text-primary font-bold mt-1">
                    {formatCurrency(item.price)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Cart Summary */}
          {cart.length > 0 && (
            <div className="p-3 bg-surface-container-low rounded-xl flex flex-col gap-2">
              <span className="font-label-md text-label-md font-bold text-on-surface">
                Ringkasan Item Dipilih:
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {cart.map((c) => (
                  <div key={c.name} className="flex items-center justify-between font-body-sm">
                    <span className="text-on-surface font-medium truncate flex-1">{c.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-primary">
                        {formatCurrency(c.price * c.qty)}
                      </span>
                      <div className="flex items-center gap-1.5 bg-surface-container-high/60 p-0.5 rounded-xl">
                        <button
                          type="button"
                          onClick={() => removeItem(c.name)}
                          className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-surface-container-highest active:scale-90 flex items-center justify-center font-bold text-base cursor-pointer transition-all"
                        >
                          -
                        </button>
                        <span className="w-6 text-center font-black text-sm">{c.qty}</span>
                        <button
                          type="button"
                          onClick={() => addItem(c)}
                          className="w-8 h-8 rounded-lg bg-primary hover:bg-primary/90 active:scale-90 text-on-primary flex items-center justify-center font-bold text-base cursor-pointer transition-all"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-surface-container-high flex justify-between items-center font-currency-row font-bold">
                <span>Total Estimasi:</span>
                <span className="text-primary text-lg">{formatCurrency(total)}</span>
              </div>
            </div>
          )}

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
              disabled={cart.length === 0}
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-container disabled:opacity-50 text-on-primary font-label-md text-label-md font-bold shadow-sm"
            >
              Simpan &amp; Kirim ke Dapur
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
