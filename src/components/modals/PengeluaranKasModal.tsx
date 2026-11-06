"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/lib/formatters";
import { UserProfile } from "@/types/auth";

export interface CashExpenseItem {
  id: string;
  cashierSessionId?: string;
  movementType?: string;
  amount: number;
  reason: string;
  createdBy?: string;
  createdAt: string;
}

interface PengeluaranKasModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  expenses: CashExpenseItem[];
  onAddExpense: (amount: number, reason: string) => Promise<boolean>;
  onDeleteExpense: (id: string) => Promise<boolean>;
}

const QUICK_AMOUNTS = [10000, 20000, 50000, 100000];

const PRESET_CATEGORIES = [
  { label: "Es Batu", icon: "ac_unit" },
  { label: "Belanja Pasar / Dapur", icon: "shopping_basket" },
  { label: "Parkir & Retribusi", icon: "local_parking" },
  { label: "Gas LPG / Galon", icon: "local_fire_department" },
  { label: "Kebersihan & Perlengkapan", icon: "cleaning_services" },
  { label: "Operasional Lainnya", icon: "inventory_2" },
];

export function PengeluaranKasModal({
  isOpen,
  onClose,
  currentUser,
  expenses,
  onAddExpense,
  onDeleteExpense,
}: PengeluaranKasModalProps) {
  const [amountRaw, setAmountRaw] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Es Batu");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  if (!isOpen) return null;

  const currentAmount = parseInt(amountRaw.replace(/\D/g, "") || "0", 10);

  const handleAddQuickAmount = (val: number) => {
    const next = currentAmount + val;
    setAmountRaw(next.toLocaleString("id-ID"));
    setErrorMsg("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (currentAmount <= 0) {
      setErrorMsg("Masukkan nominal pengeluaran kas yang valid!");
      return;
    }

    const fullReason = notes.trim()
      ? `${selectedCategory} (${notes.trim()})`
      : selectedCategory;

    setIsSubmitting(true);
    try {
      const ok = await onAddExpense(currentAmount, fullReason);
      if (ok) {
        setAmountRaw("");
        setNotes("");
      } else {
        setErrorMsg("Gagal menyimpan pengeluaran kas. Coba lagi.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Terjadi kesalahan sistem saat menyimpan kas keluar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus catatan pengeluaran kas ini?")) return;
    setDeletingId(id);
    try {
      await onDeleteExpense(id);
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const totalCashOut = expenses.reduce((sum, item) => sum + (item.amount || 0), 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* Header Modal */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">payments</span>
            </div>
            <div>
              <h2 className="font-black text-base sm:text-lg leading-tight text-white flex items-center gap-2">
                <span>Pengeluaran Kas Operasional</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/30 text-amber-300">
                  PETTY CASH
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Kasir: <strong className="text-white">{currentUser.name}</strong> • Catat pengeluaran kas laci shift aktif
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-all"
            title="Tutup"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-4 text-xs">
          
          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-rose-600">error</span>
              <span className="font-bold">{errorMsg}</span>
            </div>
          )}

          {/* Form Input Kas Keluar */}
          <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-amber-600">add_card</span>
              <span>Input Pengeluaran Kas Baru</span>
            </span>

            {/* Nominal Input */}
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-slate-800 text-xs">
                Nominal Kas Keluar <span className="text-rose-600">*</span>:
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400 text-base">
                  Rp
                </span>
                <input
                  type="text"
                  required
                  placeholder="0"
                  value={amountRaw}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, "");
                    const num = clean ? parseInt(clean, 10) : 0;
                    setAmountRaw(num > 0 ? num.toLocaleString("id-ID") : "");
                    setErrorMsg("");
                  }}
                  className="w-full pl-10 pr-3 py-2.5 bg-white border-2 border-slate-300 rounded-xl font-black text-lg text-slate-900 focus:border-amber-600 outline-none transition-all"
                />
              </div>

              {/* Quick Nominal Buttons (Tablet Friendly) */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] text-slate-500 font-bold shrink-0">Cepat:</span>
                {QUICK_AMOUNTS.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleAddQuickAmount(val)}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-50 active:scale-95 border border-slate-200 hover:border-amber-400 text-slate-700 font-bold text-[11px] transition-all cursor-pointer shadow-2xs"
                  >
                    +{formatCurrency(val)}
                  </button>
                ))}
                {currentAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmountRaw("")}
                    className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] ml-auto cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Kategori Keperluan */}
            <div className="flex flex-col gap-1.5 pt-1">
              <label className="font-bold text-slate-800 text-xs">
                Keperluan / Kategori <span className="text-rose-600">*</span>:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PRESET_CATEGORIES.map((cat) => (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => setSelectedCategory(cat.label)}
                    className={`p-2 rounded-xl text-left font-bold text-[11px] flex items-center gap-2 border transition-all cursor-pointer ${
                      selectedCategory === cat.label
                        ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base shrink-0">{cat.icon}</span>
                    <span className="truncate">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Catatan / Keterangan Tambahan */}
            <div className="flex flex-col gap-1 pt-1">
              <label className="font-bold text-slate-800 text-xs">
                Catatan Tambahan (Opsional):
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Misal: 2 karung es kristal, bon pembelian terlampir"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:border-amber-600 outline-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || currentAmount <= 0}
              className="mt-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-all"
            >
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>{isSubmitting ? "Menyimpan..." : "Simpan Pengeluaran Kas"}</span>
            </button>
          </form>

          {/* SECTION RIWAYAT PENGELUARAN KAS SHIFT INI */}
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-slate-500">receipt_long</span>
                <span>Daftar Kas Keluar Shift Ini</span>
              </span>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                Total: -{formatCurrency(totalCashOut)}
              </span>
            </div>

            {expenses.length === 0 ? (
              <div className="py-6 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center gap-1">
                <span className="material-symbols-outlined text-3xl text-slate-300">point_of_sale</span>
                <span className="font-semibold text-xs text-slate-600">Belum ada pengeluaran kas operasional</span>
                <span className="text-[11px] text-slate-400">Kas keluar yang dicatat akan memotong ekspektasi kas laci saat tutup kasir.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-0.5 scrollbar-thin">
                {expenses.map((item) => {
                  const timeStr = item.createdAt
                    ? new Date(item.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB"
                    : "";

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 flex items-center justify-between gap-3 transition-colors shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-base">payments</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-extrabold text-xs text-slate-900 truncate">
                            {item.reason}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {timeStr} • dicatat oleh {item.createdBy || currentUser.name}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-black text-sm text-rose-700">
                          -{formatCurrency(item.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                          title="Hapus catatan ini"
                        >
                          <span className="material-symbols-outlined text-base">
                            {deletingId === item.id ? "sync" : "delete"}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            Total tercatat: <strong className="text-slate-800">{expenses.length} pengeluaran</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs cursor-pointer transition-all shadow-xs"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}

