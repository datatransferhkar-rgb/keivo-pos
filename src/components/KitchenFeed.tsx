"use client";

import React from "react";

interface KitchenFeedProps {
  onPrintWaiterSheet: (table: string, items: string) => void;
  onCallCustomer: (code: string) => void;
}

export function KitchenFeed({
  onPrintWaiterSheet,
  onCallCustomer,
}: KitchenFeedProps) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-secondary text-xl">skillet</span>
          <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
            Kesiapan Dapur
          </span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary font-label-sm text-label-sm font-bold">
          3 Siap Saji
        </span>
      </div>

      {/* Notification Feed Items */}
      <div className="flex flex-col gap-space-xs mt-1">
        {/* Item 1: Meja 08 */}
        <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <div>
              <span className="px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed-variant font-label-sm text-label-sm font-bold">
                Meja 08
              </span>
              <span className="font-body-sm text-body-sm text-on-surface block mt-1 font-semibold">
                1x Gurame Bakar Cobek, 2x Es Kelapa
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-tertiary-container font-bold flex items-center gap-0.5">
              <span className="material-symbols-outlined text-sm text-tertiary">check_circle</span>
              Saji
            </span>
          </div>
          <button
            onClick={() =>
              onPrintWaiterSheet("Meja 08", "1x Gurame Bakar Cobek, 2x Es Kelapa")
            }
            className="w-full py-1.5 px-3 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-sm text-label-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">receipt</span>
            <span>Cetak Order Sheet Waiter</span>
          </button>
        </div>

        {/* Item 2: Takeaway TK-088 */}
        <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <div>
              <span className="px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-bold">
                Takeaway #TK-088
              </span>
              <span className="font-body-sm text-body-sm text-on-surface block mt-1 font-semibold">
                2x Nasi Goreng Spesial
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-secondary font-bold flex items-center gap-0.5">
              <span className="material-symbols-outlined text-sm">inventory_2</span> Dikemas
            </span>
          </div>
          <button
            onClick={() => onCallCustomer("#TK-088")}
            className="w-full py-1.5 px-3 rounded-lg bg-secondary-container hover:bg-secondary text-on-secondary font-label-sm text-label-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">campaign</span>
            <span>Panggil Pelanggan</span>
          </button>
        </div>

        {/* Note Box for Physical Ticket Dispatch */}
        <div className="p-space-sm rounded-lg bg-surface-container flex items-start gap-2 text-on-surface-variant">
          <span className="material-symbols-outlined text-lg text-primary shrink-0 mt-0.5">info</span>
          <p className="font-body-sm text-body-sm leading-relaxed">
            <strong>SOP Servis:</strong> Pelayan tidak memiliki aplikasi. Kasir mencetak tiket
            dapur dan menempelkannya di meja pelanggan untuk dicentang manual saat hidangan
            diantar.
          </p>
        </div>
      </div>
    </div>
  );
}
