"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/lib/formatters";
import { OrderData, RestaurantSettings } from "@/types/pos";
import { useRestaurant } from "@/context/RestaurantContext";

import { sendEscPosToPrinter, buildReceiptEscPos } from "@/lib/bluetoothPrinter";

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "receipt" | "waiter_ticket" | "shift_report";
  order?: OrderData | null;
  settings: RestaurantSettings;
  cashierName?: string;
  shiftData?: any;
}

export function PrintModal({
  isOpen,
  onClose,
  type,
  order,
  settings,
  cashierName = "Siti Rahmawati",
  shiftData,
}: PrintModalProps) {
  const { activeBtDevice, settings: ctxSettings } = useRestaurant();
  const [btPrintStatus, setBtPrintStatus] = useState<"idle" | "printing" | "success" | "error">("idle");

  if (!isOpen) return null;

  /** Send receipt directly to Bluetooth thermal printer via Web Bluetooth */
  const handleBluetoothPrint = async () => {
    if (!activeBtDevice) return false;

    setBtPrintStatus("printing");
    try {
      let text = "";
      if (type === "receipt" && order) {
        text = buildReceiptEscPos(order, settings, cashierName);
      } else if (type === "waiter_ticket" && order) {
        text = `\x1B@TIKET MEJA: ${order.tableOrGuest}\n`;
        text += `${order.guestSubtext || ""}\n`;
        text += `${settings.restaurantName} | ${order.orderNumber}\n`;
        text += "--------------------------------\n";
        order.items.forEach((it) => {
          text += `[ ] ${it.qty}x ${it.name}\n`;
        });
        text += "\n\n\n";
      } else {
        text = `\x1B@${settings.restaurantName}\nLAPORAN SHIFT\nSTATUS: OK\n\n\n`;
      }

      const encoder = new TextEncoder();
      const data = encoder.encode(text);

      await sendEscPosToPrinter(activeBtDevice, data);

      setBtPrintStatus("success");
      setTimeout(() => {
        setBtPrintStatus("idle");
        onClose();
      }, 1200);
      return true;
    } catch (err) {
      console.error("Bluetooth print error:", err);
      setBtPrintStatus("error");
      setTimeout(() => setBtPrintStatus("idle"), 3000);
      return false;
    }
  };

  const activePrinter = (ctxSettings.printers || []).find(
    (p) => p.isActive && (p.connectionStatus === "connected" || p.connectionType === "system")
  );

  const isBtActive =
    !!activeBtDevice &&
    activePrinter?.connectionType === "bluetooth" &&
    activePrinter?.connectionStatus === "connected";

  const isSystemActive =
    activePrinter?.connectionType === "system" ||
    (activePrinter?.connectionStatus === "connected" && !activeBtDevice);

  /** Main print handler: try direct Bluetooth first, fallback to browser print dialog */
  const handlePrint = async () => {
    if (isBtActive) {
      const sent = await handleBluetoothPrint();
      if (sent) return;
    }

    // Fallback or System printer: browser print dialog
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl flex flex-col gap-4 max-h-[95vh] overflow-y-auto text-black">
        <div className="flex items-center justify-between border-b pb-3 no-print">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl text-primary">print</span>
            <span className="font-bold text-base text-gray-800">
              {type === "receipt"
                ? "Pratinjau Struk Kwitansi"
                : type === "waiter_ticket"
                ? "Tiket Pesanan Meja (Waiter SOP)"
                : "Laporan Transaksi Shift"}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Printer status indicator */}
        {isBtActive ? (
          <div className="no-print flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <span className="text-emerald-800 font-medium">
              Printer Bluetooth aktif — struk akan dikirim langsung ke printer tanpa dialog.
            </span>
          </div>
        ) : isSystemActive ? (
          <div className="no-print flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-xs">
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
            <span className="text-blue-800 font-medium">
              Printer Laptop terhubung — struk siap dicetak via printer sistem laptop.
            </span>
          </div>
        ) : null}

        {/* PRINTABLE CONTENT AREA */}
        <div id="printable-area" className="bg-white p-3 font-sans text-xs border border-dashed border-gray-300 rounded-lg text-black">
          {type === "receipt" && order && (
            <div className="flex flex-col gap-2">
              {/* Header */}
              <div className="text-center border-b border-dashed border-black pb-2 mb-1">
                <h3 className="font-black text-sm uppercase tracking-wide text-black">{settings.restaurantName || "PAWON NUSANTARA"}</h3>
                {settings.branchName && <p className="text-[11px] font-bold text-black mt-0.5">{settings.branchName}</p>}
                {settings.address && <p className="text-[9.5px] text-gray-800 leading-tight mt-0.5">{settings.address}</p>}
                {settings.phone && <p className="text-[9.5px] text-gray-800">Telp: {settings.phone}</p>}
              </div>

              {/* Meta Transaksi (Rata Kanan) */}
              <div className="flex flex-col gap-0.5 text-[10px] border-b border-dashed border-black pb-2 mb-1 text-black">
                <div className="flex justify-between items-baseline">
                  <span>No. Transaksi:</span>
                  <span className="font-bold text-right">{order.orderNumber}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span>Waktu:</span>
                  <span className="text-right">{order.orderTime}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span>Kasir:</span>
                  <span className="text-right">{order.cashierName || cashierName}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span>Meja / Tamu:</span>
                  <span className="font-bold text-right">{order.tableOrGuest}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span>Saluran:</span>
                  <span className="text-right">{order.channelLabel}</span>
                </div>
                {order.customerTier && (
                  <div className="flex justify-between items-center py-0.5 px-1 mt-0.5 rounded bg-gray-100 text-black font-bold text-[9px]">
                    <span>Pelanggan / Member:</span>
                    <span className="uppercase text-right">★ {order.customerTier}</span>
                  </div>
                )}
              </div>

              {/* Items: Format Bersih Sebaris Horizontal Sesuai Lampiran */}
              <div className="flex flex-col gap-1.5 border-b border-dashed border-black pb-2 mb-1">
                {order.items.map((it, idx) => (
                  <div key={idx} className="flex flex-col text-[10.5px]">
                    <div className="flex justify-between items-baseline gap-2">
                      <div className="flex items-baseline gap-1.5 flex-1 min-w-0">
                        <span className="font-bold shrink-0">{it.qty}x</span>
                        <span className="font-bold text-black break-words">{it.name}</span>
                      </div>
                      <span className="font-bold text-right text-black whitespace-nowrap shrink-0">
                        {formatCurrency(it.price * it.qty)}
                      </span>
                    </div>
                    {((it.selectedAddons && it.selectedAddons.length > 0) || it.note) && (
                      <div className="pl-6 text-[9.5px] text-gray-800 flex flex-col gap-0.5 mt-0.5">
                        {it.selectedAddons?.map((add, aIdx) => (
                          <span key={aIdx}>+ {add.name}</span>
                        ))}
                        {it.note && <span>({it.note})</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Totals & Payment Breakdown */}
              <div className="flex flex-col gap-1 text-[10px] border-b border-dashed border-black pb-2 mb-1 text-black">
                {(() => {
                  const itemsSubtotal = order.subtotal || order.items.reduce((s, it) => s + it.price * it.qty, 0);
                  const discount = order.discountAmount || 0;
                  const netSubtotal = Math.max(0, itemsSubtotal - discount);

                  const taxRate = settings.taxRate || 5;
                  const taxAmt = order.taxAmount !== undefined
                    ? order.taxAmount
                    : (settings.taxEnabled ? Math.round(netSubtotal * (taxRate / 100)) : 0);

                  const srvRate = settings.serviceChargeRate || 5;
                  const srvAmt = order.serviceChargeAmount !== undefined
                    ? order.serviceChargeAmount
                    : (order.serviceAmount !== undefined
                        ? order.serviceAmount
                        : (settings.serviceChargeEnabled ? Math.round(netSubtotal * (srvRate / 100)) : 0));

                  const displayTotal = order.total || (netSubtotal + taxAmt + srvAmt);

                  const paymentMethodDisplay =
                    order.paymentMethod === "cash"
                      ? "Tunai"
                      : order.paymentMethod === "static_qr"
                      ? "QRIS"
                      : order.paymentMethod === "bank_transfer"
                      ? "Transfer Bank"
                      : order.paymentMethod || order.channelLabel || "Tunai";

                  return (
                    <>
                      <div className="flex justify-between items-baseline">
                        <span>Subtotal:</span>
                        <span className="text-right font-medium">{formatCurrency(itemsSubtotal)}</span>
                      </div>

                      {discount > 0 && (
                        <div className="flex justify-between items-baseline font-bold text-black">
                          <span>Diskon {order.discountName ? `(${order.discountName})` : ""}:</span>
                          <span className="text-right">-{formatCurrency(discount)}</span>
                        </div>
                      )}

                      {(taxAmt > 0 || (settings.taxEnabled && (settings.taxRate ?? 0) > 0)) && (
                        <div className="flex justify-between items-baseline text-black">
                          <span>Pajak Restoran PB1 ({taxRate}%):</span>
                          <span className="text-right font-medium">{formatCurrency(taxAmt)}</span>
                        </div>
                      )}

                      {(srvAmt > 0 || (settings.serviceChargeEnabled && (settings.serviceChargeRate ?? 0) > 0)) && (
                        <div className="flex justify-between items-baseline text-black">
                          <span>Biaya Layanan ({srvRate}%):</span>
                          <span className="text-right font-medium">{formatCurrency(srvAmt)}</span>
                        </div>
                      )}

                      <div className="border-b border-dotted border-black my-1"></div>

                      <div className="flex justify-between items-baseline font-black text-xs text-black">
                        <span>TOTAL:</span>
                        <span className="text-right text-sm">{formatCurrency(displayTotal)}</span>
                      </div>

                      <div className="flex justify-between items-baseline pt-0.5">
                        <span>Metode Bayar:</span>
                        <span className="text-right font-medium">{paymentMethodDisplay}</span>
                      </div>

                      <div className="flex justify-between items-baseline">
                        <span>Status:</span>
                        <span className="font-black uppercase text-black text-right">LUNAS</span>
                      </div>

                      {order.paymentNote && (
                        <div className="text-[9.5px] text-gray-800 leading-tight pt-0.5">
                          <span className="font-semibold">Keterangan:</span> {order.paymentNote}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Kupon Promo Spesial Member Kunjungan Berikutnya */}
              {(order.customerId || order.customerTier) && (() => {
                const tier = (order.customerTier || "").toLowerCase();
                const nextCouponCode = tier === "vip" ? "VIPHEMAT20" : tier === "gold" ? "GOLDHEMAT15" : "HEMAT10";
                const nextCouponDisc = tier === "vip" ? "Diskon 20% (Maks Rp50.000)" : tier === "gold" ? "Diskon 15% (Maks Rp35.000)" : "Diskon 10% (Maks Rp25.000)";
                return (
                  <div className="my-1.5 p-2 rounded-lg border-2 border-dashed border-[#003629] bg-emerald-50/70 text-center flex flex-col items-center gap-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#003629] flex items-center gap-1 justify-center">
                      ★ KUPON SPESIAL MEMBER RESTO ★
                    </span>
                    <div className="px-2.5 py-0.5 rounded bg-[#003629] text-white font-mono font-black text-xs tracking-wider shadow-2xs">
                      {nextCouponCode}
                    </div>
                    <p className="text-[10px] font-bold text-emerald-950">
                      {nextCouponDisc}
                    </p>
                    <p className="text-[9px] text-emerald-800 italic">
                      Tunjukkan struk ini pada kasir untuk kunjungan berikutnya!
                    </p>
                  </div>
                );
              })()}

              {/* Footer */}
              <div className="text-center text-[9.5px] text-gray-800 pt-1 leading-tight flex flex-col gap-1">
                <p className="font-bold text-black">
                  {settings.receiptFooter || "Terima kasih atas kunjungan Anda di Pawon Nusantara! Silakan datang kembali."}
                </p>
                <div className="border-b border-dashed border-gray-400 my-1"></div>
                {/* Social media handles */}
                {((settings.showInstagram && settings.instagram) ||
                  (settings.showFacebook && settings.facebook) ||
                  (settings.showTiktok && settings.tiktok)) && (
                  <div className="flex flex-col items-center justify-center gap-0.5 text-[9px] font-medium text-black">
                    {settings.showInstagram && settings.instagram && (
                      <span>IG: {settings.instagram}</span>
                    )}
                    {settings.showFacebook && settings.facebook && (
                      <span>FB: {settings.facebook}</span>
                    )}
                    {settings.showTiktok && settings.tiktok && (
                      <span>TikTok: {settings.tiktok}</span>
                    )}
                  </div>
                )}
                <p className="text-[8.5px] text-gray-600 mt-0.5">Sistem POS didukung oleh Keivo</p>
              </div>
            </div>
          )}

          {type === "waiter_ticket" && (
            <div className="flex flex-col gap-3">
              <div className="text-center border-b-2 border-black pb-2">
                <span className="px-2 py-0.5 border border-black font-bold uppercase text-[10px] tracking-wider">
                  TIKET TEMPEL MEJA WAITER
                </span>
                <h3 className="font-bold text-lg mt-1 uppercase">{order?.tableOrGuest || "Meja 08"}</h3>
                <p className="text-xs font-semibold">{order?.guestSubtext || "Bpk. Hendra"}</p>
                <p className="text-[10px] text-gray-600">{settings.restaurantName} • {order?.orderNumber || "#PN-1042"}</p>
              </div>

              <div className="text-xs space-y-2 border-b border-dashed pb-2">
                <div className="flex justify-between text-[11px] font-semibold text-gray-700">
                  <span>CHECKLIST HIDANGAN FISIK</span>
                  <span>PARAF</span>
                </div>
                {order?.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1 border-b border-gray-100">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 border border-black rounded flex items-center justify-center text-[10px]"></span>
                        <span className="font-bold">{it.qty}x</span>
                        <span>{it.name}</span>
                      </div>
                      {it.selectedAddons && it.selectedAddons.length > 0 && (
                        <div className="pl-6 text-[10px] text-gray-600">
                          {it.selectedAddons.map((add, aIdx) => (
                            <span key={aIdx} className="block">+ {add.name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="w-8 border-b border-gray-400"></span>
                  </div>
                ))}
              </div>

              <div className="p-2 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-600 leading-snug">
                <strong>SOP PRAMUSAJI:</strong> Tempelkan tiket ini di nomor meja. Centang manual setiap kali
                hidangan diantar oleh dapur ke meja tamu.
              </div>
            </div>
          )}

          {type === "shift_report" && (
            <div className="flex flex-col gap-3">
              <div className="text-center border-b border-dashed pb-2">
                <h3 className="font-bold text-sm uppercase">{settings.restaurantName}</h3>
                <p className="font-semibold text-xs">LAPORAN TRANSAKSI SHIFT KASIR</p>
                <p className="text-[10px] text-gray-500">Shift Pagi #042 • Kasir: {cashierName}</p>
              </div>

              <div className="space-y-1 text-[11px] border-b border-dashed pb-2">
                <div className="flex justify-between">
                  <span>Modal Kas Awal:</span>
                  <span className="font-semibold">Rp500.000</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Omset Penjualan:</span>
                  <span className="font-bold text-green-700">Rp4.820.000</span>
                </div>
                <div className="flex justify-between pl-2 text-[10px] text-gray-600">
                  <span>- Penerimaan Tunai:</span>
                  <span>Rp1.640.000</span>
                </div>
                <div className="flex justify-between pl-2 text-[10px] text-gray-600">
                  <span>- Penerimaan QRIS:</span>
                  <span>Rp2.430.000</span>
                </div>
                <div className="flex justify-between pl-2 text-[10px] text-gray-600">
                  <span>- Penerimaan Transfer:</span>
                  <span>Rp750.000</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Kas Keluar Operasional:</span>
                  <span>-Rp45.000</span>
                </div>
              </div>

              <div className="space-y-1 text-[11px] border-b border-dashed pb-2 font-bold">
                <div className="flex justify-between">
                  <span>Saldo Diharapkan di Laci:</span>
                  <span>Rp2.095.000</span>
                </div>
                <div className="flex justify-between">
                  <span>Hitung Fisik Kasir:</span>
                  <span>{formatCurrency(shiftData?.physical || 2095000)}</span>
                </div>
                <div className="flex justify-between text-xs text-blue-700">
                  <span>Selisih:</span>
                  <span>Rp0 (Pas)</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-gray-500">
                Laporan shift resmi tercatat di database Keivo POS.
              </div>
            </div>
          )}
        </div>

        {/* Footer print action */}
        <div className="flex justify-end gap-2 pt-2 border-t no-print">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold"
          >
            Tutup
          </button>
          <button
            onClick={handlePrint}
            disabled={btPrintStatus === "printing"}
            className={`px-5 py-2 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 shadow transition-all ${
              btPrintStatus === "printing"
                ? "bg-amber-500 cursor-wait"
                : btPrintStatus === "success"
                ? "bg-emerald-600"
                : btPrintStatus === "error"
                ? "bg-rose-600 hover:bg-rose-700"
                : isBtActive
                ? "bg-emerald-700 hover:bg-emerald-800"
                : isSystemActive
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-[#003629] hover:bg-[#1b4d3e]"
            }`}
          >
            <span className="material-symbols-outlined text-sm">
              {btPrintStatus === "printing"
                ? "sync"
                : btPrintStatus === "success"
                ? "check_circle"
                : btPrintStatus === "error"
                ? "error"
                : isBtActive
                ? "bluetooth"
                : "print"}
            </span>
            <span>
              {btPrintStatus === "printing"
                ? "Mencetak..."
                : btPrintStatus === "success"
                ? "Tercetak!"
                : btPrintStatus === "error"
                ? "Gagal — Coba Lagi"
                : isBtActive
                ? "Cetak ke Bluetooth Thermal"
                : isSystemActive
                ? "Cetak ke Printer Laptop"
                : "Cetak Sekarang"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
