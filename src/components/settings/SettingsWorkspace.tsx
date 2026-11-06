"use client";

import React, { useState, useEffect } from "react";
import { useRestaurant } from "@/context/RestaurantContext";
import { RestaurantSettings, PrinterConfig } from "@/types/pos";
import { UserProfile, UserRole, SystemMenu, ROLE_PERMISSIONS } from "@/types/auth";
import {
  connectBluetoothDevice,
  sendEscPosToPrinter,
  BLE_PRINTER_SERVICES,
} from "@/lib/bluetoothPrinter";

export function SettingsWorkspace() {
  const {
    settings,
    updateSettings,
    currentUser,
    switchRole,
    usersList,
    addUser,
    updateUser,
    deleteUser,
    addPrinter,
    updatePrinter,
    deletePrinter,
    activeBtDevice,
    setActiveBtDevice,
  } = useRestaurant();

  const [activeTab, setActiveTab] = useState<"identity" | "roles" | "users" | "printers">("identity");

  // Form states for Identity
  const [identityForm, setIdentityForm] = useState<RestaurantSettings>(settings);
  const [isSavingIdentity, setIsSavingIdentity] = useState(false);
  const [identitySavedFeedback, setIdentitySavedFeedback] = useState(false);

  useEffect(() => {
    setIdentityForm(settings);
  }, [settings]);

  // User modal state
  const [userModal, setUserModal] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    data?: UserProfile;
  }>({ isOpen: false, mode: "add" });

  // Printer management state
  const [addPrinterModal, setAddPrinterModal] = useState(false);
  const [printerForm, setPrinterForm] = useState<Partial<PrinterConfig>>({
    name: "",
    target: "cashier",
    connectionType: "bluetooth",
    paperWidth: "58mm",
    autoCut: false,
    isActive: true,
  });
  const [btScanStatus, setBtScanStatus] = useState<"idle" | "scanning" | "found" | "error">("idle");
  const [btFoundDevice, setBtFoundDevice] = useState<BluetoothDevice | null>(null);
  const [connectingPrinterId, setConnectingPrinterId] = useState<string | null>(null);
  const [testPrintModal, setTestPrintModal] = useState<{
    isOpen: boolean;
    printer?: PrinterConfig;
  }>({ isOpen: false });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    printer?: PrinterConfig;
  }>({ isOpen: false });
  const [btTroubleshootModal, setBtTroubleshootModal] = useState<{
    isOpen: boolean;
    printer?: PrinterConfig;
    errorMsg?: string;
  }>({ isOpen: false });

  // Handle identity save
  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingIdentity(true);
    try {
      await updateSettings(identityForm);
      setIdentitySavedFeedback(true);
      setTimeout(() => setIdentitySavedFeedback(false), 3000);
    } finally {
      setIsSavingIdentity(false);
    }
  };

  // Handle save user
  const handleSaveUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get("name") as string;
    const username = (fd.get("username") as string).toLowerCase().trim();
    const email = fd.get("email") as string;
    const phone = fd.get("phone") as string;
    const role = fd.get("role") as UserRole;
    const pin = fd.get("pin") as string;
    const isActive = fd.get("isActive") === "on";

    if (userModal.mode === "add") {
      const newUser: UserProfile = {
        id: `usr-${Date.now()}`,
        name,
        username,
        email,
        phone,
        role,
        roleLabel: ROLE_PERMISSIONS[role].roleName,
        pin: pin || "1234",
        isActive,
        avatarUrl: `https://images.unsplash.com/photo-${1534528741775 + usersList.length}?w=150&auto=format&fit=crop&q=80`,
      };
      addUser(newUser);
    } else if (userModal.data) {
      updateUser({
        ...userModal.data,
        name,
        username,
        email,
        phone,
        role,
        roleLabel: ROLE_PERMISSIONS[role].roleName,
        pin: pin || userModal.data.pin,
        isActive,
      });
    }

    setUserModal({ isOpen: false, mode: "add" });
  };

  const allRoles: UserRole[] = ["owner", "admin", "manager", "kasir", "waiters", "kitchen"];
  const allMenus: { id: SystemMenu; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "analytics" },
    { id: "pos", label: "POS (Kasir)", icon: "point_of_sale" },
    { id: "kitchen", label: "Kitchen (KDS)", icon: "skillet" },
    { id: "area_meja", label: "Waiters", icon: "table_restaurant" },
    { id: "master_data", label: "Master Data", icon: "database" },
    { id: "laporan", label: "Laporan", icon: "bar_chart" },
    { id: "pengaturan", label: "Pengaturan", icon: "settings" },
  ];

  return (
    <div className="w-full min-h-screen bg-surface px-6 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-container-high pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">tune</span>
            <h1 className="font-headline-sm text-2xl font-bold text-on-surface">
              Pengaturan Restoran &amp; Sistem
            </h1>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Konfigurasi identitas restoran, hak akses role user, manajemen pengguna, dan printer kasir/dapur.
          </p>
        </div>

        {/* Current Active User Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30">
          <span className="text-xs text-on-surface-variant font-medium">User Login:</span>
          <span className="px-2.5 py-0.5 rounded-full bg-primary text-on-primary font-bold text-xs">
            {currentUser.name} ({currentUser.role.toUpperCase()})
          </span>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-3 mt-6 border-b border-surface-container-high overflow-x-auto">
        <button
          onClick={() => setActiveTab("identity")}
          className={`pb-3 px-3 font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer border-b-2 shrink-0 ${
            activeTab === "identity"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-lg">storefront</span>
          <span>1. Identitas Restoran</span>
        </button>

        <button
          onClick={() => setActiveTab("roles")}
          className={`pb-3 px-3 font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer border-b-2 shrink-0 ${
            activeTab === "roles"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
          <span>2. Setting Role User</span>
        </button>

        <button
          onClick={() => setActiveTab("users")}
          className={`pb-3 px-3 font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer border-b-2 shrink-0 ${
            activeTab === "users"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-lg">group</span>
          <span>3. User ({usersList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("printers")}
          className={`pb-3 px-3 font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer border-b-2 shrink-0 ${
            activeTab === "printers"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-lg">print</span>
          <span>4. Printer ({settings.printers?.length || 0})</span>
        </button>
      </div>

      {/* ==================== TAB 1: IDENTITAS RESTORAN ==================== */}
      {activeTab === "identity" && (
        <form onSubmit={handleSaveIdentity} className="mt-6 max-w-4xl flex flex-col gap-6">
          {identitySavedFeedback && (
            <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-800 animate-in fade-in">
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>Identitas Restoran berhasil disimpan dan diterapkan pada seluruh sistem!</span>
            </div>
          )}

          <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 shadow-xs flex flex-col gap-4">
            <h3 className="font-headline-sm text-base font-bold text-on-surface flex items-center gap-2 border-b border-surface-container-high pb-2">
              <span className="material-symbols-outlined text-primary text-xl">badge</span>
              <span>Nama &amp; Branding Restoran</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-on-surface">Nama Restoran *</label>
                <input
                  type="text"
                  required
                  value={identityForm.restaurantName}
                  onChange={(e) => setIdentityForm({ ...identityForm, restaurantName: e.target.value })}
                  placeholder="Contoh: Pawon Nusantara"
                  className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 font-bold text-on-surface focus:outline-none focus:border-primary text-sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-on-surface">Nama Cabang / Outlet *</label>
                <input
                  type="text"
                  required
                  value={identityForm.branchName}
                  onChange={(e) => setIdentityForm({ ...identityForm, branchName: e.target.value })}
                  placeholder="Contoh: Cabang Senopati"
                  className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 font-semibold text-on-surface focus:outline-none focus:border-primary text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-bold text-on-surface">URL Logo Restoran</label>
              <div className="flex items-center gap-3">
                {identityForm.logoUrl ? (
                  <img
                    src={identityForm.logoUrl}
                    alt="Logo Preview"
                    className="w-12 h-12 rounded-xl object-contain bg-surface-container-low p-1 border border-outline-variant/30 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-outline">restaurant</span>
                  </div>
                )}
                <input
                  type="text"
                  value={identityForm.logoUrl}
                  onChange={(e) => setIdentityForm({ ...identityForm, logoUrl: e.target.value })}
                  placeholder="https://... URL gambar logo"
                  className="flex-1 p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 font-mono text-xs focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-on-surface">Nomor Telepon Restoran</label>
                <input
                  type="text"
                  value={identityForm.phone}
                  onChange={(e) => setIdentityForm({ ...identityForm, phone: e.target.value })}
                  placeholder="0812-3456-7890"
                  className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-on-surface">Kode / ID Terminal POS</label>
                <input
                  type="text"
                  value={identityForm.posTerminal}
                  onChange={(e) => setIdentityForm({ ...identityForm, posTerminal: e.target.value })}
                  placeholder="POS REG-01"
                  className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 font-mono font-bold focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-bold text-on-surface">Alamat Lengkap</label>
              <textarea
                rows={2}
                value={identityForm.address}
                onChange={(e) => setIdentityForm({ ...identityForm, address: e.target.value })}
                placeholder="Alamat fisik restoran yang dicetak pada struk..."
                className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-bold text-on-surface">Pesan Penutup Struk (Footer)</label>
              <textarea
                rows={2}
                value={identityForm.receiptFooter}
                onChange={(e) => setIdentityForm({ ...identityForm, receiptFooter: e.target.value })}
                placeholder="Terima kasih atas kunjungan Anda..."
                className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary"
              />
            </div>

            {/* Akun Media Sosial Restoran (Instagram, Facebook, TikTok) */}
            <div className="pt-3 border-t border-surface-container-high flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">share</span>
                  <span className="font-bold text-on-surface text-xs">
                    Akun Media Sosial Restoran (Cetak Struk &amp; QR Meja)
                  </span>
                </div>
                <span className="text-[11px] text-on-surface-variant font-medium">
                  Centang checkbox &quot;Tampilkan&quot; agar akun medsos dicetak di struk kwitansi &amp; QR code meja.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Instagram */}
                <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-on-surface">
                      <svg className="w-4 h-4 text-pink-600 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                      <span>Instagram</span>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={identityForm.showInstagram ?? true}
                        onChange={(e) =>
                          setIdentityForm({ ...identityForm, showInstagram: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer accent-[#003629]"
                      />
                      <span className="text-[10px] font-bold text-slate-700">Tampilkan</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={identityForm.instagram || ""}
                    onChange={(e) =>
                      setIdentityForm({ ...identityForm, instagram: e.target.value })
                    }
                    placeholder="Contoh: @pawon.nusantara"
                    className="p-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs font-medium text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>

                {/* 2. Facebook */}
                <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-on-surface">
                      <svg className="w-4 h-4 text-blue-600 fill-current" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      <span>Facebook</span>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={identityForm.showFacebook ?? true}
                        onChange={(e) =>
                          setIdentityForm({ ...identityForm, showFacebook: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer accent-[#003629]"
                      />
                      <span className="text-[10px] font-bold text-slate-700">Tampilkan</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={identityForm.facebook || ""}
                    onChange={(e) =>
                      setIdentityForm({ ...identityForm, facebook: e.target.value })
                    }
                    placeholder="Contoh: Pawon Nusantara Resto"
                    className="p-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs font-medium text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>

                {/* 3. TikTok */}
                <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-on-surface">
                      <svg className="w-4 h-4 text-slate-900 fill-current" viewBox="0 0 24 24">
                        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                      </svg>
                      <span>TikTok</span>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={identityForm.showTiktok ?? true}
                        onChange={(e) =>
                          setIdentityForm({ ...identityForm, showTiktok: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer accent-[#003629]"
                      />
                      <span className="text-[10px] font-bold text-slate-700">Tampilkan</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={identityForm.tiktok || ""}
                    onChange={(e) =>
                      setIdentityForm({ ...identityForm, tiktok: e.target.value })
                    }
                    placeholder="Contoh: @pawon.nusantara"
                    className="p-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs font-medium text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pajak & Service Charge */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 shadow-xs flex flex-col gap-4">
            <h3 className="font-headline-sm text-base font-bold text-on-surface flex items-center gap-2 border-b border-surface-container-high pb-2">
              <span className="material-symbols-outlined text-primary text-xl">receipt_long</span>
              <span>Pajak (PB1) &amp; Service Charge</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-on-surface">Pajak Restoran (PB1)</span>
                  <input
                    type="checkbox"
                    checked={identityForm.taxEnabled ?? true}
                    onChange={(e) => setIdentityForm({ ...identityForm, taxEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={identityForm.taxRate ?? 10}
                    onChange={(e) => setIdentityForm({ ...identityForm, taxRate: Number(e.target.value) })}
                    className="w-20 p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-center font-bold"
                  />
                  <span className="font-bold text-on-surface">% PB1</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-on-surface">Biaya Layanan (Service Charge)</span>
                  <input
                    type="checkbox"
                    checked={identityForm.serviceChargeEnabled ?? true}
                    onChange={(e) =>
                      setIdentityForm({ ...identityForm, serviceChargeEnabled: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={identityForm.serviceChargeRate ?? 5}
                    onChange={(e) =>
                      setIdentityForm({ ...identityForm, serviceChargeRate: Number(e.target.value) })
                    }
                    className="w-20 p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-center font-bold"
                  />
                  <span className="font-bold text-on-surface">% Service</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingIdentity}
              className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 transition-all cursor-pointer shadow-xs flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              <span>{isSavingIdentity ? "Menyimpan..." : "Simpan Identitas Restoran"}</span>
            </button>
          </div>
        </form>
      )}

      {/* ==================== TAB 2: SETTING ROLE USER ==================== */}
      {activeTab === "roles" && (
        <div className="mt-6 flex flex-col gap-6">
          <div className="p-4 bg-primary-container/20 border border-primary-container rounded-2xl flex items-start gap-3 text-xs">
            <span className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5">
              security
            </span>
            <div className="flex flex-col gap-1">
              <span className="font-bold text-on-surface text-sm">
                Aturan &amp; Matriks Hak Akses Sistem (Role-Based Access Control)
              </span>
              <p className="text-on-surface-variant leading-relaxed">
                Sesuai kebijakan keamanan restoran:
                <br />• <strong>Owner, Admin, Manager:</strong> Memiliki izin membuka <strong>SEMUA</strong> menu sistem.
                <br />• <strong>Kasir:</strong> Hanya memiliki akses ke menu <strong>POS Kasir</strong>.
                <br />• <strong>Waiters:</strong> Hanya memiliki akses ke menu <strong>Waiters</strong> (Monitor Meja & Tamu).
                <br />• <strong>Kitchen:</strong> Hanya memiliki akses ke monitor <strong>Kitchen (KDS)</strong>.
              </p>
            </div>
          </div>

          {/* Permission Matrix Table */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-surface-container-high text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    <th className="py-3 px-4">Role User</th>
                    <th className="py-3 px-4">Deskripsi Peran</th>
                    {allMenus.map((m) => (
                      <th key={m.id} className="py-3 px-2 text-center" title={m.label}>
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="material-symbols-outlined text-base">{m.icon}</span>
                          <span className="text-[10px]">{m.label}</span>
                        </div>
                      </th>
                    ))}
                    <th className="py-3 px-4 text-center">Quick Switch (Test)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-xs">
                  {allRoles.map((role) => {
                    const perm = ROLE_PERMISSIONS[role];
                    const isCurrent = currentUser.role === role;
                    return (
                      <tr
                        key={role}
                        className={`hover:bg-surface-container-low/40 transition-colors ${
                          isCurrent ? "bg-primary-container/10" : ""
                        }`}
                      >
                        <td className="py-3.5 px-4 font-bold text-on-surface">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${perm.badgeColor}`}>
                              {perm.roleName}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] bg-primary text-on-primary px-1.5 py-0.2 rounded font-bold">
                                AKTIF
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-on-surface-variant max-w-xs leading-relaxed">
                          {perm.description}
                        </td>
                        {allMenus.map((m) => {
                          const isAllowed = perm.allowedMenus.includes(m.id);
                          return (
                            <td key={m.id} className="py-3.5 px-2 text-center">
                              {isAllowed ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700">
                                  <span className="material-symbols-outlined text-base font-bold">check</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-surface-container text-outline/50">
                                  <span className="material-symbols-outlined text-sm">close</span>
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => switchRole(role)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              isCurrent
                                ? "bg-primary text-on-primary cursor-default"
                                : "bg-surface-container hover:bg-primary hover:text-on-primary text-on-surface"
                            }`}
                          >
                            {isCurrent ? "Sedang Digunakan" : `Ganti ke ${perm.roleName.split(" ")[0]}`}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: USER MANAGEMENT ==================== */}
      {activeTab === "users" && (
        <div className="mt-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-on-surface-variant font-medium">
              Total <strong>{usersList.length} user</strong> terdaftar dalam sistem restoran.
            </span>
            <button
              onClick={() => setUserModal({ isOpen: true, mode: "add" })}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary/90 text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-base">person_add</span>
              <span>+ Tambah User Baru</span>
            </button>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-surface-container-high text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    <th className="py-3 px-4">Pengguna</th>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4">Role Akses</th>
                    <th className="py-3 px-4">Email / Kontak</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-xs">
                  {usersList.map((u) => {
                    const perm = ROLE_PERMISSIONS[u.role] || ROLE_PERMISSIONS.kasir;
                    const isSelf = currentUser.id === u.id;
                    return (
                      <tr key={u.id} className="hover:bg-surface-container-low/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-on-surface">
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                u.avatarUrl ||
                                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                              }
                              alt={u.name}
                              className="w-8 h-8 rounded-full object-cover shrink-0"
                            />
                            <div className="flex flex-col">
                              <span>{u.name}</span>
                              {isSelf && (
                                <span className="text-[10px] text-primary font-bold">● Akun Anda Saat Ini</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-primary">
                          @{u.username}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${perm.badgeColor}`}>
                            {perm.roleName}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-on-surface-variant">
                          <div className="flex flex-col text-[11px]">
                            <span>{u.email || "-"}</span>
                            <span>{u.phone || "-"}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              u.isActive
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {u.isActive ? "Aktif" : "Non-Aktif"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => switchRole(u.role)}
                              className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-primary hover:text-on-primary text-[11px] font-bold transition-all cursor-pointer"
                              title="Masuk sebagai user ini"
                            >
                              Ganti Role
                            </button>
                            <button
                              onClick={() => setUserModal({ isOpen: true, mode: "edit", data: u })}
                              className="p-1 rounded-lg text-outline hover:text-primary hover:bg-surface-container cursor-pointer"
                              title="Edit User"
                            >
                              <span className="material-symbols-outlined text-base">edit</span>
                            </button>
                            <button
                              onClick={() => deleteUser(u.id)}
                              className="p-1 rounded-lg text-outline hover:text-error hover:bg-error-container/40 cursor-pointer"
                              title="Hapus User"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 4: PRINTER BLUETOOTH ==================== */}
      {activeTab === "printers" && (
        <div className="mt-6 max-w-4xl flex flex-col gap-6">
          {/* Info Banner */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3 text-xs">
            <span className="material-symbols-outlined text-blue-600 text-xl shrink-0 mt-0.5">bluetooth</span>
            <div className="flex flex-col gap-1">
              <span className="font-bold text-on-surface text-sm">Printer Bluetooth Thermal Struk Kasir</span>
              <p className="text-on-surface-variant leading-relaxed">
                Hubungkan printer Bluetooth thermal (58mm/80mm) ke perangkat ini. Setelah terhubung,
                cetak struk akan otomatis dikirim langsung ke printer tanpa muncul dialog print browser.
                Pastikan Bluetooth perangkat Anda aktif sebelum scan.
              </p>
              {activeBtDevice && (
                <div className="mt-1 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-100 border border-emerald-300 w-fit">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="font-bold text-emerald-800 text-[11px]">
                    Aktif: {activeBtDevice.name || activeBtDevice.id}
                  </span>
                  <button
                    onClick={() => {
                      activeBtDevice.gatt?.disconnect();
                      setActiveBtDevice(null);
                      // Update printer status
                      const printers = settings.printers || [];
                      printers.forEach((p) => {
                        if (p.connectionStatus === "connected") {
                          updatePrinter({ ...p, connectionStatus: "disconnected" });
                        }
                      });
                    }}
                    className="ml-1 text-[10px] text-emerald-700 underline cursor-pointer hover:text-rose-600"
                  >
                    Putuskan
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Printer List */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-on-surface-variant font-medium">
              {(settings.printers || []).length === 0
                ? "Belum ada printer terdaftar. Tambahkan printer Bluetooth untuk mulai mencetak struk."
                : `Total <strong>${(settings.printers || []).length} printer</strong> terdaftar.`
              }
            </span>
            <button
              onClick={() => {
                setPrinterForm({ name: "", target: "cashier", connectionType: "bluetooth", paperWidth: "58mm", autoCut: false, isActive: true });
                setBtScanStatus("idle");
                setBtFoundDevice(null);
                setAddPrinterModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary/90 text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span>+ Tambah Printer Bluetooth</span>
            </button>
          </div>

          {(settings.printers || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant/50">
              <span className="material-symbols-outlined text-5xl text-outline/40">print_disabled</span>
              <p className="text-sm text-on-surface-variant font-medium">Tidak ada printer terdaftar</p>
              <button
                onClick={() => {
                  setPrinterForm({ name: "", target: "cashier", connectionType: "bluetooth", paperWidth: "58mm", autoCut: false, isActive: true });
                  setBtScanStatus("idle");
                  setBtFoundDevice(null);
                  setAddPrinterModal(true);
                }}
                className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 cursor-pointer"
              >
                Tambah Printer Bluetooth Sekarang
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(settings.printers || []).map((ptr) => {
                const isSystem = ptr.connectionType === "system";
                const isConnected = isSystem
                  ? ptr.connectionStatus === "connected"
                  : !!(activeBtDevice && ptr.connectionStatus === "connected");
                const isConnecting = connectingPrinterId === ptr.id;

                const handleConnect = async () => {
                  if (ptr.connectionType === "system") {
                    updatePrinter({ ...ptr, connectionStatus: "connected" });
                    return;
                  }
                  if (!navigator.bluetooth) {
                    alert("Browser Anda tidak mendukung Web Bluetooth. Gunakan Google Chrome atau Microsoft Edge terbaru.");
                    return;
                  }
                  setConnectingPrinterId(ptr.id);
                  updatePrinter({ ...ptr, connectionStatus: "connecting" });
                  try {
                    const device = await connectBluetoothDevice(ptr.bluetoothDeviceId, ptr.name);
                    setActiveBtDevice(device);
                    device.addEventListener("gattserverdisconnected", () => {
                      setActiveBtDevice(null);
                      updatePrinter({ ...ptr, connectionStatus: "disconnected" });
                    });
                    updatePrinter({
                      ...ptr,
                      connectionStatus: "connected",
                      bluetoothDeviceId: device.id,
                      name: ptr.name || device.name || ptr.name,
                    });
                  } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err);
                    if (!msg.toLowerCase().includes("cancel")) {
                      updatePrinter({ ...ptr, connectionStatus: "error" });
                    } else {
                      updatePrinter({ ...ptr, connectionStatus: "disconnected" });
                    }
                    // Show helpful diagnosis / 1-click fix modal
                    setBtTroubleshootModal({
                      isOpen: true,
                      printer: ptr,
                      errorMsg: msg,
                    });
                  } finally {
                    setConnectingPrinterId(null);
                  }
                };

                const handleDisconnect = () => {
                  if (activeBtDevice?.gatt?.connected) {
                    activeBtDevice.gatt.disconnect();
                  }
                  setActiveBtDevice(null);
                  updatePrinter({ ...ptr, connectionStatus: "disconnected" });
                };

                return (
                  <div
                    key={ptr.id}
                    className={`bg-surface-container-lowest rounded-2xl p-5 border shadow-xs flex flex-col justify-between gap-4 transition-all ${
                      isConnected
                        ? "border-emerald-400 ring-1 ring-emerald-300"
                        : "border-outline-variant/30"
                    }`}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 ${
                            isSystem
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          <span className="material-symbols-outlined text-xs">
                            {isSystem ? "laptop_mac" : "bluetooth"}
                          </span>
                          {isSystem ? "Printer Laptop (OS)" : "Web Bluetooth"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isConnected ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              Terhubung
                            </span>
                          ) : ptr.connectionStatus === "connecting" || isConnecting ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                              Menghubungkan...
                            </span>
                          ) : ptr.connectionStatus === "error" ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-rose-600">
                              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                              Error
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-outline">
                              <span className="w-2 h-2 rounded-full bg-outline/40"></span>
                              Tidak Terhubung
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-1">
                        <h4 className="font-headline-sm text-sm font-bold text-on-surface">{ptr.name}</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant font-medium">
                          {ptr.target === "cashier" ? "Kasir" : ptr.target === "kitchen" ? "Dapur" : "Bar"}
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 text-xs text-on-surface-variant pt-2 border-t border-surface-container-high">
                        <div className="flex justify-between">
                          <span>Koneksi:</span>
                          <span className="font-bold text-on-surface flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-blue-500">
                              {isSystem ? "laptop_mac" : "bluetooth"}
                            </span>
                            {isSystem ? "Laptop (Bluetooth/USB)" : "Web Bluetooth (BLE)"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Ukuran Kertas:</span>
                          <span className="font-bold text-on-surface">{ptr.paperWidth}</span>
                        </div>
                        {ptr.bluetoothDeviceId && !isSystem && (
                          <div className="flex justify-between">
                            <span>Device ID:</span>
                            <span className="font-mono text-[10px] text-primary truncate max-w-[100px]">{ptr.bluetoothDeviceId}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {isConnected ? (
                        <>
                          <button
                            onClick={() => setTestPrintModal({ isOpen: true, printer: ptr })}
                            className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <span className="material-symbols-outlined text-sm">print</span>
                            <span>Test Cetak Struk</span>
                          </button>
                          <button
                            onClick={handleDisconnect}
                            className="w-full py-1.5 px-3 rounded-xl bg-surface-container hover:bg-rose-50 hover:text-rose-600 text-xs font-bold text-on-surface-variant transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">power_settings_new</span>
                            <span>Putuskan Koneksi</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={handleConnect}
                            disabled={isConnecting}
                            className="w-full py-2 px-3 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-xs"
                          >
                            <span className="material-symbols-outlined text-sm">{isConnecting ? "sync" : isSystem ? "power" : "bluetooth_searching"}</span>
                            <span>{isConnecting ? "Menghubungkan..." : isSystem ? "Aktifkan Printer Laptop" : "Hubungkan Printer"}</span>
                          </button>

                          {!isSystem && (
                            <button
                              type="button"
                              onClick={() => {
                                updatePrinter({
                                  ...ptr,
                                  connectionType: "system",
                                  connectionStatus: "connected",
                                });
                              }}
                              className="w-full py-1.5 px-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border border-blue-200"
                              title="Pilih opsi ini jika printer Anda sudah terhubung di menu Bluetooth Laptop"
                            >
                              <span className="material-symbols-outlined text-sm text-blue-600">laptop_mac</span>
                              <span>Printer sdh di Laptop? Aktifkan Mode Laptop</span>
                            </button>
                          )}
                        </>
                      )}

                      <button
                        onClick={() => setDeleteConfirmModal({ isOpen: true, printer: ptr })}
                        className="w-full py-1.5 px-3 rounded-xl border border-outline-variant/30 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 text-xs font-medium text-outline transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        <span>Hapus Printer</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* How-to info */}
          <div className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/20 text-xs text-on-surface-variant">
            <p className="font-bold text-on-surface mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-primary">help_outline</span>
              Cara Menghubungkan Printer Bluetooth:
            </p>
            <ol className="list-decimal list-inside space-y-1 leading-relaxed">
              <li>Nyalakan printer Bluetooth thermal dan pastikan dalam mode pairing.</li>
              <li>Aktifkan Bluetooth di perangkat komputer/tablet Anda.</li>
              <li>Klik tombol <strong>"+ Tambah Printer Bluetooth"</strong> untuk mendaftarkan printer.</li>
              <li>Klik <strong>"Hubungkan Printer"</strong> pada kartu printer, pilih perangkat dari daftar browser.</li>
              <li>Setelah terhubung, cetak struk saat transaksi akan <strong>otomatis langsung dicetak</strong> tanpa dialog.</li>
            </ol>
            <p className="mt-2 text-[11px] text-outline">
              ⚠ Web Bluetooth hanya didukung di Chrome &amp; Edge (desktop/Android). Safari &amp; Firefox tidak mendukung.
            </p>
          </div>
        </div>
      )}

      {/* ==================== USER MODAL (ADD / EDIT) ==================== */}
      {userModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-2xl flex flex-col gap-4 border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <h2 className="font-headline-sm text-lg font-bold text-on-surface">
                {userModal.mode === "add" ? "Tambah Pengguna Baru" : "Edit Pengguna"}
              </h2>
              <button
                onClick={() => setUserModal({ ...userModal, isOpen: false })}
                className="p-1 rounded-lg hover:bg-surface-container text-outline"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="flex flex-col gap-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface">Nama Lengkap *</label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={userModal.data?.name || ""}
                  placeholder="Contoh: Rina Anggraini"
                  className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Username *</label>
                  <input
                    type="text"
                    name="username"
                    required
                    defaultValue={userModal.data?.username || ""}
                    placeholder="rina_kasir"
                    className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Role Akses *</label>
                  <select
                    name="role"
                    defaultValue={userModal.data?.role || "kasir"}
                    className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-bold cursor-pointer"
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager Restoran</option>
                    <option value="kasir">Kasir</option>
                    <option value="waiters">Waiters</option>
                    <option value="kitchen">Kitchen Chef</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Email</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={userModal.data?.email || ""}
                    placeholder="rina@resto.com"
                    className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">No. Telepon</label>
                  <input
                    type="text"
                    name="phone"
                    defaultValue={userModal.data?.phone || ""}
                    placeholder="0812-..."
                    className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface">PIN Cepat (4 Digit)</label>
                <input
                  type="password"
                  name="pin"
                  maxLength={6}
                  defaultValue={userModal.data?.pin || "1234"}
                  placeholder="1234"
                  className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-mono font-bold tracking-widest text-center"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveUserInput"
                  name="isActive"
                  defaultChecked={userModal.data?.isActive ?? true}
                  className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                />
                <label htmlFor="isActiveUserInput" className="font-bold text-on-surface cursor-pointer">
                  User Aktif (Dapat Login ke Aplikasi)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => setUserModal({ ...userModal, isOpen: false })}
                  className="px-4 py-2 rounded-xl bg-surface-container text-on-surface font-bold hover:bg-surface-container-high cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary text-on-primary font-bold hover:bg-primary/90 cursor-pointer shadow-xs"
                >
                  Simpan User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== ADD PRINTER MODAL ==================== */}
      {addPrinterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-2xl flex flex-col gap-4 border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">print</span>
                <h2 className="font-headline-sm text-lg font-bold text-on-surface">Tambah Printer Baru</h2>
              </div>
              <button
                onClick={() => setAddPrinterModal(false)}
                className="p-1 rounded-lg hover:bg-surface-container text-outline cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs">
              {/* Connection Type Choice */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-on-surface">Metode Koneksi Printer</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrinterForm({ ...printerForm, connectionType: "system" })}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 cursor-pointer transition-all ${
                      printerForm.connectionType === "system"
                        ? "border-primary bg-primary/10 text-primary font-bold ring-1 ring-primary"
                        : "border-outline-variant/30 bg-surface-container-low text-on-surface hover:bg-surface-container"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <span className="material-symbols-outlined text-base">laptop_mac</span>
                      <span>Printer Laptop (OS)</span>
                    </div>
                    <span className="text-[10px] font-normal text-on-surface-variant leading-snug">
                      Sudah connect di Bluetooth / USB Laptop (Rekomendasi)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrinterForm({ ...printerForm, connectionType: "bluetooth" })}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 cursor-pointer transition-all ${
                      printerForm.connectionType === "bluetooth"
                        ? "border-primary bg-primary/10 text-primary font-bold ring-1 ring-primary"
                        : "border-outline-variant/30 bg-surface-container-low text-on-surface hover:bg-surface-container"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <span className="material-symbols-outlined text-base">bluetooth</span>
                      <span>Web Bluetooth (BLE)</span>
                    </div>
                    <span className="text-[10px] font-normal text-on-surface-variant leading-snug">
                      Koneksi nirkabel langsung via browser Chrome
                    </span>
                  </button>
                </div>
              </div>

              {/* Name & Paper Width */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Nama Printer *</label>
                  <input
                    type="text"
                    value={printerForm.name || ""}
                    onChange={(e) => setPrinterForm({ ...printerForm, name: e.target.value })}
                    placeholder={printerForm.connectionType === "system" ? "Contoh: Printer Kasir Laptop" : "Contoh: Printer Bluetooth 58mm"}
                    className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 font-bold text-on-surface focus:outline-none focus:border-primary text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-on-surface">Fungsi Printer</label>
                    <select
                      value={printerForm.target || "cashier"}
                      onChange={(e) => setPrinterForm({ ...printerForm, target: e.target.value as PrinterConfig["target"] })}
                      className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-bold cursor-pointer"
                    >
                      <option value="cashier">Struk Kasir</option>
                      <option value="kitchen">Checker Dapur</option>
                      <option value="bar">Printer Bar</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-on-surface">Ukuran Kertas</label>
                    <select
                      value={printerForm.paperWidth || "58mm"}
                      onChange={(e) => setPrinterForm({ ...printerForm, paperWidth: e.target.value as PrinterConfig["paperWidth"] })}
                      className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-bold cursor-pointer"
                    >
                      <option value="58mm">58mm (Kecil)</option>
                      <option value="80mm">80mm (Standar)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Bluetooth Scan (Only if connectionType === 'bluetooth') */}
              {printerForm.connectionType === "bluetooth" && (
                <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col gap-3">
                  <p className="font-bold text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-blue-500">bluetooth_searching</span>
                    Scan &amp; Pilih Perangkat Bluetooth
                  </p>
                  <p className="text-on-surface-variant leading-relaxed">
                    Klik tombol di bawah untuk memunculkan daftar perangkat Bluetooth. Pilih printer dari daftar.
                  </p>

                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-[11px] flex flex-col gap-1 leading-relaxed">
                    <span className="font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-amber-700">info</span>
                      Tips Khusus Pengguna iPad / iPhone:
                    </span>
                    <span>
                      Apple Safari &amp; Chrome di iPad tidak mendukung Web Bluetooth langsung. Gunakan opsi <strong>&quot;Printer Laptop (OS)&quot;</strong> di atas (AirPrint/Dialog Cetak), atau buka web ini lewat browser <strong>Bluefy</strong> gratis di App Store.
                    </span>
                  </div>

                  {btScanStatus === "found" && btFoundDevice ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      <div className="flex flex-col">
                        <span className="font-bold text-emerald-800">{btFoundDevice.name || "Perangkat Bluetooth"}</span>
                        <span className="text-[10px] text-emerald-600">ID: {btFoundDevice.id}</span>
                      </div>
                      <button
                        onClick={() => { setBtFoundDevice(null); setBtScanStatus("idle"); }}
                        className="ml-auto text-outline hover:text-rose-600 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </div>
                  ) : btScanStatus === "error" ? (
                    <div className="flex flex-col gap-1 px-3 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className="material-symbols-outlined text-base">error</span>
                        <span>Perangkat tidak ditemukan atau browser tidak mendukung Bluetooth</span>
                      </div>
                      <span className="text-[10px] text-rose-600 leading-snug">
                        Di iPad / iPhone: gunakan opsi &quot;Printer Laptop (OS)&quot; (AirPrint/Dialog Cetak) atau buka lewat browser Bluefy di App Store.
                      </span>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={async () => {
                      if (!navigator.bluetooth) {
                        setBtScanStatus("error");
                        return;
                      }
                      setBtScanStatus("scanning");
                      try {
                        const device = await connectBluetoothDevice();
                        setBtFoundDevice(device);
                        setBtScanStatus("found");
                        if (!printerForm.name && device.name) {
                          setPrinterForm((prev) => ({ ...prev, name: device.name || prev.name }));
                        }
                      } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : String(err);
                        if (!msg.toLowerCase().includes("cancel")) {
                          setBtScanStatus("error");
                        } else {
                          setBtScanStatus("idle");
                        }
                      }
                    }}
                    disabled={btScanStatus === "scanning"}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition-all shadow-xs"
                  >
                    <span className="material-symbols-outlined text-base">{btScanStatus === "scanning" ? "sync" : "bluetooth_searching"}</span>
                    <span>{btScanStatus === "scanning" ? "Mencari perangkat..." : btScanStatus === "found" ? "Cari Ulang Perangkat" : "Scan Perangkat Bluetooth"}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-high">
              <button
                onClick={() => setAddPrinterModal(false)}
                className="px-4 py-2 rounded-xl bg-surface-container text-on-surface font-bold hover:bg-surface-container-high cursor-pointer text-xs"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (!printerForm.name?.trim()) {
                    alert("Nama printer harus diisi.");
                    return;
                  }
                  const isSys = printerForm.connectionType === "system";
                  const newPrinter: PrinterConfig = {
                    id: `ptr-${isSys ? "sys" : "bt"}-${Date.now()}`,
                    name: printerForm.name.trim(),
                    target: printerForm.target || "cashier",
                    connectionType: isSys ? "system" : "bluetooth",
                    paperWidth: printerForm.paperWidth || "58mm",
                    autoCut: false,
                    isActive: true,
                    connectionStatus: isSys ? "connected" : btFoundDevice ? "connected" : "disconnected",
                    bluetoothDeviceId: btFoundDevice?.id,
                  };
                  if (btFoundDevice) {
                    setActiveBtDevice(btFoundDevice);
                  }
                  addPrinter(newPrinter);
                  setAddPrinterModal(false);
                  setBtFoundDevice(null);
                  setBtScanStatus("idle");
                }}
                className="px-5 py-2 rounded-xl bg-primary text-on-primary font-bold hover:bg-primary/90 cursor-pointer shadow-xs text-xs flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">save</span>
                Simpan Printer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TEST PRINT MODAL ==================== */}
      {testPrintModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-surface-container-lowest p-6 shadow-2xl flex flex-col gap-4 border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">print</span>
                <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                  Test Print — {testPrintModal.printer?.name}
                </h3>
              </div>
              <button
                onClick={() => setTestPrintModal({ isOpen: false })}
                className="p-1 rounded-lg hover:bg-surface-container text-outline cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Thermal Slip Simulator */}
            <div className="bg-white text-zinc-900 p-4 rounded-xl border border-zinc-300 font-mono text-[11px] leading-tight shadow-inner flex flex-col items-center gap-1">
              <span className="font-bold text-xs">{settings.restaurantName.toUpperCase()}</span>
              <span>{settings.branchName}</span>
              <span className="text-[10px] text-zinc-600 text-center">{settings.address}</span>
              <span>Telp: {settings.phone}</span>
              <div className="w-full border-b border-dashed border-zinc-400 my-2"></div>
              <div className="w-full flex justify-between text-[10px]">
                <span>TEST PRINT POS</span>
                <span>{new Date().toLocaleTimeString()}</span>
              </div>
              <div className="w-full flex justify-between text-[10px]">
                <span>PRINTER:</span>
                <span className="font-bold">{testPrintModal.printer?.paperWidth} ({testPrintModal.printer?.connectionType === "system" ? "Laptop" : "BT"})</span>
              </div>
              <div className="w-full border-b border-dashed border-zinc-400 my-2"></div>
              <div className="w-full flex justify-between font-bold">
                <span>STATUS:</span>
                <span className="text-emerald-700">TERHUBUNG (OK)</span>
              </div>
              <div className="w-full border-b border-dashed border-zinc-400 my-2"></div>
              <span className="text-[10px] text-center italic mt-1">
                {settings.receiptFooter || "Terima kasih atas kunjungan Anda!"}
              </span>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setTestPrintModal({ isOpen: false })}
                className="px-4 py-2 rounded-xl bg-surface-container text-on-surface text-xs font-bold hover:bg-surface-container-high cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={async () => {
                  const ptr = testPrintModal.printer;
                  if (!ptr) return;

                  if (ptr.connectionType === "system") {
                    window.print();
                    setTestPrintModal({ isOpen: false });
                    return;
                  }

                  if (!activeBtDevice || !activeBtDevice.gatt?.connected) {
                    alert(`⚠ Printer "${ptr?.name}" belum terhubung. Hubungkan terlebih dahulu.`);
                    return;
                  }
                  try {
                    const encoder = new TextEncoder();
                    const text = `\x1B@${settings.restaurantName}\n${settings.branchName}\n--- TEST PRINT POS ---\nSTATUS: OK\nUKURAN: ${ptr.paperWidth}\n\n\n`;
                    await sendEscPosToPrinter(activeBtDevice, encoder.encode(text));
                    alert("✅ Perintah cetak berhasil dikirim ke printer thermal!");
                  } catch (e) {
                    console.error(e);
                    alert("❌ Gagal mengirim ke printer. Pastikan printer menyala dan Bluetooth aktif.");
                  }
                  setTestPrintModal({ isOpen: false });
                }}
                className="flex-1 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                Kirim Test Print
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ==================== DELETE CONFIRM MODAL ==================== */}
      {deleteConfirmModal.isOpen && deleteConfirmModal.printer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-surface-container-lowest p-6 shadow-2xl flex flex-col gap-4 border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-rose-600">delete_forever</span>
              </div>
              <div>
                <h3 className="font-bold text-on-surface text-sm">Hapus Printer?</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Printer <strong>&quot;{deleteConfirmModal.printer.name}&quot;</strong> akan dihapus dari daftar.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-high">
              <button
                onClick={() => setDeleteConfirmModal({ isOpen: false })}
                className="px-4 py-2 rounded-xl bg-surface-container text-on-surface font-bold hover:bg-surface-container-high cursor-pointer text-xs"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const ptr = deleteConfirmModal.printer!;
                  const isConn =
                    !!activeBtDevice && ptr.connectionStatus === "connected";
                  if (isConn) {
                    activeBtDevice?.gatt?.disconnect();
                    setActiveBtDevice(null);
                  }
                  deletePrinter(ptr.id);
                  setDeleteConfirmModal({ isOpen: false });
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 cursor-pointer shadow-xs text-xs flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                Ya, Hapus Printer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== BLUETOOTH TROUBLESHOOT / QUICK FIX MODAL ==================== */}
      {btTroubleshootModal.isOpen && btTroubleshootModal.printer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-2xl flex flex-col gap-4 border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-blue-600">bluetooth_searching</span>
              </div>
              <div>
                <h3 className="font-bold text-on-surface text-sm">Printer Sudah Terkoneksi ke Laptop?</h3>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Tips solusi koneksi printer Bluetooth thermal
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface-variant flex flex-col gap-2 leading-relaxed">
              <p>
                Jika printer Anda <strong>sudah terhubung di menu Bluetooth Laptop/Mac</strong>, browser Chrome sering kali tidak dapat mendeteksinya di daftar scan karena koneksi Bluetooth telah dikunci oleh sistem operasi (macOS/Windows).
              </p>
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px]">
                <strong className="block mb-0.5 font-bold">✨ Solusi Paling Cepat &amp; Praktis:</strong>
                Gunakan <strong>Mode Printer Laptop</strong>. Aplikasi POS akan langsung terhubung ke printer laptop tanpa perlu proses pairing berulang di browser!
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1 border-t border-surface-container-high">
              <button
                onClick={() => {
                  const ptr = btTroubleshootModal.printer!;
                  updatePrinter({
                    ...ptr,
                    connectionType: "system",
                    connectionStatus: "connected",
                  });
                  setBtTroubleshootModal({ isOpen: false });
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer shadow-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <span className="material-symbols-outlined text-base">laptop_mac</span>
                <span>Aktifkan Mode Printer Laptop Sekarang (Rekomendasi)</span>
              </button>

              <button
                onClick={() => setBtTroubleshootModal({ isOpen: false })}
                className="w-full py-2 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs cursor-pointer transition-all"
              >
                Tutup &amp; Coba Lagi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
