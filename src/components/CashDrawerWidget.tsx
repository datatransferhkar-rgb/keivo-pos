"use client";

import React from "react";
import { formatCurrency } from "@/lib/formatters";
import { CashDrawerData } from "@/types/pos";

interface CashDrawerWidgetProps {
  data?: CashDrawerData;
  onCashOutClick: () => void;
  onOpenDrawerClick: () => void;
}

export function CashDrawerWidget({
  data = {
    floatAmount: 500000,
    cashReceived: 1640000,
    cashOut: 45000,
    cashOutReason: "Es Batu & Parkir",
    totalDrawer: 2095000,
  },
  onCashOutClick,
  onOpenDrawerClick,
}: CashDrawerWidgetProps) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-xl">payments</span>
          <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
            Kas Laci Kasir
          </span>
        </div>
        <span
          className="w-2.5 h-2.5 rounded-full bg-tertiary-fixed-dim animate-pulse"
          title="Laci Kas Terhubung"
        ></span>
      </div>

      <div className="flex flex-col gap-2 pt-1 font-body-sm text-body-sm">
        <div className="flex justify-between items-center text-on-surface-variant">
          <span>Modal Awal (Kas Float)</span>
          <span className="font-semibold text-on-surface">
            {formatCurrency(data.floatAmount)}
          </span>
        </div>

        <div className="flex justify-between items-center text-on-surface-variant">
          <span className="flex items-center gap-1 text-tertiary">
            <span className="material-symbols-outlined text-base">add_circle</span> Tunai Diterima
          </span>
          <span className="font-semibold text-tertiary">
            +{formatCurrency(data.cashReceived)}
          </span>
        </div>

        <div className="flex justify-between items-center text-on-surface-variant">
          <span className="flex items-center gap-1 text-error">
            <span className="material-symbols-outlined text-base">remove_circle</span> Kas Keluar (
            {data.cashOutReason})
          </span>
          <span className="font-semibold text-error">
            -{formatCurrency(data.cashOut)}
          </span>
        </div>

        <div className="pt-space-xs mt-1 bg-surface-container-low p-space-sm rounded-lg flex flex-col">
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
            Estimasi Fisik Uang di Laci
          </span>
          <span className="font-currency-display text-currency-display text-primary font-extrabold tracking-tight mt-0.5">
            {formatCurrency(data.totalDrawer)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-space-xs mt-2">
          <button
            onClick={onCashOutClick}
            className="py-2 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base text-outline">output</span>
            <span>Kas Keluar...</span>
          </button>
          <button
            onClick={onOpenDrawerClick}
            className="py-2 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base text-outline">lock</span>
            <span>Buka Laci (Drawer)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
