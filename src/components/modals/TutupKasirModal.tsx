"use client";

import React, { useState, useMemo, useEffect } from "react";
import { formatCurrency } from "@/lib/formatters";
import { OrderData, RestaurantSettings } from "@/types/pos";
import { UserProfile } from "@/types/auth";
import { sendEscPosToPrinter, buildShiftReportEscPos } from "@/lib/bluetoothPrinter";

interface TutupKasirModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: OrderData[];
  currentUser: UserProfile;
  usersList: UserProfile[];
  settings: RestaurantSettings;
  activeBtDevice?: BluetoothDevice | null;
  onSuccessShiftClose: (replacementUser: UserProfile) => void;
  cashOutTotal?: number;
  cashMovements?: Array<{
    id: string;
    amount: number;
    reason: string;
    createdBy?: string;
    createdAt: string;
  }>;
}

export function TutupKasirModal({
  isOpen,
  onClose,
  orders,
  currentUser,
  usersList,
  settings,
  activeBtDevice,
  onSuccessShiftClose,
  cashOutTotal,
  cashMovements = [],
}: TutupKasirModalProps) {
  // Filter orders for active cashier session (1:1 with Riwayat Transaksi F6)
  const cashierOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.cashierId) return o.cashierId === currentUser.id;
      if (o.cashierName) return o.cashierName.toLowerCase() === currentUser.name.toLowerCase();
      return currentUser.id === "usr-kasir-1";
    });
  }, [orders, currentUser.id, currentUser.name]);

  // 1. Calculate Shift & Transaction Metrics
  const shiftStats = useMemo(() => {
    // Only paid transactions count towards shift omset
    const paidOrders = cashierOrders.filter((o) => o.paymentStatus === "paid");
    const unpaidOrders = cashierOrders.filter((o) => o.paymentStatus !== "paid");

    const totalSales = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const unpaidTotal = unpaidOrders.reduce((sum, o) => sum + (o.total || 0), 0);

    const getMethod = (o: OrderData) => {
      if (
        o.channel === "online_platform" ||
        o.paymentMethod === "online_channel" ||
        o.paymentMethod === "online_app"
      ) {
        return "online";
      }
      if (o.paymentMethod === "static_qr" || o.paymentMethod === "qris") return "qris";
      if (o.paymentMethod === "bank_transfer" || o.paymentMethod === "transfer") return "transfer";
      return "cash";
    };

    const cashOrders = paidOrders.filter((o) => getMethod(o) === "cash");
    const qrisOrders = paidOrders.filter((o) => getMethod(o) === "qris");
    const transferOrders = paidOrders.filter((o) => getMethod(o) === "transfer");
    const onlineOrders = paidOrders.filter((o) => getMethod(o) === "online");

    const cashSales = cashOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const qrisSales = qrisOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const transferSales = transferOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const onlineSales = onlineOrders.reduce((sum, o) => sum + (o.total || 0), 0);

    const dineInOrders = cashierOrders.filter(
      (o) => o.channel === "dine_in_qr" || !o.channel
    );
    const takeawayOrders = cashierOrders.filter(
      (o) => o.channel === "takeaway_walk_in"
    );
    const deliveryOrders = cashierOrders.filter(
      (o) => o.channel === "online_platform"
    );

    const openingCash = 500000; // Modal awal kasir
    const cashOut = typeof cashOutTotal === "number" ? cashOutTotal : 0; // Kas keluar operasional dinamis dari input kasir
    const expectedCash = openingCash + cashSales - cashOut;

    return {
      cashierOrders,
      paidOrders,
      unpaidOrders,
      totalCount: paidOrders.length,
      unpaidCount: unpaidOrders.length,
      totalOrdersCount: cashierOrders.length,
      totalSales,
      unpaidTotal,
      cashCount: cashOrders.length,
      cashSales,
      qrisCount: qrisOrders.length,
      qrisSales,
      transferCount: transferOrders.length,
      transferSales,
      onlineCount: onlineOrders.length,
      onlineSales,
      dineInCount: dineInOrders.length,
      takeawayCount: takeawayOrders.length,
      deliveryCount: deliveryOrders.length,
      openingCash,
      cashOut,
      expectedCash,
    };
  }, [cashierOrders]);

  // 2. States for Form
  const [physicalCashInput, setPhysicalCashInput] = useState<string>(
    shiftStats.expectedCash.toString()
  );
  const [notes, setNotes] = useState<string>("");
  const [showTransactionList, setShowTransactionList] = useState<boolean>(false);

  // Sync physical cash when modal opens or expected cash changes
  useEffect(() => {
    if (isOpen) {
      setPhysicalCashInput(shiftStats.expectedCash.toString());
      setErrorMsg("");
    }
  }, [isOpen, shiftStats.expectedCash]);

  // Replacement Cashier State
  const eligibleReplacementUsers = useMemo(() => {
    const list = usersList.filter(
      (u) =>
        u.id !== currentUser.id &&
        ["kasir", "manager", "admin", "owner"].includes(u.role) &&
        u.isActive
    );
    return list.length > 0 ? list : usersList.filter((u) => u.id !== currentUser.id);
  }, [usersList, currentUser.id]);

  const [selectedReplacementId, setSelectedReplacementId] = useState<string>(
    eligibleReplacementUsers[0]?.id || ""
  );
  const [replacementPin, setReplacementPin] = useState<string>("");
  const [showPin, setShowPin] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Print State
  const [isPrintingReport, setIsPrintingReport] = useState<boolean>(false);

  if (!isOpen) return null;

  const countedCash = parseInt(physicalCashInput.replace(/\D/g, "") || "0", 10);
  const difference = countedCash - shiftStats.expectedCash;

  const selectedReplacement = usersList.find((u) => u.id === selectedReplacementId);

  // Print Shift Report Handler
  const handlePrintReport = async () => {
    setIsPrintingReport(true);
    const dateStr =
      new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }) +
      " " +
      new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) +
      " WIB";

    // 1. Direct Bluetooth ESC/POS if connected
    if (activeBtDevice) {
      try {
        const text = buildShiftReportEscPos({
          restaurantName: settings.restaurantName || "Pawon Nusantara",
          branchName: settings.branchName,
          shiftDate: dateStr,
          cashierName: currentUser.name,
          replacementCashierName: selectedReplacement?.name || "Kasir Pengganti",
          totalTransactions: shiftStats.totalCount,
          dineInCount: shiftStats.dineInCount,
          takeawayCount: shiftStats.takeawayCount,
          deliveryCount: shiftStats.deliveryCount,
          totalSales: shiftStats.totalSales,
          cashSales: shiftStats.cashSales,
          qrisSales: shiftStats.qrisSales,
          transferSales: shiftStats.transferSales,
          onlineSales: shiftStats.onlineSales,
          openingCash: shiftStats.openingCash,
          cashOut: shiftStats.cashOut,
          expectedCash: shiftStats.expectedCash,
          physicalCash: countedCash,
          difference,
          notes: notes.trim() || undefined,
        });

        const encoder = new TextEncoder();
        await sendEscPosToPrinter(activeBtDevice, encoder.encode(text));
        setIsPrintingReport(false);
        return;
      } catch (err) {
        console.error("Direct BT Shift Print error:", err);
      }
    }

    // 2. Browser Print dialog fallback
    setTimeout(() => {
      window.print();
      setIsPrintingReport(false);
    }, 150);
  };

  // Submit Shift Handover Handler
  const handleSubmitShiftClose = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!selectedReplacement) {
      setErrorMsg("Pilih kasir pengganti yang akan menerima serah terima shift!");
      return;
    }

    const cleanPin = replacementPin.trim();
    if (!cleanPin) {
      setErrorMsg("Masukkan kode login / PIN kasir pengganti untuk validasi serah terima!");
      return;
    }

    // Validate Replacement Cashier PIN
    const expectedPin = selectedReplacement.pin || "2222";
    if (cleanPin !== expectedPin) {
      setErrorMsg(
        `Kode login / PIN untuk ${selectedReplacement.name} tidak cocok! Harap masukkan PIN yang benar.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Send close shift to API
      await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "close_shift",
          physicalCashAmount: countedCash,
          discrepancyNotes: notes.trim() || undefined,
        }),
      });

      // Handover session to replacement user
      onSuccessShiftClose(selectedReplacement);
      onClose();
    } catch (err) {
      console.error("Error closing shift:", err);
      setErrorMsg("Gagal menyimpan data tutup kasir ke database. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="modal-tutup-kasir-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-150">
        
        {/* Header Modal */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">lock_clock</span>
            </div>
            <div>
              <h2 className="font-black text-base sm:text-lg leading-tight text-white flex items-center gap-2">
                <span>Tutup Kasir &amp; Serah Terima Shift</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/30 text-rose-300">
                  CLOSING SHIFT
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Kasir Aktif: <strong className="text-white">{currentUser.name}</strong> ({currentUser.roleLabel}) • {settings.restaurantName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-all"
            title="Batal Tutup Kasir"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmitShiftClose} className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-4 text-xs">
          
          {/* Error Alert Box */}
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 animate-in slide-in-from-top-2 duration-150 shrink-0">
              <span className="material-symbols-outlined text-lg text-rose-600 shrink-0 mt-0.5">error</span>
              <div className="flex-1">
                <span className="font-bold block">Validasi Gagal:</span>
                <span className="text-[11px] leading-tight">{errorMsg}</span>
              </div>
            </div>
          )}

          {/* SECTION 1: RINGKASAN TRANSAKSI SELAMA KASIR BEROPERASI */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                1. Ringkasan Transaksi Selama Kasir Beroperasi
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {shiftStats.totalOrdersCount} Total di Riwayat
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {shiftStats.totalCount} Pesanan Lunas
                </span>
              </div>
            </div>

            {/* Unpaid Orders Warning if any */}
            {shiftStats.unpaidCount > 0 && (
              <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-amber-600">info</span>
                  <span className="text-[11px] leading-tight">
                    Terdapat <strong>{shiftStats.unpaidCount} pesanan aktif ({formatCurrency(shiftStats.unpaidTotal)})</strong> berstatus Belum Lunas (Meja Makan di Tempat).
                  </span>
                </div>
                <span className="text-[10px] font-bold bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded-full shrink-0">
                  Belum Selesai
                </span>
              </div>
            )}

            {/* Stats Cards Grid (5 Cards: Total, Tunai, QRIS, Transfer, Ojol) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                <span className="text-[10px] text-slate-500 font-bold uppercase">Total Penjualan:</span>
                <span className="text-base font-black text-slate-900 mt-1">
                  {formatCurrency(shiftStats.totalSales)}
                </span>
                <span className="text-[9px] text-slate-400 mt-0.5">{shiftStats.totalCount} Pesanan Lunas</span>
              </div>

              <div className="p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between">
                <span className="text-[10px] text-emerald-800 font-bold uppercase flex items-center justify-between">
                  <span>Tunai (Cash):</span>
                  <span>💵</span>
                </span>
                <span className="text-base font-black text-emerald-950 mt-1">
                  {formatCurrency(shiftStats.cashSales)}
                </span>
                <span className="text-[9px] text-emerald-700 font-bold mt-0.5">{shiftStats.cashCount} Transaksi</span>
              </div>

              <div className="p-2.5 rounded-2xl bg-blue-50/70 border border-blue-200 flex flex-col justify-between">
                <span className="text-[10px] text-blue-800 font-bold uppercase flex items-center justify-between">
                  <span>QRIS:</span>
                  <span>📱</span>
                </span>
                <span className="text-base font-black text-blue-950 mt-1">
                  {formatCurrency(shiftStats.qrisSales)}
                </span>
                <span className="text-[9px] text-blue-700 font-bold mt-0.5">{shiftStats.qrisCount} Transaksi</span>
              </div>

              <div className="p-2.5 rounded-2xl bg-purple-50/70 border border-purple-200 flex flex-col justify-between">
                <span className="text-[10px] text-purple-800 font-bold uppercase flex items-center justify-between">
                  <span>Transfer Bank:</span>
                  <span>🏦</span>
                </span>
                <span className="text-base font-black text-purple-950 mt-1">
                  {formatCurrency(shiftStats.transferSales)}
                </span>
                <span className="text-[9px] text-purple-700 font-bold mt-0.5">{shiftStats.transferCount} Transaksi</span>
              </div>

              <div className="p-2.5 rounded-2xl bg-orange-50/70 border border-orange-200 flex flex-col justify-between">
                <span className="text-[10px] text-orange-800 font-bold uppercase flex items-center justify-between">
                  <span>Delivery:</span>
                  <span>🛵</span>
                </span>
                <span className="text-base font-black text-orange-950 mt-1">
                  {formatCurrency(shiftStats.onlineSales)}
                </span>
                <span className="text-[9px] text-orange-700 font-bold mt-0.5">{shiftStats.onlineCount} Transaksi</span>
              </div>
            </div>

            {/* Saluran Breakdown Chips */}
            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 overflow-x-auto">
              <span className="font-bold text-slate-700 shrink-0">Rincian Saluran:</span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-semibold shrink-0">
                🍽️ Dine In: <strong>{shiftStats.dineInCount}</strong>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-semibold shrink-0">
                🛍️ Take Away: <strong>{shiftStats.takeawayCount}</strong>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-semibold shrink-0">
                🛵 Delivery: <strong>{shiftStats.deliveryCount}</strong>
              </span>
            </div>

            {/* Collapsible: Rincian Seluruh Transaksi Sesuai Riwayat Transaksi */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => setShowTransactionList(!showTransactionList)}
                className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-between font-bold text-xs cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-slate-500">list_alt</span>
                  <span>
                    {showTransactionList ? "Sembunyikan" : "Lihat"} Rincian Transaksi Kasir ({shiftStats.cashierOrders.length} Pesanan Sesuai Riwayat)
                  </span>
                </span>
                <span className="material-symbols-outlined text-base text-slate-500 transition-transform duration-200">
                  {showTransactionList ? "expand_less" : "expand_more"}
                </span>
              </button>

              {showTransactionList && (
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 p-2 text-[11px] scrollbar-thin">
                  {shiftStats.cashierOrders.length === 0 ? (
                    <div className="py-4 text-center text-slate-400">Belum ada transaksi di kasir ini</div>
                  ) : (
                    shiftStats.cashierOrders.map((ord) => {
                      const isPaid = ord.paymentStatus === "paid";
                      const isOnline = ord.channel === "online_platform" || ord.paymentMethod === "online_channel";
                      const isQris = ord.paymentMethod === "static_qr";
                      const isTransfer = ord.paymentMethod === "bank_transfer";

                      let methodLabel = "Tunai";
                      if (isOnline) methodLabel = ord.channelLabel || "Delivery";
                      else if (isQris) methodLabel = "QRIS";
                      else if (isTransfer) methodLabel = "Transfer";

                      return (
                        <div
                          key={ord.id}
                          className="py-2 px-2 flex items-center justify-between gap-2 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono font-bold text-slate-900 shrink-0">
                              {ord.orderNumber}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0 font-medium">
                              {ord.channelLabel}
                            </span>
                            <span className="text-slate-600 truncate">
                              {ord.tableOrGuest}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {methodLabel}
                            </span>
                            <span className="font-extrabold text-slate-900">
                              {formatCurrency(ord.total)}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                                isPaid
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-900"
                              }`}
                            >
                              {isPaid ? "LUNAS" : "BELUM"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: REKONSILIASI KAS & LAPORAN FISIK */}
          <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-100">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              2. Rekonsiliasi Kas Laci &amp; Input Uang Fisik Dipegang
            </span>

            {/* Ledger Box */}
            <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-200 flex flex-col gap-1.5 text-[11px]">
              <div className="flex justify-between items-center text-slate-600">
                <span>Modal Awal Kas (Kas Float Bawaan Kasir):</span>
                <strong className="text-slate-900 font-bold">{formatCurrency(shiftStats.openingCash)}</strong>
              </div>
              <div className="flex justify-between items-center text-emerald-800">
                <span>+ Total Pembayaran Tunai Masuk:</span>
                <strong className="font-bold">+{formatCurrency(shiftStats.cashSales)}</strong>
              </div>
              <div className="flex justify-between items-center text-rose-700">
                <span className="flex items-center gap-1">
                  <span>- Pengeluaran Kas Operasional:</span>
                  {cashMovements.length > 0 && (
                    <span className="text-[10px] text-slate-500 font-normal">
                      ({cashMovements.length} catatan pengeluaran)
                    </span>
                  )}
                </span>
                <strong className="font-bold">-{formatCurrency(shiftStats.cashOut)}</strong>
              </div>

              {cashMovements.length > 0 && (
                <div className="pl-2.5 py-1 flex flex-col gap-0.5 border-l-2 border-rose-300 ml-1 bg-white/60 rounded-r-lg">
                  {cashMovements.slice(0, 3).map((cm) => (
                    <div key={cm.id} className="flex justify-between text-[10px] text-slate-600">
                      <span className="truncate max-w-[280px]">↳ {cm.reason}</span>
                      <span className="font-semibold text-rose-700">-{formatCurrency(cm.amount)}</span>
                    </div>
                  ))}
                  {cashMovements.length > 3 && (
                    <span className="text-[9px] text-slate-400 italic">
                      + {cashMovements.length - 3} pengeluaran lainnya
                    </span>
                  )}
                </div>
              )}
              <div className="pt-1.5 mt-0.5 border-t border-blue-200 flex justify-between items-center">
                <span className="font-black text-slate-800 text-xs">Total Ekspektasi Kas Sistem:</span>
                <span className="font-black text-sm sm:text-base text-[#003629]">
                  {formatCurrency(shiftStats.expectedCash)}
                </span>
              </div>
            </div>

            {/* Physical Cash Input & Difference */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-800 text-xs flex items-center justify-between">
                  <span>Uang Tunai Fisik yang Dipegang <span className="text-rose-600">*</span>:</span>
                  <button
                    type="button"
                    onClick={() => setPhysicalCashInput(shiftStats.expectedCash.toString())}
                    className="text-[10px] text-emerald-700 font-extrabold hover:underline cursor-pointer"
                  >
                    Gunakan Nilai Pas
                  </button>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">
                    Rp
                  </span>
                  <input
                    type="text"
                    required
                    value={
                      physicalCashInput
                        ? parseInt(physicalCashInput.replace(/\D/g, "") || "0", 10).toLocaleString("id-ID")
                        : "0"
                    }
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      setPhysicalCashInput(raw);
                    }}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl font-black text-base text-slate-900 focus:bg-white focus:border-[#003629] outline-none transition-all"
                  />
                </div>
              </div>

              {/* Status Selisih Kas */}
              <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                difference === 0
                  ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                  : difference < 0
                  ? "bg-rose-50 border-rose-300 text-rose-950"
                  : "bg-amber-50 border-amber-300 text-amber-950"
              }`}>
                <div className="flex items-center justify-between text-[11px] font-black uppercase">
                  <span>Selisih Kas Fisik:</span>
                  <span className="material-symbols-outlined text-sm">
                    {difference === 0 ? "verified" : difference < 0 ? "warning" : "info"}
                  </span>
                </div>
                <div className="text-base font-black truncate mt-1">
                  {difference === 0
                    ? "Sesuai / Pas (Rp0)"
                    : difference > 0
                    ? `+${formatCurrency(difference)} (Lebih)`
                    : `${formatCurrency(difference)} (Kurang)`}
                </div>
                <span className="text-[10px] opacity-80">
                  {difference === 0
                    ? "Kas fisik sesuai persis dengan catatan sistem POS"
                    : difference < 0
                    ? "Uang fisik kurang dari ekspektasi sistem"
                    : "Uang fisik melebihi ekspektasi sistem"}
                </span>
              </div>
            </div>

            {/* Closing Notes */}
            <div className="flex flex-col gap-1">
              <label className="font-bold text-slate-700 text-[11px]">
                Catatan Penutupan Shift (Wajib jika ada selisih kas):
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Misal: Sisa uang kasir diserahkan utuh, kembalian pecahan 2.000 habis..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-primary outline-none resize-none"
              />
            </div>
          </div>

          {/* SECTION 3: SERAH TERIMA & VALIDASI KASIR PENGGANTI */}
          <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-100 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-primary">badge</span>
                <span>3. Validasi Kasir Pengganti (Serah Terima Shift)</span>
              </span>
              <span className="text-[10px] font-extrabold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
                WAJIB PIN KASIR BARU
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Dropdown Kasir Pengganti */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-800 text-xs">
                  Pilih Kasir Pengganti (Shift Selanjutnya) <span className="text-rose-600">*</span>:
                </label>
                <select
                  value={selectedReplacementId}
                  onChange={(e) => {
                    setSelectedReplacementId(e.target.value);
                    setErrorMsg("");
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:border-primary outline-none"
                >
                  {eligibleReplacementUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — ({u.roleLabel})
                    </option>
                  ))}
                </select>
              </div>

              {/* Input PIN Kasir Pengganti */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-800 text-xs flex items-center justify-between">
                  <span>Input PIN Kasir Pengganti <span className="text-rose-600">*</span>:</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {selectedReplacement?.username ? `User: ${selectedReplacement.username}` : ""}
                  </span>
                </label>
                <div className="relative">
                  <input
                    type={showPin ? "text" : "password"}
                    required
                    value={replacementPin}
                    onChange={(e) => {
                      setReplacementPin(e.target.value);
                      setErrorMsg("");
                    }}
                    placeholder="Masukkan PIN login kasir penerima"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:border-primary outline-none pr-9 tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    title={showPin ? "Sembunyikan PIN" : "Tampilkan PIN"}
                  >
                    <span className="material-symbols-outlined text-base">
                      {showPin ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed italic">
              * Validasi PIN kasir pengganti diperlukan sebagai bukti serah terima kasir resmi. Setelah terkonfirmasi, sesi aktif akan beralih langsung ke kasir pengganti.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handlePrintReport}
              disabled={isPrintingReport}
              className="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
              title="Cetak struk laporan shift ke printer thermal"
            >
              <span className="material-symbols-outlined text-base text-slate-700">print</span>
              <span>{isPrintingReport ? "Mencetak..." : "Cetak Laporan Kerja"}</span>
            </button>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-all"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !replacementPin.trim()}
                className="py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
              >
                <span className="material-symbols-outlined text-base">lock</span>
                <span>{isSubmitting ? "Memproses..." : "Tutup Kasir & Serah Terima"}</span>
              </button>
            </div>
          </div>

        </form>

      </div>

      {/* ========================================================
          PRINTABLE THERMAL SHIFT REPORT (58mm)
          Hanya tampak saat proses cetak window.print()
         ======================================================== */}
      <div
        id="pos-shift-report-printable-area"
        className="hidden print:block font-mono text-xs text-black bg-white p-2"
      >
        <div className="flex flex-col gap-2">
          <div className="text-center border-b border-dashed border-black pb-2">
            <h3 className="font-bold text-sm uppercase tracking-wide">
              {settings.restaurantName || "PAWON NUSANTARA"}
            </h3>
            {settings.branchName && (
              <p className="text-[11px] text-gray-700">{settings.branchName}</p>
            )}
            <p className="text-[11px] font-bold mt-1">LAPORAN TUTUP KASIR &amp; SHIFT</p>
          </div>

          <div className="flex flex-col gap-0.5 text-[11px] border-b border-dashed border-black pb-2">
            <div className="flex justify-between">
              <span>Waktu Tutup:</span>
              <span>
                {new Date().toLocaleDateString("id-ID")} {new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
              </span>
            </div>
            <div className="flex justify-between">
              <span>Kasir Lama:</span>
              <span className="font-bold">{currentUser.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Kasir Pengganti:</span>
              <span className="font-bold">{selectedReplacement?.name || "-"}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1 text-[11px] border-b border-dashed border-black pb-2">
            <div className="flex justify-between font-bold">
              <span>Total Transaksi:</span>
              <span>{shiftStats.totalCount} Pesanan</span>
            </div>
            <div className="flex justify-between pl-2">
              <span>- Dine In:</span>
              <span>{shiftStats.dineInCount}</span>
            </div>
            <div className="flex justify-between pl-2">
              <span>- Take Away:</span>
              <span>{shiftStats.takeawayCount}</span>
            </div>
            <div className="flex justify-between pl-2">
              <span>- Delivery:</span>
              <span>{shiftStats.deliveryCount}</span>
            </div>
            <div className="flex justify-between font-bold pt-1 border-t border-dotted border-gray-400">
              <span>TOTAL OMSET:</span>
              <span>{formatCurrency(shiftStats.totalSales)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1 text-[11px] border-b border-dashed border-black pb-2">
            <span className="font-bold">METODE PEMBAYARAN:</span>
            <div className="flex justify-between pl-2">
              <span>- Tunai:</span>
              <span>{formatCurrency(shiftStats.cashSales)}</span>
            </div>
            <div className="flex justify-between pl-2">
              <span>- QRIS:</span>
              <span>{formatCurrency(shiftStats.qrisSales)}</span>
            </div>
            <div className="flex justify-between pl-2">
              <span>- Transfer:</span>
              <span>{formatCurrency(shiftStats.transferSales)}</span>
            </div>
            {shiftStats.onlineSales > 0 && (
              <div className="flex justify-between pl-2">
                <span>- Delivery:</span>
                <span>{formatCurrency(shiftStats.onlineSales)}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1 text-[11px] border-b border-dashed border-black pb-2">
            <span className="font-bold">REKONSILIASI KAS (LACI):</span>
            <div className="flex justify-between pl-2">
              <span>Modal Awal:</span>
              <span>{formatCurrency(shiftStats.openingCash)}</span>
            </div>
            <div className="flex justify-between pl-2">
              <span>+ Kas Masuk Tunai:</span>
              <span>+{formatCurrency(shiftStats.cashSales)}</span>
            </div>
            <div className="flex justify-between pl-2">
              <span>- Kas Keluar Operasional:</span>
              <span>-{formatCurrency(shiftStats.cashOut)}</span>
            </div>
            <div className="flex justify-between font-bold pt-1 border-t border-dotted border-gray-400">
              <span>Ekspektasi Kas:</span>
              <span>{formatCurrency(shiftStats.expectedCash)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Fisik Dipegang:</span>
              <span>{formatCurrency(countedCash)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Selisih:</span>
              <span>{difference === 0 ? "Pas (Rp0)" : difference > 0 ? `+${formatCurrency(difference)}` : formatCurrency(difference)}</span>
            </div>
          </div>

          {notes && (
            <div className="text-[10px] text-gray-700 border-b border-dashed border-black pb-2">
              <span className="font-bold">Catatan:</span> {notes}
            </div>
          )}

          <div className="text-center text-[10px] pt-2">
            <p className="font-bold">SERAH TERIMA TUGAS KASIR</p>
            <p className="text-[9px] text-gray-600 mb-3">Tervalidasi dengan PIN Login</p>
            <div className="flex justify-between px-2 pt-6">
              <div className="text-center">
                <p className="border-t border-black pt-1 font-bold">({currentUser.name})</p>
                <p className="text-[8px] text-gray-500">Kasir Lama</p>
              </div>
              <div className="text-center">
                <p className="border-t border-black pt-1 font-bold">({selectedReplacement?.name || "Kasir Baru"})</p>
                <p className="text-[8px] text-gray-500">Kasir Pengganti</p>
              </div>
            </div>
            <p className="mt-3 text-[9px] text-gray-500">Sistem POS didukung Keivo</p>
          </div>
        </div>
      </div>
    </div>
  );
}
