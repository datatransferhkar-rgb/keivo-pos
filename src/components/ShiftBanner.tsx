"use client";

import React from "react";
import { formatCurrency } from "@/lib/formatters";

interface ShiftBannerProps {
  shiftNumber?: string;
  cashierName?: string;
  openingCash?: number;
  totalOmset?: number;
  tunaiAmount?: number;
  qrisAmount?: number;
  transferAmount?: number;
  onCountCash?: () => void;
  onCloseShift?: () => void;
}

export function ShiftBanner({
  shiftNumber = "Shift Pagi #042",
  cashierName = "Siti Rahmawati",
  openingCash = 500000,
  totalOmset = 4820000,
  tunaiAmount = 1640000,
  qrisAmount = 2430000,
  transferAmount = 750000,
  onCountCash,
  onCloseShift,
}: ShiftBannerProps) {
  return (
    <section className="w-full bg-surface-container-lowest rounded-xl shadow-sm p-space-md lg:p-space-lg relative overflow-hidden">
      <div className="absolute -right-12 -top-12 w-64 h-64 bg-primary-fixed/30 rounded-full blur-3xl pointer-events-none"></div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md relative z-10">
        {/* Shift Metadata & Cashier */}
        <div className="flex flex-col md:flex-row md:items-center gap-space-md">
          <div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shrink-0 shadow-sm">
            <span
              className="material-symbols-outlined text-2xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              badge
            </span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-space-xs flex-wrap">
              <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight">
                {shiftNumber}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-sm text-label-sm uppercase font-bold">
                Aktif Berjalan
              </span>
              <span className="text-outline text-xs">•</span>
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                Kasir: <strong className="text-on-surface font-semibold">{cashierName}</strong>
              </span>
              <span className="text-outline text-xs">•</span>
              <span className="font-label-sm text-label-sm text-outline flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">schedule</span> Mulai 08:00 WIB
              </span>
            </div>
            <div className="flex items-center gap-space-xs mt-1.5 flex-wrap">
              <span className="px-space-sm py-1 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-outline">lock_open</span>
                Kas Awal: <strong className="text-on-surface">{formatCurrency(openingCash)}</strong>
              </span>
              <span className="text-outline text-xs hidden sm:inline">
                (Modal Kasir - Bukan Omset Penjualan)
              </span>
            </div>
          </div>
        </div>

        {/* Financial Quick Snapshot & Shift Actions */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-space-md">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-3 bg-surface-container-low p-2.5 rounded-lg w-full lg:w-auto">
            <div className="flex flex-col px-2">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Total Omset</span>
              <span className="font-currency-row text-currency-row text-primary font-bold">
                {formatCurrency(totalOmset)}
              </span>
            </div>
            <div className="flex flex-col px-2">
              <span className="font-label-sm text-label-sm text-outline flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary-container"></span>Tunai
              </span>
              <span className="font-label-lg text-label-lg font-bold text-on-surface">
                {formatCurrency(tunaiAmount)}
              </span>
            </div>
            <div className="flex flex-col px-2">
              <span className="font-label-sm text-label-sm text-outline flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim"></span>QRIS
              </span>
              <span className="font-label-lg text-label-lg font-bold text-on-surface">
                {formatCurrency(qrisAmount)}
              </span>
            </div>
            <div className="flex flex-col px-2">
              <span className="font-label-sm text-label-sm text-outline flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-surface-variant"></span>Transfer
              </span>
              <span className="font-label-lg text-label-lg font-bold text-on-surface">
                {formatCurrency(transferAmount)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-space-xs w-full lg:w-auto shrink-0">
            <button
              onClick={onCountCash}
              className="flex-1 lg:flex-initial flex items-center justify-center gap-1.5 px-space-md py-2.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md font-semibold transition-all shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">calculate</span>
              <span>Hitung Kas Laci</span>
            </button>
            <button
              onClick={onCloseShift}
              className="flex-1 lg:flex-initial flex items-center justify-center gap-1.5 px-space-md py-2.5 rounded-lg bg-error-container hover:bg-error hover:text-on-error text-on-error-container font-label-md text-label-md font-semibold transition-all shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">logout</span>
              <span>Tutup Shift</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
