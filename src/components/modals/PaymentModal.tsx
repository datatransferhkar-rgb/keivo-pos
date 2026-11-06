"use client";

import React, { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/formatters";
import { OrderData, RestaurantSettings } from "@/types/pos";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderData | null;
  settings: RestaurantSettings;
  onConfirmPayment: (
    orderId: string,
    method: "cash" | "static_qr" | "bank_transfer",
    amountPaid: number,
    change: number
  ) => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  order,
  settings,
  onConfirmPayment,
}: PaymentModalProps) {
  const [method, setMethod] = useState<"cash" | "static_qr" | "bank_transfer">("cash");
  const [amountPaidInput, setAmountPaidInput] = useState<string>("");
  const [isInputTouched, setIsInputTouched] = useState<boolean>(false);
  const [transferRef, setTransferRef] = useState<string>("");
  const [selectedBankId, setSelectedBankId] = useState<string>("");

  // Sync state when order changes or modal opens
  useEffect(() => {
    if (order && isOpen) {
      setMethod("cash");
      setAmountPaidInput(order.total.toString());
      setIsInputTouched(false);
      setTransferRef("");
      const defaultBank = (settings.bankAccounts || []).find((b) => b.isDefault && b.isActive !== false) ||
                          (settings.bankAccounts || []).find((b) => b.isActive !== false);
      setSelectedBankId(defaultBank?.id || "");
    }
  }, [order, isOpen, settings.bankAccounts]);

  if (!isOpen || !order) return null;

  const total = order.total;
  const numericPaid = parseInt(amountPaidInput.replace(/\D/g, "") || "0", 10);
  const change = Math.max(0, numericPaid - total);
  const isCashSufficient = numericPaid >= total;
  const underpaidAmount = Math.max(0, total - numericPaid);

  // Quick cash options (exact, rounded 50k, rounded 100k, etc.)
  const getQuickCashOptions = () => {
    const opts: { label: string; value: number }[] = [];
    opts.push({ label: `Pas (${formatCurrency(total)})`, value: total });

    const round50 = Math.ceil(total / 50000) * 50000;
    if (round50 > total) {
      opts.push({ label: formatCurrency(round50), value: round50 });
    }

    const round100 = Math.ceil(total / 100000) * 100000;
    if (round100 > total && round100 !== round50) {
      opts.push({ label: formatCurrency(round100), value: round100 });
    }

    // Common banknotes if greater than total
    [50000, 100000, 200000].forEach((bill) => {
      if (bill >= total && !opts.some((o) => o.value === bill)) {
        opts.push({ label: formatCurrency(bill), value: bill });
      }
    });

    return opts;
  };

  const handleSelectQuickCash = (amount: number) => {
    setAmountPaidInput(amount.toString());
    setIsInputTouched(true);
  };

  const handleQuickAdd = (addAmount: number) => {
    const current = isInputTouched ? numericPaid : 0;
    setAmountPaidInput((current + addAmount).toString());
    setIsInputTouched(true);
  };

  // Virtual Numpad Handlers
  const handleNumpadDigit = (digit: string) => {
    if (!isInputTouched || amountPaidInput === "0") {
      setAmountPaidInput(digit);
      setIsInputTouched(true);
    } else {
      if (amountPaidInput.length >= 10) return; // Prevent overflow
      setAmountPaidInput(amountPaidInput + digit);
    }
  };

  const handleNumpadTripleZero = () => {
    if (!isInputTouched || amountPaidInput === "0" || amountPaidInput === "") {
      return;
    }
    if (amountPaidInput.length >= 8) return;
    setAmountPaidInput(amountPaidInput + "000");
  };

  const handleNumpadBackspace = () => {
    if (!isInputTouched || amountPaidInput.length <= 1) {
      setAmountPaidInput("0");
      setIsInputTouched(true);
    } else {
      setAmountPaidInput(amountPaidInput.slice(0, -1));
    }
  };

  const handleNumpadClear = () => {
    setAmountPaidInput("0");
    setIsInputTouched(true);
  };

  const handlePay = () => {
    if (method === "cash" && !isCashSufficient) {
      alert("Nominal uang tunai yang diterima kurang dari total tagihan!");
      return;
    }

    onConfirmPayment(
      order.id,
      method,
      method === "cash" ? numericPaid : total,
      method === "cash" ? change : 0
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-4xl max-h-[94vh] rounded-3xl bg-white shadow-2xl flex flex-col overflow-hidden border border-slate-200/80 animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#eef2f6] flex items-center justify-center text-slate-700 shrink-0">
              <span className="material-symbols-outlined text-2xl font-bold">payments</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Pembayaran Tagihan {order.orderNumber}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#eef2f6] text-slate-700 border border-slate-200/60">
                  {order.channelLabel || "Dine-in"}
                </span>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {order.tableOrGuest} • {order.items.length} Macam Menu
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-all"
            title="Tutup Modal"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Modal Body - 2 Columns on Tablet / Desktop */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-5">
          
          {/* Kolom Kiri: Ringkasan Tagihan & Pilihan Metode */}
          <div className="md:col-span-5 flex flex-col gap-4">
            
            {/* Box Total Tagihan Utama */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#003629] text-white flex flex-col justify-between shadow-sm min-h-[112px]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-200/90">
                TOTAL YANG HARUS DIBAYAR
              </span>
              <span className="text-3xl font-black text-white tracking-tight my-1">
                {formatCurrency(total)}
              </span>
              <div className="flex items-center justify-between text-xs text-emerald-100/90 font-medium pt-1 border-t border-emerald-800/60">
                <span>{order.tableOrGuest}</span>
                <span>{order.orderTime || new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(":", ".")} WIB</span>
              </div>
            </div>

            {/* Selector Metode Pembayaran (Touch-Friendly Cards) */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                PILIH METODE PEMBAYARAN
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMethod("cash");
                    setAmountPaidInput(total.toString());
                    setIsInputTouched(false);
                  }}
                  className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[72px] active:scale-95 ${
                    method === "cash"
                      ? "bg-[#003629] text-white shadow-xs"
                      : "bg-[#f0f4f9] text-slate-700 hover:bg-slate-200/70"
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl">payments</span>
                  <span className="text-xs font-bold leading-tight">Tunai</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod("static_qr")}
                  className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[72px] active:scale-95 ${
                    method === "static_qr"
                      ? "bg-[#003629] text-white shadow-xs"
                      : "bg-[#f0f4f9] text-slate-700 hover:bg-slate-200/70"
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl">qr_code_2</span>
                  <span className="text-xs font-bold leading-tight">QRIS Statis</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod("bank_transfer")}
                  className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[72px] active:scale-95 ${
                    method === "bank_transfer"
                      ? "bg-[#003629] text-white shadow-xs"
                      : "bg-[#f0f4f9] text-slate-700 hover:bg-slate-200/70"
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl">account_balance</span>
                  <span className="text-xs font-bold leading-tight">Transfer</span>
                </button>
              </div>
            </div>

            {/* Rincian Pesanan Ringkas */}
            <div className="p-4 rounded-2xl bg-[#f0f4f9] border border-slate-200/60 flex flex-col gap-2.5 flex-1 min-h-[170px]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Rincian Item ({order.items.length})</span>
                <span className="font-semibold text-slate-400">Qty × Harga</span>
              </div>
              <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                {order.items.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 truncate pr-2">
                      <span className="font-bold text-slate-800">{it.qty}x</span>
                      <span className="font-semibold text-slate-800 truncate">{it.name}</span>
                    </div>
                    <span className="font-bold text-slate-800 shrink-0">
                      {formatCurrency(it.price * it.qty)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Kolom Kanan: Panel Interaktif Pembayaran & Numpad Khusus Tablet */}
          <div className="md:col-span-7 flex flex-col gap-3.5">
            
            {/* JIKA METODE TUNAI (CASH) */}
            {method === "cash" && (
              <>
                {/* Top Display Row: Uang Diterima & Kembalian Kasir */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Layar Uang Diterima */}
                  <div className="p-3.5 rounded-2xl bg-[#f0f4f9] border border-slate-200/70 flex flex-col justify-between h-[84px]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      UANG DITERIMA (RP)
                    </span>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-xs font-bold text-slate-400 select-none">Rp</span>
                      <span className="text-3xl font-black text-slate-900 tracking-tight text-right flex-1 truncate">
                        {numericPaid > 0 ? numericPaid.toLocaleString("id-ID") : "0"}
                      </span>
                    </div>
                  </div>

                  {/* Layar Kembalian */}
                  <div className="p-3.5 rounded-2xl bg-[#e6f4ea] border-2 border-emerald-500 flex flex-col justify-between h-[84px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        {isCashSufficient ? "KEMBALIAN KASIR" : "KURANG"}
                      </span>
                      {isCashSufficient && (
                        <span className="material-symbols-outlined text-lg font-bold text-emerald-600">
                          check_circle
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-xs font-bold text-slate-400 select-none">Rp</span>
                      <span className="text-3xl font-black text-slate-900 tracking-tight text-right flex-1 truncate">
                        {isCashSufficient
                          ? change.toLocaleString("id-ID")
                          : `-${underpaidAmount.toLocaleString("id-ID")}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section: PILIHAN UANG CEPAT (QUICK CASH) */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    PILIHAN UANG CEPAT (QUICK CASH):
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {getQuickCashOptions().map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelectQuickCash(opt.value)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                          numericPaid === opt.value
                            ? "bg-[#003629] text-white shadow-xs"
                            : "bg-[#e2edfd] hover:bg-blue-100 text-slate-800"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Quick Add Chips (+10rb, +20rb, +50rb, +100rb) */}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                      TAMBAH:
                    </span>
                    {[10000, 20000, 50000, 100000].map((addVal) => (
                      <button
                        key={addVal}
                        type="button"
                        onClick={() => handleQuickAdd(addVal)}
                        className="px-2.5 py-1 rounded-lg bg-[#e6f4ea] hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300 active:scale-95 transition-all cursor-pointer"
                      >
                        +{addVal >= 1000 ? `${addVal / 1000}rb` : addVal}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Virtual Touch Numpad Grid (4x4) */}
                <div className="bg-[#f0f4f9] p-2.5 rounded-2xl border border-slate-200/70 shadow-2xs">
                  <div className="grid grid-cols-4 gap-2">
                    {/* Row 1 */}
                    <button
                      type="button"
                      onClick={() => handleNumpadDigit("1")}
                      className="h-12 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-bold text-lg border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all"
                    >
                      1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNumpadDigit("2")}
                      className="h-12 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-bold text-lg border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all"
                    >
                      2
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNumpadDigit("3")}
                      className="h-12 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-bold text-lg border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all"
                    >
                      3
                    </button>
                    <button
                      type="button"
                      onClick={handleNumpadBackspace}
                      className="h-12 rounded-xl bg-[#fff8e1] hover:bg-amber-100 active:scale-95 text-amber-900 border border-amber-200/80 shadow-2xs flex items-center justify-center font-bold cursor-pointer transition-all"
                      title="Hapus Satu Digit"
                    >
                      <span className="material-symbols-outlined text-xl">backspace</span>
                    </button>

                    {/* Row 2 */}
                    <button
                      type="button"
                      onClick={() => handleNumpadDigit("4")}
                      className="h-12 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-bold text-lg border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all"
                    >
                      4
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNumpadDigit("5")}
                      className="h-12 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-bold text-lg border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all"
                    >
                      5
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNumpadDigit("6")}
                      className="h-12 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-bold text-lg border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all"
                    >
                      6
                    </button>
                    <button
                      type="button"
                      onClick={handleNumpadClear}
                      className="h-12 rounded-xl bg-[#fde8e8] hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200/80 shadow-2xs font-black text-base flex items-center justify-center cursor-pointer transition-all"
                      title="Reset Menjadi 0"
                    >
                      C
                    </button>

                    {/* Row 3 */}
                    <button
                      type="button"
                      onClick={() => handleNumpadDigit("7")}
                      className="h-12 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-bold text-lg border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all"
                    >
                      7
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNumpadDigit("8")}
                      className="h-12 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-bold text-lg border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all"
                    >
                      8
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNumpadDigit("9")}
                      className="h-12 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-bold text-lg border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all"
                    >
                      9
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectQuickCash(total)}
                      className="h-12 rounded-xl bg-[#cbf4d8] hover:bg-emerald-200 active:scale-95 text-emerald-950 border border-emerald-300/80 shadow-2xs font-bold text-xs flex items-center justify-center cursor-pointer transition-all text-center leading-tight"
                      title="Gunakan Uang Pas"
                    >
                      Uang Pas
                    </button>

                    {/* Row 4 */}
                    <button
                      type="button"
                      onClick={() => handleNumpadDigit("0")}
                      className="h-12 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-bold text-lg border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={handleNumpadTripleZero}
                      className="col-span-2 h-12 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-bold text-sm sm:text-base border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all"
                    >
                      000 (Ribu)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectQuickCash(Math.ceil(total / 50000) * 50000)}
                      className="h-12 rounded-xl bg-[#eef2f6] hover:bg-slate-200 active:scale-95 text-slate-800 border border-slate-300 shadow-2xs font-bold text-xs flex items-center justify-center cursor-pointer transition-all text-center leading-tight"
                    >
                      Bulat 50k
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* JIKA METODE QRIS STATIS */}
            {method === "static_qr" && (
              <div className="flex flex-col items-center justify-center p-6 bg-[#f0f4f9] rounded-2xl gap-3 text-center border border-slate-200/70 flex-1">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl font-bold">qr_code_2</span>
                  <span className="text-base font-extrabold text-slate-900">
                    {settings.staticQrLabel || "QRIS Kasir Pawon Nusantara"}
                  </span>
                </div>

                <div className="w-56 h-56 bg-white p-3 rounded-2xl shadow-sm border-2 border-slate-200 flex items-center justify-center overflow-hidden">
                  <img
                    src={
                      settings.staticQrImageUrl ||
                      "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=00020101021226670014ID.LINKAJA.WWW01189360001400000102035204581253033605802ID5915PAWON+NUSANTARA6007JAKARTA61051219062070703A016304"
                    }
                    alt={settings.staticQrLabel || "QRIS Statis"}
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>

                <div className="bg-emerald-50 px-4 py-2.5 rounded-xl border border-emerald-200 text-emerald-900 text-xs font-semibold max-w-sm">
                  {settings.staticQrInstructions ||
                    "Arahkan layar tablet ini ke pelanggan untuk dipindai via BCA Mobile, GoPay, OVO, ShopeePay, atau DANA."}
                </div>

                <span className="text-[11px] text-slate-500 font-medium">
                  Mendukung semua pembayaran QRIS perbankan dan e-wallet nasional.
                </span>
              </div>
            )}

            {/* JIKA METODE TRANSFER BANK */}
            {method === "bank_transfer" && (() => {
              const activeBankAccounts = (settings.bankAccounts || []).filter((b) => b.isActive !== false);
              const currentBankId =
                selectedBankId ||
                activeBankAccounts.find((b) => b.isDefault)?.id ||
                activeBankAccounts[0]?.id ||
                "";
              const currentBank = activeBankAccounts.find((b) => b.id === currentBankId) || activeBankAccounts[0];

              return (
                <div className="flex flex-col p-5 bg-[#f0f4f9] rounded-2xl gap-3.5 border border-slate-200/70 flex-1 justify-center">
                  
                  {/* Selector rekening bank jika > 1 */}
                  {activeBankAccounts.length > 1 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Pilih Rekening Bank Tujuan ({activeBankAccounts.length}):
                      </span>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {activeBankAccounts.map((acc) => {
                          const isSelected = acc.id === currentBank?.id;
                          return (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => setSelectedBankId(acc.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                                isSelected
                                  ? "bg-[#003629] text-white shadow-xs scale-102"
                                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                              }`}
                            >
                              <span className="material-symbols-outlined text-sm">account_balance</span>
                              <span>{acc.bankName}</span>
                              {acc.isDefault && (
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                                    isSelected ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                                  }`}
                                >
                                  Utama
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Kartu Detail Rekening Terpilih */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-black text-xs border border-emerald-200/60">
                          <span className="material-symbols-outlined text-base">account_balance</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Bank Tujuan
                          </span>
                          <span className="text-sm font-black text-slate-900">
                            {currentBank ? currentBank.bankName : "BCA"}
                          </span>
                        </div>
                      </div>
                      {currentBank?.isDefault && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Rekening Utama
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-slate-500">Nomor Rekening</span>
                        <span className="text-base sm:text-lg font-mono font-black text-slate-900 tracking-wide">
                          {currentBank ? currentBank.accountNumber : settings.bankTransferInstructions || "8830123456"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const no = currentBank ? currentBank.accountNumber : "8830123456";
                          navigator.clipboard.writeText(no);
                          alert(`Nomor rekening ${no} berhasil disalin ke clipboard!`);
                        }}
                        className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-xs font-bold text-slate-800 border border-slate-200 shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <span className="material-symbols-outlined text-sm">content_copy</span>
                        <span>Salin</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs text-slate-500 font-medium">Atas Nama (a/n):</span>
                      <span className="text-xs sm:text-sm font-black text-slate-800 uppercase">
                        {currentBank ? currentBank.accountName : "PT PAWON NUSANTARA JAYA"}
                      </span>
                    </div>
                  </div>

                  {/* Input Nomor Referensi Transfer / Bukti */}
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">
                      Nomor Referensi Transfer / Nama Pengirim (Opsional):
                    </label>
                    <input
                      type="text"
                      value={transferRef}
                      onChange={(e) => setTransferRef(e.target.value)}
                      placeholder="Contoh: REF-8829103 atau a/n Budi"
                      className="w-full px-3.5 py-2.5 bg-white rounded-xl text-slate-900 border border-slate-200 font-mono text-sm focus:outline-none focus:border-primary shadow-inner"
                    />
                  </div>

                  <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2">
                    <span className="material-symbols-outlined text-base text-amber-700 shrink-0 mt-0.5">info</span>
                    <span>Kasir wajib memeriksa mutasi rekening atau bukti transfer pelanggan sebelum menekan tombol konfirmasi lunas.</span>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>

        {/* Modal Sticky Footer - Large Touch Buttons */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-12 px-6 rounded-xl bg-[#f0f4f9] hover:bg-slate-200 active:scale-95 text-slate-800 font-bold text-sm cursor-pointer transition-all"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handlePay}
            disabled={method === "cash" && !isCashSufficient}
            className="h-12 px-6 rounded-xl bg-[#003629] hover:bg-[#00261d] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md flex items-center gap-2 cursor-pointer transition-all"
          >
            <span className="material-symbols-outlined text-lg">print</span>
            <span>Konfirmasi Lunas &amp; Cetak Struk</span>
          </button>
        </div>

      </div>
    </div>
  );
}
