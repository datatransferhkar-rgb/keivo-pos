"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { RestaurantSettings, PrinterConfig } from "@/types/pos";
import { UserProfile, UserRole, SystemMenu, DEFAULT_USERS, ROLE_PERMISSIONS, ActiveCashierShift } from "@/types/auth";

// No dummy printers — printers are added by user via Bluetooth scanning
const DEFAULT_PRINTERS: PrinterConfig[] = [];

const DEFAULT_BANK_ACCOUNTS = [
  {
    id: "bank-bca-01",
    bankName: "BCA",
    accountNumber: "8830-1234-56",
    accountName: "Pawon Nusantara Resto",
    isDefault: true,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: "bank-mandiri-02",
    bankName: "Bank Mandiri",
    accountNumber: "1370-0198-2345",
    accountName: "PT Pawon Nusantara Boga",
    isDefault: false,
    isActive: true,
    sortOrder: 2,
  },
];

const DEFAULT_SETTINGS: RestaurantSettings = {
  restaurantName: "Pawon Nusantara",
  branchName: "Cabang Senopati",
  posTerminal: "POS REG-01",
  logoUrl:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBZ38yzMys7rDMMvVwNdnO6Qn2uICUNbqSa-5UoGm10fLVYf6WDkRMOCPeRdtoxJkv8OUADMdxDXPsQzjLKJTHKblLIZvPbTlXyJC3xkOCsKw_cNbNO52ydpmNiSpokMBP8HbWAok_cF18e76XVNvX2CMcM1ZOJ5jFrBg7FzXMvJVJrdNurVe1rUQovs3FiEhVmPwbcngnw5cj9prjV2eg9F67BhB-Yd0e9AGcUPrn8t-DkCnmjVVTI",
  address: "Jl. Senopati No. 45, Kebayoran Baru, Jakarta Selatan",
  phone: "0812-3456-7890",
  receiptFooter:
    "Terima kasih atas kunjungan Anda di Pawon Nusantara! Silakan datang kembali.",
  staticQrImageUrl: "",
  staticQrLabel: "QRIS Pawon Nusantara (BCA)",
  staticQrInstructions: "Arahkan layar ini ke pelanggan untuk dipindai via BCA Mobile, GoPay, OVO, ShopeePay, atau DANA.",
  bankTransferInstructions: "BCA 8830-1234-56 a/n Pawon Nusantara Resto",
  bankAccounts: DEFAULT_BANK_ACCOUNTS,
  taxEnabled: true,
  taxRate: 10,
  serviceChargeEnabled: true,
  serviceChargeRate: 5,
  printers: DEFAULT_PRINTERS, // starts empty
  instagram: "@pawon.nusantara",
  showInstagram: true,
  facebook: "Pawon Nusantara Resto",
  showFacebook: true,
  tiktok: "@pawon.nusantara",
  showTiktok: true,
};

interface RestaurantContextType {
  settings: RestaurantSettings;
  updateSettings: (newSettings: Partial<RestaurantSettings>) => Promise<boolean>;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  isLoading: boolean;
  // Auth & Roles
  currentUser: UserProfile;
  setCurrentUser: (user: UserProfile) => void;
  switchRole: (role: UserRole) => void;
  usersList: UserProfile[];
  addUser: (user: UserProfile) => void;
  updateUser: (user: UserProfile) => void;
  deleteUser: (id: string) => void;
  canAccessMenu: (menu: SystemMenu) => boolean;
  isAuthenticated: boolean;
  activeCashierShift: ActiveCashierShift | null;
  openCashierShift: (cashierUser: UserProfile) => void;
  closeCashierShift: (replacementUser?: UserProfile) => void;
  login: (identifier: string, pin: string) => { success: boolean; message?: string; user?: UserProfile };
  logout: () => void;
  // Printer management
  addPrinter: (printer: PrinterConfig) => void;
  updatePrinter: (printer: PrinterConfig) => void;
  deletePrinter: (id: string) => void;
  // Active Bluetooth printer device reference (Web Bluetooth API)
  activeBtDevice: BluetoothDevice | null;
  setActiveBtDevice: (device: BluetoothDevice | null) => void;
  // Active USB / Serial thermal printer port (Web Serial API)
  activeSerialPort: any | null;
  setActiveSerialPort: (port: any | null) => void;
  printerConnectedName: string;
  setPrinterConnectedName: (name: string) => void;
}

