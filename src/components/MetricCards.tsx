"use client";

import React from "react";
import { MetricCardData } from "@/types/pos";
import { formatCurrency } from "@/lib/formatters";

interface MetricCardsProps {
  data?: MetricCardData;
}

export function MetricCards({
  data = {
    occupiedTables: 14,
    totalTables: 20,
    unbilledTables: 4,
    activeOrders: 18,
    dineInOrders: 11,
    takeawayOrders: 4,
    onlineOrders: 3,
    readyFromKitchen: 3,
    unpaidOrders: 6,
    unpaidTotal: 1840000,
  },
}: MetricCardsProps) {
  const occupancyPercentage = Math.round(
    (data.occupiedTables / (data.totalTables || 1)) * 100
  );

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
      {/* Card 1: Meja Terisi */}
      <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">
              Meja Terisi
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-headline-xl text-headline-xl text-on-surface font-extrabold leading-none">
                {data.occupiedTables}
              </span>
              <span className="font-headline-sm text-headline-sm text-outline font-normal">
                / {data.totalTables} Meja
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-xl">table_bar</span>
          </div>
        </div>
        <div className="mt-space-md pt-space-xs">
          <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-500"
              style={{ width: `${occupancyPercentage}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="font-label-sm text-label-sm text-primary font-bold">
              {occupancyPercentage}% Okupansi
            </span>
            <span className="font-label-sm text-label-sm text-secondary font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              {data.unbilledTables} belum tagihan
            </span>
          </div>
        </div>
      </div>

      {/* Card 2: Pesanan Aktif */}
      <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">
              Pesanan Aktif
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-headline-xl text-headline-xl text-on-surface font-extrabold leading-none">
                {data.activeOrders}
              </span>
              <span className="font-label-sm text-label-sm text-outline uppercase font-bold">
                Pesanan
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary-fixed/60 flex items-center justify-center text-on-primary-fixed-variant">
            <span className="material-symbols-outlined text-xl">receipt_long</span>
          </div>
        </div>
        <div className="mt-space-md flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-label-sm text-label-sm">
            {data.dineInOrders} Dine-in
          </span>
          <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-label-sm text-label-sm">
            {data.takeawayOrders} Take Away
          </span>
          <span className="px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-semibold">
            {data.onlineOrders} Delivery
          </span>
        </div>
      </div>

      {/* Card 3: Siap Diantar Kitchen */}
      <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-secondary-container/10 rounded-full pointer-events-none"></div>
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">
              Siap Diantar KDS
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-headline-xl text-headline-xl text-secondary font-extrabold leading-none">
                {data.readyFromKitchen}
              </span>
              <span className="font-label-sm text-label-sm text-secondary font-bold uppercase">
                Siap Saji
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-secondary-container/20 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-xl animate-bounce">room_service</span>
          </div>
        </div>
        <div className="mt-space-md flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary font-label-sm text-label-sm font-bold">
            Meja 08
          </span>
          <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary font-label-sm text-label-sm font-bold">
            Meja 12
          </span>
          <span className="px-2 py-0.5 rounded-full bg-secondary-fixed-dim text-on-secondary-fixed font-label-sm text-label-sm font-bold">
            #TK-088
          </span>
        </div>
      </div>

      {/* Card 4: Pesanan Belum Bayar */}
      <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">
              Belum Bayar (Unpaid)
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-headline-xl text-headline-xl text-error font-extrabold leading-none">
                {data.unpaidOrders}
              </span>
              <span className="font-label-sm text-label-sm text-outline uppercase font-bold">
                Tagihan
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-error-container/40 flex items-center justify-center text-error">
            <span className="material-symbols-outlined text-xl">pending_actions</span>
          </div>
        </div>
        <div className="mt-space-md flex items-center justify-between">
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            Outstanding Bill:
          </span>
          <span className="font-currency-row text-currency-row text-error font-extrabold">
            {formatCurrency(data.unpaidTotal)}
          </span>
        </div>
      </div>
    </section>
  );
}
