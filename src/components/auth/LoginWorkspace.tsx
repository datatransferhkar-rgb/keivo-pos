"use client";

import React, { useState, useEffect } from "react";
import { useRestaurant } from "@/context/RestaurantContext";
import { UserProfile, UserRole } from "@/types/auth";
import { getCurrentWibTime } from "@/lib/formatters";

interface LoginWorkspaceProps {
  onLoginSuccess?: (role: UserRole) => void;
}

function getInitials(name: string): string {
  if (!name) return "";
  const cleanName = name.replace(/^(Bpk\.?|Ibu\.?|Pak\.?|Dr\.?|H\.?)\s+/i, "").trim();
  const parts = cleanName.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleanName.slice(0, 2).toUpperCase();
}

function getUserBadgeStyle(user: UserProfile) {
  if (user.role === "owner") return "bg-[#FDF4FF] text-[#9333EA] border-[#F5D0FE]";
  if (user.role === "admin") return "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]";
  if (user.role === "manager") return "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]";
  if (user.role === "kasir") {
    if (user.username === "kasir2") return "bg-[#FFF1F2] text-[#E11D48] border-[#FECDD3]";
    return "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]";
  }
  if (user.role === "waiters") return "bg-[#F0F9FF] text-[#0284C7] border-[#BAE6FD]";
  if (user.role === "kitchen") return "bg-[#FFF7ED] text-[#EA580C] border-[#FFEDD5]";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function getUserAvatarStyle(
  user: UserProfile,
  isSelected: boolean,
  isShiftOwner: boolean,
  isLocked: boolean
) {
  if (isLocked) return "bg-slate-100 text-slate-400";
  if (isShiftOwner || (isSelected && user.role === "kasir"))
    return "bg-[#D1FAE5] text-[#065F46]";
  if (user.role === "kitchen") return "bg-[#FFEDD5] text-[#C2410C]";
  if (user.role === "manager") return "bg-[#FEF3C7] text-[#B45309]";
  return "bg-slate-100 text-slate-600";
}

export function LoginWorkspace({ onLoginSuccess }: LoginWorkspaceProps) {
  const { settings, usersList, login, activeCashierShift } = useRestaurant();

  const [roleFilter, setRoleFilter] = useState<
    "all" | "kasir" | "waiters" | "kitchen" | "management"
  >("all");

  // Selected user: default to active cashier or first cashier in list
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(() => {
    if (activeCashierShift && activeCashierShift.status === "open") {
      const shiftOwner = usersList.find((u) => u.id === activeCashierShift.cashierId);
      if (shiftOwner) return shiftOwner;
    }
    const defaultKasir = usersList.find((u) => u.role === "kasir");
    return defaultKasir || usersList[0] || null;
  });

  const [pin, setPin] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shakeError, setShakeError] = useState(false);

  // Realtime clock
  const [timeStr, setTimeStr] = useState<string>("12:00:00 WIB");

  useEffect(() => {
    setTimeStr(getCurrentWibTime());
    const interval = setInterval(() => {
      setTimeStr(getCurrentWibTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync selected user if not initialized yet
  useEffect(() => {
    if (!selectedUser && usersList.length > 0) {
      if (activeCashierShift && activeCashierShift.status === "open") {
        const shiftOwner = usersList.find((u) => u.id === activeCashierShift.cashierId);
        if (shiftOwner) {
          setSelectedUser(shiftOwner);
          return;
        }
      }
      const defaultKasir = usersList.find((u) => u.role === "kasir");
      setSelectedUser(defaultKasir || usersList[0]);
    }
  }, [usersList, activeCashierShift, selectedUser]);

  // Filtered users
  const filteredUsers = usersList.filter((u) => {
    if (!u.isActive) return false;
    if (roleFilter === "all") return true;
    if (roleFilter === "kasir") return u.role === "kasir";
    if (roleFilter === "waiters") return u.role === "waiters";
    if (roleFilter === "kitchen") return u.role === "kitchen";
    if (roleFilter === "management") return ["owner", "admin", "manager"].includes(u.role);
    return true;
  });

  // Physical keyboard support for PIN pad
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedUser) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleNumpadClick(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleNumpadBackspace();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setPin("");
        setErrorMsg("");
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedUser && pin.length >= 4) {
          executeLogin(selectedUser.username, pin);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedUser, pin]);

  // Handle PIN entry via touch numpad
  const handleNumpadClick = (digit: string) => {
    if (pin.length >= 4) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setErrorMsg("");

    // Auto submit on 4th digit
    if (nextPin.length === 4 && selectedUser) {
      setTimeout(() => {
        executeLogin(selectedUser.username, nextPin);
      }, 100);
    }
  };

  const handleNumpadClear = () => {
    setPin("");
    setErrorMsg("");
  };

  const handleNumpadBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg("");
  };

  // Execute login action
  const executeLogin = (usernameOrId: string, pinToVerify: string) => {
    setIsSubmitting(true);
    setErrorMsg("");

    const result = login(usernameOrId, pinToVerify);

    if (result.success && result.user) {
      setIsSubmitting(false);
      if (onLoginSuccess) {
        onLoginSuccess(result.user.role);
      }
    } else {
      setIsSubmitting(false);
      setErrorMsg(result.message || "PIN salah. Silakan coba lagi.");
      setShakeError(true);
      setTimeout(() => setShakeError(false), 500);
      setPin("");
    }
  };

  const restaurantInitials = getInitials(settings.restaurantName || "Pawon Nusantara");

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-start font-body-md text-slate-800 antialiased select-none">
      {/* 1. Header Identitas Restoran (Dinamis dari Setting Profile) */}
      <header className="px-6 sm:px-10 py-4 flex items-center justify-between border-b border-slate-200/80 bg-white shadow-2xs">
        {/* Logo, Nama Restoran, dan Lokasi */}
        <div className="flex items-center gap-3">
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt={settings.restaurantName || "Logo"}
              className="w-10 h-10 rounded-xl object-contain shrink-0 border border-slate-200"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-[#003629] text-white flex items-center justify-center font-black text-sm tracking-wide shrink-0 shadow-xs">
              {restaurantInitials}
            </div>
          )}
          <div>
            <h1 className="font-extrabold text-base text-slate-900 leading-tight">
              {settings.restaurantName || "Pawon Nusantara"}
            </h1>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              {(settings.branchName || "Cabang Senopati").toUpperCase()} •{" "}
              {(settings.posTerminal || "POS REG-01").toUpperCase()}
            </p>
          </div>
        </div>

        {/* Realtime Clock & Status Shift */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 text-xs font-bold">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-mono text-slate-800 tracking-wide text-xs">{timeStr}</span>
          <span className="text-slate-300 font-normal">|</span>
          <span className="text-slate-500 uppercase tracking-wider text-[11px] font-bold">
            {activeCashierShift?.status === "open" ? "SHIFT AKTIF" : "SHIFT NONAKTIF"}
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 flex flex-col justify-start">
        {/* 2. Banner Peringatan Kunci Shift Kasir */}
        {activeCashierShift && activeCashierShift.status === "open" && (
          <div className="mb-6 p-4 rounded-2xl bg-[#FFF8EB] border border-[#FDE68A] text-slate-800 flex items-start sm:items-center gap-3.5 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-[#F59E0B] text-white flex items-center justify-center shrink-0 shadow-2xs">
              <span className="material-symbols-outlined text-2xl">lock</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm text-slate-900">
                  Sesi Shift Kasir Belum Ditutup
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#FDE68A] text-[#92400E] text-[10px] font-black uppercase tracking-wider">
                  KASIR: {activeCashierShift.cashierName}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                Kasir{" "}
                <strong className="font-semibold text-slate-800">
                  {activeCashierShift.cashierName}
                </strong>{" "}
                belum melakukan laporan tutup kasir &amp; serah terima. Kasir lain terkunci hingga
                tutup kasir diselesaikan.{" "}
                <span className="text-slate-500">
                  (Akun Manajemen, Waiters &amp; Dapur tetap dapat masuk).
                </span>
              </p>
            </div>
          </div>
        )}

        {/* 3. Layout Utama 2 Kolom (Touch First) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Kolom Kiri: Pilih Staf (7 Kolom) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Header Card: Silakan Masuk Bertugas & Filter Pills */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h2 className="font-extrabold text-lg text-slate-900 leading-snug">
                Silakan Masuk Bertugas
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Pilih nama Anda dan masukkan PIN otorisasi untuk memulai operasional restoran.
              </p>

              {/* Filter Tabs Staf */}
              <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1 text-xs no-scrollbar">
                {[
                  { id: "all", label: "Semua Staf" },
                  { id: "kasir", label: "Kasir" },
                  { id: "waiters", label: "Waiters" },
                  { id: "kitchen", label: "Dapur (KDS)" },
                  { id: "management", label: "Manajemen" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setRoleFilter(f.id as any)}
                    className={`px-4 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                      roleFilter === f.id
                        ? "bg-[#003629] text-white shadow-xs"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid Kartu Staf (3 Kolom Sesuai Desain Target) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {filteredUsers.map((user) => {
                const isSelected = selectedUser?.id === user.id;
                const isCashierLocked =
                  user.role === "kasir" &&
                  activeCashierShift?.status === "open" &&
                  activeCashierShift.cashierId !== user.id;
                const isShiftOwner =
                  user.role === "kasir" &&
                  activeCashierShift?.status === "open" &&
                  activeCashierShift.cashierId === user.id;

                const initials = getInitials(user.name);
                const avatarBgColor = getUserAvatarStyle(
                  user,
                  isSelected,
                  isShiftOwner,
                  isCashierLocked
                );
                const badgeColor = getUserBadgeStyle(user);

                return (
                  <div
                    key={user.id}
                    onClick={() => {
                      setSelectedUser(user);
                      setPin("");
                      if (isCashierLocked) {
                        setErrorMsg(
                          `Kasir ${user.name} terkunci! Kasir sebelumnya (${activeCashierShift?.cashierName}) belum melakukan laporan tutup kasir.`
                        );
                      } else {
                        setErrorMsg("");
                      }
                    }}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col items-center text-center relative ${
                      isSelected
                        ? "border-2 border-emerald-500 bg-white ring-2 ring-emerald-500/20 shadow-md"
                        : isCashierLocked
                        ? "border border-rose-200 bg-white hover:border-rose-300"
                        : isShiftOwner
                        ? "border border-emerald-300 bg-white hover:border-emerald-500 shadow-xs"
                        : "border border-slate-100 bg-white hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    {/* Badge Shift Aktif di pojok kanan atas */}
                    {isShiftOwner && (
                      <span className="absolute top-3 right-3 text-[10px] font-bold text-slate-700 bg-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Shift Aktif</span>
                      </span>
                    )}

                    {/* Badge Terkunci di pojok kanan atas */}
                    {isCashierLocked && (
                      <span className="absolute top-3 right-3 px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 text-[10px] font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">lock</span>
                        <span>Terkunci</span>
                      </span>
                    )}

                    {/* Avatar Inisial Bulat Besar */}
                    <div
                      className={`w-20 h-20 rounded-full flex items-center justify-center font-extrabold text-2xl mb-3 shadow-2xs transition-transform ${avatarBgColor}`}
                    >
                      {initials}
                    </div>

                    {/* Nama Staf */}
                    <h4 className="font-extrabold text-sm text-slate-900 truncate w-full px-1">
                      {user.name}
                    </h4>

                    {/* Label Badge Peran */}
                    <span
                      className={`mt-2 inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${badgeColor}`}
                    >
                      {user.roleLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Kolom Kanan: Card PIN Otorisasi & Virtual Numpad (5 Kolom) */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex flex-col items-center text-center">
              {selectedUser ? (
                <div className="w-full flex flex-col items-center">
                  {/* Avatar Staf Terpilih: Rounded Square Lembut */}
                  <div className="w-20 h-20 rounded-2xl bg-[#E6F4EA] border border-[#A7F3D0] text-[#003629] flex items-center justify-center font-extrabold text-2xl mb-3 shadow-2xs">
                    {getInitials(selectedUser.name)}
                  </div>

                  {/* Nama Staf Terpilih */}
                  <h3 className="font-extrabold text-base text-slate-900">
                    {selectedUser.name}
                  </h3>

                  {/* Peran / Subtitle */}
                  <p className="text-xs font-semibold text-emerald-600 mt-0.5">
                    {selectedUser.roleLabel}
                  </p>

                  {/* Status jika Kasir Terkunci */}
                  {selectedUser.role === "kasir" &&
                  activeCashierShift?.status === "open" &&
                  activeCashierShift.cashierId !== selectedUser.id ? (
                    <div className="w-full flex flex-col items-center text-center py-4 animate-in fade-in">
                      <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-3 shadow-2xs">
                        <span className="material-symbols-outlined text-2xl">lock</span>
                      </div>
                      <h4 className="font-extrabold text-sm text-rose-950">
                        Kasir Terkunci Sementara
                      </h4>
                      <p className="text-xs text-rose-800 mt-1 max-w-xs leading-relaxed">
                        Kasir <strong>{activeCashierShift.cashierName}</strong> belum melakukan
                        laporan tutup kasir dan serah terima shift.
                      </p>

                      <button
                        type="button"
                        onClick={() => {
                          const activeOwner = usersList.find(
                            (u) => u.id === activeCashierShift.cashierId
                          );
                          if (activeOwner) {
                            setSelectedUser(activeOwner);
                            setPin("");
                            setErrorMsg("");
                          }
                        }}
                        className="mt-5 w-full max-w-[280px] py-3 px-4 rounded-xl bg-[#003629] text-white font-bold text-xs shadow-sm hover:bg-[#004d3b] transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-base">switch_account</span>
                        <span>Beralih ke {activeCashierShift.cashierName}</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Judul Input PIN */}
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-6 mb-1">
                        MASUKKAN 4 DIGIT PIN OTORISASI
                      </div>

                      {/* Label Informasi Kode PIN Pengguna Masing-masing (Poin 2) */}
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold mb-3 border border-slate-200">
                        <span className="material-symbols-outlined text-sm text-emerald-700">key</span>
                        <span>
                          Kode PIN:{" "}
                          <strong className="font-mono text-slate-900 tracking-wider">
                            {selectedUser.pin}
                          </strong>
                        </span>
                      </div>

                      {/* 4 Lingkaran Indikator PIN */}
                      <div
                        className={`flex items-center justify-center gap-3.5 my-2 ${
                          shakeError ? "animate-bounce" : ""
                        }`}
                      >
                        {[0, 1, 2, 3].map((idx) => {
                          const isFilled = pin.length > idx;
                          return (
                            <span
                              key={idx}
                              className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                                isFilled
                                  ? "bg-[#003629] scale-110 shadow-xs"
                                  : "border-2 border-slate-300 bg-transparent"
                              }`}
                            />
                          );
                        })}
                      </div>

                      {/* Keterangan Numpad */}
                      <p className="text-xs text-slate-400 mt-1 mb-4">
                        Gunakan layar sentuh atau numpad keyboard
                      </p>

                      {/* Notifikasi Error jika PIN salah */}
                      {errorMsg && (
                        <p className="text-xs font-bold text-rose-600 mb-3 flex items-center justify-center gap-1 animate-in fade-in">
                          <span className="material-symbols-outlined text-sm">error</span>
                          <span>{errorMsg}</span>
                        </p>
                      )}

                      {/* Grid Virtual Numpad 3x4 */}
                      <div className="grid grid-cols-3 gap-2.5 w-full max-w-[280px]">
                        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => handleNumpadClick(num)}
                            disabled={isSubmitting}
                            className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 text-xl font-bold text-slate-800 transition-all flex items-center justify-center cursor-pointer shadow-2xs border border-slate-100"
                          >
                            {num}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={handleNumpadClear}
                          disabled={isSubmitting || pin.length === 0}
                          className="h-14 rounded-2xl bg-[#FFF1F2] hover:bg-rose-100 active:scale-95 text-rose-600 text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center cursor-pointer shadow-2xs border border-rose-100"
                        >
                          HAPUS
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNumpadClick("0")}
                          disabled={isSubmitting}
                          className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 text-xl font-bold text-slate-800 transition-all flex items-center justify-center cursor-pointer shadow-2xs border border-slate-100"
                        >
                          0
                        </button>
                        <button
                          type="button"
                          onClick={handleNumpadBackspace}
                          disabled={isSubmitting || pin.length === 0}
                          className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 transition-all flex items-center justify-center cursor-pointer shadow-2xs border border-slate-100"
                          title="Hapus Satu Digit"
                        >
                          <span className="material-symbols-outlined text-xl">backspace</span>
                        </button>
                      </div>

                      {/* Tombol Utama Masuk Kasir / Sesi */}
                      <button
                        type="button"
                        disabled={isSubmitting || pin.length < 4}
                        onClick={() => executeLogin(selectedUser.username, pin)}
                        className={`w-full max-w-[280px] mt-4 py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                          pin.length >= 4 && !isSubmitting
                            ? "bg-[#003629] text-white hover:bg-[#004d3b] active:scale-98"
                            : "bg-[#003629] text-white opacity-90 hover:opacity-100"
                        }`}
                      >
                        <span>
                          {isSubmitting
                            ? "Memverifikasi..."
                            : selectedUser.role === "kasir"
                            ? "Masuk Kasir / Sesi →"
                            : "Masuk Aplikasi →"}
                        </span>
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="py-12 px-6 flex flex-col items-center text-center gap-3 text-slate-400">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined text-3xl">touch_app</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-700">Pilih Nama Staf</h4>
                  <p className="text-xs text-slate-400 max-w-[240px]">
                    Klik salah satu kartu staf di sisi kiri untuk memunculkan tombol PIN otorisasi.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
