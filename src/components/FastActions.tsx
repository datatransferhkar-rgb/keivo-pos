"use client";

import React from "react";

interface FastActionsProps {
  onTakeawayClick: () => void;
  onOjolClick: () => void;
  onOpenTableClick?: () => void;
}

export function FastActions({
  onTakeawayClick,
  onOjolClick,
}: FastActionsProps) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm">
      <div className="flex items-center justify-between">
        <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
          Entri Cepat Kasir
        </span>
        <span className="font-label-sm text-label-sm text-outline uppercase font-semibold">
          Shortcut Keyboard
        </span>
      </div>
      <div className="flex flex-col gap-space-xs mt-1">
        {/* Button Takeaway */}
        <button
          onClick={onTakeawayClick}
          className="w-full h-14 px-space-md rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg font-bold flex items-center justify-between transition-all shadow-sm active:scale-[0.99] cursor-pointer"
        >
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-2xl">shopping_bag</span>
            <span>+ Pesanan Take Away</span>
          </div>
          <kbd className="px-2 py-0.5 rounded bg-black/20 text-xs font-mono">F3</kbd>
        </button>

        {/* Button Ojol */}
        <button
          onClick={onOjolClick}
          className="w-full h-14 px-space-md rounded-xl bg-secondary-container hover:bg-secondary text-on-secondary font-label-lg text-label-lg font-bold flex items-center justify-between transition-all shadow-sm active:scale-[0.99] cursor-pointer"
        >
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-2xl">moped</span>
            <span>+ Input Order Delivery</span>
          </div>
          <kbd className="px-2 py-0.5 rounded bg-black/20 text-xs font-mono">F4</kbd>
        </button>
      </div>
    </div>
  );
}