const RestaurantContext = createContext<RestaurantContextType>({
  settings: DEFAULT_SETTINGS,
  updateSettings: async () => false,
  isSettingsOpen: false,
  setIsSettingsOpen: () => {},
  isLoading: true,
  currentUser: DEFAULT_USERS[0],
  setCurrentUser: () => {},
  switchRole: () => {},
  usersList: DEFAULT_USERS,
  addUser: () => {},
  updateUser: () => {},
  deleteUser: () => {},
  canAccessMenu: () => true,
  isAuthenticated: false,
  activeCashierShift: null,
  openCashierShift: () => {},
  closeCashierShift: () => {},
  login: () => ({ success: false, message: "Context uninitialized" }),
  logout: () => {},
  addPrinter: () => {},
  updatePrinter: () => {},
  deletePrinter: () => {},
  activeBtDevice: null,
  setActiveBtDevice: () => {},
  activeSerialPort: null,
  setActiveSerialPort: () => {},
  printerConnectedName: "",
  setPrinterConnectedName: () => {},
});

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<RestaurantSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Active Bluetooth & USB Serial thermal printer devices
  const [activeBtDevice, setActiveBtDevice] = useState<BluetoothDevice | null>(null);
  const [activeSerialPort, setActiveSerialPort] = useState<any | null>(null);
  const [printerConnectedName, setPrinterConnectedName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // Users & Active User State
  const [usersList, setUsersList] = useState<UserProfile[]>(DEFAULT_USERS);
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEFAULT_USERS[0]); // default: Owner
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Active Cashier Shift State (Strict shift-lock across logins/logouts)
  const [activeCashierShift, setActiveCashierShift] = useState<ActiveCashierShift | null>(null);

  // Load initial settings & users from localStorage cache
  useEffect(() => {
    const cachedAuth = localStorage.getItem("keivo_pos_is_auth");
    if (cachedAuth === "true") {
      setIsAuthenticated(true);
    }

    // Restore or initialize active cashier shift
    const cachedShift = localStorage.getItem("keivo_pos_active_shift");
    if (cachedShift) {
      try {
        const parsed = JSON.parse(cachedShift);
        if (parsed && parsed.cashierId) {
          setActiveCashierShift(parsed);
        }
      } catch (e) {
        // ignore
      }
    } else {
      // Default initial open shift to Siti Rahmawati (usr-kasir-1)
      const defaultShift: ActiveCashierShift = {
        cashierId: "usr-kasir-1",
        cashierName: "Siti Rahmawati",
        cashierUsername: "kasir",
        openedAt: new Date().toISOString(),
        status: "open",
      };
      setActiveCashierShift(defaultShift);
      localStorage.setItem("keivo_pos_active_shift", JSON.stringify(defaultShift));
    }

    const cachedSettings = localStorage.getItem("keivo_pos_settings");
    if (cachedSettings) {
      try {
        setSettings(JSON.parse(cachedSettings));
      } catch (e) {
        // ignore
      }
    }

    const cachedUsers = localStorage.getItem("keivo_pos_users");
    if (cachedUsers) {
      try {
        const parsed = JSON.parse(cachedUsers);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setUsersList(parsed);
        }
      } catch (e) {
        // ignore
      }
    }

    const cachedActiveUser = localStorage.getItem("keivo_pos_active_user");
    if (cachedActiveUser) {
      try {
        const parsed = JSON.parse(cachedActiveUser);
        if (parsed && parsed.role) {
          setCurrentUser(parsed);
        }
      } catch (e) {
        // ignore
      }
    }

    // Auto-reconnect Web Bluetooth printer if previously granted by user
    if (typeof navigator !== "undefined" && navigator.bluetooth && navigator.bluetooth.getDevices) {
      navigator.bluetooth.getDevices().then(async (devices) => {
        if (devices.length > 0) {
          const dev = devices[0];
          try {
            if (!dev.gatt?.connected) {
              await dev.gatt?.connect();
            }
            setActiveBtDevice(dev);
            setPrinterConnectedName(dev.name || "Printer Bluetooth");
          } catch (err) {
            console.log("Auto-connect to paired BT printer:", err);
          }
        }
      }).catch(() => {});
    }

    // Auto-reconnect Web Serial (USB) printer if previously granted by user
    if (typeof navigator !== "undefined" && "serial" in navigator) {
      (navigator as any).serial.getPorts().then(async (ports: any[]) => {
        if (ports && ports.length > 0) {
          const port = ports[0];
          try {
            await port.open({ baudRate: 9600 });
          } catch {}
          setActiveSerialPort(port);
          setPrinterConnectedName("Printer USB Thermal");
        }
      }).catch(() => {});
    }

    // Ground truth from backend API
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.restaurantName) {
          const loaded: RestaurantSettings = {
            restaurantName: data.restaurantName,
            branchName: data.branchName || "Cabang Senopati",
            posTerminal: data.posTerminal || "POS REG-01",
            logoUrl: data.logoUrl || DEFAULT_SETTINGS.logoUrl,
            address: data.address || DEFAULT_SETTINGS.address,
            phone: data.phone || DEFAULT_SETTINGS.phone,
            receiptFooter: data.receiptFooter || DEFAULT_SETTINGS.receiptFooter,
            staticQrImageUrl: data.staticQrImageUrl || DEFAULT_SETTINGS.staticQrImageUrl || "",
            staticQrLabel: data.staticQrLabel || DEFAULT_SETTINGS.staticQrLabel,
            bankTransferInstructions:
              data.bankTransferInstructions || DEFAULT_SETTINGS.bankTransferInstructions,
            bankAccounts: (() => {
              if (Array.isArray(data.bankAccounts) && data.bankAccounts.length > 0) return data.bankAccounts;
              if (typeof data.bankAccounts === "string" && data.bankAccounts.trim().startsWith("[")) {
                try {
                  const parsed = JSON.parse(data.bankAccounts);
                  if (Array.isArray(parsed) && parsed.length > 0) return parsed;
                } catch {}
              }
              try {
                const savedAccounts = localStorage.getItem("keivo_pos_bank_accounts");
                if (savedAccounts) return JSON.parse(savedAccounts);
              } catch {}
              return DEFAULT_SETTINGS.bankAccounts;
            })(),
            taxEnabled: data.taxEnabled ?? DEFAULT_SETTINGS.taxEnabled,
            taxRate: data.taxRate ?? DEFAULT_SETTINGS.taxRate,
            serviceChargeEnabled:
              data.serviceChargeEnabled ?? DEFAULT_SETTINGS.serviceChargeEnabled,
            serviceChargeRate:
              data.serviceChargeRate ?? DEFAULT_SETTINGS.serviceChargeRate,
            instagram: data.instagram ?? DEFAULT_SETTINGS.instagram,
            showInstagram: data.showInstagram !== undefined ? Boolean(data.showInstagram) : DEFAULT_SETTINGS.showInstagram,
            facebook: data.facebook ?? DEFAULT_SETTINGS.facebook,
            showFacebook: data.showFacebook !== undefined ? Boolean(data.showFacebook) : DEFAULT_SETTINGS.showFacebook,
            tiktok: data.tiktok ?? DEFAULT_SETTINGS.tiktok,
            showTiktok: data.showTiktok !== undefined ? Boolean(data.showTiktok) : DEFAULT_SETTINGS.showTiktok,
            // Restore saved printers from localStorage if available
            printers: (() => {
              try {
                const saved = localStorage.getItem("keivo_pos_printers");
                return saved ? JSON.parse(saved) : DEFAULT_PRINTERS;
              } catch { return DEFAULT_PRINTERS; }
            })(),
          };
          setSettings(loaded);
          localStorage.setItem("keivo_pos_settings", JSON.stringify(loaded));
        }
      })
      .catch((err) => console.error("Failed to load settings:", err))
      .finally(() => setIsLoading(false));

    // Also fetch dedicated bank accounts
    fetch("/api/bank-accounts")
      .then((res) => res.json())
      .then((accs) => {
        if (Array.isArray(accs) && accs.length > 0) {
          setSettings((prev) => ({ ...prev, bankAccounts: accs }));
          localStorage.setItem("keivo_pos_bank_accounts", JSON.stringify(accs));
        }
      })
      .catch(() => {});

    // Restore printers from localStorage independently
    try {
      const savedPrinters = localStorage.getItem("keivo_pos_printers");
      if (savedPrinters) {
        const parsed: PrinterConfig[] = JSON.parse(savedPrinters);
        setSettings((prev) => ({ ...prev, printers: parsed }));
      }
    } catch { /* ignore */ }
  }, []);

  const updateSettings = async (newSettings: Partial<RestaurantSettings>): Promise<boolean> => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    localStorage.setItem("keivo_pos_settings", JSON.stringify(merged));
    if (newSettings.bankAccounts) {
      localStorage.setItem("keivo_pos_bank_accounts", JSON.stringify(newSettings.bankAccounts));
    }

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });
      return res.ok;
    } catch (err) {
      console.error("Failed to persist settings:", err);
      return false;
    }
  };

  const handleSetCurrentUser = (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem("keivo_pos_active_user", JSON.stringify(user));
  };

  const switchRole = (role: UserRole) => {
    const target = usersList.find((u) => u.role === role) || {
      id: `usr-${role}-default`,
      name: role.toUpperCase(),
      username: role,
      role: role,
      roleLabel: ROLE_PERMISSIONS[role].roleName,
      isActive: true,
    };
    handleSetCurrentUser(target);
  };

  const addUser = (newUser: UserProfile) => {
    const updated = [...usersList, newUser];
    setUsersList(updated);
    localStorage.setItem("keivo_pos_users", JSON.stringify(updated));
  };

  const updateUser = (updatedUser: UserProfile) => {
    const updated = usersList.map((u) => (u.id === updatedUser.id ? updatedUser : u));
    setUsersList(updated);
    localStorage.setItem("keivo_pos_users", JSON.stringify(updated));
    if (currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
      localStorage.setItem("keivo_pos_active_user", JSON.stringify(updatedUser));
    }
  };

  const deleteUser = (id: string) => {
    if (usersList.length <= 1) {
      alert("Tidak dapat menghapus user terakhir.");
      return;
    }
    const updated = usersList.filter((u) => u.id !== id);
    setUsersList(updated);
    localStorage.setItem("keivo_pos_users", JSON.stringify(updated));
    if (currentUser.id === id) {
      handleSetCurrentUser(updated[0]);
    }
  };

  // Printer management
  const savePrinters = (printers: PrinterConfig[]) => {
    localStorage.setItem("keivo_pos_printers", JSON.stringify(printers));
    setSettings((prev) => ({ ...prev, printers }));
  };

  const addPrinter = (printer: PrinterConfig) => {
    setSettings((prev) => {
      const updated = [...(prev.printers || []), printer];
      localStorage.setItem("keivo_pos_printers", JSON.stringify(updated));
      return { ...prev, printers: updated };
    });
  };

  const updatePrinter = (printer: PrinterConfig) => {
    setSettings((prev) => {
      const updated = (prev.printers || []).map((p) => (p.id === printer.id ? printer : p));
      localStorage.setItem("keivo_pos_printers", JSON.stringify(updated));
      return { ...prev, printers: updated };
    });
  };

  const deletePrinter = (id: string) => {
    setSettings((prev) => {
      const updated = (prev.printers || []).filter((p) => p.id !== id);
      localStorage.setItem("keivo_pos_printers", JSON.stringify(updated));
      return { ...prev, printers: updated };
    });
  };

  const canAccessMenu = (menu: SystemMenu): boolean => {
    const role = currentUser.role;
    const permissions = ROLE_PERMISSIONS[role];
    if (!permissions) return false;
    return permissions.allowedMenus.includes(menu);
  };

  const openCashierShift = (cashierUser: UserProfile) => {
    const shift: ActiveCashierShift = {
      cashierId: cashierUser.id,
      cashierName: cashierUser.name,
      cashierUsername: cashierUser.username,
      openedAt: new Date().toISOString(),
      status: "open",
    };
    setActiveCashierShift(shift);
    localStorage.setItem("keivo_pos_active_shift", JSON.stringify(shift));
  };

  const closeCashierShift = (replacementUser?: UserProfile) => {
    if (replacementUser && replacementUser.role === "kasir") {
      // Serah terima shift ke kasir pengganti yang sah
      const newShift: ActiveCashierShift = {
        cashierId: replacementUser.id,
        cashierName: replacementUser.name,
        cashierUsername: replacementUser.username,
        openedAt: new Date().toISOString(),
        status: "open",
      };
      setActiveCashierShift(newShift);
      localStorage.setItem("keivo_pos_active_shift", JSON.stringify(newShift));
      handleSetCurrentUser(replacementUser);
    } else {
      // Tandai shift selesai/tutup tanpa kasir pengganti langsung
      const closed: ActiveCashierShift = {
        cashierId: activeCashierShift?.cashierId || "",
        cashierName: activeCashierShift?.cashierName || "",
        cashierUsername: activeCashierShift?.cashierUsername || "",
        openedAt: activeCashierShift?.openedAt || new Date().toISOString(),
        status: "closed",
      };
      setActiveCashierShift(closed);
      localStorage.setItem("keivo_pos_active_shift", JSON.stringify(closed));
    }
  };

  const login = (
    identifier: string,
    pin: string
  ): { success: boolean; message?: string; user?: UserProfile } => {
    const trimmed = identifier.toLowerCase().trim();
    const user = usersList.find(
      (u) =>
        u.id === identifier ||
        u.username.toLowerCase() === trimmed ||
        (u.email && u.email.toLowerCase() === trimmed)
    );

    if (!user) {
      return { success: false, message: "Pengguna tidak ditemukan." };
    }

    if (!user.isActive) {
      return {
        success: false,
        message: `Akun "${user.name}" (${user.roleLabel}) sedang dinonaktifkan. Hubungi Administrator/Owner.`,
      };
    }

    // ATURAN SHIFT POS KASIR:
    // Apabila kasir belum melakukan laporan tutup kasir dan melakukan log out,
    // maka sistem tidak akan mengizinkan kasir lainnya login (harus ada notifikasi bahwa kasir sebelumnya harus tutup kasir),
    // KECUALI akun lainnya selain kasir (Owner, Admin, Manager, Waiters, Kitchen) tetap dapat login bebas.
    if (user.role === "kasir") {
      if (
        activeCashierShift &&
        activeCashierShift.status === "open" &&
        activeCashierShift.cashierId !== user.id
      ) {
        return {
          success: false,
          message: `Kasir sebelumnya (${activeCashierShift.cashierName}) belum melakukan laporan tutup kasir! Sistem tidak mengizinkan kasir lain login sampai kasir ${activeCashierShift.cashierName} melakukan tutup kasir dan serah terima shift.`,
        };
      }
    }

    const expectedPin = user.pin || "1234";
    if (expectedPin !== pin.trim()) {
      return { success: false, message: "PIN yang Anda masukkan salah. Coba lagi." };
    }

    // Jika kasir login dan belum ada shift aktif, buka shift baru untuk kasir ini
    if (user.role === "kasir") {
      if (!activeCashierShift || activeCashierShift.status === "closed") {
        openCashierShift(user);
      }
    }

    handleSetCurrentUser(user);
    setIsAuthenticated(true);
    localStorage.setItem("keivo_pos_is_auth", "true");
    return { success: true, user };
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("keivo_pos_is_auth");
    // Catatan: activeCashierShift sengaja tetap disimpan di localStorage sebagai "open",
    // agar aturan penguncian shift tetap berlaku ketika kasir lain mencoba login.
  };

  return (
    <RestaurantContext.Provider
      value={{
        settings,
        updateSettings,
        isSettingsOpen,
        setIsSettingsOpen,
        isLoading,
        currentUser,
        setCurrentUser: handleSetCurrentUser,
        switchRole,
        usersList,
        addUser,
        updateUser,
        deleteUser,
        canAccessMenu,
        isAuthenticated,
        activeCashierShift,
        openCashierShift,
        closeCashierShift,
        login,
        logout,
        addPrinter,
        updatePrinter,
        deletePrinter,
        activeBtDevice,
        setActiveBtDevice,
        activeSerialPort,
        setActiveSerialPort,
        printerConnectedName,
        setPrinterConnectedName,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant() {
  return useContext(RestaurantContext);
}
