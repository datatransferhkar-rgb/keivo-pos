"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/lib/formatters";
import { CashDrawerData } from "@/types/pos";

interface ShiftCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashData: CashDrawerData;
  onConfirmClose: (physicalCash: number, notes: string) => void;
}

export function ShiftCloseModal({
  isOpen,
  onClose,
  cashData,
  onConfirmClose,
}: ShiftCloseModalProps) {
  const [physicalInput, setPhysicalInput] = useState<string>(
    cashData.totalDrawer.toString()
  );
  const [closingNotes, setClosingNotes] = useState<string>("");

  if (!isOpen) return null;

  const countedCash = parseInt(physicalInput.replace(/\D/g, "") || "0", 10);
  const expectedCash = cashData.totalDrawer;
  const difference = countedCash - expectedCash;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirm("Apakah Anda yakin ingin menutup sesi shift kasir ini dan mencetak laporan shift?")) {
      onConfirmClose(countedCash, closingNotes);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-surface-container-lowest p-6 shadow-xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl text-error">logout</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              Tutup Shift Kasir &amp; Rekonsiliasi Kas
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-container text-outline"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 font-body-sm">
          {/* Drawer summary */}
          <div className="p-3.5 bg-surface-container-low rounded-xl flex flex-col gap-2">
            <div className="flex justify-between items-center text-on-surface-variant">
              <span>Modal Kas Awal (Kas Float Bawaan):</span>
              <strong className="text-on-surface">{formatCurrency(cashData.floatAmount)}</strong>
            </div>
            <div className="flex justify-between items-center text-tertiary">
              <span>+ Total Pembayaran Tunai Masuk:</span>
              <strong>+{formatCurrency(cashData.cashReceived)}</strong>
            </div>
            <div className="flex justify-between items-center text-error">
              <span>- Pengeluaran Kas ({cashData.cashOutReason}):</span>
              <strong>-{formatCurrency(cashData.cashOut)}</strong>
            </div>
            <div className="pt-2 border-t border-surface-container-high flex justify-between items-center font-currency-row">
              <span className="font-bold text-on-surface">Saldo Kas yang Diharapkan:</span>
              <span className="text-primary font-extrabold text-lg">
                {formatCurrency(expectedCash)}
              </span>
            </div>
          </div>

          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
              Hitung Fisik Uang di Laci (Kasir Hitung Nyata) *:
            </label>
            <input
              type="text"
              required
              value={physicalInput}
              onChange={(e) => setPhysicalInput(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-currency-row text-xl font-bold text-on-surface focus:outline-none"
            />
          </div>

          {/* Difference notice */}
          <div
            className={`p-3 rounded-xl flex items-center justify-between ${
              difference === 0
                ? "bg-tertiary-fixed/30 text-on-tertiary-fixed-variant"
                : difference < 0
                ? "bg-error-container text-on-error-container"
                : "bg-secondary-fixed/40 text-on-secondary-fixed-variant"
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold">
              <span className="material-symbols-outlined">
                {difference === 0 ? "check_circle" : "warning"}
              </span>
              <span>Selisih Kas:</span>
            </div>
            <span className="font-currency-row text-lg font-extrabold">
              {difference === 0
                ? "Pas (Rp0)"
                : difference > 0
                ? `+${formatCurrency(difference)} (Lebih)`
                : `${formatCurrency(difference)} (Kurang)`}
            </span>
          </div>

          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
              Catatan Penutupan Shift:
            </label>
            <textarea
              rows={2}
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              placeholder="Catatan saldo fisik atau alasan bila ada selisih kas..."
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-on-surface resize-none focus:outline-none"
            />
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
              className="px-5 py-2.5 rounded-lg bg-error hover:bg-red-700 text-on-error font-label-md text-label-md font-bold shadow-sm cursor-pointer"
            >
              Tutup Shift &amp; Cetak Laporan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
