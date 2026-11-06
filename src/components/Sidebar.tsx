"use client";

import React, { useState } from "react";
import { RestaurantSettings } from "@/types/pos";
import { useRestaurant } from "@/context/RestaurantContext";
import { SystemMenu } from "@/types/auth";

interface SidebarProps {
  settings: RestaurantSettings;
  activePath?: string;
  isOpen?: boolean;
  onToggle?: () => void;
  onNavigate?: (path: string) => void;
  onOpenSettings?: () => void;
  onLogout?: () => void;
  orderCount?: number;
}

export function Sidebar({
  settings,
  activePath = "dashboard",
  isOpen = true,
  onToggle,
  onNavigate,
  onOpenSettings,
  orderCount = 12,
}: SidebarProps) {
  const { currentUser, canAccessMenu } = useRestaurant();

  const handleNav = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    if (!canAccessMenu(path as SystemMenu)) {
      alert(
        `Akses Ditolak: Role "${currentUser.roleLabel}" tidak memiliki izin untuk membuka menu ini.`
      );
      return;
    }
    if (typeof window !== "undefined") {
      window.location.hash = path;
    }
    if (onNavigate) onNavigate(path);
  };

  interface MenuGroup {
    title: string;
    items: {
      id: SystemMenu;
      label: string;
      icon: string;
      count?: number;
    }[];
  }

  const menuGroups: MenuGroup[] = [
    {
      title: "Utama",
      items: [
        { id: "dashboard", label: "Dashboard", icon: "analytics" },
      ],
    },
    {
      title: "Operasional",
      items: [
        { id: "pos", label: "POS (Kasir)", icon: "point_of_sale", count: orderCount },
        { id: "kitchen", label: "Kitchen (KDS)", icon: "skillet" },
        { id: "area_meja", label: "Waiters", icon: "table_restaurant" },
      ],
    },
    {
      title: "Manajemen",
      items: [
        { id: "master_data", label: "Master Data", icon: "database" },
        { id: "laporan", label: "Laporan", icon: "bar_chart" },
        { id: "pengaturan", label: "Pengaturan", icon: "settings" },
      ],
    },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-white border-r border-slate-200/80 shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-50 flex flex-col justify-between transition-all duration-300 ease-in-out ${
        isOpen ? "w-72" : "w-[72px]"
      }`}
    >
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Brand Header */}
        <div
          className={`h-16 flex items-center border-b border-slate-200/80 transition-all ${
            isOpen ? "px-4 justify-start gap-2.5" : "px-2 justify-center"
          }`}
        >
          <div
            onClick={() => {
              if (canAccessMenu("pengaturan") && onNavigate) {
                onNavigate("pengaturan");
              } else if (onOpenSettings) {
                onOpenSettings();
              }
            }}
            className={`flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition-opacity ${
              isOpen ? "min-w-0" : "justify-center"
            }`}
            title="Klik untuk Pengaturan Restoran"
          >
            {settings.logoUrl ? (
              <img
                alt={`${settings.restaurantName} Logo`}
                className="h-8 w-auto max-w-[38px] object-contain shrink-0"
                src={settings.logoUrl}
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#003629] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-lg">restaurant</span>
              </div>
            )}
            {isOpen && (
              <div className="flex flex-col leading-tight truncate">
                <span className="font-headline-sm text-sm font-bold text-slate-900 tracking-tight truncate">
                  {settings.restaurantName}
                </span>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider truncate">
                  {settings.branchName}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Grouped System Menus */}
        <nav className={`flex-1 space-y-4 py-2 ${isOpen ? "px-3" : "px-2"}`}>
          {menuGroups.map((group, groupIdx) => (
            <div key={group.title || groupIdx} className="space-y-1">
              {/* Group Title Header or Separator */}
              {isOpen ? (
                <div className="px-3 pt-1 pb-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    {group.title}
                  </span>
                </div>
              ) : (
                groupIdx > 0 && <div className="my-2 border-t border-slate-100 mx-1.5" />
              )}

              {/* Group Items */}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isAllowed = canAccessMenu(item.id);
                  const isActive = activePath === item.id;

                  if (!isAllowed) {
                    if (!isOpen) {
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-center w-11 h-11 mx-auto rounded-xl text-slate-300 cursor-not-allowed select-none relative"
                          title={`Menu ${item.label} (Terkunci untuk role ${currentUser.roleLabel})`}
                        >
                          <span className="material-symbols-outlined text-lg opacity-40">
                            {item.icon}
                          </span>
                          <span className="material-symbols-outlined text-[10px] absolute bottom-1 right-1 opacity-60">
                            lock
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-slate-300 font-medium text-xs cursor-not-allowed select-none"
                        title={`Menu ${item.label} tidak dapat diakses oleh role ${currentUser.roleLabel}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="material-symbols-outlined text-lg opacity-60">
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </div>
                        <span className="material-symbols-outlined text-xs opacity-50">lock</span>
                      </div>
                    );
                  }

                  if (!isOpen) {
                    return (
                      <a
                        key={item.id}
                        aria-current={isActive ? "page" : undefined}
                        className={`flex items-center justify-center w-11 h-11 mx-auto rounded-xl transition-all cursor-pointer relative ${
                          isActive
                            ? "bg-[#003629] text-white shadow-xs font-bold"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                        data-path={item.id}
                        href={`#${item.id}`}
                        onClick={(e) => handleNav(e, item.id)}
                        title={item.label}
                      >
                        <span className={`material-symbols-outlined text-xl ${isActive ? "text-white" : "text-slate-600"}`}>
                          {item.icon}
                        </span>
                        {item.count !== undefined && item.count > 0 && (
                          <span className="absolute -top-1 -right-1 px-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[9px] font-black bg-emerald-600 text-white shadow-2xs border border-white">
                            {item.count > 99 ? "99+" : item.count}
                          </span>
                        )}
                      </a>
                    );
                  }

                  return (
                    <a
                      key={item.id}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer text-xs font-semibold ${
                        isActive
                          ? "bg-[#003629] text-white shadow-xs font-bold"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                      data-path={item.id}
                      href={`#${item.id}`}
                      onClick={(e) => handleNav(e, item.id)}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`material-symbols-outlined text-lg ${isActive ? "text-white" : "text-slate-500"}`}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </div>
                      {item.count !== undefined && item.count > 0 && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-emerald-100 text-emerald-900"
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* 1 Tombol Tunggal Hide & Unhide di Bagian Bawah Side Menu (Cukup Icon Saja) */}
      {onToggle && (
        <div
          className={`p-3 border-t border-slate-200/80 bg-slate-50/50 flex items-center ${
            isOpen ? "justify-end" : "justify-center"
          }`}
        >
          <button
            type="button"
            onClick={onToggle}
            className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/80 shadow-2xs flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title={isOpen ? "Sembunyikan Label (Mode Icon)" : "Perluas Menu Samping"}
          >
            <span className="material-symbols-outlined text-xl">
              {isOpen ? "menu_open" : "menu"}
            </span>
          </button>
        </div>
      )}
    </aside>
  );
}
