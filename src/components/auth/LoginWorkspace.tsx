"use client";

import React, { useState, useEffect } from "react";
import { useRestaurant } from "@/context/RestaurantContext";
import { UserProfile, UserRole, ROLE_PERMISSIONS } from "@/types/auth";
import { getCurrentWibTime } from "@/lib/formatters";

interface LoginWorkspaceProps {
  onLoginSuccess?: (role: UserRole) => void;
}

export function LoginWorkspace({ onLoginSuccess }: LoginWorkspaceProps) {
  const { settings, usersList, login, activeCashierShift } = useRestaurant();

  // Mode: "touch" (Pilih Staf & Masukkan PIN) vs "form" (Ketik Username & PIN)
  const [loginMode, setLoginMode] = useState<"touch" | "form">("touch");
  const [roleFilter, setRoleFilter] = useState<"all" | "kasir" | "waiters" | "kitchen" | "management">("all");
  
  // Selected user for touch mode
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [pin, setPin] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shakeError, setShakeError] = useState(false);

  // Form mode state
  const [formUsername, setFormUsername] = useState("");
  const [formPin, setFormPin] = useState("");

  // Quick Demo PIN helper drawer
  const [showDemoHelp, setShowDemoHelp] = useState(false);

  // Realtime clock
  const [timeStr, setTimeStr] = useState<string>("12:00:00 WIB");

  useEffect(() => {
    setTimeStr(getCurrentWibTime());
    const interval = setInterval(() => {
      setTimeStr(getCurrentWibTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filtered users for touch mode
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
      if (!selectedUser && loginMode === "touch") return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleNumpadClick(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleNumpadBackspace();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSelectedUser(null);
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
  }, [selectedUser, pin, loginMode]);

  // Handle PIN entry via touch numpad
  const handleNumpadClick = (digit: string) => {
    if (pin.length >= 6) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setErrorMsg("");

    // Auto submit on 4th digit (standard POS behavior)
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

  // Form mode submission
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername.trim()) {
      setErrorMsg("Masukkan username atau email staf.");
      return;
    }
    if (!formPin.trim()) {
      setErrorMsg("Masukkan PIN staf.");
      return;
    }
    executeLogin(formUsername, formPin);
  };

  // Quick 1-click login helper for testing
  const handleQuickDemoLogin = (username: string, demoPin: string) => {
    const user = usersList.find((u) => u.username === username);
    if (user) {
      setSelectedUser(user);
      setPin(demoPin);
      executeLogin(username, demoPin);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between font-body-md text-on-surface antialiased select-none">
      {/* Top Bar Branding */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-surface-container-high/60 bg-surface-container-lowest shadow-2xs">
        <div className="flex items-center gap-3">
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt="Logo Restoran"
              className="h-9 w-auto max-w-[44px] object-contain shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">restaurant</span>
            </div>
          )}
          <div>
            <h1 className="font-headline-sm text-base font-bold text-primary tracking-tight leading-tight">
              {settings.restaurantName}
            </h1>
            <p className="text-xs text-secondary font-semibold uppercase tracking-wider">
              {settings.branchName} • {settings.posTerminal || "POS REG-01"}
            </p>
          </div>
        </div>

        {/* Realtime clock & shift info */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low border border-outline-variant/30 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-on-surface font-mono">{timeStr}</span>
            <span className="text-outline">•</span>
            <span className="text-on-surface-variant font-medium">Shift Aktif</span>
          </div>

          <button
            onClick={() => setShowDemoHelp(!showDemoHelp)}
            className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Daftar Akun & PIN Default untuk Testing Cepat"
          >
            <span className="material-symbols-outlined text-sm text-amber-700">key</span>
            <span>Bantuan PIN Demo</span>
          </button>
        </div>
      </header>

      {/* Demo Credentials Quick Drawer */}
      {showDemoHelp && (
        <div className="bg-amber-50/90 border-b border-amber-300 px-6 py-3.5 animate-in slide-in-from-top-2 duration-150">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-amber-700">info</span>
                <span>Klik salah satu staf di bawah ini untuk Langsung Masuk (Auto-Login Demo):</span>
              </span>
              <p className="text-[11px] text-amber-800">
                Akses menu dan tata letak layar kerja akan otomatis disesuaikan dengan izin peran masing-masing.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { username: "owner", pin: "1234", role: "Owner", roleColor: "bg-purple-100 text-purple-900 border-purple-300" },
                {
                  username: "kasir",
                  pin: "1111",
                  role: "Kasir 1 (Siti)",
                  roleColor: "bg-emerald-100 text-emerald-900 border-emerald-300",
                  statusLabel: activeCashierShift?.status === "open" && activeCashierShift.cashierUsername === "kasir" ? "Shift Aktif" : undefined,
                },
                {
                  username: "kasir2",
                  pin: "2222",
                  role: "Kasir 2 (Rian)",
                  roleColor:
                    activeCashierShift?.status === "open" && activeCashierShift.cashierUsername !== "kasir2"
                      ? "bg-rose-50 text-rose-900 border-rose-300"
                      : "bg-emerald-100 text-emerald-900 border-emerald-300",
                  statusLabel:
                    activeCashierShift?.status === "open" && activeCashierShift.cashierUsername !== "kasir2"
                      ? "🔒 Terkunci"
                      : undefined,
                },
                { username: "waiter", pin: "2222", role: "Waiters (Meja)", roleColor: "bg-cyan-100 text-cyan-900 border-cyan-300" },
                { username: "kitchen", pin: "3333", role: "Kitchen (KDS)", roleColor: "bg-orange-100 text-orange-900 border-orange-300" },
                { username: "manager", pin: "5555", role: "Manager", roleColor: "bg-amber-100 text-amber-900 border-amber-300" },
                { username: "admin", pin: "8888", role: "Admin", roleColor: "bg-blue-100 text-blue-900 border-blue-300" },
              ].map((item) => (
                <button
                  key={item.username}
                  onClick={() => handleQuickDemoLogin(item.username, item.pin)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 hover:shadow-xs transition-all cursor-pointer ${item.roleColor}`}
                >
                  <span>{item.role}</span>
                  {item.statusLabel && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-black/10 font-black">
                      {item.statusLabel}
                    </span>
                  )}
                  <span className="opacity-60 text-[10px]">PIN: {item.pin}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Login Workspace */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 flex flex-col justify-center">
        {/* Title & Mode Switcher */}
        <div className="text-center max-w-lg mx-auto mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-2">
            <span className="material-symbols-outlined text-sm">lock</span>
            <span>Autentikasi &amp; Kontrol Akses Sistem</span>
          </div>
          <h2 className="font-headline-sm text-2xl font-extrabold text-on-surface">
            Silakan Masuk Bertugas
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            Pilih nama Anda dan masukkan PIN otorisasi untuk memulai operasional restoran.
          </p>

          {/* Shift Lock Warning Alert Banner */}
          {activeCashierShift && activeCashierShift.status === "open" && (
            <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs text-left">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <span className="material-symbols-outlined text-2xl">lock_clock</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-sm text-amber-950">
                      Sesi Shift Kasir Belum Ditutup
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 text-[10px] font-black uppercase tracking-wider border border-amber-300">
                      Kasir: {activeCashierShift.cashierName}
                    </span>
                  </div>
                  <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                    Kasir <strong>{activeCashierShift.cashierName}</strong> belum melakukan laporan tutup kasir &amp; serah terima. Kasir lain terkunci hingga tutup kasir diselesaikan. <em>(Akun Manajemen/Waiters/Dapur tetap dapat masuk).</em>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Toggle Login Mode */}
          <div className="inline-flex rounded-xl bg-surface-container p-1 mt-4 border border-outline-variant/30">
            <button
              onClick={() => {
                setLoginMode("touch");
                setErrorMsg("");
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                loginMode === "touch"
                  ? "bg-surface-container-lowest text-primary shadow-xs"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-sm">touch_app</span>
              <span>Pilih Staf &amp; PIN (Touch)</span>
            </button>
            <button
              onClick={() => {
                setLoginMode("form");
                setSelectedUser(null);
                setErrorMsg("");
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                loginMode === "form"
                  ? "bg-surface-container-lowest text-primary shadow-xs"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-sm">badge</span>
              <span>Username &amp; Password</span>
            </button>
          </div>
        </div>

        {/* ========================================================
            MODE 1: TOUCH SCREEN SELECTION & VIRTUAL PIN NUMPAD
           ======================================================== */}
        {loginMode === "touch" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Staff Cards Grid (7 Cols on large screen) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {/* Role Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
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
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      roleFilter === f.id
                        ? "bg-primary text-on-primary shadow-2xs"
                        : "bg-surface-container-low hover:bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Staff Cards List */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredUsers.map((user) => {
                  const isSelected = selectedUser?.id === user.id;
                  const rolePerm = ROLE_PERMISSIONS[user.role] || ROLE_PERMISSIONS.owner;
                  const isCashierLocked =
                    user.role === "kasir" &&
                    activeCashierShift?.status === "open" &&
                    activeCashierShift.cashierId !== user.id;
                  const isShiftOwner =
                    user.role === "kasir" &&
                    activeCashierShift?.status === "open" &&
                    activeCashierShift.cashierId === user.id;

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
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col items-center text-center gap-2 relative ${
                        isSelected
                          ? isCashierLocked
                            ? "bg-rose-50 border-rose-500 shadow-md ring-2 ring-rose-300"
                            : "bg-primary-container/20 border-primary shadow-md ring-2 ring-primary/30"
                          : isCashierLocked
                          ? "bg-slate-50/80 border-rose-200 hover:border-rose-300 opacity-80"
                          : isShiftOwner
                          ? "bg-emerald-50/50 border-emerald-300 hover:border-emerald-500"
                          : "bg-surface-container-lowest border-outline-variant/30 hover:border-primary/50 hover:shadow-xs"
                      }`}
                    >
                      {/* Status Badges */}
                      {isCashierLocked && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-rose-100 border border-rose-300 text-rose-800 text-[9px] font-black flex items-center gap-0.5 shadow-2xs">
                          <span className="material-symbols-outlined text-[12px]">lock</span>
                          <span>Terkunci</span>
                        </span>
                      )}

                      {isShiftOwner && !isSelected && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-emerald-100 border border-emerald-300 text-emerald-800 text-[9px] font-black flex items-center gap-1 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                          <span>Shift Aktif</span>
                        </span>
                      )}

                      {/* Active Selection Checkmark */}
                      {isSelected && !isCashierLocked && (
                        <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs">
                          <span className="material-symbols-outlined text-xs">check</span>
                        </span>
                      )}

                      <img
                        src={user.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                        alt={user.name}
                        className={`w-14 h-14 rounded-full object-cover border-2 shadow-2xs ${
                          isCashierLocked ? "border-rose-300 grayscale-30" : "border-surface-container-high"
                        }`}
                      />

                      <div className="w-full">
                        <h4 className="font-bold text-xs text-on-surface truncate">
                          {user.name}
                        </h4>
                        <span className={`mt-1 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${rolePerm.badgeColor}`}>
                          {user.roleLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: PIN Pad & Prompt (5 Cols on large screen) */}
            <div className="lg:col-span-5">
              <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-lg flex flex-col items-center">
                {selectedUser ? (
                  <div className="w-full flex flex-col items-center">
                    {/* User Profile Header */}
                    <div className="flex items-center gap-3 w-full pb-4 border-b border-surface-container-high mb-4">
                      <img
                        src={selectedUser.avatarUrl}
                        alt={selectedUser.name}
                        className="w-12 h-12 rounded-full object-cover border border-outline-variant"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                            Staf Terpilih
                          </span>
                          <button
                            onClick={() => {
                              setSelectedUser(null);
                              setPin("");
                              setErrorMsg("");
                            }}
                            className="text-xs text-outline hover:text-error transition-colors cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                        <h3 className="font-bold text-sm text-on-surface truncate">
                          {selectedUser.name}
                        </h3>
                        <span className="text-[11px] font-semibold text-primary">
                          {selectedUser.roleLabel}
                        </span>
                      </div>
                    </div>

                    {/* TAMPILAN JIKA KASIR TERKUNCI KARENA SHIFT BELUM DITUTUP */}
                    {selectedUser.role === "kasir" &&
                    activeCashierShift?.status === "open" &&
                    activeCashierShift.cashierId !== selectedUser.id ? (
                      <div className="w-full flex flex-col items-center text-center py-2 animate-in fade-in">
                        <div className="w-16 h-16 rounded-2xl bg-rose-100 border border-rose-300 text-rose-700 flex items-center justify-center mb-3 shadow-xs">
                          <span className="material-symbols-outlined text-3xl">lock_clock</span>
                        </div>
                        <h4 className="font-extrabold text-sm text-rose-950">
                          Kasir Terkunci Sementara
                        </h4>
                        <p className="text-xs text-rose-800 mt-1 max-w-xs leading-relaxed">
                          Kasir sebelumnya (<strong>{activeCashierShift.cashierName}</strong>) belum melakukan laporan tutup kasir dan serah terima shift.
                        </p>

                        <div className="mt-4 p-3 rounded-2xl bg-amber-50 border border-amber-300 text-left w-full text-xs text-amber-950 flex items-start gap-2 shadow-2xs">
                          <span className="material-symbols-outlined text-base text-amber-700 mt-0.5 shrink-0">info</span>
                          <span className="leading-snug">
                            Sesuai aturan keamanan kasir, sistem mengunci login kasir lain. Kasir <strong>{activeCashierShift.cashierName}</strong> harus login kembali untuk menyelesaikan proses <strong>Tutup Kasir</strong>.
                          </span>
                        </div>

                        {/* Tombol beralih langsung ke kasir shift aktif */}
                        <button
                          type="button"
                          onClick={() => {
                            const activeOwner = usersList.find((u) => u.id === activeCashierShift.cashierId);
                            if (activeOwner) {
                              setSelectedUser(activeOwner);
                              setPin("");
                              setErrorMsg("");
                            }
                          }}
                          className="mt-5 w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-base">switch_account</span>
                          <span>Beralih ke {activeCashierShift.cashierName}</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* PIN Display Dots */}
                        <div className="flex flex-col items-center gap-1.5 mb-5 w-full">
                          <span className="text-xs font-bold text-on-surface-variant">
                            Masukkan 4-Digit PIN Anda:
                          </span>

                          <div
                            className={`flex items-center justify-center gap-3.5 py-2.5 px-6 rounded-2xl bg-surface-container-low border border-outline-variant/30 ${
                              shakeError ? "animate-bounce border-error text-error" : ""
                            }`}
                          >
                            {[0, 1, 2, 3].map((idx) => {
                              const isFilled = pin.length > idx;
                              return (
                                <span
                                  key={idx}
                                  className={`w-4 h-4 rounded-full transition-all ${
                                    isFilled
                                      ? "bg-primary scale-110 shadow-xs"
                                      : "border-2 border-outline-variant/50 bg-transparent"
                                  }`}
                                />
                              );
                            })}
                          </div>

                          {/* Error feedback */}
                          {errorMsg && (
                            <p className="text-xs font-bold text-error flex items-center gap-1 mt-1 text-center animate-in fade-in">
                              <span className="material-symbols-outlined text-sm">error</span>
                              <span>{errorMsg}</span>
                            </p>
                          )}
                        </div>

                        {/* Virtual Numpad */}
                        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[280px]">
                          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => handleNumpadClick(num)}
                              disabled={isSubmitting}
                              className="h-14 rounded-2xl bg-surface-container-low hover:bg-surface-container active:scale-95 text-xl font-bold text-on-surface transition-all flex items-center justify-center cursor-pointer shadow-2xs border border-outline-variant/20"
                            >
                              {num}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={handleNumpadClear}
                            disabled={isSubmitting || pin.length === 0}
                            className="h-14 rounded-2xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-800 text-sm font-bold transition-all flex items-center justify-center cursor-pointer border border-rose-200"
                            title="Hapus Semua"
                          >
                            C
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNumpadClick("0")}
                            disabled={isSubmitting}
                            className="h-14 rounded-2xl bg-surface-container-low hover:bg-surface-container active:scale-95 text-xl font-bold text-on-surface transition-all flex items-center justify-center cursor-pointer shadow-2xs border border-outline-variant/20"
                          >
                            0
                          </button>
                          <button
                            type="button"
                            onClick={handleNumpadBackspace}
                            disabled={isSubmitting || pin.length === 0}
                            className="h-14 rounded-2xl bg-surface-container-low hover:bg-surface-container active:scale-95 text-on-surface transition-all flex items-center justify-center cursor-pointer border border-outline-variant/20"
                            title="Hapus Satu Digit"
                          >
                            <span className="material-symbols-outlined text-lg">backspace</span>
                          </button>
                        </div>

                        {/* Manual Login Confirmation Button */}
                        <button
                          type="button"
                          disabled={isSubmitting || pin.length < 4}
                          onClick={() => executeLogin(selectedUser.username, pin)}
                          className={`w-full max-w-[280px] mt-4 py-3 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                            pin.length >= 4 && !isSubmitting
                              ? "bg-primary text-on-primary hover:bg-primary/90"
                              : "bg-surface-container text-outline cursor-not-allowed"
                          }`}
                        >
                          <span className="material-symbols-outlined text-base">login</span>
                          <span>{isSubmitting ? "Memverifikasi..." : "Masuk ke Sistem"}</span>
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="py-12 px-6 flex flex-col items-center text-center gap-3 text-on-surface-variant">
                    <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-outline">
                      <span className="material-symbols-outlined text-3xl">touch_app</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-on-surface">Pilih Nama Staf</h4>
                      <p className="text-xs text-on-surface-variant mt-1 max-w-[240px]">
                        Klik salah satu kartu staf di sisi kiri untuk memunculkan tombol PIN otorisasi.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================
              MODE 2: TRADITIONAL USERNAME & PIN FORM
             ======================================================== */
          <div className="max-w-md mx-auto w-full">
            <form
              onSubmit={handleFormSubmit}
              className="bg-surface-container-lowest rounded-3xl p-7 border border-outline-variant/30 shadow-xl flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">
                  Username Staf / Email
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">
                    person
                  </span>
                  <input
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="Contoh: kasir, waiter, kitchen, owner..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs font-bold text-on-surface focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">
                  PIN Otorisasi (4 Digit)
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">
                    pin
                  </span>
                  <input
                    type="password"
                    maxLength={6}
                    value={formPin}
                    onChange={(e) => setFormPin(e.target.value)}
                    placeholder="••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs font-mono font-bold tracking-widest text-on-surface focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-colors"
                    required
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">login</span>
                <span>{isSubmitting ? "Memverifikasi..." : "Masuk ke Sistem"}</span>
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Footer System Info */}
      <footer className="px-6 py-3 border-t border-surface-container-high/60 bg-surface-container-lowest text-[11px] text-on-surface-variant flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-primary">Keivo POS Restaurant System</span>
          <span>•</span>
          <span>v1.2.0 Multi-Role Edition</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Otorisasi Berbasis Peran (RBAC) Aktif</span>
          <span>•</span>
          <span className="font-mono text-outline">Terminal ID: {settings.posTerminal || "POS-01"}</span>
        </div>
      </footer>
    </div>
  );
}
