"use client";

import React from "react";
import { useRestaurant } from "@/context/RestaurantContext";

interface HeaderProps {
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onTakeawayClick?: () => void;
  onOjolClick?: () => void;
  onCloseShiftClick?: () => void;
  onOpenSettingsClick?: () => void;
  onLogout?: () => void;
}

export function Header({
  isSidebarOpen = true,
  onLogout,
}: HeaderProps) {
  const { currentUser } = useRestaurant();

  return (
    <header
      className={`fixed top-0 right-0 h-16 bg-white border-b border-slate-200/80 z-40 px-4 sm:px-6 flex items-center justify-between shadow-2xs transition-all duration-300 ease-in-out ${
        isSidebarOpen ? "left-72" : "left-[72px]"
      }`}
    >
      {/* Sisi Kiri Bersih */}
      <div className="flex items-center gap-2" />

      {/* Sisi Kanan: User Info & Logout Button */}
      <div className="flex items-center gap-2.5">
        {/* Active User Info */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 shrink-0">
          <img
            alt={currentUser.name}
            className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
            src={
              currentUser.avatarUrl ||
              "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
            }
          />
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-xs text-slate-900 truncate max-w-[140px]">
              {currentUser.name}
            </span>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              {currentUser.role}
            </span>
          </div>
        </div>

        {/* Logout (Icon Button Seragam Kasir) */}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-2xs active:scale-95"
            title="Keluar / Logout Akun"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
          </button>
        )}
      </div>
    </header>
  );
}
