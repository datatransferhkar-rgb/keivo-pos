"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/lib/formatters";
import { OrderData } from "@/types/pos";

interface OjolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddOrder: (order: OrderData) => void;
  existingOrders: OrderData[];
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
  { name: "Es Jeruk Murni", price: 12000 },
];

export function OjolModal({
  isOpen,
  onClose,
  onAddOrder,
  existingOrders,
}: OjolModalProps) {
  const [platform, setPlatform] = useState<"GoFood" | "GrabFood" | "ShopeeFood">("GoFood");
  const [externalId, setExternalId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "unpaid">("paid");
  const [cart, setCart] = useState<{ name: string; price: number; qty: number }[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

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
    setErrorMsg("");

    const cleanExtId = externalId.trim().toUpperCase();
    if (!cleanExtId) {
      setErrorMsg("ID Pesanan Eksternal (misal: GF-8921) wajib diisi!");
      return;
    }

    // Check duplicate
    const isDuplicate = existingOrders.some(
      (o) =>
        o.channel === "online_platform" &&
        o.channelLabel.toLowerCase() === platform.toLowerCase() &&
        o.tableOrGuest.toUpperCase().includes(cleanExtId)
    );

    if (isDuplicate) {
      setErrorMsg(
        `ID Pesanan ${cleanExtId} sudah pernah diinput untuk platform ${platform}! Cegah duplikasi.`
      );
      return;
    }

    if (cart.length === 0) {
      setErrorMsg("Pilih minimal satu menu makanan untuk pesanan ojol!");
      return;
    }

    const orderNum = `#PN-${Math.floor(1000 + Math.random() * 9000)}`;
    const formattedExtId = cleanExtId.startsWith("#") ? cleanExtId : `#${cleanExtId}`;

    const newOrder: OrderData = {
      id: "ord-" + Date.now(),
      orderNumber: orderNum,
      channel: "online_platform",
      channelLabel: platform,
      tableOrGuest: formattedExtId,
      guestSubtext: driverName.trim()
        ? `Driver: ${driverName.trim()}`
        : `Pesanan ${platform}`,
      orderTime: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }) + " WIB",
      timeAgo: "Baru saja",
      items: cart.map((c) => ({ name: c.name, qty: c.qty, price: c.price })),
      total,
      kitchenStatus: "new",
      kitchenStatusLabel: "Pesanan Baru",
      paymentStatus: paymentStatus,
      paymentStatusLabel:
        paymentStatus === "paid" ? `Lunas (${platform})` : "Belum Bayar",
    };

    onAddOrder(newOrder);
    setCart([]);
    setExternalId("");
    setDriverName("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl bg-surface-container-lowest p-6 shadow-xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl text-secondary">moped</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              Input Pesanan Platform Online / Delivery
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-container text-outline"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-error-container text-on-error-container rounded-lg text-body-sm font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-error">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
                Pilih Platform Online *:
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as any)}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none border border-outline-variant font-body-sm cursor-pointer"
              >
                <option value="GoFood">GoFood (GoJek)</option>
                <option value="GrabFood">GrabFood</option>
                <option value="ShopeeFood">ShopeeFood</option>
              </select>
            </div>

            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
                ID Pesanan Eksternal *:
              </label>
              <input
                type="text"
                required
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder="Contoh: GF-8921"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none border border-outline-variant font-body-sm uppercase font-mono"
              />
            </div>

            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
                Nama Driver / Pemesan:
              </label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Contoh: Joko / Denny"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none border border-outline-variant font-body-sm"
              />
            </div>
          </div>

          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
              Status Pembayaran di Platform:
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-body-sm">
                <input
                  type="radio"
                  name="ojolPayment"
                  checked={paymentStatus === "paid"}
                  onChange={() => setPaymentStatus("paid")}
                  className="accent-primary"
                />
                <span className="font-semibold text-primary">
                  Sudah Lunas via Platform (GoPay / OVO / ShopeePay)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-body-sm">
                <input
                  type="radio"
                  name="ojolPayment"
                  checked={paymentStatus === "unpaid"}
                  onChange={() => setPaymentStatus("unpaid")}
                  className="accent-primary"
                />
                <span className="text-on-surface-variant">
                  Belum Lunas (Bayar Tunai saat Pengambilan)
                </span>
              </label>
            </div>
          </div>

          <div>
            <span className="font-label-md text-label-md text-on-surface font-semibold block mb-2">
              Pilih Item Menu yang Dipesan:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto p-1 bg-surface-container-low rounded-xl">
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
                  <span className="font-label-sm text-label-sm text-secondary font-bold mt-1">
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
                Item Pesanan Delivery:
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {cart.map((c) => (
                  <div key={c.name} className="flex items-center justify-between font-body-sm">
                    <span className="text-on-surface font-medium truncate flex-1">{c.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-secondary">
                        {formatCurrency(c.price * c.qty)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => removeItem(c.name)}
                          className="w-6 h-6 rounded bg-surface-container-high flex items-center justify-center font-bold text-sm"
                        >
                          -
                        </button>
                        <span className="px-1.5 font-bold">{c.qty}</span>
                        <button
                          type="button"
                          onClick={() => addItem(c)}
                          className="w-6 h-6 rounded bg-secondary-container text-on-secondary flex items-center justify-center font-bold text-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-surface-container-high flex justify-between items-center font-currency-row font-bold">
                <span>Total Pesanan Delivery:</span>
                <span className="text-secondary text-lg">{formatCurrency(total)}</span>
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
              className="px-5 py-2 rounded-lg bg-secondary-container hover:bg-secondary text-on-secondary disabled:opacity-50 font-label-md text-label-md font-bold shadow-sm"
            >
              Simpan Order Delivery
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
