"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/formatters";
import { OrderData, RestaurantSettings, MasterProduct, KitchenStatus, ProductAddon, PromoDiscount, Customer, CustomerTier, ProductPromo } from "@/types/pos";
import { calculateProductPromoPrice } from "@/lib/productPromoHelper";
import { DEFAULT_CATALOG_PRODUCTS } from "@/lib/catalogData";
import { useRestaurant } from "@/context/RestaurantContext";
import { sendEscPosToPrinter, buildReceiptEscPos } from "@/lib/bluetoothPrinter";
import { TutupKasirModal } from "@/components/modals/TutupKasirModal";
import { ProductDetailModal } from "@/components/modals/ProductDetailModal";
import { PengeluaranKasModal, CashExpenseItem } from "@/components/modals/PengeluaranKasModal";
import { PindahMejaModal } from "@/components/modals/PindahMejaModal";
import {
  playOrderChime,
  playSuccessChime,
  unlockAudioContext,
  isSoundEnabled,
  setSoundEnabled,
} from "@/lib/soundChime";

interface PosWorkspaceProps {
  orders: OrderData[];
  onProcessPayment: (order: OrderData) => void;
  onPrintTicket: (order: OrderData) => void;
  onPrintWaiterSheet: (table: string, orderOrItems?: any) => void;
  onTakeawayClick?: () => void;
  onOjolClick?: () => void;
  onTableClick?: () => void;
  onConfirmDirectPayment?: (
    orderId: string,
    method: "cash" | "static_qr" | "bank_transfer",
    amountPaid: number,
    change: number,
    orderData?: OrderData
  ) => void;
  onAddNewOrder?: (order: OrderData, alreadySaved?: boolean) => void;
  onNavigateHome?: () => void;
}

// Strictly 3 table statuses as requested:
// 1. "tersedia" (Tersedia)
// 2. "reservasi" (Reservasi)
// 3. "terisi" (Terisi, previously makan/cooking/ready/unpaid)
export type TableStatus = "tersedia" | "reservasi" | "terisi";

export interface TableCardInfo {
  id: string;
  tableNumber: string;
  displayName: string;
  area: "indoor" | "outdoor";
  areaLabel: string;
  capacity: number;
  status: TableStatus;
  statusLabel: string;
  orderNumber?: string;
  customerName?: string;
  amount?: number;
  timeElapsed?: string;
  reservationTime?: string;
  reservationTimestamp?: number;
  reservationNotes?: string;
  isProcessing?: boolean; // Kitchen cooking badge: "Proses"
  foodStatus?: "in_progress" | "ready" | "served" | "none";
  foodStatusLabel?: string;
  orderData?: OrderData;
  qrToken?: string;
}

// ========================================================
// INTERFACE & HELPER: REKOMENDASI PROMO KHUSUS MEMBER
// ========================================================
export interface MemberPromoSuggestion {
  promo: PromoDiscount;
  reason: string;
  badge: string;
  isPersonal: boolean;
  priority: number;
}

export function getMemberPromos(
  customer: Customer | null,
  targetScope: "dine_in" | "takeaway",
  promosList: PromoDiscount[],
  currentSubtotal: number = 0
): MemberPromoSuggestion[] {
  if (!customer) return [];
  const results: MemberPromoSuggestion[] = [];

  for (const promo of promosList) {
    if (!promo.isActive) continue;
    if (promo.scope !== "all" && promo.scope !== targetScope) continue;

    // ATURAN PROMO: Harus memenuhi batas minimal belanja untuk bisa disugestikan sebagai promo siap pakai!
    if (promo.minOrderAmount && currentSubtotal < promo.minOrderAmount) {
      continue;
    }

    const pScope = promo.customerScope || "all";

    if (pScope === "personal") {
      if (
        (promo.assignedCustomerId && promo.assignedCustomerId === customer.id) ||
        (promo.assignedCustomerName &&
          promo.assignedCustomerName.toLowerCase().trim() === customer.name.toLowerCase().trim())
      ) {
        results.push({
          promo,
          reason: `Voucher Spesial Pribadi (${customer.name})`,
          badge: "Personal",
          isPersonal: true,
          priority: 1,
        });
      }
    } else if (pScope === "vip") {
      if (customer.tier === "vip") {
        results.push({
          promo,
          reason: "Penawaran Eksklusif Member VIP",
          badge: "VIP Member",
          isPersonal: false,
          priority: 2,
        });
      }
    } else if (pScope === "gold") {
      if (customer.tier === "gold" || customer.tier === "vip") {
        results.push({
          promo,
          reason: `Hak Istimewa Member ${customer.tier.toUpperCase()}`,
          badge: "Gold & VIP",
          isPersonal: false,
          priority: 3,
        });
      }
    } else if (pScope === "member") {
      results.push({
        promo,
        reason: "Diskon Khusus Member Terdaftar Resto",
        badge: "Semua Member",
        isPersonal: false,
        priority: 4,
      });
    }
  }

  results.sort((a, b) => a.priority - b.priority);
  return results;
}

export function PosWorkspace({
  orders,
  onProcessPayment,
  onPrintTicket,
  onPrintWaiterSheet,
  onTakeawayClick,
  onOjolClick,
  onTableClick,
  onConfirmDirectPayment,
  onAddNewOrder,
  onNavigateHome,
}: PosWorkspaceProps) {
  const {
    settings,
    currentUser,
    activeBtDevice,
    switchRole,
    setCurrentUser,
    usersList,
    logout,
    activeCashierShift,
    closeCashierShift,
  } = useRestaurant();
  const [lastPrintedOrder, setLastPrintedOrder] = useState<OrderData | null>(null);

  /** Cetak kwitansi langsung tanpa membuka pratinjau modal */
  const printReceiptDirectly = async (order: OrderData) => {
    setLastPrintedOrder(order);

    // 1. Direct Web Bluetooth Thermal ESC/POS (tanpa dialog browser)
    if (activeBtDevice) {
      try {
        const text = buildReceiptEscPos(order, settings, currentUser.name);
        const encoder = new TextEncoder();
        await sendEscPosToPrinter(activeBtDevice, encoder.encode(text));
        return;
      } catch (err) {
        console.error("Direct BT print error, falling back to window.print:", err);
      }
    }

    // 2. Browser/System Print Dialog
    setTimeout(() => {
      window.print();
    }, 150);
  };
  const [selectedTableNumber, setSelectedTableNumber] = useState<string>("Meja 01");
  const [areaFilter, setAreaFilter] = useState<"all" | "indoor" | "outdoor">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | TableStatus>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTutupKasirOpen, setIsTutupKasirOpen] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // REVISION: Mode Input Pesanan Bungkus & Ojol berbasis katalog produk (menggantikan kartu denah meja di sisi kiri)
  const [orderingMode, setOrderingMode] = useState<"table" | "takeaway" | "ojol">("table");
  const [orderCart, setOrderCart] = useState<{
    cartItemId?: string;
    id: string;
    name: string;
    price: number;
    qty: number;
    note?: string;
    selectedAddons?: ProductAddon[];
    imageUrl?: string;
    originalPrice?: number;
    isPromo?: boolean;
    promoName?: string;
  }[]>([]);

  // Input Pesanan Bungkus (Transaksi Langsung Lunas saat Pemesanan)
  const [takeawayCustomerName, setTakeawayCustomerName] = useState("");
  const [takeawayNotes, setTakeawayNotes] = useState("");
  const [takeawayPaymentMethod, setTakeawayPaymentMethod] = useState<"cash" | "qris" | "transfer">("cash");
  const [takeawayCashReceived, setTakeawayCashReceived] = useState<number>(0);
  const [takeawayCashInputRaw, setTakeawayCashInputRaw] = useState<string>("");
  const [showTakeawayNumpad, setShowTakeawayNumpad] = useState<boolean>(true);
  const [takeawayTransferRef, setTakeawayTransferRef] = useState<string>("");

  // ========================================================
  // FITUR PROMO & DISKON (Dine-in & Takeaway)
  // ========================================================
  const [availablePromos, setAvailablePromos] = useState<PromoDiscount[]>([]);
  const [tablePromo, setTablePromo] = useState<PromoDiscount | null>(null);
  const [tableCustomDiscount, setTableCustomDiscount] = useState<{
    type: "percentage" | "fixed";
    value: number;
    reason?: string;
  } | null>(null);

  const [takeawayPromo, setTakeawayPromo] = useState<PromoDiscount | null>(null);
  const [takeawayCustomDiscount, setTakeawayCustomDiscount] = useState<{
    type: "percentage" | "fixed";
    value: number;
    reason?: string;
  } | null>(null);

  // Promo Produk / Menu (Item-Level Promos)
  const [productPromos, setProductPromos] = useState<ProductPromo[]>([]);

  const [promoModalState, setPromoModalState] = useState<{
    isOpen: boolean;
    target: "table" | "takeaway";
    activeTab: "promos" | "custom";
    customType: "percentage" | "fixed";
    customValue: number;
    customReason: string;
  }>({
    isOpen: false,
    target: "table",
    activeTab: "promos",
    customType: "percentage",
    customValue: 10,
    customReason: "",
  });

  // Load active promos from API
  useEffect(() => {
    fetch("/api/promos?active=true")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setAvailablePromos(data);
      })
      .catch((err) => console.error("Gagal load data promo di POS:", err));
  }, []);

  // Load active product promos from API
  useEffect(() => {
    const fetchProductPromos = () => {
      fetch("/api/product-promos?active=true")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setProductPromos(data);
        })
        .catch((err) => console.error("Gagal load product promos di POS:", err));
    };
    fetchProductPromos();
    const interval = setInterval(fetchProductPromos, 10000);
    return () => clearInterval(interval);
  }, []);

  // Reset table promo saat kasir berganti meja
  useEffect(() => {
    setTablePromo(null);
    setTableCustomDiscount(null);
  }, [selectedTableNumber]);

  // Customer & Member State in POS
  const [availableCustomers, setAvailableCustomers] = useState<Customer[]>([]);
  const [selectedTableCustomer, setSelectedTableCustomer] = useState<Customer | null>(null);
  const [takeawayCustomer, setTakeawayCustomer] = useState<Customer | null>(null);
  const [customerModalState, setCustomerModalState] = useState<{
    isOpen: boolean;
    target: "table" | "takeaway";
    search: string;
    isAddingNew: boolean;
    newCustomer: {
      name: string;
      phone: string;
      email: string;
      tier: CustomerTier;
      notes: string;
    };
  }>({
    isOpen: false,
    target: "table",
    search: "",
    isAddingNew: false,
    newCustomer: {
      name: "",
      phone: "",
      email: "",
      tier: "regular",
      notes: "",
    },
  });

  const loadCustomers = async () => {
    try {
      const res = await fetch("/api/customers?active=true");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setAvailableCustomers(data);
      }
    } catch (err) {
      console.error("Gagal load customer di POS:", err);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // Takeaway Numpad Handlers for Touchscreen Tablet
  const handleTakeawayNumpadDigit = (digit: string) => {
    const currentStr = takeawayCashReceived > 0 ? takeawayCashReceived.toString() : "";
    if (currentStr.length >= 10) return;
    const newNum = parseInt(currentStr + digit, 10) || 0;
    setTakeawayCashReceived(newNum);
    setTakeawayCashInputRaw(newNum.toLocaleString("id-ID"));
  };

  const handleTakeawayNumpadTripleZero = () => {
    if (takeawayCashReceived === 0) return;
    const currentStr = takeawayCashReceived.toString();
    if (currentStr.length >= 8) return;
    const newNum = parseInt(currentStr + "000", 10) || 0;
    setTakeawayCashReceived(newNum);
    setTakeawayCashInputRaw(newNum.toLocaleString("id-ID"));
  };

  const handleTakeawayNumpadBackspace = () => {
    const currentStr = takeawayCashReceived.toString();
    if (currentStr.length <= 1) {
      setTakeawayCashReceived(0);
      setTakeawayCashInputRaw("0");
    } else {
      const newNum = parseInt(currentStr.slice(0, -1), 10) || 0;
      setTakeawayCashReceived(newNum);
      setTakeawayCashInputRaw(newNum.toLocaleString("id-ID"));
    }
  };

  const handleTakeawayNumpadClear = () => {
    setTakeawayCashReceived(0);
    setTakeawayCashInputRaw("0");
  };

  const handleTakeawayQuickAdd = (addVal: number) => {
    const newNum = takeawayCashReceived + addVal;
    setTakeawayCashReceived(newNum);
    setTakeawayCashInputRaw(newNum.toLocaleString("id-ID"));
  };

  // Input Pesanan Ojol (Pembayaran otomatis via aplikasi pihak ke-3)
  const [ojolPlatform, setOjolPlatform] = useState<"GoFood" | "GrabFood" | "ShopeeFood">("GoFood");
  const [ojolExternalId, setOjolExternalId] = useState("");
  const [ojolDriverName, setOjolDriverName] = useState("");
  const [ojolNotes, setOjolNotes] = useState("");
  const [ojolError, setOjolError] = useState("");

  // Modal Riwayat Transaksi Kasir
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyChannelFilter, setHistoryChannelFilter] = useState<
    "all" | "dine_in_qr" | "takeaway_walk_in" | "online_platform"
  >("all");
  const [historySearchQuery, setHistorySearchQuery] = useState("");

  // Pengeluaran Kas Operasional (Petty Cash Kasir)
  const [isCashExpenseModalOpen, setIsCashExpenseModalOpen] = useState(false);
  const [cashExpensesList, setCashExpensesList] = useState<CashExpenseItem[]>([]);
  const [totalCashOut, setTotalCashOut] = useState<number>(0);

  const fetchShiftCashMovements = async () => {
    try {
      const res = await fetch("/api/shifts");
      const data = await res.json();
      if (data && Array.isArray(data.cashMovements)) {
        setCashExpensesList(data.cashMovements);
        setTotalCashOut(Number(data.cashOutTotal) || 0);
      }
    } catch (err) {
      console.error("Gagal memuat data kas keluar:", err);
    }
  };

  useEffect(() => {
    fetchShiftCashMovements();
  }, []);

  // Fullscreen / Kiosk Mode & Online Status (Prioritas 2)
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showIosFullscreenGuide, setShowIosFullscreenGuide] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);

      const handleOnline = () => {
        setIsOnline(true);
        showToast("Koneksi internet kembali stabil!", "success");
      };
      const handleOffline = () => {
        setIsOnline(false);
        showToast("Koneksi terputus! Mode kasir offline aktif.", "error");
      };

      const handleFullscreenChange = () => {
        const isFull = !!(
          document.fullscreenElement ||
          (document as any).webkitFullscreenElement
        );
        setIsFullscreen(isFull);
      };

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      document.addEventListener("fullscreenchange", handleFullscreenChange);
      document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
        document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      };
    }
  }, []);

  const handleToggleFullscreen = async () => {
    try {
      const isIOS =
        typeof navigator !== "undefined" &&
        /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !(window as any).MSStream;

      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        const docEl = document.documentElement as any;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        } else if (isIOS) {
          setShowIosFullscreenGuide(true);
        }
      } else {
        const doc = document as any;
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.log("Fullscreen request notice:", err);
      setShowIosFullscreenGuide(true);
    }
  };

  const handleAddCashExpense = async (amount: number, reason: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cash_movement",
          movementType: "cash_out",
          amount,
          reason,
          createdBy: currentUser.name,
        }),
      });
      if (res.ok) {
        await fetchShiftCashMovements();
        showToast(`Kas keluar ${formatCurrency(amount)} (${reason}) berhasil dicatat.`, "success");
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error adding cash expense:", err);
      return false;
    }
  };

  const handleDeleteCashExpense = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_cash_movement",
          id,
        }),
      });
      if (res.ok) {
        await fetchShiftCashMovements();
        showToast("Catatan pengeluaran kas berhasil dihapus.", "success");
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error deleting cash expense:", err);
      return false;
    }
  };

  // ========================================================
  // PRIORITAS 3: NOTIFIKASI SUARA (AUDIO CHIME) & PINDAH MEJA
  // ========================================================
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(true);
  const knownOrderIdsRef = React.useRef<Set<string>>(new Set());
  const isInitialOrderLoadRef = React.useRef<boolean>(true);

  const [isMoveTableModalOpen, setIsMoveTableModalOpen] = useState<boolean>(false);
  const [moveSourceTable, setMoveSourceTable] = useState<TableCardInfo | null>(null);

  // Load sound setting from localStorage & register one-time audio unlock gesture
  useEffect(() => {
    if (typeof window !== "undefined") {
      setSoundEnabledState(isSoundEnabled());

      const handleUserGesture = () => {
        unlockAudioContext();
        window.removeEventListener("click", handleUserGesture);
        window.removeEventListener("touchstart", handleUserGesture);
      };
      window.addEventListener("click", handleUserGesture, { once: true });
      window.addEventListener("touchstart", handleUserGesture, { once: true });

      return () => {
        window.removeEventListener("click", handleUserGesture);
        window.removeEventListener("touchstart", handleUserGesture);
      };
    }
  }, []);

  // Detect incoming orders and trigger audio chime + toast badge
  useEffect(() => {
    if (!orders || orders.length === 0) return;

    if (isInitialOrderLoadRef.current) {
      knownOrderIdsRef.current = new Set(orders.map((o) => o.id));
      isInitialOrderLoadRef.current = false;
      return;
    }

    const newOrders = orders.filter((o) => !knownOrderIdsRef.current.has(o.id));
    if (newOrders.length > 0) {
      newOrders.forEach((o) => knownOrderIdsRef.current.add(o.id));
      if (soundEnabled) {
        playOrderChime();
      }
      const firstNew = newOrders[0];
      const targetLabel =
        firstNew.channel === "dine_in_qr"
          ? `Meja ${firstNew.tableOrGuest}`
          : firstNew.channel === "online_platform"
            ? `${firstNew.channelLabel} (${firstNew.tableOrGuest})`
            : `Take Away (${firstNew.tableOrGuest})`;
      showToast(
        `🔔 Pesanan Baru Masuk! (${targetLabel}) • ${formatCurrency(firstNew.total)}`,
        "success"
      );
    }
  }, [orders, soundEnabled]);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabledState(next);
    setSoundEnabled(next);
    if (next) {
      playOrderChime();
      showToast("🔔 Notifikasi suara pesanan diaktifkan", "info");
    } else {
      showToast("🔕 Notifikasi suara dinonaktifkan (Mode Bisu)", "info");
    }
  };

  const handleOpenMoveTable = (table: TableCardInfo) => {
    setMoveSourceTable(table);
    setIsMoveTableModalOpen(true);
  };

  const handleConfirmMoveTable = async (
    sourceTableNumber: string,
    targetTableNumber: string,
    notes?: string
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move",
          sourceTableNumber,
          targetTableNumber,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(data.error || "Gagal memindahkan meja", "error");
        return false;
      }

      // Update local state immediately
      setTables((prev) =>
        prev.map((t) => {
          if (t.tableNumber === sourceTableNumber) {
            return {
              ...t,
              status: "tersedia",
              statusLabel: "Tersedia",
              customerName: undefined,
              orderNumber: undefined,
              amount: undefined,
              timeElapsed: undefined,
              isProcessing: false,
              foodStatus: "none",
              foodStatusLabel: undefined,
              orderData: undefined,
            };
          }
          if (t.tableNumber === targetTableNumber) {
            const src = prev.find((x) => x.tableNumber === sourceTableNumber);
            return {
              ...t,
              status: "terisi",
              statusLabel: "Terisi",
              customerName: src?.customerName,
              orderNumber: src?.orderNumber,
              amount: src?.amount,
              timeElapsed: "Baru pindah",
              isProcessing: src?.isProcessing,
              foodStatus: src?.foodStatus,
              foodStatusLabel: src?.foodStatusLabel,
              orderData: src?.orderData,
            };
          }
          return t;
        })
      );

      // Select newly transferred table
      setSelectedTableNumber(targetTableNumber);

      // Play pleasant success tone
      playSuccessChime();

      showToast(
        `Berhasil memindahkan sesi dari ${sourceTableNumber} ke ${targetTableNumber}!`,
        "success"
      );
      return true;
    } catch (err: any) {
      console.error("Error moving table:", err);
      showToast("Terjadi kesalahan koneksi saat memindahkan meja", "error");
      return false;
    }
  };

  // Filter & Pencarian Katalog Produk
  const [catalogProducts, setCatalogProducts] = useState<MasterProduct[]>(DEFAULT_CATALOG_PRODUCTS);
  const [catalogCategory, setCatalogCategory] = useState("all");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedDetailProduct, setSelectedDetailProduct] = useState<MasterProduct | null>(null);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await fetch("/api/menu-items");
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCatalogProducts(data);
        }
      } catch (err) {
        console.log("Using fallback catalog products:", err);
      }
    };
    fetchCatalog();
    const interval = setInterval(fetchCatalog, 6000);
    return () => clearInterval(interval);
  }, []);

  const catalogCategories = useMemo(() => {
    const cats = Array.from(new Set(catalogProducts.map((p) => p.category))).filter(Boolean);
    return [
      { id: "all", label: "Semua Menu" },
      ...cats.map((c) => ({ id: c, label: c })),
    ];
  }, [catalogProducts]);

  const filteredCatalogProducts = catalogProducts.filter((prod) => {
    if (catalogCategory !== "all" && prod.category !== catalogCategory) return false;
    if (catalogSearch.trim()) {
      const q = catalogSearch.toLowerCase();
      return (
        prod.name.toLowerCase().includes(q) ||
        (prod.code && prod.code.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const cartSubtotal = orderCart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const cartNormalSubtotal = orderCart.reduce(
    (sum, item) => sum + (item.isPromo ? 0 : item.price * item.qty),
    0
  );
  const cartPromoSubtotal = orderCart.reduce(
    (sum, item) => sum + (item.isPromo ? item.price * item.qty : 0),
    0
  );

  let takeawayDiscountAmount = 0;
  let takeawayDiscountLabel = "";
  if (takeawayPromo) {
    const isTakeawayPromoEligible =
      (!takeawayPromo.minOrderAmount || cartSubtotal >= takeawayPromo.minOrderAmount) &&
      (!takeawayPromo.customerScope || takeawayPromo.customerScope === "all" ||
        (takeawayPromo.customerScope === "vip" && takeawayCustomer?.tier === "vip") ||
        (takeawayPromo.customerScope === "gold" && (takeawayCustomer?.tier === "gold" || takeawayCustomer?.tier === "vip")) ||
        (takeawayPromo.customerScope === "member" && Boolean(takeawayCustomer)) ||
        (takeawayPromo.customerScope === "personal" && Boolean(takeawayCustomer && (
          (takeawayPromo.assignedCustomerId && takeawayPromo.assignedCustomerId === takeawayCustomer.id) ||
          (takeawayPromo.assignedCustomerName && takeawayPromo.assignedCustomerName.toLowerCase().trim() === takeawayCustomer.name.toLowerCase().trim())
        )))
      );

    if (isTakeawayPromoEligible) {
      // ATURAN MODEL B: Voucher diskon hanya memotong subtotal menu reguler (non-promo)
      const baseForDiscount = cartNormalSubtotal;
      if (takeawayPromo.discountType === "percentage") {
        let calc = Math.round(baseForDiscount * (takeawayPromo.discountValue / 100));
        if (takeawayPromo.maxDiscount) calc = Math.min(calc, takeawayPromo.maxDiscount);
        takeawayDiscountAmount = calc;
      } else {
        takeawayDiscountAmount = Math.min(baseForDiscount, takeawayPromo.discountValue);
      }
      takeawayDiscountLabel = takeawayPromo.name;
    }
  } else if (takeawayCustomDiscount) {
    const baseForDiscount = cartNormalSubtotal > 0 ? cartNormalSubtotal : cartSubtotal;
    if (takeawayCustomDiscount.type === "percentage") {
      takeawayDiscountAmount = Math.round(baseForDiscount * (takeawayCustomDiscount.value / 100));
    } else {
      takeawayDiscountAmount = Math.min(baseForDiscount, takeawayCustomDiscount.value);
    }
    takeawayDiscountLabel =
      takeawayCustomDiscount.reason ||
      `Diskon (${takeawayCustomDiscount.type === "percentage" ? `${takeawayCustomDiscount.value}%` : formatCurrency(takeawayCustomDiscount.value)})`;
  }

  // Auto-lepas promo jika subtotal di bawah batas minimal order
  useEffect(() => {
    if (takeawayPromo && takeawayPromo.minOrderAmount && cartSubtotal > 0 && cartSubtotal < takeawayPromo.minOrderAmount) {
      setTakeawayPromo(null);
      showToast(`Promo ${takeawayPromo.name} dilepas karena subtotal pesanan di bawah minimal belanja.`, "info");
    }
  }, [cartSubtotal, takeawayPromo]);

  const cartDiscountedSubtotal = Math.max(0, cartSubtotal - takeawayDiscountAmount);
  const cartTax = settings.taxEnabled
    ? Math.round(cartDiscountedSubtotal * ((settings.taxRate ?? 0) / 100))
    : 0;
  const cartService = settings.serviceChargeEnabled
    ? Math.round(cartDiscountedSubtotal * ((settings.serviceChargeRate ?? 0) / 100))
    : 0;
  const cartFinalTotal = cartDiscountedSubtotal + cartTax + cartService;

  // Helper Kembalian & Nominal Tunai Bungkus
  const effectiveTakeawayCash = takeawayCashReceived > 0 ? takeawayCashReceived : cartFinalTotal;
  const takeawayKembalian = Math.max(0, effectiveTakeawayCash - cartFinalTotal);

  const handleTakeawayCashInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    const num = raw ? parseInt(raw, 10) : 0;
    setTakeawayCashReceived(num);
    setTakeawayCashInputRaw(raw ? num.toLocaleString("id-ID") : "");
  };

  const getTakeawayQuickCashOptions = (tot: number) => {
    const opts = [{ label: "Uang Pas", value: tot }];
    const next5k = Math.ceil(tot / 5000) * 5000;
    if (next5k > tot) opts.push({ label: `Rp${next5k.toLocaleString("id-ID")}`, value: next5k });
    const next10k = Math.ceil(tot / 10000) * 10000;
    if (next10k > tot && next10k !== next5k) {
      opts.push({ label: `Rp${next10k.toLocaleString("id-ID")}`, value: next10k });
    }
    const next50k = Math.ceil(tot / 50000) * 50000;
    if (next50k > tot && !opts.some((o) => o.value === next50k)) {
      opts.push({ label: `Rp${next50k.toLocaleString("id-ID")}`, value: next50k });
    }
    const next100k = Math.ceil(tot / 100000) * 100000;
    if (next100k > tot && !opts.some((o) => o.value === next100k)) {
      opts.push({ label: `Rp${next100k.toLocaleString("id-ID")}`, value: next100k });
    }
    return opts;
  };

  const handleAddToCart = (
    product: MasterProduct,
    quantity: number = 1,
    selectedAddons?: ProductAddon[],
    note?: string
  ) => {
    if (product.isAvailable === false) {
      showToast(`Menu "${product.name}" sedang STOK HABIS dan tidak dapat dipesan.`, "info");
      return;
    }
    const qtyToAdd = Math.max(1, quantity);
    const addonsPrice = (selectedAddons || []).reduce((s, a) => s + (a.price || 0), 0);

    // Hitung apakah menu ini terkena promo produk aktif
    const promoCalc = calculateProductPromoPrice(product, productPromos);
    const hasPromoPrice = promoCalc.isPromo || (product.promoPrice !== undefined && product.promoPrice < product.price);
    const baseItemPrice = promoCalc.isPromo
      ? promoCalc.effectivePrice
      : (product.promoPrice !== undefined && product.promoPrice < product.price ? product.promoPrice : product.price);
    const effectiveUnitPrice = baseItemPrice + addonsPrice;
    const isPromo = hasPromoPrice;
    const originalPrice = product.price;
    const promoName = promoCalc.promoName || product.promoName || "";

    setOrderCart((prev) => {
      // Check if item with same name AND exact same addons exists
      const addonKey = (addons?: ProductAddon[]) =>
        (addons || [])
          .map((a) => a.id)
          .sort()
          .join(",");

      const existingIdx = prev.findIndex(
        (item) =>
          item.name === product.name &&
          addonKey(item.selectedAddons) === addonKey(selectedAddons) &&
          (item.note || "") === (note || "")
      );

      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          qty: updated[existingIdx].qty + qtyToAdd,
        };
        return updated;
      }

      return [
        ...prev,
        {
          cartItemId: `${product.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          id: product.id,
          name: product.name,
          price: effectiveUnitPrice,
          qty: qtyToAdd,
          note,
          selectedAddons,
          imageUrl: product.imageUrl || product.image,
          originalPrice,
          isPromo,
          promoName,
        },
      ];
    });
  };

  const handleUpdateCartQty = (cartIndex: number, delta: number) => {
    setOrderCart((prev) =>
      prev
        .map((item, idx) => (idx === cartIndex ? { ...item, qty: item.qty + delta } : item))
        .filter((item) => item.qty > 0)
    );
  };

  const handleRemoveFromCart = (cartIndex: number) => {
    setOrderCart((prev) => prev.filter((_, idx) => idx !== cartIndex));
  };

  const handleUpdateCartNote = (cartIndex: number, note: string) => {
    setOrderCart((prev) =>
      prev.map((item, idx) => (idx === cartIndex ? { ...item, note } : item))
    );
  };

  const handleCancelOrderingMode = () => {
    setOrderingMode("table");
    setOrderCart([]);
    setTakeawayCustomerName("");
    setTakeawayNotes("");
    setTakeawayPaymentMethod("cash");
    setTakeawayCashReceived(0);
    setTakeawayCashInputRaw("");
    setTakeawayTransferRef("");
    setTakeawayPromo(null);
    setTakeawayCustomDiscount(null);
    setOjolExternalId("");
    setOjolDriverName("");
    setOjolNotes("");
    setOjolError("");
  };

  // REVISI 1: Pesanan Bungkus transaksi dilakukan LANGSUNG saat proses pemesanan makanan (Lunas di awal)
  const handleSubmitTakeaway = async (
    customMethod?: "cash" | "static_qr" | "bank_transfer",
    customAmountPaid?: number,
    customChange?: number,
    customTransferRef?: string
  ) => {
    if (isSubmittingOrder) return;
    if (orderCart.length === 0) {
      alert("Pilih minimal satu produk dari katalog menu di sebelah kiri!");
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const custName = takeawayCustomerName.trim() || "Pelanggan Take Away";
      const orderNum = `#PN-${Math.floor(1000 + Math.random() * 9000)}`;
      const tkNum = `#TK-0${Math.floor(80 + Math.random() * 20)}`;

      const method = customMethod || (
        takeawayPaymentMethod === "cash"
          ? "cash"
          : takeawayPaymentMethod === "qris"
            ? "static_qr"
            : "bank_transfer"
      );

      const effectiveCash = customAmountPaid !== undefined ? customAmountPaid : (takeawayCashReceived > 0 ? takeawayCashReceived : cartFinalTotal);
      const changeAmount = customChange !== undefined ? customChange : (method === "cash" ? Math.max(0, effectiveCash - cartFinalTotal) : 0);

      let savedOrder: OrderData = {
        id: "ord-" + Date.now(),
        orderNumber: orderNum,
        channel: "takeaway_walk_in",
        channelLabel: "Take Away",
        tableOrGuest: custName,
        guestSubtext: `Antrian ${tkNum}`,
        customerId: takeawayCustomer?.id,
        customerPhone: takeawayCustomer?.phone,
        customerTier: takeawayCustomer?.tier,
        orderTime:
          new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Jakarta",
          }) + " WIB",
        timeAgo: "Baru saja",
        items: orderCart.map((c) => ({
          name: c.name,
          qty: c.qty,
          price: c.price,
          note: c.note,
          selectedAddons: c.selectedAddons,
          isPromo: c.isPromo,
          originalPrice: c.originalPrice,
          promoName: c.promoName,
        })),
        specialNote: takeawayNotes.trim() || undefined,
        subtotal: cartSubtotal,
        discountAmount: takeawayDiscountAmount,
        discountName: takeawayDiscountLabel || undefined,
        promoCode: takeawayPromo?.code || undefined,
        taxAmount: cartTax,
        total: cartFinalTotal,
        kitchenStatus: "new",
        kitchenStatusLabel: "Pesanan Baru",
        paymentStatus: "paid", // LUNAS saat pemesanan!
        paymentStatusLabel:
          method === "cash"
            ? `Lunas (Kembali Rp${changeAmount.toLocaleString("id-ID")})`
            : method === "static_qr"
              ? "Lunas (QRIS)"
              : "Lunas (Transfer)",
        paymentMethod: method,
        paymentNote: method === "cash" ? `Kembali Rp${changeAmount.toLocaleString("id-ID")}` : undefined,
        cashierId: currentUser.id,
        cashierName: currentUser.name,
      };

      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceChannel: "takeaway_walk_in",
            customerId: takeawayCustomer?.id || null,
            customerName: custName,
            items: orderCart.map((c) => ({
              name: c.name,
              quantity: c.qty,
              unitPrice: c.price,
              price: c.price,
              note: c.note,
              selectedAddons: c.selectedAddons,
              isPromo: c.isPromo,
              originalPrice: c.originalPrice,
              promoName: c.promoName,
            })),
            subtotal: cartSubtotal,
            discountAmount: takeawayDiscountAmount,
            discountName: takeawayDiscountLabel || null,
            promoCode: takeawayPromo?.code || null,
            taxAmount: cartTax,
            totalAmount: cartFinalTotal,
            notes: takeawayNotes.trim() || undefined,
            paymentStatus: "paid",
            paymentMethod: method,
            amountPaid: effectiveCash,
          }),
        });
        if (res.ok) {
          const created = await res.json();
          if (created?.id) {
            savedOrder = {
              ...savedOrder,
              id: created.id,
              orderNumber: created.orderNumber || savedOrder.orderNumber,
              guestSubtext: `Antrian #${(created.orderNumber || savedOrder.orderNumber).replace("#PN-", "TK-")}`,
            };
          }
        }
      } catch (err) {
        console.error("Gagal menyimpan pesanan takeaway ke API:", err);
      }

      if (onAddNewOrder) {
        onAddNewOrder(savedOrder, true);
      }

      if (onConfirmDirectPayment && method === "cash") {
        onConfirmDirectPayment(savedOrder.id, method, effectiveCash, changeAmount, savedOrder);
      }

      // Cetak otomatis kwitansi langsung tanpa pratinjau modal
      printReceiptDirectly(savedOrder);

      showToast(`Pesanan Take Away (${custName}) LUNAS ${formatCurrency(cartFinalTotal)} & dikirim ke dapur! Struk tercetak.`, "success");
      handleCancelOrderingMode();
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // REVISI 2: Pesanan Ojol tidak perlu input status bayar (karena pembayaran otomatis via aplikasi pihak ke-3 / Lunas)
  const handleSubmitOjol = async () => {
    if (isSubmittingOrder) return;
    setOjolError("");
    const cleanExtId = ojolExternalId.trim().toUpperCase();
    if (!cleanExtId) {
      setOjolError("ID Pesanan Eksternal (misal: GF-8921) wajib diisi!");
      return;
    }

    if (orderCart.length === 0) {
      setOjolError("Pilih minimal satu produk dari katalog menu di sebelah kiri!");
      return;
    }

    const isDuplicate = orders.some(
      (o) =>
        o.channel === "online_platform" &&
        o.channelLabel.toLowerCase() === ojolPlatform.toLowerCase() &&
        o.tableOrGuest.toUpperCase().includes(cleanExtId)
    );
    if (isDuplicate) {
      setOjolError(`ID Pesanan ${cleanExtId} sudah pernah diinput untuk platform ${ojolPlatform}!`);
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const formattedExtId = cleanExtId.startsWith("#") ? cleanExtId : `#${cleanExtId}`;
      const orderNum = `#PN-${Math.floor(1000 + Math.random() * 9000)}`;

      let savedOrder: OrderData = {
        id: "ord-" + Date.now(),
        orderNumber: orderNum,
        channel: "online_platform",
        channelLabel: ojolPlatform,
        tableOrGuest: formattedExtId,
        guestSubtext: ojolDriverName.trim()
          ? `Dr: ${ojolDriverName.trim()}`
          : `Platform: ${ojolPlatform}`,
        orderTime:
          new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Jakarta",
          }) + " WIB",
        timeAgo: "Baru saja",
        items: orderCart.map((c) => ({
          name: c.name,
          qty: c.qty,
          price: c.price,
          note: c.note,
          selectedAddons: c.selectedAddons,
          isPromo: c.isPromo,
          originalPrice: c.originalPrice,
          promoName: c.promoName,
        })),
        specialNote: ojolNotes.trim() || undefined,
        total: cartFinalTotal,
        kitchenStatus: "new",
        kitchenStatusLabel: "Pesanan Baru",
        paymentStatus: "paid", // Lunas otomatis via platform ojol
        paymentStatusLabel: `Lunas (${ojolPlatform})`,
        paymentMethod: undefined,
        paymentNote: `Pembayaran via Aplikasi ${ojolPlatform}`,
        cashierId: currentUser.id,
        cashierName: currentUser.name,
      };

      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceChannel: "online_platform",
            externalPlatformName: ojolPlatform,
            externalOrderId: formattedExtId,
            customerName: ojolDriverName.trim() || `Pelanggan ${ojolPlatform}`,
            items: orderCart.map((c) => ({
              name: c.name,
              quantity: c.qty,
              unitPrice: c.price,
              price: c.price,
              note: c.note,
              selectedAddons: c.selectedAddons,
              isPromo: c.isPromo,
              originalPrice: c.originalPrice,
              promoName: c.promoName,
            })),
            notes: ojolNotes.trim() || undefined,
            paymentStatus: "paid",
            paymentMethod: "online_app",
          }),
        });
        if (res.ok) {
          const created = await res.json();
          if (created?.id) {
            savedOrder = {
              ...savedOrder,
              id: created.id,
              orderNumber: created.orderNumber || savedOrder.orderNumber,
            };
          }
        }
      } catch (err) {
        console.error("Gagal menyimpan pesanan ojol ke API:", err);
      }

      if (onAddNewOrder) {
        onAddNewOrder(savedOrder, true);
      }

      // Cetak otomatis kwitansi langsung tanpa pratinjau modal
      printReceiptDirectly(savedOrder);

      showToast(`Pesanan ${ojolPlatform} (${formattedExtId}) berhasil dibuat & dikirim ke dapur! Status: LUNAS (${ojolPlatform}).`, "success");
      handleCancelOrderingMode();
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Keyboard shortcut listener untuk F3 (Bungkus), F4 (Ojol), F6 (Riwayat Transaksi), dan Escape (Batal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "F3" && !isInput) {
        e.preventDefault();
        setOrderingMode("takeaway");
        setCatalogCategory("all");
        setCatalogSearch("");
      } else if (e.key === "F4" && !isInput) {
        e.preventDefault();
        setOrderingMode("ojol");
        setCatalogCategory("all");
        setCatalogSearch("");
      } else if (e.key === "F6" && !isInput) {
        e.preventDefault();
        setIsHistoryModalOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        if (isHistoryModalOpen) {
          e.preventDefault();
          setIsHistoryModalOpen(false);
        } else if (orderingMode !== "table") {
          e.preventDefault();
          handleCancelOrderingMode();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [orderingMode, isHistoryModalOpen]);

  // Toast feedback state
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "info" | "error" }>({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (message: string, type: "success" | "info" | "error" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 4000);
  };

  // Modals state
  const [reservationModal, setReservationModal] = useState<{
    isOpen: boolean;
    table: TableCardInfo | null;
  }>({ isOpen: false, table: null });

  const [cancelModal, setCancelModal] = useState<{
    isOpen: boolean;
    table: TableCardInfo | null;
  }>({ isOpen: false, table: null });

  const [reminderModal, setReminderModal] = useState<{
    isOpen: boolean;
    table: TableCardInfo | null;
    minutesLeft: number;
  }>({ isOpen: false, table: null, minutesLeft: 25 });

  // Reservation form fields
  const [resCustomerName, setResCustomerName] = useState("");
  const [resTime, setResTime] = useState("13:00 WIB");
  const [resCustomTime, setResCustomTime] = useState("13:00");
  const [resPax, setResPax] = useState(4);
  const [resPhone, setResPhone] = useState("");
  const [resNotes, setResNotes] = useState("");
  const [resActivateNow, setResActivateNow] = useState(true);

  // Cancel reservation form fields
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNotes, setCancelNotes] = useState("");

  // Floating Compact Payment Pop-Up for Tablet (Clean Screen & Roomy Menu)
  const [paymentPopup, setPaymentPopup] = useState<{
    isOpen: boolean;
    mode: "cash" | "qris" | "transfer";
    step: "input" | "preview";
    source: "table" | "takeaway";
    amountPaid: number;
    transferRef: string;
    isTouched: boolean;
    selectedBankId?: string;
  }>({
    isOpen: false,
    mode: "cash",
    step: "input",
    source: "table",
    amountPaid: 0,
    transferRef: "",
    isTouched: false,
    selectedBankId: "",
  });

  const getPopupQuickCashOptions = (total: number) => {
    const opts: { label: string; value: number }[] = [];
    opts.push({ label: `Pas (${formatCurrency(total)})`, value: total });

    const round50 = Math.ceil(total / 50000) * 50000;
    if (round50 > total) {
      opts.push({ label: formatCurrency(round50), value: round50 });
    }

    const round100 = Math.ceil(total / 100000) * 100000;
    if (round100 > total && round100 !== round50) {
      opts.push({ label: formatCurrency(round100), value: round100 });
    }

    [100000, 150000, 200000, 300000, 500000].forEach((bill) => {
      if (bill >= total && !opts.some((o) => o.value === bill) && opts.length < 4) {
        opts.push({ label: formatCurrency(bill), value: bill });
      }
    });

    return opts;
  };

  const openPaymentPopup = (mode: "cash" | "qris" | "transfer", source: "table" | "takeaway") => {
    const totalToPay = source === "table" ? finalTotal : cartFinalTotal;
    const defaultBank = (settings.bankAccounts || []).find((b) => b.isDefault && b.isActive !== false) ||
                        (settings.bankAccounts || []).find((b) => b.isActive !== false);
    setPaymentPopup({
      isOpen: true,
      mode,
      step: "input",
      source,
      amountPaid: totalToPay,
      transferRef: "",
      isTouched: false,
      selectedBankId: defaultBank?.id || "",
    });
  };

  const handlePopupNumpadDigit = (digit: string) => {
    setPaymentPopup((prev) => {
      if (!prev.isTouched || prev.amountPaid === 0) {
        return { ...prev, amountPaid: parseInt(digit, 10) || 0, isTouched: true };
      }
      const currentStr = prev.amountPaid.toString();
      if (currentStr.length >= 10) return prev;
      const newNum = parseInt(currentStr + digit, 10) || 0;
      return { ...prev, amountPaid: newNum, isTouched: true };
    });
  };

  const handlePopupNumpadTripleZero = () => {
    setPaymentPopup((prev) => {
      if (!prev.isTouched || prev.amountPaid === 0) return prev;
      const currentStr = prev.amountPaid.toString();
      if (currentStr.length >= 8) return prev;
      const newNum = parseInt(currentStr + "000", 10) || 0;
      return { ...prev, amountPaid: newNum, isTouched: true };
    });
  };

  const handlePopupNumpadBackspace = () => {
    setPaymentPopup((prev) => {
      const currentStr = prev.amountPaid.toString();
      if (currentStr.length <= 1) {
        return { ...prev, amountPaid: 0, isTouched: true };
      }
      const newNum = parseInt(currentStr.slice(0, -1), 10) || 0;
      return { ...prev, amountPaid: newNum, isTouched: true };
    });
  };

  const handlePopupNumpadClear = () => {
    setPaymentPopup((prev) => ({ ...prev, amountPaid: 0, isTouched: true }));
  };

  const handlePopupQuickAdd = (addVal: number) => {
    setPaymentPopup((prev) => ({
      ...prev,
      amountPaid: prev.amountPaid + addVal,
      isTouched: true,
    }));
  };

  const handlePopupQuickExact = () => {
    const totalToPay = paymentPopup.source === "table" ? finalTotal : cartFinalTotal;
    setPaymentPopup((prev) => ({ ...prev, amountPaid: totalToPay, isTouched: true }));
  };

  const handlePopupRound50k = () => {
    const totalToPay = paymentPopup.source === "table" ? finalTotal : cartFinalTotal;
    let rounded = Math.ceil(totalToPay / 50000) * 50000;
    if (rounded === totalToPay) rounded += 50000;
    setPaymentPopup((prev) => ({ ...prev, amountPaid: rounded, isTouched: true }));
  };

  const handlePopupGoToPreview = () => {
    const totalToPay = paymentPopup.source === "table" ? finalTotal : cartFinalTotal;
    if (paymentPopup.mode === "cash" && paymentPopup.amountPaid < totalToPay) {
      showToast("Nominal uang tunai kurang dari total tagihan!", "error");
      return;
    }
    setPaymentPopup((prev) => ({ ...prev, step: "preview" }));
  };

  const handlePopupFinalConfirmAndPrint = () => {
    if (isSubmittingOrder) return;
    const totalToPay = paymentPopup.source === "table" ? finalTotal : cartFinalTotal;
    if (paymentPopup.mode === "cash" && paymentPopup.amountPaid < totalToPay) {
      showToast("Nominal uang tunai kurang dari total tagihan!", "error");
      return;
    }
    const method = paymentPopup.mode === "cash" ? "cash" : paymentPopup.mode === "qris" ? "static_qr" : "bank_transfer";
    const amountPaid = paymentPopup.mode === "cash" ? paymentPopup.amountPaid : totalToPay;
    const change = paymentPopup.mode === "cash" ? Math.max(0, paymentPopup.amountPaid - totalToPay) : 0;

    const activeBankAccounts = (settings.bankAccounts || []).filter((b) => b.isActive !== false);
    const selectedBank = activeBankAccounts.find((b) => b.id === paymentPopup.selectedBankId) || activeBankAccounts[0];
    const finalTransferRef = paymentPopup.mode === "transfer"
      ? (selectedBank ? `[${selectedBank.bankName}] ${paymentPopup.transferRef || ""}`.trim() : paymentPopup.transferRef)
      : paymentPopup.transferRef;

    if (paymentPopup.source === "table") {
      handleConfirmDirectCheckout(method, amountPaid, change, finalTransferRef);
    } else {
      handleSubmitTakeaway(method, amountPaid, change, finalTransferRef);
    }

    setPaymentPopup((prev) => ({ ...prev, isOpen: false }));
  };

  // Direct Inline Payment States (No Popup Modal!)
  const [inlinePaymentMethod, setInlinePaymentMethod] = useState<"cash" | "qris" | "transfer">("cash");
  const [cashReceived, setCashReceived] = useState<number>(300000);
  const [cashInputRaw, setCashInputRaw] = useState<string>("300.000");
  const [showInlineNumpad, setShowInlineNumpad] = useState<boolean>(true);
  const [transferRef, setTransferRef] = useState<string>("");
  const [isQrisModalOpen, setIsQrisModalOpen] = useState(false);
  const [justPaidTable, setJustPaidTable] = useState<{
    tableNumber: string;
    orderNumber: string;
    total: number;
    change: number;
  } | null>(null);

  // Inline Numpad Handlers for Tablet Touchscreen
  const handleInlineNumpadDigit = (digit: string) => {
    const currentStr = cashReceived > 0 ? cashReceived.toString() : "";
    if (currentStr.length >= 10) return;
    const newNum = parseInt(currentStr + digit, 10) || 0;
    setCashReceived(newNum);
    setCashInputRaw(newNum.toLocaleString("id-ID"));
  };

  const handleInlineNumpadTripleZero = () => {
    if (cashReceived === 0) return;
    const currentStr = cashReceived.toString();
    if (currentStr.length >= 8) return;
    const newNum = parseInt(currentStr + "000", 10) || 0;
    setCashReceived(newNum);
    setCashInputRaw(newNum.toLocaleString("id-ID"));
  };

  const handleInlineNumpadBackspace = () => {
    const currentStr = cashReceived.toString();
    if (currentStr.length <= 1) {
      setCashReceived(0);
      setCashInputRaw("0");
    } else {
      const newNum = parseInt(currentStr.slice(0, -1), 10) || 0;
      setCashReceived(newNum);
      setCashInputRaw(newNum.toLocaleString("id-ID"));
    }
  };

  const handleInlineNumpadClear = () => {
    setCashReceived(0);
    setCashInputRaw("0");
  };

  const handleInlineQuickAdd = (addVal: number) => {
    const newNum = cashReceived + addVal;
    setCashReceived(newNum);
    setCashInputRaw(newNum.toLocaleString("id-ID"));
  };

  // Default local orders mapped to tables (initially empty, populated strictly by SQLite database)
  const defaultTableOrders: Record<string, OrderData> = {};

  // Base list of 20 dining tables strictly adhering to 3 statuses:
  // "tersedia" | "reservasi" | "terisi"
  // Cooking/dimasak is represented as `isProcessing: true` with badge "Proses"
  // Base list of 20 dining tables strictly adhering to 3 statuses:
  // "tersedia" | "reservasi" | "terisi"
  const initialTablesList: TableCardInfo[] = [
    { id: "tbl-01", tableNumber: "Meja 01", displayName: "Meja 01", area: "indoor", areaLabel: "Area Indoor AC", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
    { id: "tbl-02", tableNumber: "Meja 02", displayName: "Meja 02", area: "indoor", areaLabel: "Area Indoor AC", capacity: 2, status: "tersedia", statusLabel: "Tersedia" },
    { id: "tbl-03", tableNumber: "Meja 03", displayName: "Meja 03", area: "indoor", areaLabel: "Area Indoor AC", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
    { id: "tbl-04", tableNumber: "Meja 04", displayName: "Meja 04", area: "indoor", areaLabel: "Area Indoor AC", capacity: 2, status: "tersedia", statusLabel: "Tersedia" },
    { id: "tbl-05", tableNumber: "Meja 05", displayName: "Meja 05", area: "indoor", areaLabel: "Booth Sofa Utama", capacity: 6, status: "tersedia", statusLabel: "Tersedia" },
    { id: "tbl-06", tableNumber: "Meja 06", displayName: "Meja 06", area: "indoor", areaLabel: "Area Indoor AC", capacity: 3, status: "tersedia", statusLabel: "Tersedia" },
    { id: "tbl-07", tableNumber: "Meja 07", displayName: "Meja 07", area: "indoor", areaLabel: "Area Indoor AC", capacity: 5, status: "tersedia", statusLabel: "Tersedia" },
    { id: "tbl-08", tableNumber: "Meja 08", displayName: "Meja 08", area: "indoor", areaLabel: "Area Indoor AC", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
    { id: "tbl-09", tableNumber: "Meja 09", displayName: "Meja 09", area: "indoor", areaLabel: "Area Indoor AC", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
    { id: "tbl-10", tableNumber: "Meja 10", displayName: "Meja 10", area: "outdoor", areaLabel: "Outdoor Garden", capacity: 2, status: "tersedia", statusLabel: "Tersedia" },
    { id: "tbl-11", tableNumber: "Meja 11", displayName: "Meja 11", area: "outdoor", areaLabel: "Outdoor Smoking Garden", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
    { id: "tbl-12", tableNumber: "Meja 12", displayName: "Meja 12", area: "indoor", areaLabel: "Indoor VIP Lounge", capacity: 6, status: "tersedia", statusLabel: "Tersedia" },
    { id: "tbl-13", tableNumber: "Meja 13", displayName: "Meja 13", area: "outdoor", areaLabel: "Outdoor Smoking Garden", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
    { id: "tbl-14", tableNumber: "Meja 14", displayName: "Meja 14", area: "outdoor", areaLabel: "Outdoor Garden", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
    { id: "tbl-15", tableNumber: "Meja 15", displayName: "Meja 15", area: "outdoor", areaLabel: "Outdoor Garden", capacity: 2, status: "tersedia", statusLabel: "Tersedia" },
    { id: "tbl-16", tableNumber: "Meja 16", displayName: "Meja 16", area: "outdoor", areaLabel: "Outdoor Gazebo", capacity: 6, status: "tersedia", statusLabel: "Tersedia" },
    { id: "tbl-17", tableNumber: "Meja 17", displayName: "Meja 17", area: "indoor", areaLabel: "Area Indoor AC", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
    { id: "tbl-18", tableNumber: "Meja 18", displayName: "Meja 18", area: "indoor", areaLabel: "Area Indoor AC", capacity: 2, status: "tersedia", statusLabel: "Tersedia" },
    { id: "tbl-19", tableNumber: "Meja 19", displayName: "Meja 19", area: "outdoor", areaLabel: "Outdoor Garden", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
    { id: "tbl-20", tableNumber: "Meja 20", displayName: "Meja 20", area: "outdoor", areaLabel: "Outdoor VIP Gazebo", capacity: 6, status: "tersedia", statusLabel: "Tersedia" },
  ];

  // Helper sinkronisasi perubahan meja ke SQLite database
  const updateTableInDb = async (
    tableNumber: string,
    updateData: {
      status?: TableStatus;
      statusLabel?: string;
      customerName?: string | null;
      reservationTime?: string | null;
      reservationNotes?: string | null;
      orderNumber?: string | null;
      capacity?: number;
      amount?: number | null;
      timeElapsed?: string | null;
      isProcessing?: boolean;
      foodStatus?: string | null;
      foodStatusLabel?: string | null;
    }
  ) => {
    try {
      await fetch("/api/tables", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber,
          ...updateData,
        }),
      });
    } catch (err) {
      console.error(`Gagal sinkronisasi meja ${tableNumber} ke SQLite:`, err);
    }
  };

  // Dynamic tables state
  const [tables, setTables] = useState<TableCardInfo[]>(initialTablesList);
  const [localTableOrders, setLocalTableOrders] = useState<Record<string, OrderData>>(defaultTableOrders);
  const ordersRef = React.useRef<OrderData[]>(orders);
  ordersRef.current = orders;
  const dbTablesRef = React.useRef<any[]>([]);

  // Pure sync helper: merges SQLite database tables with active UNPAID orders without race conditions
  const syncTables = (
    baseTables: TableCardInfo[],
    dbTables: any[],
    currentOrders: OrderData[]
  ): TableCardInfo[] => {
    return baseTables.map((t) => {
      const matched = dbTables.find(
        (d: any) =>
          d.tableNumber?.toLowerCase() === t.tableNumber?.toLowerCase() ||
          (t.displayName && d.displayName?.toLowerCase() === t.displayName?.toLowerCase())
      );

      // ONLY match active UNPAID orders! Historical paid orders must NOT clear or match active tables!
      const activeUnpaidOrder = currentOrders.find(
        (o) =>
          (o.tableOrGuest?.toLowerCase() === t.tableNumber.toLowerCase() ||
            (t.displayName && o.tableOrGuest?.toLowerCase() === t.displayName.toLowerCase()) ||
            (t.tableNumber && o.tableOrGuest && o.tableOrGuest.toLowerCase().includes(t.tableNumber.toLowerCase()))) &&
          o.channel === "dine_in_qr" &&
          o.paymentStatus !== "paid"
      );

      if (activeUnpaidOrder) {
        let foodStatus: "in_progress" | "ready" | "served" | "none" = "none";
        let foodStatusLabel = "";
        let isProcessing = false;

        if (activeUnpaidOrder.kitchenStatus === "ready") {
          foodStatus = "ready";
          foodStatusLabel = "🔔 SIAP SAJI - Siap Diantar!";
          isProcessing = false;
        } else if (activeUnpaidOrder.kitchenStatus === "in_progress") {
          foodStatus = "in_progress";
          foodStatusLabel = "Sedang Dimasak di Dapur";
          isProcessing = true;
        } else if (activeUnpaidOrder.kitchenStatus === "new") {
          foodStatus = "in_progress";
          foodStatusLabel = "Pesanan Baru Masuk ke Dapur";
          isProcessing = true;
        } else if (activeUnpaidOrder.kitchenStatus === "completed" || activeUnpaidOrder.kitchenStatus === "served") {
          foodStatus = "served";
          foodStatusLabel = "Semua Makanan Sudah Disajikan";
          isProcessing = false;
        }

        return {
          ...t,
          status: "terisi",
          statusLabel: "Terisi",
          customerName: activeUnpaidOrder.guestSubtext || matched?.customerName || t.customerName || "Pelanggan QR",
          orderNumber: activeUnpaidOrder.orderNumber,
          amount: activeUnpaidOrder.total,
          timeElapsed: activeUnpaidOrder.timeAgo || t.timeElapsed || "Baru saja",
          isProcessing,
          foodStatus,
          foodStatusLabel,
          orderData: activeUnpaidOrder,
        };
      }

      // If no active unpaid order from live props, rely on matched DB table status
      if (matched) {
        const dbStatus = (matched.status as TableStatus) || "tersedia";
        if (dbStatus === "tersedia") {
          return {
            ...t,
            status: "tersedia",
            statusLabel: "Tersedia",
            customerName: undefined,
            reservationTime: undefined,
            reservationNotes: undefined,
            orderNumber: undefined,
            amount: undefined,
            timeElapsed: undefined,
            isProcessing: false,
            foodStatus: "none",
            foodStatusLabel: undefined,
            orderData: undefined,
          };
        }

        if (dbStatus === "reservasi") {
          return {
            ...t,
            status: "reservasi",
            statusLabel: "Reservasi",
            customerName: matched.customerName || t.customerName || "Tamu Reservasi",
            reservationTime: matched.reservationTime || t.reservationTime || undefined,
            reservationNotes: matched.reservationNotes || t.reservationNotes || undefined,
            orderNumber: undefined,
            amount: undefined,
            timeElapsed: undefined,
            isProcessing: false,
            foodStatus: "none",
            foodStatusLabel: undefined,
            orderData: undefined,
          };
        }

        // dbStatus === "terisi" but no live order from props
        const localOrder = localTableOrders[t.tableNumber];
        const hasUnpaidLocal = localOrder && localOrder.paymentStatus !== "paid";
        const fallbackOrder = hasUnpaidLocal ? localOrder : (matched.amount ? null : defaultTableOrders[t.tableNumber]);

        return {
          ...t,
          status: "terisi",
          statusLabel: "Terisi",
          customerName: matched.customerName || fallbackOrder?.guestSubtext || t.customerName,
          orderNumber: matched.orderNumber || fallbackOrder?.orderNumber || t.orderNumber,
          amount: matched.amount || fallbackOrder?.total || t.amount,
          timeElapsed: matched.timeElapsed || fallbackOrder?.timeAgo || t.timeElapsed || "30 mnt",
          isProcessing: matched.isProcessing ?? (fallbackOrder?.kitchenStatus === "in_progress"),
          foodStatus: (matched.foodStatus as any) || t.foodStatus || "none",
          foodStatusLabel: matched.foodStatusLabel || t.foodStatusLabel,
          orderData: (hasUnpaidLocal ? localOrder : t.orderData || fallbackOrder) || undefined,
        };
      }

      return t;
    });
  };

  // Live polling for SQLite tables
  useEffect(() => {
    const fetchTablesFromSqlite = async () => {
      try {
        const res = await fetch("/api/tables");
        const dbTables = await res.json();
        if (Array.isArray(dbTables) && dbTables.length > 0) {
          dbTablesRef.current = dbTables;
          setTables((prev) => syncTables(prev, dbTables, ordersRef.current));
        }
      } catch (err) {
        console.error("Gagal mengambil data meja dari SQLite:", err);
      }
    };

    fetchTablesFromSqlite();
    const interval = setInterval(fetchTablesFromSqlite, 4000);
    return () => clearInterval(interval);
  }, []);

  // Synchronize when orders change from parent component
  useEffect(() => {
    ordersRef.current = orders;
    if (dbTablesRef.current.length > 0) {
      setTables((prev) => syncTables(prev, dbTablesRef.current, orders));
    }
  }, [orders]);

  const [hasShownReminder, setHasShownReminder] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("reminder_dismissed_Meja 07") === "true";
    }
    return false;
  });

  // Initial trigger for 30-minute reminder for Meja 07 (only once if Meja 07 is actually reservasi and not dismissed)
  useEffect(() => {
    const isDismissed =
      typeof window !== "undefined" && sessionStorage.getItem("reminder_dismissed_Meja 07") === "true";
    if (!hasShownReminder && !isDismissed) {
      const table07 = tables.find((t) => t.tableNumber === "Meja 07" && t.status === "reservasi");
      if (table07) {
        const timer = setTimeout(() => {
          setReminderModal({
            isOpen: true,
            table: table07,
            minutesLeft: 25,
          });
          setHasShownReminder(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [hasShownReminder, tables]);

  // REVISI 4 & 5: Helper Cek Keterlambatan Reservasi (> 15 Menit -> No-Show)
  const getReservationDelayInfo = (t: TableCardInfo) => {
    if (t.status !== "reservasi" || !t.reservationTime) {
      return { isLate: false, isOver15Min: false, diffMinutes: 0 };
    }

    let diffMinutes = 0;
    if (t.reservationTimestamp) {
      diffMinutes = Math.floor((Date.now() - t.reservationTimestamp) / 60000);
    } else {
      const match = t.reservationTime.match(/(\d{1,2})[:.](\d{2})/);
      if (match) {
        const resH = parseInt(match[1], 10);
        const resM = parseInt(match[2], 10);
        const now = new Date();
        const curTotalMin = now.getHours() * 60 + now.getMinutes();
        const resTotalMin = resH * 60 + resM;
        diffMinutes = curTotalMin - resTotalMin;
      }
    }

    return {
      isLate: diffMinutes > 0,
      isOver15Min: diffMinutes > 15,
      diffMinutes,
    };
  };

  // REVISI 4 & 5: Pemeriksaan otomatis toleransi kehadiran reservasi
  // Apabila customer tidak datang dalam waktu 15 menit setelah waktu yang dipesan,
  // secara otomatis reservasi BATAL dengan keterangan No-Show dan meja kembali dalam status TERSEDIA.
  useEffect(() => {
    const autoCancelInterval = setInterval(() => {
      setTables((prevTables) => {
        let hasChanges = false;
        const updated = prevTables.map((t) => {
          if (t.status === "reservasi") {
            const { isOver15Min, diffMinutes } = getReservationDelayInfo(t);
            if (isOver15Min) {
              hasChanges = true;
              if (typeof window !== "undefined") {
                sessionStorage.setItem(`reminder_dismissed_${t.tableNumber}`, "true");
              }
              updateTableInDb(t.tableNumber, {
                status: "tersedia",
                statusLabel: "Tersedia",
                customerName: null,
                reservationTime: null,
                reservationNotes: `No-Show (>15 mnt / telat ${diffMinutes} mnt)`,
                orderNumber: null,
                amount: null,
              });
              showToast(
                `Reservasi ${t.tableNumber} (${t.customerName || "Tamu"}) otomatis BATAL: No-Show (pelanggan tidak datang melebihi 15 menit / telat ${diffMinutes} mnt). Meja kembali TERSEDIA.`,
                "info"
              );
              return {
                ...t,
                status: "tersedia" as TableStatus,
                statusLabel: "Tersedia",
                customerName: undefined,
                reservationTime: undefined,
                reservationTimestamp: undefined,
                orderData: undefined,
                amount: undefined,
              };
            }
          }
          return t;
        });

        return hasChanges ? updated : prevTables;
      });
    }, 5000);

    return () => clearInterval(autoCancelInterval);
  }, []);

  // Handler: Pembatalan langsung No-Show (manual oleh kasir atau dari pengingat)
  const handleCancelReservationNoShow = (table: TableCardInfo) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`reminder_dismissed_${table.tableNumber}`, "true");
    }
    setHasShownReminder(true);
    setTables((prev) =>
      prev.map((t) =>
        t.tableNumber === table.tableNumber
          ? {
            ...t,
            status: "tersedia" as TableStatus,
            statusLabel: "Tersedia",
            customerName: undefined,
            reservationTime: undefined,
            reservationTimestamp: undefined,
            orderData: undefined,
            amount: undefined,
          }
          : t
      )
    );
    // Persist ke database SQLite
    updateTableInDb(table.tableNumber, {
      status: "tersedia",
      statusLabel: "Tersedia",
      customerName: null,
      reservationTime: null,
      reservationNotes: "No-Show (pelanggan tidak datang melebihi 15 menit)",
      orderNumber: null,
      amount: null,
    });
    setReminderModal({ isOpen: false, table: null, minutesLeft: 0 });
    setCancelModal({ isOpen: false, table: null });
    showToast(
      `Reservasi ${table.tableNumber} dibatalkan: No-Show (pelanggan tidak datang melebihi 15 menit). Meja kembali TERSEDIA dan tersimpan di database SQLite.`,
      "info"
    );
  };

  // Takeaway and Ojol lists for cashier queue
  const takeawayOrders = orders.filter((o) => o.channel === "takeaway_walk_in");
  const ojolOrders = orders.filter((o) => o.channel === "online_platform");

  // Determine active selected order for right sheet
  const selectedTableInfo = tables.find((t) => t.tableNumber === selectedTableNumber);

  // Prioritize real active order from props/database over stale static defaults
  const liveOrderFromOrders =
    orders.find(
      (o) =>
        ((selectedTableInfo?.orderNumber && (o.orderNumber === selectedTableInfo.orderNumber || o.id === selectedTableInfo.orderNumber)) ||
          o.tableOrGuest?.toLowerCase() === selectedTableNumber.toLowerCase() ||
          (selectedTableInfo?.displayName && o.tableOrGuest?.toLowerCase() === selectedTableInfo.displayName.toLowerCase()) ||
          (selectedTableNumber && o.tableOrGuest && o.tableOrGuest.toLowerCase().includes(selectedTableNumber.toLowerCase()))) &&
        o.paymentStatus !== "paid"
    ) ||
    (selectedTableInfo?.status === "terisi" && selectedTableInfo?.orderNumber
      ? orders.find(
        (o) =>
          o.orderNumber === selectedTableInfo.orderNumber ||
          o.id === selectedTableInfo.orderNumber
      )
      : undefined) ||
    (selectedTableInfo?.status === "terisi"
      ? orders.find(
        (o) =>
          o.tableOrGuest?.toLowerCase() === selectedTableNumber.toLowerCase() ||
          (selectedTableInfo?.displayName && o.tableOrGuest?.toLowerCase() === selectedTableInfo.displayName.toLowerCase())
      )
      : undefined);

  // Jika meja berstatus terisi dan memiliki nominal tetapi order belum ditemukan di orders, buatkan fallback order yang akurat
  const syntheticTableOrder: OrderData | null =
    selectedTableInfo?.status === "terisi" && (selectedTableInfo.amount || 0) > 0
      ? {
        id: `tbl-ord-${selectedTableNumber}-${selectedTableInfo.orderNumber || "curr"}`,
        orderNumber: selectedTableInfo.orderNumber || `#PN-${selectedTableNumber.replace(/\D/g, "") || "00"}`,
        channel: "dine_in_qr",
        channelLabel: "Dine-in",
        tableOrGuest: selectedTableNumber,
        guestSubtext: selectedTableInfo.customerName || "Tamu Meja",
        orderTime: selectedTableInfo.timeElapsed ? `${selectedTableInfo.timeElapsed} lalu` : "Hari ini",
        timeAgo: selectedTableInfo.timeElapsed || "Aktif",
        items: [
          {
            name: `Pesanan ${selectedTableNumber} (${selectedTableInfo.customerName || "Tamu"})`,
            qty: 1,
            price: selectedTableInfo.amount || 0,
          },
        ],
        total: selectedTableInfo.amount || 0,
        kitchenStatus: (selectedTableInfo.foodStatus as KitchenStatus) || "served",
        kitchenStatusLabel: selectedTableInfo.foodStatusLabel || "Selesai Disajikan",
        paymentStatus: "unpaid",
        paymentStatusLabel: "Belum Bayar",
      }
      : null;

  const activeOrder: OrderData | null =
    selectedTableInfo?.status === "tersedia" || selectedTableInfo?.status === "reservasi"
      ? null
      : liveOrderFromOrders ||
      selectedTableInfo?.orderData ||
      (localTableOrders[selectedTableNumber]?.paymentStatus !== "paid" ? localTableOrders[selectedTableNumber] : null) ||
      syntheticTableOrder ||
      null;

  // Sinkronisasi otomatis pelanggan terdaftar pada meja terpilih
  useEffect(() => {
    const custName = selectedTableInfo?.customerName || activeOrder?.guestSubtext;
    if (custName && availableCustomers.length > 0) {
      const matched = availableCustomers.find(
        (c) =>
          c.name.toLowerCase() === custName.toLowerCase() ||
          (activeOrder?.customerId && c.id === activeOrder.customerId) ||
          (activeOrder?.customerPhone && c.phone === activeOrder.customerPhone)
      );
      setSelectedTableCustomer(matched || null);
    } else {
      setSelectedTableCustomer(null);
    }
  }, [selectedTableNumber, selectedTableInfo?.customerName, activeOrder?.customerId, availableCustomers]);

  // Financial calculations for right order sheet
  const subtotal = activeOrder
    ? activeOrder.items.reduce((sum, item) => sum + item.price * item.qty, 0)
    : (selectedTableInfo?.amount || 0);

  const dineInItems = activeOrder?.items || [];
  const dineInNormalSubtotal = dineInItems.reduce(
    (sum, item) => sum + (item.isPromo ? 0 : item.price * item.qty),
    0
  );
  const dineInPromoSubtotal = dineInItems.reduce(
    (sum, item) => sum + (item.isPromo ? item.price * item.qty : 0),
    0
  );

  let discountAmount = 0;
  let discountLabel = "";
  if (tablePromo) {
    const isTablePromoEligible =
      (!tablePromo.minOrderAmount || subtotal >= tablePromo.minOrderAmount) &&
      (!tablePromo.customerScope || tablePromo.customerScope === "all" ||
        (tablePromo.customerScope === "vip" && selectedTableCustomer?.tier === "vip") ||
        (tablePromo.customerScope === "gold" && (selectedTableCustomer?.tier === "gold" || selectedTableCustomer?.tier === "vip")) ||
        (tablePromo.customerScope === "member" && Boolean(selectedTableCustomer)) ||
        (tablePromo.customerScope === "personal" && Boolean(selectedTableCustomer && (
          (tablePromo.assignedCustomerId && tablePromo.assignedCustomerId === selectedTableCustomer.id) ||
          (tablePromo.assignedCustomerName && tablePromo.assignedCustomerName.toLowerCase().trim() === selectedTableCustomer.name.toLowerCase().trim())
        )))
      );

    if (isTablePromoEligible) {
      // MODEL B: Voucher diskon hanya memotong menu reguler (non-promo)
      const baseForDiscount = dineInItems.length > 0 && dineInPromoSubtotal > 0 ? dineInNormalSubtotal : subtotal;
      if (tablePromo.discountType === "percentage") {
        let calc = Math.round(baseForDiscount * (tablePromo.discountValue / 100));
        if (tablePromo.maxDiscount) calc = Math.min(calc, tablePromo.maxDiscount);
        discountAmount = calc;
      } else {
        discountAmount = Math.min(baseForDiscount, tablePromo.discountValue);
      }
      discountLabel = tablePromo.name;
    }
  } else if (tableCustomDiscount) {
    const baseForDiscount = dineInItems.length > 0 && dineInPromoSubtotal > 0 ? dineInNormalSubtotal : subtotal;
    if (tableCustomDiscount.type === "percentage") {
      discountAmount = Math.round(baseForDiscount * (tableCustomDiscount.value / 100));
    } else {
      discountAmount = Math.min(baseForDiscount, tableCustomDiscount.value);
    }
    discountLabel =
      tableCustomDiscount.reason ||
      `Diskon (${tableCustomDiscount.type === "percentage" ? `${tableCustomDiscount.value}%` : formatCurrency(tableCustomDiscount.value)})`;
  } else if (activeOrder?.discountAmount) {
    discountAmount = activeOrder.discountAmount;
    discountLabel = activeOrder.discountName || "Diskon";
  }

  // Auto-lepas table promo jika subtotal meja di bawah batas minimal order
  useEffect(() => {
    if (tablePromo && tablePromo.minOrderAmount && subtotal > 0 && subtotal < tablePromo.minOrderAmount) {
      setTablePromo(null);
      showToast(`Promo ${tablePromo.name} dilepas karena subtotal meja di bawah minimal belanja.`, "info");
    }
  }, [subtotal, tablePromo]);

  const taxRate = settings.taxEnabled ? (settings.taxRate ?? 0) : 0;
  const serviceRate = settings.serviceChargeEnabled ? (settings.serviceChargeRate ?? 0) : 0;
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const taxPB1 = Math.round(discountedSubtotal * (taxRate / 100));
  const serviceCharge = Math.round(discountedSubtotal * (serviceRate / 100));
  const rawTotal = discountedSubtotal + taxPB1 + serviceCharge;
  const finalTotal = subtotal > 0 ? rawTotal : (activeOrder ? activeOrder.total : (selectedTableInfo?.amount || 0));
  const roundingDiff = 0;
  const kembalian = Math.max(0, cashReceived - finalTotal);

  // ========================================================
  // SUGESTI & REKOMENDASI PROMO KHUSUS MEMBER / PELANGGAN
  // ========================================================
  const matchedTakeawayCustomers = useMemo(() => {
    if (takeawayCustomer) return [];
    if (!takeawayCustomerName || takeawayCustomerName.trim().length < 2) return [];
    const q = takeawayCustomerName.toLowerCase().trim();
    const cleanDigits = q.replace(/\D/g, "");

    return availableCustomers.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(q);
      const phoneMatch = cleanDigits.length >= 3 && Boolean(c.phone && c.phone.replace(/\D/g, "").includes(cleanDigits));
      return nameMatch || phoneMatch;
    }).slice(0, 3);
  }, [takeawayCustomer, takeawayCustomerName, availableCustomers]);

  const matchedTakeawayCustomer = matchedTakeawayCustomers.length > 0 ? matchedTakeawayCustomers[0] : null;

  // Active customer hanya berlaku jika pelanggan sudah dipilih / dihubungkan
  const activeTakeawayCustomer = takeawayCustomer;

  const takeawayMemberPromos = useMemo(() => {
    return getMemberPromos(activeTakeawayCustomer, "takeaway", availablePromos, cartSubtotal);
  }, [activeTakeawayCustomer, availablePromos, cartSubtotal]);

  const dineInMemberPromos = useMemo(() => {
    return getMemberPromos(selectedTableCustomer, "dine_in", availablePromos, subtotal);
  }, [selectedTableCustomer, availablePromos, subtotal]);

  const handleApplySuggestedPromo = (promo: PromoDiscount, target: "table" | "takeaway") => {
    const currentSubtotal = target === "table" ? subtotal : cartSubtotal;
    let pot = 0;
    if (promo.discountType === "percentage") {
      pot = Math.round(currentSubtotal * (promo.discountValue / 100));
      if (promo.maxDiscount) pot = Math.min(pot, promo.maxDiscount);
    } else {
      pot = Math.min(currentSubtotal, promo.discountValue);
    }

    if (target === "table") {
      setTablePromo(promo);
      setTableCustomDiscount(null);
    } else {
      if (!takeawayCustomer && matchedTakeawayCustomer) {
        setTakeawayCustomer(matchedTakeawayCustomer);
        setTakeawayCustomerName(matchedTakeawayCustomer.name);
      }
      setTakeawayPromo(promo);
      setTakeawayCustomDiscount(null);
    }

    const custName = target === "table" ? selectedTableCustomer?.name : (takeawayCustomer?.name || matchedTakeawayCustomer?.name);
    showToast(
      `Promo ${promo.code} berhasil diterapkan${custName ? ` untuk ${custName}` : ""}! Hemat ${formatCurrency(pot)}.`,
      "success"
    );
  };

  // Sync cash input when selected table changes
  useEffect(() => {
    const cur = activeOrder || syntheticTableOrder;
    const tot = cur ? cur.total : (selectedTableInfo?.amount || 0);
    const defaultCash = tot > 0
      ? (Math.ceil(tot / 50000) * 50000 === tot ? tot + 50000 : Math.ceil(tot / 50000) * 50000)
      : 0;
    setCashReceived(defaultCash);
    setCashInputRaw(defaultCash > 0 ? defaultCash.toLocaleString("id-ID") : "0");
  }, [selectedTableNumber, orders, activeOrder, syntheticTableOrder, selectedTableInfo]);

  // Quick cash calculations
  const getQuickCashOptions = (total: number) => {
    if (total === 261000) {
      return [
        { label: `Uang Pas Rp${total.toLocaleString("id-ID")}`, value: total },
        { label: "Rp270.000", value: 270000 },
        { label: "Rp300.000", value: 300000 },
        { label: "Rp350.000", value: 350000 },
        { label: "Rp500.000", value: 500000 },
      ];
    }
    const opt1 = total;
    const opt2 = Math.ceil(total / 10000) * 10000 === total ? total + 10000 : Math.ceil(total / 10000) * 10000;
    const opt3 = Math.ceil(total / 50000) * 50000 <= opt2 ? opt2 + 50000 : Math.ceil(total / 50000) * 50000;
    const opt4 = Math.ceil(total / 100000) * 100000 <= opt3 ? opt3 + 50000 : Math.ceil(total / 100000) * 100000;
    const opt5 = opt4 + 100000;
    const unique = Array.from(new Set([opt1, opt2, opt3, opt4, opt5])).sort((a, b) => a - b);
    return unique.map((val) => ({
      label: val === total ? `Uang Pas Rp${val.toLocaleString("id-ID")}` : `Rp${val.toLocaleString("id-ID")}`,
      value: val,
    }));
  };

  const handleCashInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    const num = parseInt(raw || "0", 10);
    setCashReceived(num);
    setCashInputRaw(raw ? num.toLocaleString("id-ID") : "");
  };

  // Rule 5: Meja yang telah melakukan pembayaran, secara otomatis status meja menjadi tersedia!
  const handleConfirmDirectCheckout = (
    customMethod?: "cash" | "static_qr" | "bank_transfer",
    customAmountPaid?: number,
    customChange?: number,
    customTransferRef?: string
  ) => {
    if (!activeOrder) return;

    const method = customMethod || (
      inlinePaymentMethod === "cash"
        ? "cash"
        : inlinePaymentMethod === "qris"
          ? "static_qr"
          : "bank_transfer"
    );

    const amountPaid = customAmountPaid !== undefined ? customAmountPaid : (method === "cash" ? cashReceived : finalTotal);
    const changeAmount = customChange !== undefined ? customChange : (method === "cash" ? Math.max(0, cashReceived - finalTotal) : 0);

    const updatedOrder: OrderData = {
      ...activeOrder,
      customerId: selectedTableCustomer?.id || activeOrder.customerId,
      customerPhone: selectedTableCustomer?.phone || activeOrder.customerPhone,
      customerTier: selectedTableCustomer?.tier || activeOrder.customerTier,
      subtotal,
      discountAmount,
      discountName: discountLabel || undefined,
      promoCode: tablePromo?.code || undefined,
      taxAmount: taxPB1,
      total: finalTotal,
      paymentStatus: "paid",
      paymentStatusLabel:
        method === "cash"
          ? `Lunas (Kembali Rp${changeAmount.toLocaleString("id-ID")})`
          : method === "static_qr"
            ? "Lunas (QRIS)"
            : "Lunas (Transfer)",
      paymentMethod: method,
      paymentNote: method === "cash" ? `Kembali Rp${changeAmount.toLocaleString("id-ID")}` : undefined,
      cashierId: currentUser.id,
      cashierName: currentUser.name,
    };

    // Patch order details to database
    fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: activeOrder.id,
        tableNumber: selectedTableNumber,
        customerId: selectedTableCustomer?.id || activeOrder.customerId || null,
        subtotal,
        discountAmount,
        discountName: discountLabel || null,
        promoCode: tablePromo?.code || null,
        taxAmount: taxPB1,
        total: finalTotal,
        paymentStatus: "paid",
      }),
    }).catch((err) => console.error("Gagal sync diskon/pembayaran pesanan ke db:", err));

    // Update local table order mapping
    setLocalTableOrders((prev) => ({
      ...prev,
      [selectedTableNumber]: updatedOrder,
    }));

    // REVISION 5: Otomatis ubah status meja menjadi "tersedia" (hilangkan status lunas)
    setTables((prev) =>
      prev.map((t) =>
        t.tableNumber === selectedTableNumber
          ? {
            ...t,
            status: "tersedia",
            statusLabel: "Tersedia",
            orderNumber: undefined,
            customerName: undefined,
            amount: undefined,
            timeElapsed: undefined,
            isProcessing: false,
            orderData: undefined,
          }
          : t
      )
    );

    // Persist status meja ke database SQLite
    updateTableInDb(selectedTableNumber, {
      status: "tersedia",
      statusLabel: "Tersedia",
      customerName: null,
      orderNumber: null,
      amount: null,
      timeElapsed: null,
      foodStatus: "none",
      foodStatusLabel: null,
      isProcessing: false,
    });

    // Call external payment hook with full order data
    if (onConfirmDirectPayment) {
      onConfirmDirectPayment(activeOrder.id, method, amountPaid, changeAmount, updatedOrder);
    }

    // Cetak otomatis kwitansi langsung tanpa pratinjau modal
    printReceiptDirectly(updatedOrder);

    // Set paid state to show receipt banner
    setJustPaidTable({
      tableNumber: selectedTableNumber,
      orderNumber: activeOrder.orderNumber,
      total: finalTotal,
      change: changeAmount,
    });

    showToast(
      `Pembayaran ${selectedTableNumber} (${activeOrder.orderNumber}) berhasil! Status meja kini otomatis TERSEDIA.`,
      "success"
    );
  };

  // Keyboard shortcut for Confirm Checkout (Enter / F8) and Print (P)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.id === "global-search-input")) return;
        if (paymentPopup.isOpen) {
          e.preventDefault();
          handlePopupFinalConfirmAndPrint();
          return;
        }
        if (activeOrder && activeOrder.paymentStatus !== "paid" && selectedTableInfo?.status === "terisi") {
          e.preventDefault();
          openPaymentPopup("cash", "table");
        }
      } else if (e.key === "F8") {
        e.preventDefault();
        openPaymentPopup("cash", "table");
      } else if (e.key === "p" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (activeOrder) onPrintTicket(activeOrder);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeOrder, cashReceived, inlinePaymentMethod, finalTotal, selectedTableInfo, paymentPopup]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchShiftCashMovements();
    setTimeout(() => {
      setIsRefreshing(false);
      showToast("Data meja dan status transaksi telah disinkronkan.", "info");
    }, 600);
  };

  // Handler: Open Reservation Modal
  const handleOpenReservationModal = (table: TableCardInfo) => {
    setReservationModal({ isOpen: true, table });
    setResCustomerName("");
    setResPax(table.capacity);
    setResTime("13:00 WIB");
    setResCustomTime("13:00");
    setResPhone("");
    setResNotes("");
    setResActivateNow(true);
  };

  // Handler: Submit Reservation
  const handleSaveReservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservationModal.table) return;
    if (!resCustomerName.trim()) {
      alert("Silakan masukkan nama pemesan!");
      return;
    }

    const chosenTime = resTime === "custom" ? `${resCustomTime} WIB` : resTime;
    const targetTableNumber = reservationModal.table.tableNumber;

    if (typeof window !== "undefined") {
      sessionStorage.removeItem(`reminder_dismissed_${targetTableNumber}`);
    }

    // Update table status to "reservasi"
    setTables((prev) =>
      prev.map((t) =>
        t.tableNumber === targetTableNumber
          ? {
            ...t,
            status: "reservasi",
            statusLabel: "Reservasi",
            customerName: resCustomerName.trim(),
            reservationTime: chosenTime,
            capacity: resPax,
          }
          : t
      )
    );

    // Simpan ke database SQLite
    updateTableInDb(targetTableNumber, {
      status: "reservasi",
      statusLabel: "Reservasi",
      customerName: resCustomerName.trim(),
      reservationTime: chosenTime,
      capacity: resPax,
    });

    setReservationModal({ isOpen: false, table: null });
    showToast(`Reservasi ${targetTableNumber} atas nama "${resCustomerName}" (${chosenTime}) berhasil disimpan ke SQLite.`);
  };

  // Handler: Open Cancel Reservation Modal
  const handleOpenCancelModal = (table: TableCardInfo) => {
    setCancelModal({ isOpen: true, table });
    setCancelReason("");
    setCancelNotes("");
  };

  // Handler: Confirm Cancel Reservation
  const handleConfirmCancelReservation = () => {
    if (!cancelModal.table) return;
    if (!cancelReason) {
      alert("Pilih alasan pembatalan reservasi terlebih dahulu!");
      return;
    }

    const targetTableNumber = cancelModal.table.tableNumber;

    if (typeof window !== "undefined") {
      sessionStorage.setItem(`reminder_dismissed_${targetTableNumber}`, "true");
    }
    setHasShownReminder(true);

    // Table returns to "tersedia"
    setTables((prev) =>
      prev.map((t) =>
        t.tableNumber === targetTableNumber
          ? {
            ...t,
            status: "tersedia",
            statusLabel: "Tersedia",
            customerName: undefined,
            reservationTime: undefined,
          }
          : t
      )
    );

    // Simpan ke SQLite
    updateTableInDb(targetTableNumber, {
      status: "tersedia",
      statusLabel: "Tersedia",
      customerName: null,
      reservationTime: null,
      reservationNotes: cancelReason,
      orderNumber: null,
      amount: null,
    });

    setCancelModal({ isOpen: false, table: null });
    showToast(`Reservasi ${targetTableNumber} dibatalkan (${cancelReason}). Meja kembali TERSEDIA di database SQLite.`, "info");
  };

  // Handler: Activate Reservation (Guest arrived -> status becomes "terisi")
  const handleActivateReservation = (table: TableCardInfo) => {
    const custName = table.customerName || "Tamu Reservasi";
    setTables((prev) =>
      prev.map((t) =>
        t.tableNumber === table.tableNumber
          ? {
            ...t,
            status: "terisi",
            statusLabel: "Terisi",
            isProcessing: false,
            amount: 0,
            timeElapsed: "Baru tiba",
          }
          : t
      )
    );
    setSelectedTableNumber(table.tableNumber);
    showToast(`Tamu ${custName} di ${table.tableNumber} telah check-in. Meja kini berstatus TERISI.`);
  };

  // Filtered tables based on area tab, status tab, and search query
  const filteredTables = tables.filter((t) => {
    if (areaFilter === "indoor" && t.area !== "indoor") return false;
    if (areaFilter === "outdoor" && t.area !== "outdoor") return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      const matchNum = t.tableNumber.toLowerCase().includes(q);
      const matchName = t.customerName?.toLowerCase().includes(q) || false;
      const matchOrder = t.orderNumber?.toLowerCase().includes(q) || false;
      return matchNum || matchName || matchOrder;
    }
    return true;
  });

  // Accurate counts for strictly 3 statuses
  const totalTablesCount = tables.length;
  const indoorCount = tables.filter((t) => t.area === "indoor").length;
  const outdoorCount = tables.filter((t) => t.area === "outdoor").length;
  const tersediaCount = tables.filter((t) => t.status === "tersedia").length;
  const terisiCount = tables.filter((t) => t.status === "terisi").length;
  const reservasiCount = tables.filter((t) => t.status === "reservasi").length;

  return (
    <div className="flex flex-col lg:flex-row w-full bg-surface h-screen max-h-screen lg:h-[100dvh] lg:max-h-[100dvh] overflow-hidden">

      {/* Offline Banner Alert */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-[11px] font-bold py-1 px-4 text-center flex items-center justify-center gap-1.5 shadow-xs">
          <span className="material-symbols-outlined text-sm">wifi_off</span>
          <span>Mode Offline: Internet terputus. Pembayaran kasir tunai tetap berjalan normal.</span>
        </div>
      )}

      {/* Toast Alert Notification */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className={`px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-bold border ${toast.type === "error"
              ? "bg-rose-950 text-white border-rose-400/50"
              : "bg-[#003629] text-white border-[#baeed9]/40"
            }`}>
            <span className={`material-symbols-outlined text-base ${toast.type === "error" ? "text-rose-400" : "text-[#baeed9]"
              }`}>
              {toast.type === "success" ? "check_circle" : toast.type === "error" ? "error" : "info"}
            </span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* ========================================================
          LEFT AREA (70% WIDTH ON TABLET LANDSCAPE & DESKTOP):
          Katalog menu atau denah meja (70% lebar layar tablet)
         ======================================================== */}
      <div className="w-full lg:w-[70%] shrink-0 flex flex-col h-full overflow-hidden border-r border-slate-200/80 bg-surface">

        {/* Top Operational Bar: Clean Single-Row Tablet Header */}
        <div className="w-full bg-surface-container-lowest shadow-xs border-b border-outline-variant/30 px-3 sm:px-4 py-2 shrink-0 flex items-center justify-between gap-3">
          {/* Brand & POS Title */}
          <div className="flex items-center gap-2.5 shrink-0 min-w-0">
            {["owner", "admin", "manager"].includes(currentUser.role) && onNavigateHome && (
              <button
                onClick={onNavigateHome}
                className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors cursor-pointer flex items-center justify-center text-xs font-bold shrink-0"
                title="Kembali ke Dashboard Utama"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
              </button>
            )}

            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#003629] text-white shadow-xs shrink-0">
              <span className="material-symbols-outlined text-xl">point_of_sale</span>
            </div>
            <div className="flex flex-col shrink-0">
              <div className="flex items-center gap-2 flex-nowrap">
                <h1 className="font-headline-sm text-sm sm:text-base font-black text-slate-900 leading-tight whitespace-nowrap">
                  POS Kasir &amp; Transaksi
                </h1>
                {isOnline ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-[#006e33] border border-emerald-200 text-[10px] font-extrabold uppercase shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    <span>Live Sync</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black uppercase shrink-0 animate-pulse" title="Tidak terhubung ke internet">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                    <span>Offline</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-tight truncate">
                {settings.restaurantName}
              </p>
            </div>

            {reservasiCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  const resTable = tables.find((t) => t.status === "reservasi");
                  if (resTable) {
                    setReminderModal({
                      isOpen: true,
                      table: resTable,
                      minutesLeft: 25,
                    });
                  }
                }}
                className="relative w-9 h-9 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center transition-all cursor-pointer animate-pulse shrink-0 ml-1"
                title={`Pengingat: Ada ${reservasiCount} reservasi tamu`}
              >
                <span className="material-symbols-outlined text-lg text-amber-700">alarm</span>
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  {reservasiCount}
                </span>
              </button>
            )}
          </div>

          {/* Right Controls: Cashier Badge & Clean Icon Toolbar */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Active Cashier Badge */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 shrink-0"
              title={`Kasir: ${currentUser.name} (${currentUser.role.toUpperCase()})`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="truncate max-w-[85px] sm:max-w-[120px]">
                {currentUser.name}
              </span>
            </div>

            {/* Divider */}
            <div className="h-5 w-px bg-slate-200 mx-0.5 hidden sm:block shrink-0" />

            {/* Tombol Kas Keluar (Pengeluaran Operasional) */}
            <button
              type="button"
              id="btn-pos-kas-keluar"
              onClick={() => setIsCashExpenseModalOpen(true)}
              className="relative w-9 h-9 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 shadow-2xs"
              title={`Kas Keluar (Operasional Kas Kecil) • Total: ${formatCurrency(totalCashOut)}`}
            >
              <span className="material-symbols-outlined text-lg text-amber-700">payments</span>
              {totalCashOut > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-600 ring-2 ring-white"
                  title={`Kas keluar tercatat: ${formatCurrency(totalCashOut)}`}
                />
              )}
            </button>

            {/* Tombol Tutup Kasir (Serah Terima Shift) */}
            <button
              type="button"
              id="btn-tutup-kasir"
              onClick={() => setIsTutupKasirOpen(true)}
              className="w-9 h-9 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex items-center justify-center shadow-xs cursor-pointer transition-all shrink-0"
              title="Tutup Shift Kasir &amp; Serah Terima"
            >
              <span className="material-symbols-outlined text-lg">lock_clock</span>
            </button>

            {/* Riwayat POS */}
            <button
              type="button"
              id="btn-pos-riwayat"
              onClick={() => setIsHistoryModalOpen(true)}
              className="w-9 h-9 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0"
              title="Riwayat Transaksi POS (F6)"
            >
              <span className="material-symbols-outlined text-lg text-slate-600">receipt_long</span>
            </button>

            {/* Layar Penuh (Fullscreen Kiosk Mode) */}
            <button
              type="button"
              id="btn-pos-fullscreen"
              onClick={handleToggleFullscreen}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0 ${isFullscreen
                  ? "bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-900"
                  : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                }`}
              title={isFullscreen ? "Keluar Layar Penuh" : "Mode Layar Penuh Tablet (Kiosk)"}
            >
              <span className="material-symbols-outlined text-lg text-slate-600">
                {isFullscreen ? "fullscreen_exit" : "fullscreen"}
              </span>
            </button>

            {/* Notifikasi Suara (Audio Chime Toggle) */}
            <button
              type="button"
              id="btn-pos-sound-toggle"
              onClick={handleToggleSound}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0 ${soundEnabled
                  ? "bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-900"
                  : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-400"
                }`}
              title={
                soundEnabled
                  ? "Notifikasi Suara Aktif (Klik untuk Mode Bisu)"
                  : "Suara Bisu / Mute (Klik untuk Mengaktifkan Notifikasi Suara)"
              }
            >
              <span className="material-symbols-outlined text-lg">
                {soundEnabled ? "volume_up" : "volume_off"}
              </span>
            </button>

            {/* Segarkan */}
            <button
              type="button"
              onClick={handleRefresh}
              className="w-9 h-9 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-center transition-all active:scale-95 shadow-2xs cursor-pointer shrink-0"
              title="Segarkan data meja dan pesanan"
            >
              <span className={`material-symbols-outlined text-lg text-primary ${isRefreshing ? "animate-spin" : ""}`}>
                sync
              </span>
            </button>

            {/* Logout */}
            <button
              type="button"
              onClick={() => logout()}
              className="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Keluar / Logout"
            >
              <span className="material-symbols-outlined text-lg">logout</span>
            </button>
          </div>
        </div>

        {/* ========================================================
            SISI KIRI LAYAR (65%):
            - Jika orderingMode !== "table": Tampilkan KATALOG PRODUK LENGKAP
              menggantikan kartu denah meja sesuai permintaan user.
            - Jika orderingMode === "table": Tampilkan Fixed Filter Panel & Layout Denah Meja.
           ======================================================== */}
        {orderingMode !== "table" ? (
          <>
            {/* FIXED CATALOG FILTER PANEL (Shrink-0) */}
            <div className="shrink-0 w-full px-4 pt-3 pb-2.5 bg-surface border-b border-slate-200/80 z-10">
              <div className="flex flex-col gap-2.5 bg-surface-container-lowest p-3 rounded-2xl border border-outline-variant/30 shadow-xs">
                {/* Mode Title Header */}
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-2xs ${orderingMode === "takeaway"
                          ? "bg-[#003629] text-white"
                          : "bg-secondary text-white"
                        }`}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {orderingMode === "takeaway" ? "shopping_bag" : "moped"}
                      </span>
                      <span>
                        {orderingMode === "takeaway"
                          ? "Katalog Pesanan Take Away"
                          : `Katalog Pesanan Delivery (${ojolPlatform})`}
                      </span>
                    </span>
                    <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                      Pilih menu di bawah untuk menambahkan ke keranjang
                    </span>
                  </div>

                  <div className="text-xs font-bold text-slate-500">
                    Total: <strong className="text-slate-900">{orderCart.reduce((s, i) => s + i.qty, 0)} Item</strong> di keranjang
                  </div>
                </div>

                {/* Category Tabs & Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
                  {/* Category Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                    {catalogCategories.map((cat) => {
                      const isSelected = catalogCategory === cat.id;
                      const count =
                        cat.id === "all"
                          ? catalogProducts.length
                          : catalogProducts.filter((p) => p.category === cat.id).length;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCatalogCategory(cat.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${isSelected
                              ? "bg-primary text-on-primary shadow-xs"
                              : "bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface"
                            }`}
                        >
                          <span>{cat.label}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isSelected
                                ? "bg-white/20 text-white"
                                : "bg-slate-200 text-slate-600"
                              }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Search Input */}
                  <div className="relative min-w-[220px]">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-base">
                      search
                    </span>
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Cari nama menu / kode..."
                      className="w-full pl-9 pr-7 py-1.5 bg-surface-container-low rounded-xl text-xs text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest border border-outline-variant/30"
                    />
                    {catalogSearch && (
                      <button
                        type="button"
                        onClick={() => setCatalogSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SCROLLABLE CATALOG GRID (Menggantikan denah meja) */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-slate-200">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="font-headline-md text-lg lg:text-xl font-bold text-on-surface tracking-tight">
                    Katalog Produk ({filteredCatalogProducts.length} Menu)
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-bold text-xs">
                    {catalogCategory === "all" ? "Semua Menu" : catalogCategory}
                  </span>
                </div>
                <span className="text-xs text-on-surface-variant font-medium">
                  {orderCart.reduce((sum, item) => sum + item.qty, 0)} item dipilih di keranjang
                </span>
              </div>

              {filteredCatalogProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-slate-200/80">
                  <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">search_off</span>
                  <p className="font-bold text-sm text-slate-700">Tidak ada produk yang cocok</p>
                  <p className="text-xs text-slate-400 mt-1">Coba ubah kata kunci pencarian atau kategori filter.</p>
                  <button
                    type="button"
                    onClick={() => { setCatalogSearch(""); setCatalogCategory("all"); }}
                    className="mt-3 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Reset Filter
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-2.5">
                  {filteredCatalogProducts.map((prod) => {
                    const promoCalc = calculateProductPromoPrice(prod, productPromos);
                    const enhancedProduct: MasterProduct = promoCalc.isPromo
                      ? { ...prod, promoPrice: promoCalc.effectivePrice, promoBadge: promoCalc.badge, promoName: promoCalc.promoName }
                      : prod;
                    const cartItem = orderCart.find((c) => c.name === prod.name);
                    const qty = cartItem ? cartItem.qty : 0;
                    const img = prod.imageUrl || prod.image;
                    const isOutOfStock = prod.isAvailable === false;

                    return (
                      <div
                        key={prod.id}
                        role="button"
                        tabIndex={isOutOfStock ? -1 : 0}
                        onClick={() => {
                          if (!isOutOfStock) {
                            if (prod.addons && prod.addons.length > 0) {
                              setSelectedDetailProduct(enhancedProduct);
                            } else {
                              handleAddToCart(enhancedProduct);
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if ((e.key === "Enter" || e.key === " ") && !isOutOfStock) {
                            e.preventDefault();
                            if (prod.addons && prod.addons.length > 0) {
                              setSelectedDetailProduct(enhancedProduct);
                            } else {
                              handleAddToCart(enhancedProduct);
                            }
                          }
                        }}
                        className={`group relative rounded-2xl p-2.5 bg-surface-container-lowest border transition-all duration-150 flex flex-col justify-between gap-2 shadow-2xs select-none ${isOutOfStock
                            ? "opacity-60 bg-slate-50/90 border-rose-200 cursor-not-allowed"
                            : qty > 0
                              ? "ring-2 ring-[#003629] border-[#003629] bg-emerald-50/25 shadow-xs cursor-pointer active:scale-[0.97]"
                              : promoCalc.isPromo
                              ? "border-rose-300 hover:border-rose-500 hover:shadow-xs cursor-pointer active:scale-[0.97]"
                              : "border-outline-variant/30 hover:border-primary/50 hover:shadow-xs cursor-pointer active:scale-[0.97]"
                          }`}
                        title={
                          isOutOfStock
                            ? `Menu "${prod.name}" sedang stok habis`
                            : qty > 0
                              ? `Klik kartu atau gambar untuk menambah jumlah (+1). Total saat ini: ${qty} porsi.`
                              : `Klik kartu atau gambar untuk memesan ${prod.name}`
                        }
                      >
                        {/* Product Image (Klik gambar menambah produk ke keranjang) */}
                        <div
                          className={`relative w-full aspect-4/3 rounded-xl overflow-hidden bg-slate-100 border border-slate-100 shrink-0 ${isOutOfStock ? "grayscale contrast-125" : ""
                            }`}
                        >
                          {img ? (
                            <img
                              src={img}
                              alt={prod.name}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1">
                              <span className="material-symbols-outlined text-3xl">restaurant</span>
                              <span className="text-[10px]">Tanpa Foto</span>
                            </div>
                          )}

                          {/* Promo Badge Floating (Merah Menyala) */}
                          {promoCalc.isPromo && !isOutOfStock && (
                            <div className="absolute top-2 left-2 z-15 pointer-events-none">
                              <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[11px]">local_fire_department</span>
                                <span>{promoCalc.badge}</span>
                              </span>
                            </div>
                          )}

                          {/* Category Badge Floating */}
                          <div className={`absolute ${promoCalc.isPromo ? "bottom-2 left-2" : "top-2 left-2"} z-10 pointer-events-none`}>
                            <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold">
                              {prod.category}
                            </span>
                          </div>

                          {/* Out of Stock Overlay Badge */}
                          {isOutOfStock && (
                            <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[1px] flex flex-col items-center justify-center gap-1 z-20 pointer-events-none">
                              <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white text-[11px] font-black uppercase tracking-wider shadow-md flex items-center gap-1 animate-in zoom-in-75 duration-150">
                                <span className="material-symbols-outlined text-xs">block</span>
                                <span>Stok Habis</span>
                              </span>
                            </div>
                          )}

                          {/* Qty indicator badge on top right - Menonjol & jelas di tablet */}
                          {qty > 0 && !isOutOfStock && (
                            <div className="absolute top-2 right-2 animate-in zoom-in-75 duration-150 z-20 pointer-events-none">
                              <span className="px-2.5 py-1 rounded-full bg-[#003629] text-white text-xs font-black shadow-md flex items-center gap-1 border border-white/25">
                                <span className="material-symbols-outlined text-[13px]">check</span>
                                <span>{qty}x</span>
                              </span>
                            </div>
                          )}

                          {/* Tap +1 Quick Visual Cue on Hover */}
                          {!isOutOfStock && (
                            <div className="absolute inset-0 bg-black/15 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-10">
                              <span className="px-2.5 py-1 rounded-full bg-white/95 text-slate-900 text-xs font-black shadow-md flex items-center gap-1 backdrop-blur-xs">
                                <span className="material-symbols-outlined text-sm text-primary">add</span>
                                <span>{qty > 0 ? "Ketuk +1" : "Pesan"}</span>
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Info: Name, Code & Price */}
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                              {prod.code || "PROD"}
                            </span>
                            <div className="flex flex-col items-end">
                              {promoCalc.isPromo ? (
                                <>
                                  <span className="text-[10px] text-slate-400 line-through">
                                    {formatCurrency(prod.price)}
                                  </span>
                                  <span className="font-black text-sm text-rose-600">
                                    {formatCurrency(promoCalc.effectivePrice)}
                                  </span>
                                </>
                              ) : (
                                <span
                                  className={`font-black text-sm ${isOutOfStock ? "text-slate-400 line-through" : "text-emerald-700"
                                    }`}
                                >
                                  {formatCurrency(prod.price)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <h3
                              className={`font-bold text-xs lg:text-sm leading-snug line-clamp-2 ${isOutOfStock ? "text-slate-500" : "text-slate-900"
                                }`}
                            >
                              {prod.name}
                            </h3>
                          </div>
                          {isOutOfStock ? (
                            <span className="text-[10px] font-black text-rose-600 flex items-center gap-0.5 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                              <span>Habis dari Dapur</span>
                            </span>
                          ) : prod.description ? (
                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                              {prod.description}
                            </p>
                          ) : null}
                        </div>

                        {/* Card Footer: Detail Produk & Status Pemesanan */}
                        <div className="pt-1.5 border-t border-slate-100 shrink-0 flex items-center justify-between text-[11px] gap-1">
                          {isOutOfStock ? (
                            <span className="text-rose-600 font-bold text-[10px] flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">block</span>
                              <span>Stok Habis</span>
                            </span>
                          ) : qty > 0 ? (
                            <span className="text-[#003629] font-black text-xs flex items-center gap-1 truncate">
                              <span className="w-2 h-2 rounded-full bg-[#003629] animate-pulse shrink-0"></span>
                              <span className="truncate">{qty} Porsi</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium truncate">
                              Ketuk untuk +1
                            </span>
                          )}

                          {/* Tombol Detail Produk (Membuka Pop-up Informasi Detail Menu & Pelengkap) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDetailProduct(prod);
                            }}
                            className={`px-2.5 py-1 rounded-xl font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer shadow-2xs border shrink-0 ${prod.addons && prod.addons.length > 0
                                ? "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300"
                                : "bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border-slate-200/90"
                              }`}
                            title={`Lihat informasi detail & pelengkap ${prod.name}`}
                          >
                            <span className={`material-symbols-outlined text-[13px] ${prod.addons && prod.addons.length > 0 ? "text-amber-700" : "text-primary"}`}>
                              {prod.addons && prod.addons.length > 0 ? "tune" : "info"}
                            </span>
                            <span>{prod.addons && prod.addons.length > 0 ? `+ Pelengkap (${prod.addons.length})` : "Detail Produk"}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* ========================================================
                FIXED FILTER PANEL (Shrink-0):
                Tetap di atas, tidak ikut bergulir saat kasir mencari meja.
                Jarak dan padding dibuat konsisten, rapi dan seragam.
               ======================================================== */}
            <div className="shrink-0 w-full px-4 pt-3 pb-2.5 bg-surface border-b border-slate-200/80 z-10">
              <div className="flex flex-col gap-2.5 bg-surface-container-lowest p-3 rounded-2xl border border-outline-variant/30 shadow-xs">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  {/* Area Filters */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                    <button
                      onClick={() => setAreaFilter("all")}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${areaFilter === "all"
                          ? "bg-primary text-on-primary shadow-xs"
                          : "bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface"
                        }`}
                    >
                      Semua Area ({totalTablesCount})
                    </button>
                    <button
                      onClick={() => setAreaFilter("indoor")}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${areaFilter === "indoor"
                          ? "bg-primary text-on-primary shadow-xs"
                          : "bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface"
                        }`}
                    >
                      Indoor AC ({indoorCount})
                    </button>
                    <button
                      onClick={() => setAreaFilter("outdoor")}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${areaFilter === "outdoor"
                          ? "bg-primary text-on-primary shadow-xs"
                          : "bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface"
                        }`}
                    >
                      Outdoor / Smoking ({outdoorCount})
                    </button>
                  </div>

                  {/* Quick Table Search */}
                  <div className="relative min-w-[200px]">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-base">
                      search
                    </span>
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Cari meja, no. atau tamu..."
                      className="w-full pl-9 pr-3 py-1.5 bg-surface-container-low rounded-xl text-xs text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest border border-outline-variant/30"
                    />
                  </div>
                </div>

                {/* Status Filters: Strictly Tersedia, Terisi, Reservasi */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 overflow-x-auto scrollbar-none">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                    Status Meja:
                  </span>
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${statusFilter === "all"
                        ? "bg-slate-800 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                  >
                    Semua ({tables.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter("tersedia")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${statusFilter === "tersedia"
                        ? "bg-[#006e33] text-white"
                        : "bg-[#e8f7ee] text-[#006e33] hover:bg-[#d4f2de]"
                      }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Tersedia ({tersediaCount})</span>
                  </button>
                  <button
                    onClick={() => setStatusFilter("terisi")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${statusFilter === "terisi"
                        ? "bg-[#003629] text-white"
                        : "bg-[#eff4ff] text-[#003629] hover:bg-[#e0ecff]"
                      }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    <span>Terisi ({terisiCount})</span>
                  </button>
                  <button
                    onClick={() => setStatusFilter("reservasi")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${statusFilter === "reservasi"
                        ? "bg-[#8a5b00] text-white"
                        : "bg-[#fff8e6] text-[#8a5b00] hover:bg-[#ffefcc]"
                      }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    <span>Reservasi ({reservasiCount})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ========================================================
            SCROLLABLE TABLE CARDS CONTAINER:
            Independent Scroll inside 65% area, fixed jarak & padding.
           ======================================================== */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-slate-200">

              {/* Layout Denah Meja Header */}
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="font-headline-md text-lg lg:text-xl font-bold text-on-surface tracking-tight">
                    Layout Denah Meja
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-bold text-xs">
                    Lantai 1
                  </span>
                </div>
                <span className="text-xs text-on-surface-variant font-medium">
                  3 Status: Tersedia • Terisi • Reservasi
                </span>
              </div>

              {/* Grid Denah Kartu Meja: 5 Kolom Proporsional */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-2.5">
                {filteredTables.map((table) => {
                  const isSelected = selectedTableNumber === table.tableNumber;
                  const isAvailable = table.status === "tersedia";
                  const isReservation = table.status === "reservasi";
                  const isOccupied = table.status === "terisi";

                  return (
                    <div
                      key={table.id}
                      onClick={() => {
                        setSelectedTableNumber(table.tableNumber);
                      }}
                      className={`relative rounded-2xl p-3 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5 border ${isSelected
                          ? "bg-surface-container-lowest ring-2 ring-primary shadow-md border-transparent"
                          : "bg-surface-container-lowest border-outline-variant/30 hover:border-primary/50 hover:shadow-sm"
                        }`}
                    >
                      {/* Top Selected Badge Pill */}
                      {isSelected && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                          <span className="px-2.5 py-0.5 rounded-full bg-primary text-on-primary text-[10px] font-black shadow-xs flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">check</span>
                            <span>Meja Terpilih</span>
                          </span>
                        </div>
                      )}

                      {/* Card Header Row: Status Badge & Capacity */}
                      <div className="flex items-center justify-between">
                        {/* Status Badges - Strictly 3: Tersedia, Terisi, Reservasi */}
                        <div className="flex items-center gap-1.5">
                          {isAvailable && (
                            <span className="px-2.5 py-0.5 rounded-full bg-[#e8f7ee] text-[#006e33] border border-[#a6e6b8] text-xs font-bold tracking-wide">
                              Tersedia
                            </span>
                          )}

                          {isReservation && (
                            <span className="px-2.5 py-0.5 rounded-full bg-[#fff8e6] text-[#8a5b00] border border-[#ffd580] text-xs font-bold tracking-wide flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              <span>Reservasi</span>
                            </span>
                          )}

                          {isOccupied && (
                            <span className="px-2.5 py-0.5 rounded-full bg-[#eff4ff] text-[#003629] border border-[#c2d7fe] text-xs font-bold tracking-wide">
                              Terisi
                            </span>
                          )}

                          {/* Status Makanan dari Kitchen: Siap Saji / Disajikan / Proses */}
                          {isOccupied && (table.foodStatus === "ready" || table.orderData?.kitchenStatus === "ready") && (
                            <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-900 border border-orange-300 text-[11px] font-bold flex items-center gap-1 animate-pulse shadow-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-ping"></span>
                              <span className="material-symbols-outlined text-[13px] text-orange-600">room_service</span>
                              <span>Siap Saji</span>
                            </span>
                          )}

                          {isOccupied && (table.foodStatus === "served" || table.orderData?.kitchenStatus === "completed" || table.orderData?.kitchenStatus === "served") && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-semibold flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px] text-emerald-600">check</span>
                              <span>Disajikan</span>
                            </span>
                          )}

                          {isOccupied && table.isProcessing && table.foodStatus !== "ready" && table.orderData?.kitchenStatus !== "ready" && table.foodStatus !== "served" && (
                            <span className="px-2 py-0.5 rounded-full bg-[#fff2e6] text-[#b35900] border border-[#ffd1a4] text-[11px] font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                              <span>Proses</span>
                            </span>
                          )}
                        </div>

                        {/* Capacity Badge */}
                        <div className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-bold text-xs flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">group</span>
                          <span>{table.capacity}</span>
                        </div>
                      </div>

                      {/* Table Title & Body Information */}
                      <div className="flex flex-col">
                        <h3 className="font-headline-sm text-xl font-bold text-on-surface tracking-tight">
                          {table.tableNumber}
                        </h3>

                        {/* If Tersedia */}
                        {isAvailable && (
                          <div className="mt-1 flex flex-col">
                            <span className="text-xs text-on-surface-variant font-medium">
                              {table.areaLabel}
                            </span>
                            <span className="text-xs font-bold text-[#006e33] mt-0.5 flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">check_circle</span>
                              <span>Siap ditempati tamu</span>
                            </span>
                          </div>
                        )}

                        {/* If Reservasi */}
                        {isReservation && (
                          <div className="mt-1 flex flex-col">
                            <span className="text-xs font-bold text-on-surface">
                              {table.customerName || "Tamu Reservasi"}
                            </span>
                            <span className="text-xs font-bold text-secondary flex items-center gap-1 mt-0.5">
                              <span className="material-symbols-outlined text-xs">schedule</span>
                              <span>{table.reservationTime || "Waktu Belum Diset"}</span>
                            </span>
                          </div>
                        )}

                        {/* Table Order Summary Info (For Terisi Tables) */}
                        {isOccupied && (
                          <div className="mt-1 flex flex-col">
                            <span className="text-base font-bold text-on-surface">
                              {formatCurrency(
                                orders.find((o) => o.tableOrGuest.toLowerCase() === table.tableNumber.toLowerCase() && o.paymentStatus !== "paid")?.total ||
                                table.amount ||
                                defaultTableOrders[table.tableNumber]?.total ||
                                0
                              )}
                            </span>
                            <div className="flex items-center gap-1 text-xs text-on-surface-variant mt-0.5">
                              {table.customerName ? (
                                <>
                                  <span className="material-symbols-outlined text-xs">person</span>
                                  <span>{table.customerName}</span>
                                  <span>•</span>
                                  <span>{table.timeElapsed || "30 mnt"}</span>
                                </>
                              ) : (
                                <>
                                  <span className="material-symbols-outlined text-xs">timer</span>
                                  <span>{table.timeElapsed || "30 mnt"}</span>
                                  <span>•</span>
                                  <span className="font-semibold">{table.orderNumber || "-"}</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* REVISION: Tombol atau Action pada Meja strictly:
                          1. "Reservasi" untuk meja Tersedia
                          2. "Bayar" untuk meja Terisi
                          3. "Batalkan Reservasi" untuk meja Reservasi
                      */}
                      <div className="pt-1">
                        {isAvailable && (
                          <button
                            type="button"
                            id={`btn-reservasi-${table.tableNumber.toLowerCase().replace(/\s+/g, "")}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenReservationModal(table);
                            }}
                            className="w-full py-2 px-3 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center justify-center gap-1.5 transition-all hover:bg-primary/90 shadow-xs cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">event_seat</span>
                            <span>Reservasi</span>
                          </button>
                        )}

                        {isOccupied && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              id={`btn-bayar-${table.tableNumber.toLowerCase().replace(/\s+/g, "")}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTableNumber(table.tableNumber);
                              }}
                              className={`flex-1 py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs ${isSelected
                                  ? "bg-primary text-on-primary"
                                  : "bg-primary hover:bg-primary/90 text-on-primary"
                                }`}
                            >
                              <span className="material-symbols-outlined text-sm">payments</span>
                              <span>Bayar</span>
                            </button>
                            <button
                              type="button"
                              id={`btn-pindah-${table.tableNumber.toLowerCase().replace(/\s+/g, "")}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenMoveTable(table);
                              }}
                              className="py-2 px-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer border border-outline-variant/30"
                              title={`Pindahkan tamu dari ${table.tableNumber} ke meja lain`}
                            >
                              <span className="material-symbols-outlined text-sm text-primary">sync_alt</span>
                              <span className="hidden xl:inline">Pindah</span>
                            </button>
                          </div>
                        )}

                        {isReservation && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              id={`btn-batal-${table.tableNumber.toLowerCase().replace(/\s+/g, "")}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenCancelModal(table);
                              }}
                              className="flex-1 py-2 px-2 rounded-xl bg-error-container/50 hover:bg-error-container text-on-error-container font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                              title="Batalkan reservasi ini"
                            >
                              <span className="material-symbols-outlined text-sm">cancel</span>
                              <span>Batalkan Reservasi</span>
                            </button>
                            <button
                              type="button"
                              id={`btn-mulai-${table.tableNumber.toLowerCase().replace(/\s+/g, "")}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleActivateReservation(table);
                              }}
                              className="py-2 px-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                              title="Tamu hadir, mulai makan"
                            >
                              <span className="material-symbols-outlined text-sm">how_to_reg</span>
                              <span>Mulai</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ========================================================
            RIGHT COLUMN: Order Detail Sheet & Kasir Panel (30% WIDTH)
            (30% width, FULL vertically from top: 0 to bottom: 100vh)
           ======================================================== */}
      <div className="w-full lg:w-[30%] shrink-0 h-full bg-white flex flex-col p-4 gap-2.5 overflow-hidden shadow-xs border-l border-slate-200/90">

        {/* ========================================================
              CHANNEL TABS: DINE IN | TAKE AWAY | DELIVERY
              (Terletak di paling atas area layar kasir)
              Urutan: 1. Dine In, 2. Take Away, 3. Delivery
             ======================================================== */}
        <div className="shrink-0 grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200 shadow-2xs">
          <button
            type="button"
            id="tab-channel-dine-in"
            onClick={() => {
              setOrderingMode("table");
            }}
            className={`py-2 px-1 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${orderingMode === "table"
                ? "bg-[#003629] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
              }`}
          >
            <span className="material-symbols-outlined text-base">restaurant</span>
            <span>Dine In</span>
          </button>

          <button
            type="button"
            id="tab-channel-takeaway"
            onClick={() => {
              setOrderingMode("takeaway");
              setCatalogCategory("all");
              setCatalogSearch("");
            }}
            className={`py-2 px-1 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${orderingMode === "takeaway"
                ? "bg-[#003629] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
              }`}
          >
            <span className="material-symbols-outlined text-base">shopping_bag</span>
            <span>Take Away</span>
          </button>

          <button
            type="button"
            id="tab-channel-delivery"
            onClick={() => {
              setOrderingMode("ojol");
              setCatalogCategory("all");
              setCatalogSearch("");
            }}
            className={`py-2 px-1 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${orderingMode === "ojol"
                ? "bg-[#003629] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
              }`}
          >
            <span className="material-symbols-outlined text-base">moped</span>
            <span>Delivery</span>
          </button>
        </div>

        {orderingMode !== "table" ? (
          /* ========================================================
              PANEL TRANSAKSI TAKE AWAY & DELIVERY (SISI KANAN - 30%)
              Rincian pesanan, form data pelanggan/delivery, cart & bayar
             ======================================================== */
          <>
            {/* Header: Mode Badge & Title */}
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span
                  className={`font-black text-xs px-2.5 py-1 rounded-md tracking-wider uppercase shrink-0 ${orderingMode === "takeaway"
                      ? "bg-[#003629] text-white"
                      : "bg-secondary text-white"
                    }`}
                >
                  {orderingMode === "takeaway" ? "Take Away" : `Delivery: ${ojolPlatform}`}
                </span>
                <h2 className="font-bold text-base md:text-lg text-slate-900 tracking-tight truncate">
                  {orderingMode === "takeaway" ? "Pesanan Take Away" : "Pesanan Delivery"}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCancelOrderingMode}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                title="Kembali ke Dine In (Esc)"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Subtitle Info */}
            <p className="text-[11px] text-slate-500 -mt-1 shrink-0 truncate">
              {orderingMode === "takeaway"
                ? "Pesanan bawa pulang langsung • Masuk langsung ke kitchen display"
                : `Pesanan delivery ${ojolPlatform} • Masukkan no. order eksternal aplikasi`}
            </p>

            {/* Middle Scrollable Section: Pelanggan/Ojol Card + Cart Header + Cart Items List */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-2.5 scrollbar-thin scrollbar-thumb-slate-200">
              {/* Input Data Pelanggan / Ojol */}
              <div className="shrink-0 bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 flex flex-col gap-2">
              {orderingMode === "takeaway" ? (
                <>
                  {takeawayCustomer ? (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col gap-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-emerald-700 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                            {takeawayCustomer.name.charAt(0)}
                          </span>
                          <span className="font-bold text-slate-800 truncate">{takeawayCustomer.name}</span>
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded shrink-0 ${takeawayCustomer.tier === "vip" ? "bg-purple-100 text-purple-900 border border-purple-200" :
                              takeawayCustomer.tier === "gold" ? "bg-amber-100 text-amber-900 border border-amber-200" :
                                takeawayCustomer.tier === "silver" ? "bg-slate-200 text-slate-800" : "bg-emerald-100 text-emerald-900"
                            }`}>
                            {takeawayCustomer.tier.toUpperCase()}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setTakeawayCustomer(null);
                            setTakeawayCustomerName("");
                            if (takeawayPromo && takeawayPromo.customerScope !== "all") {
                              setTakeawayPromo(null);
                            }
                          }}
                          className="text-slate-400 hover:text-red-600 text-xs font-bold shrink-0 ml-2"
                        >
                          Ganti
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-600">
                        <span className="font-mono">{takeawayCustomer.phone}</span>
                        <span className="font-bold text-amber-700">★ {takeawayCustomer.points || 0} Poin</span>
                      </div>
                      {takeawayCustomer.notes && (
                        <div className="mt-0.5 p-1.5 rounded-lg bg-amber-100/80 text-amber-900 text-[10px] leading-tight flex items-start gap-1">
                          <span className="material-symbols-outlined text-xs shrink-0 mt-0.5">warning</span>
                          <span>{takeawayCustomer.notes}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700">
                          Nama Pelanggan (Take Away):
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setCustomerModalState({
                              isOpen: true,
                              target: "takeaway",
                              search: "",
                              isAddingNew: false,
                              newCustomer: { name: "", phone: "", email: "", tier: "regular", notes: "" },
                            })
                          }
                          className="text-[11px] font-bold text-[#003629] hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[13px]">person_search</span>
                          <span>Pilih Member</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={takeawayCustomerName}
                        onChange={(e) => setTakeawayCustomerName(e.target.value)}
                        placeholder="Ketik nama pelanggan walk-in atau pilih member..."
                        className="w-full px-3 py-1.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-primary"
                      />

                      {/* Helper Pill jika nama cocok dengan data member terdaftar */}
                      {!takeawayCustomer && matchedTakeawayCustomers.length > 0 && (
                        <div className="flex flex-col gap-1 mt-1">
                          {matchedTakeawayCustomers.map((cust) => (
                            <button
                              key={cust.id}
                              type="button"
                              onClick={() => {
                                setTakeawayCustomer(cust);
                                setTakeawayCustomerName(cust.name);
                                const rel = getMemberPromos(cust, "takeaway", availablePromos, cartSubtotal);
                                if (rel.length > 0) {
                                  setPromoModalState({
                                    isOpen: true,
                                    target: "takeaway",
                                    activeTab: "promos",
                                    customType: "percentage",
                                    customValue: 10,
                                    customReason: "",
                                  });
                                  showToast(
                                    `Member ${cust.name} (${cust.tier.toUpperCase()}) terhubung! Ditemukan ${rel.length} voucher yang memenuhi syarat.`,
                                    "success"
                                  );
                                } else {
                                  showToast(
                                    `Pelanggan ${cust.name} (${cust.tier.toUpperCase()}) terhubung sebagai member!`,
                                    "success"
                                  );
                                }
                              }}
                              className="flex items-center justify-between p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-950 text-xs font-bold transition-all text-left cursor-pointer shadow-2xs"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="material-symbols-outlined text-emerald-700 text-sm">how_to_reg</span>
                                <span className="truncate text-[11px]">
                                  Cocok Member: <strong>{cust.name}</strong> ({cust.tier.toUpperCase()})
                                  {cust.phone ? <span className="font-normal text-slate-600 font-mono ml-1">• {cust.phone}</span> : null}
                                </span>
                              </div>
                              <span className="px-2 py-0.5 rounded-md bg-[#003629] text-white text-[10px] font-bold shrink-0">
                                Hubungkan
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Platform Picker */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-700">
                      Pilih Platform Delivery:
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["GoFood", "GrabFood", "ShopeeFood"] as const).map((plat) => (
                        <button
                          key={plat}
                          type="button"
                          onClick={() => setOjolPlatform(plat)}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${ojolPlatform === plat
                              ? plat === "GoFood"
                                ? "bg-red-600 text-white shadow-xs"
                                : plat === "GrabFood"
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : "bg-orange-600 text-white shadow-xs"
                              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                            }`}
                        >
                          {plat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ID Pesanan Eksternal & Driver */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        ID Pesanan <span className="text-rose-500">*</span>:
                      </label>
                      <input
                        type="text"
                        value={ojolExternalId}
                        onChange={(e) => {
                          setOjolExternalId(e.target.value);
                          setOjolError("");
                        }}
                        placeholder="Misal: GF-8921"
                        className="w-full px-2.5 py-1.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 uppercase font-bold focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        Driver / Pemesan:
                      </label>
                      <input
                        type="text"
                        value={ojolDriverName}
                        onChange={(e) => setOjolDriverName(e.target.value)}
                        placeholder="Misal: Joko Susilo"
                        className="w-full px-2.5 py-1.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* Keterangan Pembayaran Otomatis Pihak ke-3 (Tanpa Input Status Bayar) */}
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs mt-0.5 shadow-2xs">
                    <span className="material-symbols-outlined text-emerald-600 text-lg shrink-0">verified</span>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[11px] text-emerald-950">
                          Pembayaran via Aplikasi {ojolPlatform} (Pihak ke-3)
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-900 font-black text-[9px] uppercase tracking-wide">
                          LUNAS
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-700 leading-tight mt-0.5">
                        Konsumen membayar di aplikasi • Kasir langsung proses &amp; kirim ke dapur
                      </span>
                    </div>
                  </div>

                  {ojolError && (
                    <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm shrink-0">error</span>
                      <span>{ojolError}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Cart Header */}
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-1 border-t border-slate-100 shrink-0">
              <span>DAFTAR MENU DIPESAN ({orderCart.reduce((s, i) => s + i.qty, 0)})</span>
              <span>SUBTOTAL</span>
            </div>

            {/* Cart Items List */}
            <div className="flex flex-col gap-2 my-0.5 divide-y divide-slate-100 shrink-0">
              {orderCart.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 gap-2">
                  <span className="material-symbols-outlined text-4xl text-slate-300">shopping_cart</span>
                  <p className="font-bold text-xs text-slate-600">Keranjang Masih Kosong</p>
                  <p className="text-[11px] text-slate-400 max-w-[220px]">
                    Sentuh kartu atau gambar produk pada katalog di sebelah kiri untuk memesan.
                  </p>
                </div>
              ) : (
                orderCart.map((item, cartIdx) => (
                  <div key={item.cartItemId || `${item.name}-${cartIdx}`} className="flex flex-col gap-1.5 pt-2 first:pt-0">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-100 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <span className="material-symbols-outlined text-base">restaurant</span>
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-slate-900 leading-snug line-clamp-1">
                              {item.name}
                            </span>
                            {item.isPromo && (
                              <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 font-bold text-[9px] border border-rose-200">
                                PROMO
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[10px]">
                            {item.isPromo && item.originalPrice && item.originalPrice > item.price && (
                              <span className="text-slate-400 line-through">
                                @{formatCurrency(item.originalPrice)}
                              </span>
                            )}
                            <span className={item.isPromo ? "text-rose-700 font-bold" : "text-slate-400"}>
                              @{formatCurrency(item.price)}
                            </span>
                          </div>
                          {/* Pelengkap Badge di Keranjang POS */}
                          {item.selectedAddons && item.selectedAddons.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.selectedAddons.map((addon, aIdx) => (
                                <span
                                  key={aIdx}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 font-bold text-[9px]"
                                >
                                  <span className="text-amber-600 font-bold">+</span>
                                  <span>{addon.name}</span>
                                  <span className="text-amber-700/80 font-normal">
                                    (+{formatCurrency(addon.price)})
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="font-black text-xs text-slate-900 shrink-0">
                        {formatCurrency(item.price * item.qty)}
                      </span>
                    </div>

                    {/* Stepper & Note Row (Touch-Friendly Tablet Sized) */}
                    <div className="flex items-center justify-between gap-2.5 pt-1">
                      {/* Note Input */}
                      <input
                        type="text"
                        value={item.note || ""}
                        onChange={(e) => handleUpdateCartNote(cartIdx, e.target.value)}
                        placeholder="Catatan item (pedas, sedikit es)..."
                        className="flex-1 px-3 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/70 rounded-xl border border-slate-200 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-primary transition-all"
                      />

                      {/* Stepper with Large 38px Touch Targets */}
                      <div className="flex items-center gap-1.5 shrink-0 bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60">
                        <button
                          type="button"
                          onClick={() => handleUpdateCartQty(cartIdx, -1)}
                          className="w-9 h-9 rounded-lg bg-white hover:bg-slate-200 active:scale-90 text-slate-700 flex items-center justify-center font-bold shadow-2xs cursor-pointer transition-all"
                          title={item.qty === 1 ? "Hapus dari Keranjang" : "Kurangi 1"}
                        >
                          <span className="material-symbols-outlined text-base">
                            {item.qty === 1 ? "delete" : "remove"}
                          </span>
                        </button>
                        <span className="w-7 text-center font-black text-sm text-slate-900 select-none">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateCartQty(cartIdx, 1)}
                          className="w-9 h-9 rounded-lg bg-primary hover:bg-primary/90 active:scale-90 text-white flex items-center justify-center font-bold shadow-2xs cursor-pointer transition-all"
                          title="Tambah 1"
                        >
                          <span className="material-symbols-outlined text-base">add</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Fixed Bottom Summary & Action (Always pinned at bottom, never pushed off) */}
          <div className="shrink-0 flex flex-col gap-2 pt-2 border-t border-slate-100 bg-white z-10">
              {/* Promo / Diskon Trigger Pill Takeaway */}
              <div
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all ${
                  takeawayDiscountAmount > 0
                    ? "bg-amber-50/80 border-amber-200"
                    : takeawayPromo && takeawayPromo.minOrderAmount && cartSubtotal < takeawayPromo.minOrderAmount
                    ? "bg-amber-100/70 border-amber-300"
                    : takeawayMemberPromos.length > 0
                    ? "bg-gradient-to-r from-amber-100/90 to-emerald-50 border-amber-300 shadow-2xs"
                    : "bg-amber-50/80 border-amber-200"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs min-w-0">
                  <span
                    className={`material-symbols-outlined text-base shrink-0 ${
                      takeawayMemberPromos.length > 0 && takeawayDiscountAmount === 0 && !takeawayPromo
                        ? "text-amber-600 animate-pulse"
                        : "text-amber-700"
                    }`}
                  >
                    {takeawayPromo && takeawayPromo.minOrderAmount && cartSubtotal < takeawayPromo.minOrderAmount
                      ? "warning"
                      : takeawayMemberPromos.length > 0 && takeawayDiscountAmount === 0 && !takeawayPromo
                      ? "stars"
                      : "local_offer"}
                  </span>
                  {takeawayDiscountAmount > 0 ? (
                    <span className="font-bold text-amber-900 truncate">
                      {takeawayDiscountLabel} (-{formatCurrency(takeawayDiscountAmount)})
                    </span>
                  ) : takeawayPromo && takeawayPromo.minOrderAmount && cartSubtotal < takeawayPromo.minOrderAmount ? (
                    <span className="font-bold text-amber-900 text-[11px] truncate flex items-center gap-1">
                      <span>{takeawayPromo.name}: Kurang {formatCurrency(takeawayPromo.minOrderAmount - cartSubtotal)}</span>
                    </span>
                  ) : takeawayMemberPromos.length > 0 ? (
                    <span className="font-bold text-amber-950 text-[11px] truncate flex items-center gap-1">
                      <span>Ada {takeawayMemberPromos.length} Promo Khusus Member Siap Digunakan!</span>
                    </span>
                  ) : (
                    <span className="font-medium text-amber-800 text-[11px] truncate">
                      Gunakan Promo / Diskon
                    </span>
                  )}
                </div>
                {takeawayDiscountAmount > 0 ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setPromoModalState({
                          isOpen: true,
                          target: "takeaway",
                          activeTab: "promos",
                          customType: "percentage",
                          customValue: 10,
                          customReason: "",
                        })
                      }
                      className="px-2 py-0.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-[#003629] text-[10px] font-bold cursor-pointer transition-colors shadow-2xs"
                      title="Lihat atau ganti promo lain"
                    >
                      Lihat Promo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTakeawayPromo(null);
                        setTakeawayCustomDiscount(null);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-[10px] font-bold cursor-pointer transition-colors"
                    >
                      Hapus
                    </button>
                  </div>
                ) : takeawayPromo && takeawayPromo.minOrderAmount && cartSubtotal < takeawayPromo.minOrderAmount ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setPromoModalState({
                          isOpen: true,
                          target: "takeaway",
                          activeTab: "promos",
                          customType: "percentage",
                          customValue: 10,
                          customReason: "",
                        })
                      }
                      className="px-2 py-0.5 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-950 text-[10px] font-bold cursor-pointer transition-colors shadow-2xs"
                    >
                      Ganti
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTakeawayPromo(null);
                        setTakeawayCustomDiscount(null);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-[10px] font-bold cursor-pointer transition-colors"
                    >
                      Hapus
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setPromoModalState({
                        isOpen: true,
                        target: "takeaway",
                        activeTab: "promos",
                        customType: "percentage",
                        customValue: 10,
                        customReason: "",
                      })
                    }
                    className="px-2.5 py-1 rounded-lg bg-[#003629] hover:bg-[#1a4a3e] active:scale-95 text-white text-[10px] font-bold cursor-pointer shadow-2xs shrink-0 flex items-center gap-1"
                  >
                    <span>{takeawayMemberPromos.length > 0 ? "Lihat Promo" : "+ Pilih Promo"}</span>
                    {takeawayMemberPromos.length > 0 && (
                      <span className="w-4 h-4 rounded-full bg-amber-400 text-amber-950 font-bold text-[9px] flex items-center justify-center">
                        {takeawayMemberPromos.length}
                      </span>
                    )}
                  </button>
                )}
              </div>

              <div className="bg-[#eff4ff] rounded-xl p-2.5 flex flex-col gap-1 text-[11px]">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Subtotal ({orderCart.reduce((s, i) => s + i.qty, 0)} Item)</span>
                  <span className="font-medium text-slate-800">{formatCurrency(cartSubtotal)}</span>
                </div>
                {cartPromoSubtotal > 0 && cartNormalSubtotal > 0 && (
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pl-2">
                    <span>• Menu Promo:</span>
                    <span>{formatCurrency(cartPromoSubtotal)}</span>
                  </div>
                )}
                {cartPromoSubtotal > 0 && cartNormalSubtotal > 0 && (
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pl-2">
                    <span>• Menu Reguler (Dapat Diskon Voucher):</span>
                    <span>{formatCurrency(cartNormalSubtotal)}</span>
                  </div>
                )}
                {takeawayDiscountAmount > 0 && (
                  <div className="flex flex-col gap-0.5 text-red-600 font-medium">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">sell</span>
                        <span>Diskon ({takeawayDiscountLabel})</span>
                      </span>
                      <span>-{formatCurrency(takeawayDiscountAmount)}</span>
                    </div>
                    {cartPromoSubtotal > 0 && (
                      <span className="text-[9px] text-emerald-800 italic pl-5">
                        *Voucher dihitung dari menu berharga reguler (Model B)
                      </span>
                    )}
                  </div>
                )}
                {takeawayPromo && cartNormalSubtotal === 0 && cartPromoSubtotal > 0 && (
                  <div className="text-[10px] text-amber-800 bg-amber-100/70 p-1.5 rounded-lg border border-amber-300">
                    Semua menu dalam pesanan ini sudah berharga promo. Voucher tidak dapat digabung dengan promo produk (Model B).
                  </div>
                )}
                {settings.taxEnabled && (settings.taxRate ?? 0) > 0 && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Pajak Restoran PB1 ({settings.taxRate}%)</span>
                    <span className="font-medium text-slate-800">{formatCurrency(cartTax)}</span>
                  </div>
                )}
                {settings.serviceChargeEnabled && (settings.serviceChargeRate ?? 0) > 0 && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Biaya Layanan ({settings.serviceChargeRate}%)</span>
                    <span className="font-medium text-slate-800">{formatCurrency(cartService)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1.5 mt-0.5 border-t border-blue-200/60">
                  <span className="font-bold text-xs text-slate-900 tracking-tight">
                    TOTAL TAGIHAN
                  </span>
                  <span className="font-black text-2xl text-[#003629] tracking-tight">
                    {formatCurrency(cartFinalTotal)}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Tunggal & Bersih (Metode Pembayaran ada di dalam Pop-up) */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCancelOrderingMode}
                  className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs sm:text-sm cursor-pointer transition-all"
                >
                  Batal (Esc)
                </button>

                {orderingMode === "takeaway" ? (
                  <button
                    type="button"
                    id="btn-submit-takeaway"
                    onClick={() => {
                      if (orderCart.length === 0) {
                        showToast("Pilih minimal 1 menu makanan terlebih dahulu!", "error");
                        return;
                      }
                      openPaymentPopup("cash", "takeaway");
                    }}
                    disabled={orderCart.length === 0 || isSubmittingOrder}
                    className="flex-1 py-3 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer bg-[#003629] hover:bg-[#00261d] active:scale-[0.99] text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-base">point_of_sale</span>
                    <span>{isSubmittingOrder ? "Memproses..." : `Proses Bayar (${formatCurrency(cartFinalTotal)})`}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    id="btn-submit-ojol"
                    onClick={handleSubmitOjol}
                    disabled={orderCart.length === 0 || !ojolExternalId.trim() || isSubmittingOrder}
                    className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer ${orderCart.length === 0 || !ojolExternalId.trim() || isSubmittingOrder
                        ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                        : "bg-secondary hover:bg-secondary/90 active:scale-[0.99] text-white"
                      }`}
                  >
                    <span className="material-symbols-outlined text-base">soup_kitchen</span>
                    <span>{isSubmittingOrder ? "Mengirim..." : "Kirim ke Dapur (Cetak Struk)"}</span>
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Header (Fixed, Shrink-0): Table Pill Badge & Customer Name */}
            <div className="flex items-center justify-between shrink-0 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="bg-[#003629] text-white font-bold text-xs px-2.5 py-1 rounded-md tracking-wider uppercase shrink-0">
                  {selectedTableNumber}
                </span>
                <h2 className="font-bold text-lg md:text-xl text-slate-900 tracking-tight truncate">
                  {selectedTableInfo?.status === "tersedia"
                    ? "Meja Tersedia"
                    : selectedTableInfo?.status === "reservasi"
                      ? `Reservasi: ${selectedTableInfo.customerName || "Tamu"}`
                      : activeOrder?.guestSubtext || selectedTableInfo?.customerName || "Tamu Meja"}
                </h2>
              </div>

              {/* Tombol Pindah Meja untuk meja yang sedang terisi */}
              {selectedTableInfo?.status === "terisi" && (
                <button
                  type="button"
                  id="btn-pos-pindah-meja-selected"
                  onClick={() => handleOpenMoveTable(selectedTableInfo)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-xs font-bold text-on-surface shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0"
                  title="Pindahkan sesi meja ini ke meja lain yang tersedia"
                >
                  <span className="material-symbols-outlined text-sm text-primary">sync_alt</span>
                  <span className="hidden sm:inline">Pindah Meja</span>
                </button>
              )}
            </div>

            {/* Subtitle Order Info (Fixed, Shrink-0) */}
            <p className="text-[11px] text-slate-500 -mt-1 shrink-0 truncate">
              {selectedTableInfo?.status === "tersedia" ? (
                <span>Meja siap ditempati • Kapasitas {selectedTableInfo.capacity} Tamu ({selectedTableInfo.areaLabel})</span>
              ) : selectedTableInfo?.status === "reservasi" ? (
                <span>Reservasi: {selectedTableInfo.reservationTime} • {selectedTableInfo.capacity} Tamu</span>
              ) : (
                <span>
                  Order {activeOrder?.orderNumber || selectedTableInfo?.orderNumber || `#PN-${selectedTableNumber.replace(/\D/g, "") || "00"}`} • Buka {activeOrder?.orderTime || "Hari ini"} ({activeOrder?.timeAgo || "Aktif"})
                </span>
              )}
            </p>

            {/* SUCCESS STATE AFTER PAYMENT (Meja Otomatis Menjadi Tersedia) */}
            {justPaidTable && justPaidTable.tableNumber === selectedTableNumber ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 bg-[#e8f7ee] border border-[#a6e6b8] rounded-2xl p-5">
                <div className="w-12 h-12 rounded-full bg-[#006e33] text-white flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-2xl font-bold">check</span>
                </div>
                <div className="flex flex-col">
                  <h3 className="font-bold text-lg text-[#003629]">Transaksi Berhasil &amp; Lunas</h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Order {justPaidTable.orderNumber} ({justPaidTable.tableNumber}) sebesar {formatCurrency(justPaidTable.total)} telah dibayar.
                  </p>
                  <div className="mt-2 py-1 px-3 rounded-full bg-[#006e33]/10 text-[#006e33] text-xs font-bold self-center border border-[#006e33]/20">
                    Status {justPaidTable.tableNumber} kini otomatis: TERSEDIA
                  </div>
                </div>
                <div className="flex gap-2 w-full pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeOrder) onPrintTicket(activeOrder);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">print</span>
                    <span>Cetak Ulang Struk</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setJustPaidTable(null);
                      const nextOccupied = tables.find((t) => t.status === "terisi" && t.tableNumber !== selectedTableNumber);
                      if (nextOccupied) setSelectedTableNumber(nextOccupied.tableNumber);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
                  >
                    Pilih Meja Lain
                  </button>
                </div>
              </div>
            ) : selectedTableInfo?.status === "tersedia" ? (
              /* STATE IF SELECTED TABLE IS TERSEDIA */
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-6 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">table_restaurant</span>
                </div>
                <div className="flex flex-col">
                  <div className="inline-flex items-center justify-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold mx-auto mb-1">
                    <span className="material-symbols-outlined text-xs">check_circle</span>
                    <span>Meja Tersedia</span>
                  </div>
                  <h3 className="font-bold text-base text-on-surface">
                    {selectedTableNumber.startsWith("Meja") ? selectedTableNumber : `Meja ${selectedTableNumber}`} Kosong & Siap Dipakai
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-1 max-w-sm">
                    Customer langsung menempati meja ini dan melakukan pemesanan makanan via <strong>Scan QR Code di Meja</strong>. Sesi meja akan terisi otomatis saat customer mengirim pesanan.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full pt-2">
                  <button
                    type="button"
                    onClick={() => handleOpenReservationModal(selectedTableInfo)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs hover:bg-primary/90 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">event_seat</span>
                    <span>+ Buat Reservasi Meja</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const token = selectedTableInfo?.qrToken || "tbl-token-01-xyz";
                      window.open(`/menu/${token}`, "_blank");
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-outline-variant/30"
                    title="Buka QR menu di tab baru untuk preview pemesanan customer"
                  >
                    <span className="material-symbols-outlined text-sm">qr_code_2</span>
                    <span>Preview Menu QR</span>
                  </button>
                </div>
              </div>
            ) : selectedTableInfo?.status === "reservasi" ? (
              /* STATE IF SELECTED TABLE IS RESERVASI */
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-6 rounded-2xl bg-[#fff8e6] border border-[#ffd580]">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-[#8a5b00] flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">calendar_month</span>
                </div>
                <div className="flex flex-col">
                  <h3 className="font-bold text-base text-slate-900">
                    Reservasi {selectedTableNumber.startsWith("Meja") ? selectedTableNumber : `Meja ${selectedTableNumber}`}
                  </h3>
                  <p className="text-xs text-slate-700 mt-1">
                    Nama Pemesan: <span className="font-bold">{selectedTableInfo.customerName}</span>
                  </p>
                  <p className="text-xs text-amber-900 font-bold mt-0.5">
                    Waktu Kedatangan: {selectedTableInfo.reservationTime}
                  </p>
                </div>
                <div className="flex gap-2 w-full pt-2">
                  <button
                    type="button"
                    onClick={() => handleOpenCancelModal(selectedTableInfo)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-error-container text-on-error-container font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-error-container/80 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">cancel</span>
                    <span>Batalkan Reservasi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleActivateReservation(selectedTableInfo)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-primary/90 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">how_to_reg</span>
                    <span>Tamu Hadir (Mulai Makan)</span>
                  </button>
                </div>
              </div>
            ) : (
              /* STATE IF SELECTED TABLE IS TERISI (ACTIVE BILL & PAYMENT) */
              <>
                {/* Middle Scrollable Section: Member Customer + Promo Suggestions + Kitchen/Waiter Alerts + Cart Items */}
                <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-2.5 scrollbar-thin scrollbar-thumb-slate-200">
                  {/* Member / Customer Badge Dine-in */}
                  {selectedTableCustomer ? (
                    <div className="shrink-0 flex items-center justify-between px-3 py-1.5 rounded-xl bg-purple-50/80 border border-purple-200">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-purple-700 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                          {selectedTableCustomer.name.charAt(0)}
                        </span>
                        <span className="font-bold text-xs text-purple-950 truncate">{selectedTableCustomer.name}</span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded shrink-0 ${selectedTableCustomer.tier === "vip" ? "bg-purple-200 text-purple-900 border border-purple-300" :
                            selectedTableCustomer.tier === "gold" ? "bg-amber-200 text-amber-900 border border-amber-300" :
                              selectedTableCustomer.tier === "silver" ? "bg-slate-200 text-slate-800" : "bg-emerald-200 text-emerald-900"
                          }`}>
                          {selectedTableCustomer.tier.toUpperCase()}
                        </span>
                        <span className="text-[11px] text-amber-800 font-bold shrink-0 hidden sm:inline">★ {selectedTableCustomer.points} Poin</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTableCustomer(null);
                          if (tablePromo && tablePromo.customerScope !== "all") {
                            setTablePromo(null);
                          }
                        }}
                        className="text-slate-400 hover:text-red-600 text-[11px] font-bold shrink-0 ml-2 cursor-pointer"
                      >
                        Ganti
                      </button>
                    </div>
                  ) : (
                    <div className="shrink-0 flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <span className="text-slate-500 text-[11px]">Belum terhubung ke Member Resto</span>
                      <button
                        type="button"
                        onClick={() =>
                          setCustomerModalState({
                            isOpen: true,
                            target: "table",
                            search: "",
                            isAddingNew: false,
                            newCustomer: { name: "", phone: "", email: "", tier: "regular", notes: "" },
                          })
                        }
                        className="text-[11px] font-bold text-[#003629] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[13px]">person_add</span>
                        Hubungkan Member
                      </button>
                    </div>
                  )}

                  {/* Special Note / Allergy Alert from Customer */}
                  {selectedTableCustomer?.notes && (
                    <div className="shrink-0 p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-1.5">
                      <span className="material-symbols-outlined text-amber-600 text-sm shrink-0 mt-0.5">warning</span>
                      <div>
                        <span className="font-bold">Catatan Selera / Alergi: </span>
                        <span>{selectedTableCustomer.notes}</span>
                      </div>
                    </div>
                  )}

                  {/* Live Kitchen & Waiter Sync Status Alert Pill */}
                {(activeOrder?.kitchenStatus === "ready" || selectedTableInfo?.foodStatus === "ready") ? (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-2.5 flex items-center justify-between shrink-0 shadow-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-lg animate-bounce">room_service</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-xs text-orange-950 truncate">
                          Status Dapur: SIAP SAJI!
                        </span>
                        <span className="text-[10px] text-orange-800 truncate">
                          Makanan selesai dimasak, waiter sedang mengantar ke meja
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-orange-600 text-white font-bold text-[10px] shrink-0">
                      SIAP DIANTAR
                    </span>
                  </div>
                ) : (activeOrder?.kitchenStatus === "in_progress" || selectedTableInfo?.foodStatus === "in_progress" || selectedTableInfo?.isProcessing) ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-lg animate-pulse">skillet</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-xs text-amber-950 truncate">
                          Status Dapur: Sedang Dimasak
                        </span>
                        <span className="text-[10px] text-amber-800 truncate">
                          Sedang diproses oleh koki di monitor dapur (KDS)
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-amber-600 text-white font-bold text-[10px] shrink-0">
                      DIMASAK
                    </span>
                  </div>
                ) : (activeOrder?.kitchenStatus === "completed" || selectedTableInfo?.foodStatus === "served") ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-base">check_circle</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-xs text-emerald-950 truncate">
                          Semua Makanan Sudah Disajikan
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-700 text-white font-bold text-[10px] shrink-0">
                      DISAJIKAN
                    </span>
                  </div>
                ) : null}

                {/* Waiter SOP Banner: Lembar Kontrol Pelayan (Fixed, Shrink-0) */}
                <div className="bg-[#fef8ed] border border-[#fde7c7] rounded-xl p-2.5 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#fff1dd] flex items-center justify-center text-[#d97706] shrink-0">
                      <span className="material-symbols-outlined text-xl">menu_book</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-xs text-slate-900 leading-tight truncate">
                        Lembar Kontrol Pelayan
                      </span>
                      <span className="text-[10px] text-slate-500 leading-tight truncate mt-0.5">
                        Checklist sajian meja
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeOrder) {
                        onPrintWaiterSheet(selectedTableNumber, activeOrder);
                      }
                    }}
                    className="bg-[#fe932c] hover:bg-[#e07d1c] active:scale-95 text-white font-bold text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-xs transition-all cursor-pointer shrink-0"
                  >
                    <span className="material-symbols-outlined text-sm">print</span>
                    <span>Cetak Lembar</span>
                  </button>
                </div>

                {/* Items Ordered Table Header (Fixed, Shrink-0) */}
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-1 border-t border-slate-100 shrink-0">
                  <span>ITEM PESANAN ({activeOrder?.items ? activeOrder.items.length : (subtotal > 0 ? 1 : 0)})</span>
                  <span>SUBTOTAL</span>
                </div>

                {/* Items Ordered List */}
                <div className="flex flex-col gap-2 my-0.5 divide-y divide-slate-100 shrink-0">
                  {activeOrder?.items && activeOrder.items.length > 0 ? (
                    activeOrder.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start pt-1.5 first:pt-0">
                        <div className="flex flex-col pr-2">
                          <span className="font-bold text-xs text-slate-900 leading-snug">
                            {item.qty}x {item.name}
                          </span>
                          {/* Pelengkap Badge di Lembar Kasir POS */}
                          {item.selectedAddons && item.selectedAddons.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.selectedAddons.map((addon, aIdx) => (
                                <span
                                  key={aIdx}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 font-bold text-[9px]"
                                >
                                  <span className="text-amber-600 font-bold">+</span>
                                  <span>{addon.name}</span>
                                  <span className="text-amber-700/80 font-normal">
                                    (+{formatCurrency(addon.price)})
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                          {item.note && (
                            <span className="text-[10px] italic text-rose-600 mt-0.5">
                              Catatan: {item.note}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            @{formatCurrency(item.price)}
                          </span>
                        </div>
                        <span className="font-bold text-xs text-slate-900 shrink-0">
                          {formatCurrency(item.price * item.qty)}
                        </span>
                      </div>
                    ))
                  ) : selectedTableInfo?.status === "terisi" && (selectedTableInfo.amount || 0) > 0 ? (
                    <div className="flex justify-between items-start pt-1.5 first:pt-0">
                      <div className="flex flex-col pr-2">
                        <span className="font-bold text-xs text-slate-900 leading-snug">
                          Pesanan {selectedTableNumber} ({selectedTableInfo.customerName || "Tamu"})
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          Order {selectedTableInfo.orderNumber || "-"}
                        </span>
                      </div>
                      <span className="font-bold text-xs text-slate-900 shrink-0">
                        {formatCurrency(selectedTableInfo.amount || 0)}
                      </span>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-center p-3 text-slate-400 text-xs font-medium">
                      Belum ada item pesanan
                    </div>
                  )}
                </div>
              </div>

              {/* ========================================================
                    BOTTOM SECTION: FIXED PINNED AT BOTTOM!
                    Informasi pelanggan, total tagihan, metode pembayaran,
                    nominal tunai, kembalian, dan tombol konfirmasi tetap terlihat!
                   ======================================================== */}
              <div className="shrink-0 flex flex-col gap-2 pt-2 border-t border-slate-100 bg-white z-10">
                  {/* Promo / Diskon Trigger Pill Dine-in */}
                  <div
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all ${
                      discountAmount > 0
                        ? "bg-amber-50/80 border-amber-200"
                        : tablePromo && tablePromo.minOrderAmount && subtotal < tablePromo.minOrderAmount
                        ? "bg-amber-100/70 border-amber-300"
                        : dineInMemberPromos.length > 0
                        ? "bg-gradient-to-r from-amber-100/90 to-emerald-50 border-amber-300 shadow-2xs"
                        : "bg-amber-50/80 border-amber-200"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs min-w-0">
                      <span
                        className={`material-symbols-outlined text-base shrink-0 ${
                          dineInMemberPromos.length > 0 && discountAmount === 0 && !tablePromo
                            ? "text-amber-600 animate-pulse"
                            : "text-amber-700"
                        }`}
                      >
                        {tablePromo && tablePromo.minOrderAmount && subtotal < tablePromo.minOrderAmount
                          ? "warning"
                          : dineInMemberPromos.length > 0 && discountAmount === 0 && !tablePromo
                          ? "stars"
                          : "local_offer"}
                      </span>
                      {discountAmount > 0 ? (
                        <span className="font-bold text-amber-900 truncate">
                          {discountLabel} (-{formatCurrency(discountAmount)})
                        </span>
                      ) : tablePromo && tablePromo.minOrderAmount && subtotal < tablePromo.minOrderAmount ? (
                        <span className="font-bold text-amber-900 text-[11px] truncate flex items-center gap-1">
                          <span>{tablePromo.name}: Kurang {formatCurrency(tablePromo.minOrderAmount - subtotal)}</span>
                        </span>
                      ) : dineInMemberPromos.length > 0 ? (
                        <span className="font-bold text-amber-950 text-[11px] truncate flex items-center gap-1">
                          <span>Ada {dineInMemberPromos.length} Promo Khusus Member Siap Digunakan!</span>
                        </span>
                      ) : (
                        <span className="font-medium text-amber-800 text-[11px] truncate">
                          Punya Promo / Diskon Khusus?
                        </span>
                      )}
                    </div>
                    {discountAmount > 0 ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setPromoModalState({
                              isOpen: true,
                              target: "table",
                              activeTab: "promos",
                              customType: "percentage",
                              customValue: 10,
                              customReason: "",
                            })
                          }
                          className="px-2 py-0.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-[#003629] text-[10px] font-bold cursor-pointer transition-colors shadow-2xs"
                          title="Lihat atau ganti promo lain"
                        >
                          Lihat Promo
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTablePromo(null);
                            setTableCustomDiscount(null);
                          }}
                          className="px-2 py-0.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          Hapus
                        </button>
                      </div>
                    ) : tablePromo && tablePromo.minOrderAmount && subtotal < tablePromo.minOrderAmount ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setPromoModalState({
                              isOpen: true,
                              target: "table",
                              activeTab: "promos",
                              customType: "percentage",
                              customValue: 10,
                              customReason: "",
                            })
                          }
                          className="px-2 py-0.5 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-950 text-[10px] font-bold cursor-pointer transition-colors shadow-2xs"
                        >
                          Ganti
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTablePromo(null);
                            setTableCustomDiscount(null);
                          }}
                          className="px-2 py-0.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          Hapus
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setPromoModalState({
                            isOpen: true,
                            target: "table",
                            activeTab: "promos",
                            customType: "percentage",
                            customValue: 10,
                            customReason: "",
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-[#003629] hover:bg-[#1a4a3e] active:scale-95 text-white text-[10px] font-bold cursor-pointer shadow-2xs shrink-0 flex items-center gap-1"
                      >
                        <span>{dineInMemberPromos.length > 0 ? "Lihat Promo" : "+ Pilih Promo"}</span>
                        {dineInMemberPromos.length > 0 && (
                          <span className="w-4 h-4 rounded-full bg-amber-400 text-amber-950 font-bold text-[9px] flex items-center justify-center">
                            {dineInMemberPromos.length}
                          </span>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Financial Ledger Box */}
                  <div className="bg-[#eff4ff] rounded-xl p-2.5 flex flex-col gap-1 text-[11px]">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Subtotal ({activeOrder?.items ? activeOrder.items.length : (subtotal > 0 ? 1 : 0)} Item)</span>
                      <span className="font-medium text-slate-800">{formatCurrency(subtotal)}</span>
                    </div>
                    {dineInPromoSubtotal > 0 && dineInNormalSubtotal > 0 && (
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pl-2">
                        <span>• Menu Promo:</span>
                        <span>{formatCurrency(dineInPromoSubtotal)}</span>
                      </div>
                    )}
                    {dineInPromoSubtotal > 0 && dineInNormalSubtotal > 0 && (
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pl-2">
                        <span>• Menu Reguler (Dapat Diskon Voucher):</span>
                        <span>{formatCurrency(dineInNormalSubtotal)}</span>
                      </div>
                    )}
                    {discountAmount > 0 && (
                      <div className="flex flex-col gap-0.5 text-red-600 font-medium">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">sell</span>
                            <span>Diskon ({discountLabel})</span>
                          </span>
                          <span>-{formatCurrency(discountAmount)}</span>
                        </div>
                        {dineInPromoSubtotal > 0 && (
                          <span className="text-[9px] text-emerald-800 italic pl-5">
                            *Voucher dihitung dari menu berharga reguler (Model B)
                          </span>
                        )}
                      </div>
                    )}
                    {tablePromo && dineInNormalSubtotal === 0 && dineInPromoSubtotal > 0 && (
                      <div className="text-[10px] text-amber-800 bg-amber-100/70 p-1.5 rounded-lg border border-amber-300">
                        Semua menu dalam pesanan meja ini sudah berharga promo. Voucher tidak dapat digabung dengan promo produk (Model B).
                      </div>
                    )}
                    {settings.taxEnabled && (settings.taxRate ?? 0) > 0 && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Pajak Restoran PB1 ({settings.taxRate}%)</span>
                        <span className="font-medium text-slate-800">{formatCurrency(taxPB1)}</span>
                      </div>
                    )}
                    {settings.serviceChargeEnabled && (settings.serviceChargeRate ?? 0) > 0 && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Biaya Layanan ({settings.serviceChargeRate}%)</span>
                        <span className="font-medium text-slate-800">{formatCurrency(serviceCharge)}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1.5 mt-0.5 border-t border-blue-200/60">
                      <span className="font-bold text-xs text-slate-900 tracking-tight">
                        TOTAL TAGIHAN
                      </span>
                      <span className="font-black text-2xl text-[#003629] tracking-tight">
                        {formatCurrency(finalTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Tombol Utama Bayar Tagihan (Buka Pop-up Pembayaran) */}
                  <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      id="btn-confirm-direct-payment"
                      onClick={() => openPaymentPopup("cash", "table")}
                      className="w-full py-3.5 px-4 rounded-xl bg-[#003629] hover:bg-[#00261d] active:scale-[0.99] text-white font-black text-xs md:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">payments</span>
                      <span>Bayar Tagihan ({formatCurrency(finalTotal)})</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ========================================================
          MODAL PEMBAYARAN POP-UP (Desain Sesuai Lampiran Kasir)
          - 2 Kolom (Ringkasan Tagihan & Numpad Kasir)
          - Tunai / QRIS / Transfer
          - Cetak Struk Langsung
         ======================================================== */}
      {paymentPopup.isOpen && (() => {
        const totalToPay = paymentPopup.source === "table" ? finalTotal : cartFinalTotal;
        const change = Math.max(0, paymentPopup.amountPaid - totalToPay);
        const isSufficient = paymentPopup.amountPaid >= totalToPay;
        const underpaid = Math.max(0, totalToPay - paymentPopup.amountPaid);
        const rawPopupItems = paymentPopup.source === "table"
          ? (activeOrder?.items && activeOrder.items.length > 0
              ? activeOrder.items
              : selectedTableInfo?.orderData?.items || [])
          : orderCart;
        const displayItems = rawPopupItems.length > 0
          ? rawPopupItems
          : [{ name: "Pesanan Menu Restoran", qty: 1, price: totalToPay }];
        const popupOrderNumber = paymentPopup.source === "table"
          ? (activeOrder?.orderNumber || (selectedTableNumber ? `#${selectedTableNumber}` : "#PN-3400"))
          : `#TA-${Math.floor(Date.now() / 1000).toString().slice(-4)}`;
        const channelBadge = paymentPopup.source === "table" ? "Dine-in" : "Take Away";
        const tableOrGuestText = paymentPopup.source === "table"
          ? (selectedTableNumber || "Meja 01")
          : (takeawayCustomerName.trim() || "Pelanggan");
        const formattedTime = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(":", ".");

        return (
          <div
            id="modal-payment-popup-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPaymentPopup((prev) => ({ ...prev, isOpen: false }));
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
          >
            <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 max-h-[94vh]">

              {/* Header Pop-up */}
              <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#eef2f6] flex items-center justify-center text-slate-700 shrink-0">
                    <span className="material-symbols-outlined text-2xl font-bold">payments</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                        Pembayaran Tagihan {popupOrderNumber}
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#eef2f6] text-slate-700 border border-slate-200/60">
                        {channelBadge}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                      {tableOrGuestText} • {displayItems.length} Macam Menu
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentPopup((prev) => ({ ...prev, isOpen: false }))}
                  className="w-9 h-9 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-all"
                  title="Tutup Modal"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              {/* Body Pop-up - 2 Columns */}
              <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-5 overflow-y-auto flex-1">

                {/* Kolom Kiri: 5 cols */}
                <div className="md:col-span-5 flex flex-col gap-4">

                  {/* Card 1: TOTAL YANG HARUS DIBAYAR */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#003629] text-white flex flex-col justify-between shadow-sm min-h-[112px]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-200/90">
                      TOTAL YANG HARUS DIBAYAR
                    </span>
                    <span className="text-3xl font-black text-white tracking-tight my-1">
                      {formatCurrency(totalToPay)}
                    </span>
                    <div className="flex items-center justify-between text-xs text-emerald-100/90 font-medium pt-1 border-t border-emerald-800/60">
                      <span>{tableOrGuestText}</span>
                      <span>{formattedTime} WIB</span>
                    </div>
                  </div>

                  {/* Section 2: PILIH METODE PEMBAYARAN */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      PILIH METODE PEMBAYARAN
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentPopup((prev) => ({ ...prev, mode: "cash" }))}
                        className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[72px] active:scale-95 ${
                          paymentPopup.mode === "cash"
                            ? "bg-[#003629] text-white shadow-xs"
                            : "bg-[#f0f4f9] text-slate-700 hover:bg-slate-200/70"
                        }`}
                      >
                        <span className="material-symbols-outlined text-2xl">payments</span>
                        <span className="text-xs font-bold leading-tight">Tunai</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentPopup((prev) => ({ ...prev, mode: "qris" }))}
                        className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[72px] active:scale-95 ${
                          paymentPopup.mode === "qris"
                            ? "bg-[#003629] text-white shadow-xs"
                            : "bg-[#f0f4f9] text-slate-700 hover:bg-slate-200/70"
                        }`}
                      >
                        <span className="material-symbols-outlined text-2xl">qr_code_2</span>
                        <span className="text-xs font-bold leading-tight">QRIS Statis</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentPopup((prev) => ({ ...prev, mode: "transfer" }))}
                        className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[72px] active:scale-95 ${
                          paymentPopup.mode === "transfer"
                            ? "bg-[#003629] text-white shadow-xs"
                            : "bg-[#f0f4f9] text-slate-700 hover:bg-slate-200/70"
                        }`}
                      >
                        <span className="material-symbols-outlined text-2xl">account_balance</span>
                        <span className="text-xs font-bold leading-tight">Transfer</span>
                      </button>
                    </div>
                  </div>

                  {/* Section 3: Rincian Item */}
                  <div className="p-4 rounded-2xl bg-[#f0f4f9] border border-slate-200/60 flex flex-col gap-2.5 flex-1 min-h-[170px]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">Rincian Item ({displayItems.length})</span>
                      <span className="font-semibold text-slate-400">Qty × Harga</span>
                    </div>
                    <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                      {displayItems.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 truncate pr-2">
                            <span className="font-bold text-slate-800">{it.qty}x</span>
                            <span className="font-semibold text-slate-800 truncate">{it.name}</span>
                          </div>
                          <span className="font-bold text-slate-800 shrink-0">
                            {formatCurrency(it.price * it.qty)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Kolom Kanan: 7 cols */}
                <div className="md:col-span-7 flex flex-col gap-3.5">

                  {/* KASUS 1: TUNAI (CASH) */}
                  {paymentPopup.mode === "cash" && (
                    <>
                      {/* Top Display Row: Uang Diterima & Kembalian Kasir */}
                      <div className="grid grid-cols-2 gap-3">
                        {/* Card A: UANG DITERIMA */}
                        <div className="p-3.5 rounded-2xl bg-[#f0f4f9] border border-slate-200/70 flex flex-col justify-between h-[84px]">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            UANG DITERIMA (RP)
                          </span>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-xs font-bold text-slate-400 select-none">Rp</span>
                            <span className="text-3xl font-black text-slate-900 tracking-tight text-right flex-1 truncate">
                              {paymentPopup.amountPaid > 0 ? paymentPopup.amountPaid.toLocaleString("id-ID") : "0"}
                            </span>
                          </div>
                        </div>

                        {/* Card B: KEMBALIAN KASIR */}
                        <div className="p-3.5 rounded-2xl bg-[#e6f4ea] border-2 border-emerald-500 flex flex-col justify-between h-[84px]">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                              {isSufficient ? "KEMBALIAN KASIR" : "KURANG"}
                            </span>
                            {isSufficient && (
                              <span className="material-symbols-outlined text-lg font-bold text-emerald-600">
                                check_circle
                              </span>
                            )}
                          </div>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-xs font-bold text-slate-400 select-none">Rp</span>
                            <span className="text-3xl font-black text-slate-900 tracking-tight text-right flex-1 truncate">
                              {isSufficient ? change.toLocaleString("id-ID") : `-${underpaid.toLocaleString("id-ID")}`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Section: PILIHAN UANG CEPAT (QUICK CASH) */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          PILIHAN UANG CEPAT (QUICK CASH):
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          {getPopupQuickCashOptions(totalToPay).map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setPaymentPopup((prev) => ({ ...prev, amountPaid: opt.value, isTouched: true }))}
                              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                                paymentPopup.amountPaid === opt.value
                                  ? "bg-[#003629] text-white shadow-xs"
                                  : "bg-[#e2edfd] hover:bg-blue-100 text-slate-800"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {/* Quick Add Chips */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                            TAMBAH:
                          </span>
                          {[10000, 20000, 50000, 100000].map((addVal) => (
                            <button
                              key={addVal}
                              type="button"
                              onClick={() => handlePopupQuickAdd(addVal)}
                              className="px-2.5 py-1 rounded-lg bg-[#e6f4ea] hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300 active:scale-95 transition-all cursor-pointer"
                            >
                              +{addVal >= 1000 ? `${addVal / 1000}rb` : addVal}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Virtual Touch Numpad Grid (4x4) */}
                      <div className="bg-[#f0f4f9] p-2.5 rounded-2xl border border-slate-200/70 shadow-2xs">
                        <div className="grid grid-cols-4 gap-2">
                          <button
                            type="button"
                            onClick={() => handlePopupNumpadDigit("1")}
                            className="h-12 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-bold text-lg border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all"
                          >
                            1
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePopupNumpadDigit("2")}
                            className="h-12 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-bold text-lg border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all"
                          >
                            2
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePopupNumpadDigit("3")}
                            className="h-12 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-bold text-lg border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all"
                          >
                            3
                          </button>
                          <button
                            type="button"
                            onClick={handlePopupNumpadBackspace}
                            className="h-12 rounded-xl bg-[#fff8e1] hover:bg-amber-100 active:scale-95 text-amber-900 border border-amber-200/80 shadow-2xs flex items-center justify-center font-bold cursor-pointer transition-all"
                            title="Hapus Satu Digit"
                          >
                            <span className="material-symbols-outlined text-xl">backspace</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePopupNumpadDigit("4")}
                            className="h-12 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-bold text-lg border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all"
                          >
                            4
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePopupNumpadDigit("5")}
                            className="h-12 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-bold text-lg border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all"
                          >
                            5
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePopupNumpadDigit("6")}
                            className="h-12 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-bold text-lg border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all"
                          >
                            6
                          </button>
                          <button
                            type="button"
                            onClick={handlePopupNumpadClear}
                            className="h-12 rounded-xl bg-[#fde8e8] hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200/80 shadow-2xs font-black text-base flex items-center justify-center cursor-pointer transition-all"
                            title="Reset Menjadi 0"
                          >
                            C
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePopupNumpadDigit("7")}
                            className="h-12 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-bold text-lg border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all"
                          >
                            7
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePopupNumpadDigit("8")}
                            className="h-12 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-bold text-lg border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all"
                          >
                            8
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePopupNumpadDigit("9")}
                            className="h-12 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-bold text-lg border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all"
                          >
                            9
                          </button>
                          <button
                            type="button"
                            onClick={handlePopupQuickExact}
                            className="h-12 rounded-xl bg-[#cbf4d8] hover:bg-emerald-200 active:scale-95 text-emerald-950 border border-emerald-300/80 shadow-2xs font-bold text-xs flex items-center justify-center cursor-pointer transition-all text-center leading-tight"
                            title="Gunakan Uang Pas"
                          >
                            Uang Pas
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePopupNumpadDigit("0")}
                            className="h-12 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-bold text-lg border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all"
                          >
                            0
                          </button>
                          <button
                            type="button"
                            onClick={handlePopupNumpadTripleZero}
                            className="col-span-2 h-12 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-bold text-sm sm:text-base border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all"
                          >
                            000 (Ribu)
                          </button>
                          <button
                            type="button"
                            onClick={handlePopupRound50k}
                            className="h-12 rounded-xl bg-[#eef2f6] hover:bg-slate-200 active:scale-95 text-slate-800 border border-slate-300 shadow-2xs font-bold text-xs flex items-center justify-center cursor-pointer transition-all text-center leading-tight"
                          >
                            Bulat 50k
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* KASUS 2: QRIS STATIS */}
                  {paymentPopup.mode === "qris" && (
                    <div className="flex flex-col items-center justify-center p-6 bg-[#f0f4f9] rounded-2xl gap-3 text-center border border-slate-200/70 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-xl font-bold">qr_code_2</span>
                        <span className="text-base font-extrabold text-slate-900">
                          {settings.staticQrLabel || "QRIS Kasir Pawon Nusantara"}
                        </span>
                      </div>

                      <div className="w-56 h-56 bg-white p-3 rounded-2xl shadow-sm border-2 border-slate-200 flex items-center justify-center overflow-hidden">
                        <img
                          src={
                            settings.staticQrImageUrl ||
                            "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=00020101021226670014ID.LINKAJA.WWW01189360001400000102035204581253033605802ID5915PAWON+NUSANTARA6007JAKARTA61051219062070703A016304"
                          }
                          alt={settings.staticQrLabel || "QRIS Statis"}
                          className="w-full h-full object-contain rounded-lg"
                        />
                      </div>

                      <div className="bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200 text-emerald-900 text-xs font-semibold max-w-sm">
                        {settings.staticQrInstructions ||
                          "Arahkan layar ini ke pelanggan untuk dipindai via BCA Mobile, GoPay, OVO, ShopeePay, atau DANA."}
                      </div>

                      <span className="text-[11px] text-slate-500 font-medium">
                        Mendukung semua pembayaran QRIS perbankan dan e-wallet nasional.
                      </span>
                    </div>
                  )}

                  {/* KASUS 3: TRANSFER BANK */}
                  {paymentPopup.mode === "transfer" && (() => {
                    const activeBankAccounts = (settings.bankAccounts || []).filter((b) => b.isActive !== false);
                    const currentBankId =
                      paymentPopup.selectedBankId ||
                      activeBankAccounts.find((b) => b.isDefault)?.id ||
                      activeBankAccounts[0]?.id ||
                      "";
                    const currentBank = activeBankAccounts.find((b) => b.id === currentBankId) || activeBankAccounts[0];

                    return (
                      <div className="flex flex-col p-5 bg-[#f0f4f9] rounded-2xl gap-3.5 border border-slate-200/70 flex-1 justify-center">
                        
                        {/* Jika ada lebih dari 1 rekening bank, tampilkan selector tab/pills */}
                        {activeBankAccounts.length > 1 && (
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                              Pilih Rekening Bank Tujuan ({activeBankAccounts.length}):
                            </span>
                            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                              {activeBankAccounts.map((acc) => {
                                const isSelected = acc.id === currentBank?.id;
                                return (
                                  <button
                                    key={acc.id}
                                    type="button"
                                    onClick={() =>
                                      setPaymentPopup((prev) => ({ ...prev, selectedBankId: acc.id }))
                                    }
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                                      isSelected
                                        ? "bg-[#003629] text-white shadow-xs scale-102"
                                        : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-sm">account_balance</span>
                                    <span>{acc.bankName}</span>
                                    {acc.isDefault && (
                                      <span
                                        className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                                          isSelected ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                                        }`}
                                      >
                                        Utama
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Kartu Detail Rekening Terpilih */}
                        <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col gap-3">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-black text-xs border border-emerald-200/60">
                                <span className="material-symbols-outlined text-base">account_balance</span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                  Bank Tujuan
                                </span>
                                <span className="text-sm font-black text-slate-900">
                                  {currentBank ? currentBank.bankName : "BCA"}
                                </span>
                              </div>
                            </div>
                            {currentBank?.isDefault && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Rekening Utama
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div className="flex flex-col">
                              <span className="text-[11px] font-bold text-slate-500">Nomor Rekening</span>
                              <span className="text-base sm:text-lg font-mono font-black text-slate-900 tracking-wide">
                                {currentBank
                                  ? currentBank.accountNumber
                                  : settings.bankTransferInstructions || "8830123456"}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const no = currentBank ? currentBank.accountNumber : "8830123456";
                                navigator.clipboard.writeText(no);
                                showToast(`Nomor rekening ${no} disalin ke clipboard!`, "success");
                              }}
                              className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-xs font-bold text-slate-800 border border-slate-200 shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
                            >
                              <span className="material-symbols-outlined text-sm">content_copy</span>
                              <span>Salin</span>
                            </button>
                          </div>

                          <div className="flex items-center justify-between px-1">
                            <span className="text-xs text-slate-500 font-medium">Atas Nama (a/n):</span>
                            <span className="text-xs sm:text-sm font-black text-slate-800 uppercase">
                              {currentBank ? currentBank.accountName : "PT PAWON NUSANTARA JAYA"}
                            </span>
                          </div>
                        </div>

                        {/* Input Nomor Referensi Transfer / Bukti */}
                        <div>
                          <label className="text-xs font-bold text-slate-600 block mb-1">
                            Nomor Referensi Transfer / Nama Pengirim (Opsional):
                          </label>
                          <input
                            type="text"
                            value={paymentPopup.transferRef}
                            onChange={(e) => setPaymentPopup((prev) => ({ ...prev, transferRef: e.target.value }))}
                            placeholder="Contoh: REF-8829103 atau a/n Budi"
                            className="w-full px-3.5 py-2.5 bg-white rounded-xl text-slate-900 border border-slate-200 font-mono text-sm focus:outline-none focus:border-primary shadow-inner"
                          />
                        </div>

                        <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2">
                          <span className="material-symbols-outlined text-base text-amber-700 shrink-0 mt-0.5">info</span>
                          <span>Kasir wajib memeriksa mutasi rekening atau bukti transfer pelanggan sebelum menekan tombol konfirmasi lunas.</span>
                        </div>
                      </div>
                    );
                  })()}

                </div>

              </div>

              {/* Footer Pop-up */}
              <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setPaymentPopup((prev) => ({ ...prev, isOpen: false }))}
                  className="h-12 px-6 rounded-xl bg-[#f0f4f9] hover:bg-slate-200 active:scale-95 text-slate-800 font-bold text-sm cursor-pointer transition-all"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handlePopupFinalConfirmAndPrint}
                  disabled={paymentPopup.mode === "cash" && paymentPopup.amountPaid < totalToPay}
                  className="h-12 px-6 rounded-xl bg-[#003629] hover:bg-[#00261d] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md flex items-center gap-2 cursor-pointer transition-all"
                >
                  <span className="material-symbols-outlined text-lg">print</span>
                  <span>Konfirmasi Lunas &amp; Cetak Struk</span>
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ========================================================
          MODAL 1: RESERVASI MEJA (Popup Pemesanan & Jadwal)
         ======================================================== */}
      {reservationModal.isOpen && reservationModal.table && (
        <div
          id="modal-reservation-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReservationModal({ isOpen: false, table: null });
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 bg-primary text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-xl">event_seat</span>
                <div className="flex flex-col">
                  <h3 className="font-bold text-base leading-tight">
                    Reservasi {reservationModal.table.tableNumber}
                  </h3>
                  <span className="text-xs text-white/80">
                    {reservationModal.table.areaLabel} • Kapasitas {reservationModal.table.capacity} Tamu
                  </span>
                </div>
              </div>
              <button
                type="button"
                id="btn-close-reservation-x"
                onClick={() => setReservationModal({ isOpen: false, table: null })}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveReservation} className="p-5 flex flex-col gap-3.5 text-xs">
              {/* Nama Pemesan */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-800">
                  Nama Pemesan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  id="input-res-customer-name"
                  placeholder="Contoh: Bpk. Bambang Sutrisno"
                  value={resCustomerName}
                  onChange={(e) => setResCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:bg-white focus:border-primary outline-none"
                />
              </div>

              {/* Jumlah Tamu & Nomor Telepon */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-800">Jumlah Tamu</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    id="input-res-pax"
                    value={resPax}
                    onChange={(e) => setResPax(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:bg-white focus:border-primary outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-800">No. WhatsApp / HP</label>
                  <input
                    type="tel"
                    id="input-res-phone"
                    placeholder="0812-xxxx-xxxx"
                    value={resPhone}
                    onChange={(e) => setResPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:bg-white focus:border-primary outline-none"
                  />
                </div>
              </div>

              {/* Waktu Reservasi */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-800">
                  Waktu Kedatangan Reservasi <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {["12:30 WIB", "13:00 WIB", "13:30 WIB", "18:00 WIB", "19:00 WIB", "20:00 WIB"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setResTime(preset)}
                      className={`px-2.5 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${resTime === preset
                          ? "bg-primary text-white shadow-xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                    >
                      {preset}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setResTime("custom")}
                    className={`px-2.5 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${resTime === "custom"
                        ? "bg-primary text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                  >
                    Custom Jam
                  </button>
                </div>
                {resTime === "custom" && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-slate-500 text-xs">Pilih Jam:</span>
                    <input
                      type="time"
                      value={resCustomTime}
                      onChange={(e) => setResCustomTime(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Catatan Khusus */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-800">Catatan Khusus (Opsional)</label>
                <textarea
                  rows={2}
                  id="input-res-notes"
                  placeholder="Contoh: Kursi bayi 1 pcs, request tempat sejuk, ulang tahun..."
                  value={resNotes}
                  onChange={(e) => setResNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:bg-white focus:border-primary outline-none resize-none"
                />
              </div>

              {/* Status Update Info Box */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start gap-2 text-amber-900">
                <span className="material-symbols-outlined text-base shrink-0 mt-0.5 text-amber-700">info</span>
                <div className="flex flex-col">
                  <span className="font-bold text-xs">Aktivasi Otomatis &amp; Reminder 30 Menit</span>
                  <span className="text-[11px] text-amber-800/90 leading-relaxed mt-0.5">
                    Meja langsung bertanda Reservasi dan sistem akan memunculkan pop-up pengingat 30 menit sebelum jadwal kedatangan.
                  </span>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  id="btn-close-reservation"
                  onClick={() => setReservationModal({ isOpen: false, table: null })}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  id="btn-save-reservation"
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">check</span>
                  <span>Simpan Reservasi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: BATALKAN RESERVASI (Dengan Dropdown Alasan)
         ======================================================== */}
      {cancelModal.isOpen && cancelModal.table && (
        <div
          id="modal-cancel-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCancelModal({ isOpen: false, table: null });
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 bg-red-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-xl">event_busy</span>
                <div className="flex flex-col">
                  <h3 className="font-bold text-base leading-tight">
                    Batalkan Reservasi {cancelModal.table.tableNumber}
                  </h3>
                  <span className="text-xs text-white/80">
                    Pemesan: {cancelModal.table.customerName || "Tamu"} • {cancelModal.table.reservationTime}
                  </span>
                </div>
              </div>
              <button
                type="button"
                id="btn-close-cancel-x"
                onClick={() => setCancelModal({ isOpen: false, table: null })}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Form */}
            <div className="p-5 flex flex-col gap-3.5 text-xs">
              <p className="text-slate-600">
                Pilih alasan pembatalan reservasi untuk dicatat pada log pembatalan kasir. Meja akan secara otomatis kembali berstatus <span className="font-bold text-[#006e33]">Tersedia</span>.
              </p>

              {/* Drop Box / Dropdown Pilihan Alasan Cancel */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-800">
                  Alasan Pembatalan <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="select-cancel-reason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:bg-white focus:border-red-500 outline-none appearance-none pr-8 cursor-pointer"
                  >
                    <option value="">-- Pilih Alasan Pembatalan --</option>
                    <option value="Pelanggan Menghubungi untuk Batal">Pelanggan Menghubungi untuk Batal</option>
                    <option value="No-Show (Pelanggan Tidak Datang Melebihi 15 Menit)">No-Show (Pelanggan Tidak Datang Melebihi 15 Menit)</option>
                    <option value="Perubahan Rencana / Jadwal Tamu">Perubahan Rencana / Jadwal Tamu</option>
                    <option value="Kesalahan Jadwal / Input Kasir">Kesalahan Jadwal / Input Kasir</option>
                    <option value="Permintaan Pindah / Re-alokasi Meja">Permintaan Pindah / Re-alokasi Meja</option>
                    <option value="Kendala Operasional / Force Majeure">Kendala Operasional / Force Majeure</option>
                    <option value="Alasan Lainnya">Alasan Lainnya</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-base">
                    expand_more
                  </span>
                </div>
              </div>

              {/* Catatan Tambahan */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-800">Catatan Tambahan (Opsional)</label>
                <textarea
                  rows={2}
                  id="input-cancel-notes"
                  placeholder="Detail alasan pembatalan atau kontak pelanggan..."
                  value={cancelNotes}
                  onChange={(e) => setCancelNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:bg-white focus:border-red-500 outline-none resize-none"
                />
              </div>

              {/* Warning note */}
              <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-[11px]">
                💡 Setelah dibatalkan, status meja akan langsung menjadi <span className="font-bold text-slate-800">Tersedia</span> dan dapat dipesan oleh tamu walk-in maupun pelanggan QR.
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  id="btn-close-cancel"
                  onClick={() => setCancelModal({ isOpen: false, table: null })}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  id="btn-confirm-cancel-reservation"
                  disabled={!cancelReason}
                  onClick={handleConfirmCancelReservation}
                  className={`px-5 py-2.5 rounded-xl text-white font-bold shadow-sm flex items-center gap-1.5 transition-all ${cancelReason
                      ? "bg-red-600 hover:bg-red-700 cursor-pointer"
                      : "bg-red-300 cursor-not-allowed"
                    }`}
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                  <span>Konfirmasi Batalkan Reservasi</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: PENGINGAT (REMINDER) 30 MENIT SEBELUM RESERVASI
         ======================================================== */}
      {reminderModal.isOpen && reminderModal.table && (
        <div
          id="modal-reminder-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if (typeof window !== "undefined" && reminderModal.table) {
                sessionStorage.setItem(`reminder_dismissed_${reminderModal.table.tableNumber}`, "true");
              }
              setHasShownReminder(true);
              setReminderModal({ isOpen: false, table: null, minutesLeft: 0 });
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border-2 border-amber-400 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 bg-amber-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-2xl animate-bounce">alarm</span>
                <div className="flex flex-col">
                  <h3 className="font-bold text-base leading-tight">
                    Pengingat Reservasi Meja (&le; 30 Menit)
                  </h3>
                  <span className="text-xs text-amber-100">
                    Sistem Otomatis Restoran {settings.restaurantName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                id="btn-close-reminder-x"
                onClick={() => {
                  if (typeof window !== "undefined" && reminderModal.table) {
                    sessionStorage.setItem(`reminder_dismissed_${reminderModal.table.tableNumber}`, "true");
                  }
                  setHasShownReminder(true);
                  setReminderModal({ isOpen: false, table: null, minutesLeft: 0 });
                }}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-5 flex flex-col gap-3.5 text-xs">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                  <span className="text-slate-600">Nomor Meja:</span>
                  <span className="font-black text-sm text-slate-900 bg-white px-2.5 py-0.5 rounded-md border border-amber-200">
                    {reminderModal.table.tableNumber} ({reminderModal.table.areaLabel})
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                  <span className="text-slate-600">Nama Pemesan:</span>
                  <span className="font-bold text-sm text-slate-900">
                    {reminderModal.table.customerName || "Bpk. Irwan S."}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                  <span className="text-slate-600">Jadwal Kedatangan:</span>
                  <span className="font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded text-xs">
                    {reminderModal.table.reservationTime || "13:00 WIB"} (~{reminderModal.minutesLeft} menit lagi)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Jumlah Tamu:</span>
                  <span className="font-bold text-slate-900">
                    {reminderModal.table.capacity} Orang
                  </span>
                </div>
              </div>

              {/* REVISI 4: Kebijakan Toleransi No-Show 15 Menit */}
              <div className="p-3 bg-red-50/80 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-950">
                <span className="material-symbols-outlined text-red-600 text-lg mt-0.5">timer_off</span>
                <div className="flex flex-col">
                  <span className="font-bold text-xs text-red-900">Toleransi Waktu &amp; Kebijakan No-Show (15 Menit):</span>
                  <p className="text-[11px] text-red-800 mt-0.5 leading-relaxed">
                    Apabila pelanggan tidak hadir dalam waktu <strong>15 menit</strong> setelah jam yang dipesan, reservasi akan <strong>otomatis dibatalkan</strong> dengan status <em>No-Show (pelanggan tidak datang melebihi 15 menit)</em> dan meja langsung kembali berstatus <strong>Tersedia</strong>.
                  </p>
                </div>
              </div>

              {/* SOP checklist prompt */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 text-slate-700">
                <span className="material-symbols-outlined text-primary text-lg mt-0.5">checklist</span>
                <div className="flex flex-col">
                  <span className="font-bold text-xs text-slate-900">Checklist Pelayan:</span>
                  <ul className="list-disc list-inside text-[11px] text-slate-600 mt-1 space-y-0.5">
                    <li>Pastikan meja telah dibersihkan &amp; disanitasi</li>
                    <li>Siapkan perlengkapan sajian (alat makan, gelas, menu)</li>
                    <li>Nyalakan AC / pendingin ruangan pada area meja</li>
                  </ul>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  id="btn-reminder-cancel-noshow"
                  onClick={() => handleCancelReservationNoShow(reminderModal.table!)}
                  className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold flex items-center gap-1 cursor-pointer text-xs transition-colors"
                  title="Batalkan reservasi ini dengan keterangan No-Show dan kembalikan meja ke status Tersedia"
                >
                  <span className="material-symbols-outlined text-sm">cancel</span>
                  <span>Batal (No-Show)</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="btn-close-reminder-bottom"
                    onClick={() => {
                      if (typeof window !== "undefined" && reminderModal.table) {
                        sessionStorage.setItem(`reminder_dismissed_${reminderModal.table.tableNumber}`, "true");
                      }
                      setHasShownReminder(true);
                      setReminderModal({ isOpen: false, table: null, minutesLeft: 0 });
                    }}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer text-xs"
                  >
                    Tutup
                  </button>
                  <button
                    type="button"
                    id="btn-mark-table-ready"
                    onClick={() => {
                      if (typeof window !== "undefined" && reminderModal.table) {
                        sessionStorage.setItem(`reminder_dismissed_${reminderModal.table.tableNumber}`, "true");
                      }
                      setHasShownReminder(true);
                      setReminderModal({ isOpen: false, table: null, minutesLeft: 0 });
                      showToast(`Meja ${reminderModal.table?.tableNumber} ditandai Siap untuk tamu reservasi.`);
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-sm flex items-center gap-1.5 cursor-pointer text-xs"
                  >
                    <span className="material-symbols-outlined text-sm">task_alt</span>
                    <span>Tandai Meja Siap</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal QRIS Pop-up Lebih Besar */}
      {isQrisModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 flex flex-col items-center text-center gap-4 border border-slate-200 relative">
            {/* Close button */}
            <button
              type="button"
              onClick={() => setIsQrisModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            {/* Header */}
            <div className="flex flex-col items-center gap-1">
              <div className="px-3 py-1 rounded-full bg-red-600 text-white font-black text-xs tracking-wider uppercase shadow-xs">
                QRIS STANDAR NASIONAL
              </div>
              <h3 className="font-bold text-lg text-slate-900 mt-1">{settings.restaurantName}</h3>
              <p className="text-[11px] text-slate-500">NMID: ID102003928192 • Kasir: {currentUser.name}</p>
            </div>

            {/* Large QR Code Graphic */}
            <div className="p-4 bg-white rounded-2xl border-2 border-slate-900 shadow-md flex flex-col items-center justify-center relative">
              <div className="w-56 h-56 bg-slate-900 p-2 rounded-xl flex items-center justify-center">
                <div className="w-full h-full bg-white p-2 rounded-lg flex flex-col items-center justify-center relative overflow-hidden">
                  <svg viewBox="0 0 100 100" className="w-full h-full text-slate-950 fill-current">
                    {/* Position markers */}
                    <rect x="5" y="5" width="26" height="26" rx="3" fill="#000" />
                    <rect x="9" y="9" width="18" height="18" fill="#fff" />
                    <rect x="13" y="13" width="10" height="10" rx="1" fill="#000" />
                    <rect x="69" y="5" width="26" height="26" rx="3" fill="#000" />
                    <rect x="73" y="9" width="18" height="18" fill="#fff" />
                    <rect x="77" y="13" width="10" height="10" rx="1" fill="#000" />
                    <rect x="5" y="69" width="26" height="26" rx="3" fill="#000" />
                    <rect x="9" y="73" width="18" height="18" fill="#fff" />
                    <rect x="13" y="77" width="10" height="10" rx="1" fill="#000" />
                    {/* QR Data Dots */}
                    <rect x="36" y="8" width="5" height="5" />
                    <rect x="45" y="8" width="5" height="5" />
                    <rect x="55" y="8" width="5" height="5" />
                    <rect x="36" y="18" width="5" height="5" />
                    <rect x="50" y="18" width="5" height="5" />
                    <rect x="40" y="28" width="5" height="5" />
                    <rect x="55" y="28" width="5" height="5" />
                    <rect x="8" y="36" width="5" height="5" />
                    <rect x="18" y="36" width="5" height="5" />
                    <rect x="28" y="36" width="5" height="5" />
                    <rect x="36" y="36" width="6" height="6" />
                    <rect x="45" y="36" width="5" height="5" />
                    <rect x="55" y="36" width="5" height="5" />
                    <rect x="65" y="36" width="5" height="5" />
                    <rect x="75" y="36" width="5" height="5" />
                    <rect x="85" y="36" width="5" height="5" />
                    <rect x="36" y="45" width="5" height="5" />
                    <rect x="55" y="45" width="5" height="5" />
                    <rect x="68" y="45" width="6" height="6" />
                    <rect x="80" y="45" width="5" height="5" />
                    <rect x="36" y="55" width="5" height="5" />
                    <rect x="48" y="55" width="5" height="5" />
                    <rect x="60" y="55" width="5" height="5" />
                    <rect x="36" y="65" width="6" height="6" />
                    <rect x="50" y="65" width="5" height="5" />
                    <rect x="65" y="65" width="5" height="5" />
                    <rect x="78" y="65" width="5" height="5" />
                    <rect x="36" y="75" width="5" height="5" />
                    <rect x="48" y="75" width="5" height="5" />
                    <rect x="60" y="75" width="6" height="6" />
                    <rect x="72" y="75" width="5" height="5" />
                    <rect x="85" y="75" width="5" height="5" />
                    <rect x="36" y="85" width="5" height="5" />
                    <rect x="55" y="85" width="5" height="5" />
                    <rect x="68" y="85" width="5" height="5" />
                    <rect x="80" y="85" width="5" height="5" />
                  </svg>
                  <div className="absolute inset-0 m-auto w-10 h-10 bg-white rounded-lg p-1 shadow-sm border border-slate-200 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl text-red-600 font-bold">qr_code_scanner</span>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-medium">Arahkan kamera HP ke kode QR di atas</p>
            </div>

            {/* Total & Order details */}
            <div className="w-full bg-[#eff4ff] p-3 rounded-2xl border border-slate-200 flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">TOTAL PEMBAYARAN</span>
              <span className="text-2xl font-black text-[#003629] mt-0.5">{formatCurrency(finalTotal)}</span>
              <span className="text-xs text-slate-600 font-medium mt-0.5">
                {selectedTableNumber} • {activeOrder?.orderNumber || selectedTableInfo?.orderNumber || "-"} ({activeOrder?.guestSubtext || selectedTableInfo?.customerName || "Pelanggan"})
              </span>
            </div>

            {/* Acquirers */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] text-slate-500">
              <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700">BCA</span>
              <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700">Mandiri</span>
              <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700">GoPay</span>
              <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700">OVO</span>
              <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700">ShopeePay</span>
              <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700">DANA</span>
            </div>

            {/* Done / Confirm Button */}
            <div className="w-full flex gap-2">
              <button
                type="button"
                onClick={() => setIsQrisModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsQrisModalOpen(false);
                  handleConfirmDirectCheckout();
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#003629] hover:bg-[#00261d] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">check</span>
                <span>Sudah Masuk &amp; Cetak</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL RIWAYAT TRANSAKSI POS KASIR (Shortcut F6)
          Keterangan eksplisit: Dine-in (Meja), Bungkus (Takeaway), Ojol (Platform)
         ======================================================== */}
      {isHistoryModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsHistoryModalOpen(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-2xs">
                  <span className="material-symbols-outlined text-2xl">receipt_long</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-lg text-slate-900 leading-tight">
                      Riwayat Transaksi Kasir: {currentUser.name}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider border border-emerald-300">
                      Kasir Aktif
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider">
                      Shortcut F6
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hanya menampilkan transaksi di kasir ini ({currentUser.name}). Riwayat kasir baru otomatis kosong.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors border border-slate-200"
                title="Tutup (Esc)"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Filter Bar & Quick Search */}
            <div className="shrink-0 p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Saluran Tabs */}
              {(() => {
                const cashierOrders = orders.filter((o) => {
                  if (o.cashierId) return o.cashierId === currentUser.id;
                  if (o.cashierName) return o.cashierName.toLowerCase() === currentUser.name.toLowerCase();
                  return currentUser.id === "usr-kasir-1";
                });

                return (
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
                    <button
                      type="button"
                      onClick={() => setHistoryChannelFilter("all")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${historyChannelFilter === "all"
                          ? "bg-slate-900 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                    >
                      Semua Saluran ({cashierOrders.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryChannelFilter("dine_in_qr")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${historyChannelFilter === "dine_in_qr"
                          ? "bg-primary text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                    >
                      <span className="material-symbols-outlined text-sm">table_restaurant</span>
                      <span>Dine-in ({cashierOrders.filter((o) => o.channel === "dine_in_qr" || !o.channel).length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryChannelFilter("takeaway_walk_in")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${historyChannelFilter === "takeaway_walk_in"
                          ? "bg-emerald-700 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                    >
                      <span className="material-symbols-outlined text-sm">shopping_bag</span>
                      <span>Take Away ({cashierOrders.filter((o) => o.channel === "takeaway_walk_in").length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryChannelFilter("online_platform")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${historyChannelFilter === "online_platform"
                          ? "bg-orange-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                    >
                      <span className="material-symbols-outlined text-sm">moped</span>
                      <span>Delivery ({cashierOrders.filter((o) => o.channel === "online_platform").length})</span>
                    </button>
                  </div>
                );
              })()}

              {/* Search Box */}
              <div className="relative min-w-[220px]">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">
                  search
                </span>
                <input
                  type="text"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  placeholder="Cari no. struk, meja, pelanggan..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-primary"
                />
              </div>
            </div>

            {/* List Transaksi Content */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 divide-y divide-slate-100 scrollbar-thin">
              {(() => {
                const cashierOrders = orders.filter((o) => {
                  if (o.cashierId) return o.cashierId === currentUser.id;
                  if (o.cashierName) return o.cashierName.toLowerCase() === currentUser.name.toLowerCase();
                  return currentUser.id === "usr-kasir-1";
                });

                if (cashierOrders.length === 0) {
                  return (
                    <div className="py-14 flex flex-col items-center justify-center text-center text-slate-400 gap-2">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs mb-1">
                        <span className="material-symbols-outlined text-3xl">account_circle</span>
                      </div>
                      <p className="font-bold text-base text-slate-800">
                        Riwayat Kasir {currentUser.name} Masih Kosong
                      </p>
                      <p className="text-xs text-slate-500 max-w-sm">
                        Kasir baru pada shift ini belum memproses transaksi. Setiap transaksi Dine-in, Take Away, maupun Delivery yang diselesaikan kasir ini akan otomatis tercatat di sini.
                      </p>
                      <span className="mt-2 px-3 py-1 bg-slate-100 rounded-lg text-[11px] font-semibold text-slate-600 border border-slate-200">
                        💡 Seluruh riwayat transaksi antar-kasir tetap tersimpan utuh di menu Laporan / History Pesanan.
                      </span>
                    </div>
                  );
                }

                const filtered = cashierOrders.filter((order) => {
                  if (historyChannelFilter === "dine_in_qr" && order.channel !== "dine_in_qr" && order.channel) return false;
                  if (historyChannelFilter === "takeaway_walk_in" && order.channel !== "takeaway_walk_in") return false;
                  if (historyChannelFilter === "online_platform" && order.channel !== "online_platform") return false;

                  if (historySearchQuery) {
                    const q = historySearchQuery.toLowerCase();
                    const matchNo = order.orderNumber.toLowerCase().includes(q);
                    const matchTable = order.tableOrGuest.toLowerCase().includes(q);
                    const matchSub = order.guestSubtext?.toLowerCase().includes(q) ?? false;
                    const matchLabel = order.channelLabel?.toLowerCase().includes(q) ?? false;
                    const matchItems = order.items.some((i) => i.name.toLowerCase().includes(q));
                    if (!matchNo && !matchTable && !matchSub && !matchLabel && !matchItems) return false;
                  }

                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400 gap-2">
                      <span className="material-symbols-outlined text-5xl text-slate-300">receipt_long</span>
                      <p className="font-bold text-sm text-slate-600">Tidak ada transaksi ditemukan</p>
                      <p className="text-xs text-slate-400">
                        Sesuaikan kata kunci pencarian atau filter saluran di atas.
                      </p>
                    </div>
                  );
                }

                return filtered.map((ord) => {
                  const isDineIn = ord.channel === "dine_in_qr" || !ord.channel;
                  const isTakeaway = ord.channel === "takeaway_walk_in";
                  const isOjol = ord.channel === "online_platform";

                  return (
                    <div
                      key={ord.id}
                      className="pt-2.5 first:pt-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
                    >
                      {/* Left: Saluran Badge, Order No, Table/Guest */}
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Channel Icon Avatar */}
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isTakeaway
                              ? "bg-emerald-100 text-emerald-800"
                              : isOjol
                                ? "bg-orange-100 text-orange-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                        >
                          <span className="material-symbols-outlined text-xl">
                            {isTakeaway ? "shopping_bag" : isOjol ? "moped" : "table_restaurant"}
                          </span>
                        </div>

                        {/* Order & Channel Description */}
                        <div className="flex flex-col min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-extrabold text-sm text-slate-900">
                              {ord.orderNumber}
                            </span>

                            {/* KETERANGAN SALURAN SANGAT JELAS */}
                            {isDineIn && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-black flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">table_restaurant</span>
                                <span>Dine-in ({ord.tableOrGuest})</span>
                              </span>
                            )}
                            {isTakeaway && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 text-[10px] font-black flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">shopping_bag</span>
                                <span>Take Away</span>
                              </span>
                            )}
                            {isOjol && (
                              <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-950 border border-orange-200 text-[10px] font-black flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">moped</span>
                                <span>Delivery ({ord.channelLabel || "Online"})</span>
                              </span>
                            )}

                            <span className="text-[11px] text-slate-400">
                              • {ord.orderTime} ({ord.timeAgo})
                            </span>
                          </div>

                          {/* Customer / Driver Subtext */}
                          <div className="text-xs font-semibold text-slate-700 mt-0.5">
                            {ord.tableOrGuest}
                            {ord.guestSubtext && (
                              <span className="font-normal text-slate-500"> — {ord.guestSubtext}</span>
                            )}
                          </div>

                          {/* Items summary */}
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {ord.items.map((it, idx) => (
                              <span key={idx}>
                                <strong className="text-slate-700">{it.qty}x</strong> {it.name}
                                {it.selectedAddons && it.selectedAddons.length > 0 && (
                                  <span className="text-amber-700 font-medium">
                                    {" "}
                                    (+{it.selectedAddons.map((a) => a.name).join(", ")})
                                  </span>
                                )}
                                {idx < ord.items.length - 1 ? ", " : ""}
                              </span>
                            ))}
                          </p>
                        </div>
                      </div>

                      {/* Right: Total, Status Bayar & Tombol Cetak Struk */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="flex flex-col sm:items-end">
                          <span className="font-black text-base text-slate-900 leading-tight">
                            {formatCurrency(ord.total)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black mt-0.5 inline-flex items-center gap-1 ${ord.paymentStatus === "paid"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-amber-100 text-amber-900 border border-amber-200"
                              }`}
                          >
                            <span className="material-symbols-outlined text-xs">
                              {ord.paymentStatus === "paid" ? "check_circle" : "pending"}
                            </span>
                            <span>{ord.paymentStatusLabel || (ord.paymentStatus === "paid" ? "LUNAS" : "BELUM BAYAR")}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onPrintTicket(ord)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            title="Cetak Ulang Struk Kasir"
                          >
                            <span className="material-symbols-outlined text-sm">print</span>
                            <span>Cetak Struk</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Footer: Quick Stats */}
            <div className="shrink-0 px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">
                Total Riwayat: <strong className="text-slate-900 font-bold">{orders.length} Transaksi</strong>
              </span>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs cursor-pointer transition-all shadow-xs"
              >
                Tutup (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          OFF-SCREEN PRINTABLE THERMAL RECEIPT (AUTO-PRINT)
          Hanya tampak saat proses cetak window.print()
         ======================================================== */}
      {lastPrintedOrder && (
        <div
          id="pos-direct-printable-area"
          className="hidden print:block font-mono text-xs text-black bg-white p-2"
        >
          <div className="flex flex-col gap-2">
            {/* Header Restoran */}
            <div className="text-center border-b border-dashed border-black pb-2">
              <h3 className="font-bold text-sm uppercase tracking-wide">
                {settings.restaurantName || "PAWON NUSANTARA"}
              </h3>
              {settings.branchName && (
                <p className="text-[11px] text-gray-700">{settings.branchName}</p>
              )}
              {settings.address && (
                <p className="text-[10px] text-gray-600">{settings.address}</p>
              )}
              {settings.phone && (
                <p className="text-[10px] text-gray-600">Telp: {settings.phone}</p>
              )}
            </div>

            {/* Meta Transaksi */}
            <div className="flex flex-col gap-0.5 text-[11px] border-b border-dashed border-black pb-2">
              <div className="flex justify-between">
                <span>No. Transaksi:</span>
                <span className="font-bold">{lastPrintedOrder.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Waktu:</span>
                <span>{lastPrintedOrder.orderTime}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>{currentUser.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Meja / Tamu:</span>
                <span className="font-bold">{lastPrintedOrder.tableOrGuest}</span>
              </div>
              <div className="flex justify-between">
                <span>Saluran:</span>
                <span>{lastPrintedOrder.channelLabel}</span>
              </div>
              {lastPrintedOrder.customerTier && (
                <div className="flex justify-between items-center py-0.5 px-1 mt-0.5 rounded bg-gray-100 text-black font-bold">
                  <span>Pelanggan / Member:</span>
                  <span className="uppercase text-[10px]">
                    ★ {lastPrintedOrder.customerTier}
                  </span>
                </div>
              )}
            </div>

            {/* Daftar Menu Pesanan */}
            <div className="space-y-1.5 border-b border-dashed border-black pb-2 text-[11px]">
              {lastPrintedOrder.items.map((it, idx) => (
                <div key={idx} className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                    <span className="font-bold">{it.qty}x</span> {it.name}
                    {it.selectedAddons && it.selectedAddons.length > 0 && (
                      <div className="text-[10px] text-gray-700 pl-1 font-medium">
                        {it.selectedAddons.map((add, aIdx) => (
                          <span key={aIdx} className="block">
                            + {add.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {it.note && (
                      <span className="block text-[10px] text-gray-600 italic">
                        ({it.note})
                      </span>
                    )}
                  </div>
                  <span className="font-semibold shrink-0">
                    {formatCurrency(it.price * it.qty)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total Pembayaran */}
            <div className="flex flex-col gap-1 text-[11px] border-b border-dashed border-black pb-2">
              {(() => {
                const itemsSubtotal = lastPrintedOrder.subtotal || lastPrintedOrder.items.reduce((s, it) => s + it.price * it.qty, 0);
                const hasDiscount = Boolean(lastPrintedOrder.discountAmount && lastPrintedOrder.discountAmount > 0);
                const hasTaxOrService = lastPrintedOrder.total !== itemsSubtotal || hasDiscount;
                return (
                  <>
                    {hasTaxOrService && (
                      <div className="flex justify-between text-gray-700">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(itemsSubtotal)}</span>
                      </div>
                    )}
                    {hasDiscount && (
                      <div className="flex justify-between font-bold text-red-700">
                        <span>Diskon ({lastPrintedOrder.discountName || "Promo"}):</span>
                        <span>-{formatCurrency(lastPrintedOrder.discountAmount || 0)}</span>
                      </div>
                    )}
                    {lastPrintedOrder.promoCode && (
                      <div className="flex justify-between font-bold text-gray-900">
                        <span>Kode Promo:</span>
                        <span className="font-mono">{lastPrintedOrder.promoCode}</span>
                      </div>
                    )}
                    {settings.taxEnabled && (settings.taxRate ?? 0) > 0 && hasTaxOrService && (
                      <div className="flex justify-between text-gray-700">
                        <span>Pajak Restoran PB1 ({settings.taxRate}%):</span>
                        <span>{formatCurrency(lastPrintedOrder.taxAmount || Math.round((itemsSubtotal - (lastPrintedOrder.discountAmount || 0)) * ((settings.taxRate ?? 0) / 100)))}</span>
                      </div>
                    )}
                    {settings.serviceChargeEnabled && (settings.serviceChargeRate ?? 0) > 0 && hasTaxOrService && (
                      <div className="flex justify-between text-gray-700">
                        <span>Biaya Layanan ({settings.serviceChargeRate}%):</span>
                        <span>{formatCurrency(Math.round((itemsSubtotal - (lastPrintedOrder.discountAmount || 0)) * ((settings.serviceChargeRate ?? 0) / 100)))}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-sm pt-1">
                      <span>TOTAL:</span>
                      <span>{formatCurrency(lastPrintedOrder.total)}</span>
                    </div>
                  </>
                );
              })()}
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-bold uppercase text-emerald-800">LUNAS</span>
              </div>
              {lastPrintedOrder.paymentNote && (
                <div className="flex justify-between text-[10px] text-gray-700">
                  <span>Keterangan:</span>
                  <span>{lastPrintedOrder.paymentNote}</span>
                </div>
              )}
            </div>

            {/* Kupon Promo Spesial Member Kunjungan Berikutnya */}
            {(lastPrintedOrder.customerId || lastPrintedOrder.customerTier) && (() => {
              const tier = (lastPrintedOrder.customerTier || "").toLowerCase();
              const nextCouponCode = tier === "vip" ? "VIPHEMAT20" : tier === "gold" ? "GOLDHEMAT15" : "HEMAT10";
              const nextCouponDisc = tier === "vip" ? "Diskon 20% (Maks Rp50.000)" : tier === "gold" ? "Diskon 15% (Maks Rp35.000)" : "Diskon 10% (Maks Rp25.000)";
              return (
                <div className="my-1.5 p-2 rounded border-2 border-dashed border-black text-center flex flex-col items-center gap-0.5">
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    ★ KUPON SPESIAL MEMBER RESTO ★
                  </span>
                  <div className="px-2 py-0.5 border border-black font-mono font-black text-xs tracking-wider">
                    {nextCouponCode}
                  </div>
                  <p className="text-[10px] font-bold">
                    {nextCouponDisc}
                  </p>
                  <p className="text-[9px] italic">
                    Tunjukkan struk ini pada kasir untuk kunjungan berikutnya!
                  </p>
                </div>
              );
            })()}

            {/* Footer Struk */}
            <div className="text-center text-[10px] text-gray-600 pt-1">
              <p>{settings.receiptFooter || "Terima kasih atas kunjungan Anda!"}</p>
              {/* Social media handles */}
              {((settings.showInstagram && settings.instagram) ||
                (settings.showFacebook && settings.facebook) ||
                (settings.showTiktok && settings.tiktok)) && (
                  <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 mt-1 pt-1 border-t border-dashed border-gray-400 text-[9px] font-semibold text-gray-700">
                    {settings.showInstagram && settings.instagram && (
                      <span>IG: {settings.instagram}</span>
                    )}
                    {settings.showFacebook && settings.facebook && (
                      <span>FB: {settings.facebook}</span>
                    )}
                    {settings.showTiktok && settings.tiktok && (
                      <span>TikTok: {settings.tiktok}</span>
                    )}
                  </div>
                )}
              <p className="mt-1 text-[9px] text-gray-500">Sistem POS didukung oleh Keivo</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL TUTUP KASIR & SERAH TERIMA SHIFT
         ======================================================== */}
      <TutupKasirModal
        isOpen={isTutupKasirOpen}
        onClose={() => setIsTutupKasirOpen(false)}
        orders={orders}
        currentUser={currentUser}
        usersList={usersList}
        settings={settings}
        activeBtDevice={activeBtDevice}
        cashOutTotal={totalCashOut}
        cashMovements={cashExpensesList}
        onSuccessShiftClose={(repUser) => {
          closeCashierShift(repUser);
          setCurrentUser(repUser);
          showToast(
            `Tutup kasir berhasil! Sesi aktif kini resmi diserahkan kepada ${repUser.name}.`,
            "success"
          );
        }}
      />

      {/* ========================================================
          MODAL DETAIL INFORMASI PRODUK
         ======================================================== */}
      <ProductDetailModal
        isOpen={!!selectedDetailProduct}
        onClose={() => setSelectedDetailProduct(null)}
        product={selectedDetailProduct}
        currentCartQty={
          selectedDetailProduct
            ? orderCart
              .filter((c) => c.name === selectedDetailProduct.name)
              .reduce((s, c) => s + c.qty, 0)
            : 0
        }
        onAddToCart={(prod, qty, selectedAddons, note) => {
          handleAddToCart(prod, qty, selectedAddons, note);
          showToast(
            `${qty || 1} porsi "${prod.name}" berhasil ditambahkan ke keranjang pesanan.`,
            "success"
          );
        }}
      />

      {/* ========================================================
          MODAL INPUT PENGELUARAN KAS OPERASIONAL (PETTY CASH)
         ======================================================== */}
      <PengeluaranKasModal
        isOpen={isCashExpenseModalOpen}
        onClose={() => setIsCashExpenseModalOpen(false)}
        currentUser={currentUser}
        expenses={cashExpensesList}
        onAddExpense={handleAddCashExpense}
        onDeleteExpense={handleDeleteCashExpense}
      />

      {/* ========================================================
          MODAL PANDUAN FULLSCREEN / KIOSK IPAD (IOS SAFARI)
         ======================================================== */}
      {showIosFullscreenGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowIosFullscreenGuide(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#003629] text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">tablet_mac</span>
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 leading-tight">
                  Mode Kiosk Layar Penuh di iPad
                </h3>
                <p className="text-xs text-slate-500">
                  Jalankan aplikasi POS tanpa bilah browser Safari
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-700">
              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-900 font-black flex items-center justify-center shrink-0 text-xs">
                  1
                </span>
                <span className="pt-0.5 leading-relaxed">
                  Tekan tombol <strong>Bagikan (Share / <span className="material-symbols-outlined text-sm align-middle">ios_share</span>)</strong> di bilah atas Safari iPad.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-900 font-black flex items-center justify-center shrink-0 text-xs">
                  2
                </span>
                <span className="pt-0.5 leading-relaxed">
                  Gulir ke bawah dan pilih menu <strong>&apos;Tambah ke Layar Utama&apos; (Add to Home Screen)</strong>.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-900 font-black flex items-center justify-center shrink-0 text-xs">
                  3
                </span>
                <span className="pt-0.5 leading-relaxed">
                  Buka aplikasi dari ikon di Home Screen. POS akan otomatis berjalan <strong>100% Layar Penuh (Fullscreen Kiosk)</strong> tanpa bilah alamat Safari!
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosFullscreenGuide(false)}
              className="w-full py-3 bg-[#003629] hover:bg-[#00261d] active:scale-[0.99] text-white font-bold rounded-xl text-xs cursor-pointer transition-all"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL PILIH PROMO & DISKON KASIR
         ======================================================== */}
      {promoModalState.isOpen && (() => {
        const currentSubtotal = promoModalState.target === "table" ? subtotal : cartSubtotal;
        const targetScope = promoModalState.target === "table" ? "dine_in" : "takeaway";
        const currentCustomer = promoModalState.target === "table" ? selectedTableCustomer : takeawayCustomer;
        const matchingPromos = availablePromos.filter(
          (p) => p.isActive && (p.scope === "all" || p.scope === targetScope)
        );

        // Helper kelayakan pelanggan untuk sorting
        const checkCustEligible = (p: PromoDiscount) => {
          const pScope = p.customerScope || "all";
          if (pScope === "vip") return currentCustomer?.tier === "vip";
          if (pScope === "gold") return currentCustomer?.tier === "gold" || currentCustomer?.tier === "vip";
          if (pScope === "member") return Boolean(currentCustomer);
          if (pScope === "personal") {
            return Boolean(
              currentCustomer &&
              ((p.assignedCustomerId && p.assignedCustomerId === currentCustomer.id) ||
               (p.assignedCustomerName && p.assignedCustomerName.toLowerCase().trim() === currentCustomer.name.toLowerCase().trim()))
            );
          }
          return true;
        };

        // Urutkan promo:
        // 1. Promo yang memenuhi semua aturan (canApply = true) paling atas
        // 2. Di antara yang canApply, utamakan promo member
        // 3. Sisanya (yang belum memenuhi aturan min order atau tier) ditaruh di bawah
        const sortedPromos = [...matchingPromos].sort((a, b) => {
          const aOrderEligible = currentSubtotal >= (a.minOrderAmount || 0);
          const bOrderEligible = currentSubtotal >= (b.minOrderAmount || 0);
          const aCustEligible = checkCustEligible(a);
          const bCustEligible = checkCustEligible(b);

          const aCanApply = aOrderEligible && aCustEligible;
          const bCanApply = bOrderEligible && bCustEligible;

          if (aCanApply && !bCanApply) return -1;
          if (!aCanApply && bCanApply) return 1;

          const aIsMember = (a.customerScope || "all") !== "all";
          const bIsMember = (b.customerScope || "all") !== "all";
          if (aIsMember && !bIsMember) return -1;
          if (!aIsMember && bIsMember) return 1;

          return (a.minOrderAmount || 0) - (b.minOrderAmount || 0);
        });

        const customCalcDiscount =
          promoModalState.customType === "percentage"
            ? Math.round(currentSubtotal * (promoModalState.customValue / 100))
            : Math.min(currentSubtotal, promoModalState.customValue);

        return (
          <div
            id="modal-promo-selection-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setPromoModalState((prev) => ({ ...prev, isOpen: false }));
              }
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
          >
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 max-h-[92vh]">
              {/* Modal Header */}
              <div className="px-5 py-4 bg-[#003629] text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
                    <span className="material-symbols-outlined text-xl">local_offer</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm leading-tight text-white">
                      Pilih Promo / Terapkan Diskon
                    </h3>
                    <p className="text-[11px] text-emerald-200">
                      Subtotal Saat Ini: <strong className="text-white">{formatCurrency(currentSubtotal)}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPromoModalState((prev) => ({ ...prev, isOpen: false }))}
                  className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* Status Pelanggan Terhubung Bar */}
              {currentCustomer ? (
                <div className="px-5 py-2 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between text-xs text-emerald-900 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-emerald-700">verified_user</span>
                    <span>
                      Pelanggan: <strong>{currentCustomer.name}</strong>
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase ${currentCustomer.tier === "vip" ? "bg-purple-200 text-purple-900" :
                        currentCustomer.tier === "gold" ? "bg-amber-200 text-amber-900" :
                          "bg-emerald-200 text-emerald-900"
                      }`}>
                      {currentCustomer.tier}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-amber-800">★ {currentCustomer.points || 0} Poin</span>
                </div>
              ) : (
                <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-900 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-amber-700">person_search</span>
                    <span className="text-[11px]">Belum ada data member terhubung di transaksi ini</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPromoModalState((prev) => ({ ...prev, isOpen: false }));
                      setCustomerModalState((prev) => ({
                        ...prev,
                        isOpen: true,
                        target: promoModalState.target,
                        search: "",
                        isAddingNew: false,
                      }));
                    }}
                    className="text-[11px] font-bold px-2.5 py-0.5 bg-white border border-amber-300 rounded-lg text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer shadow-2xs"
                  >
                    + Hubungkan Member
                  </button>
                </div>
              )}

              {/* Tabs Switcher: Promo Resto vs Diskon Manual */}
              <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3 gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setPromoModalState((prev) => ({ ...prev, activeTab: "promos" }))}
                  className={`pb-2.5 px-2 font-bold text-xs flex items-center gap-1.5 border-b-2 cursor-pointer transition-colors ${promoModalState.activeTab === "promos"
                      ? "border-[#003629] text-[#003629]"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                >
                  <span className="material-symbols-outlined text-base">sell</span>
                  <span>Voucher &amp; Promo Resto ({matchingPromos.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPromoModalState((prev) => ({ ...prev, activeTab: "custom" }))}
                  className={`pb-2.5 px-2 font-bold text-xs flex items-center gap-1.5 border-b-2 cursor-pointer transition-colors ${promoModalState.activeTab === "custom"
                      ? "border-[#003629] text-[#003629]"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                >
                  <span className="material-symbols-outlined text-base">tune</span>
                  <span>Diskon Manual Kasir</span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
                {promoModalState.activeTab === "promos" ? (
                  matchingPromos.length === 0 ? (
                    <div className="py-12 text-center flex flex-col items-center justify-center text-slate-400 gap-2">
                      <span className="material-symbols-outlined text-4xl text-slate-300">local_offer</span>
                      <p className="text-xs font-medium">Tidak ada promo aktif untuk saluran ini.</p>
                      <p className="text-[11px] text-slate-500">Anda dapat menggunakan tab Diskon Manual.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {sortedPromos.map((promo) => {
                        // Evaluasi kelayakan nilai belanja
                        const isOrderAmountEligible = currentSubtotal >= (promo.minOrderAmount || 0);

                        // Evaluasi kelayakan target pelanggan
                        const pScope = promo.customerScope || "all";
                        let isCustomerEligible = true;
                        let customerIneligibleReason = "";

                        if (pScope === "vip") {
                          if (!currentCustomer) {
                            isCustomerEligible = false;
                            customerIneligibleReason = "Khusus Member VIP (Belum pilih pelanggan)";
                          } else if (currentCustomer.tier !== "vip") {
                            isCustomerEligible = false;
                            customerIneligibleReason = `Khusus VIP (Tier saat ini: ${currentCustomer.tier.toUpperCase()})`;
                          }
                        } else if (pScope === "gold") {
                          if (!currentCustomer) {
                            isCustomerEligible = false;
                            customerIneligibleReason = "Khusus Gold & VIP (Belum pilih pelanggan)";
                          } else if (currentCustomer.tier !== "vip" && currentCustomer.tier !== "gold") {
                            isCustomerEligible = false;
                            customerIneligibleReason = `Khusus Gold & VIP (Tier saat ini: ${currentCustomer.tier.toUpperCase()})`;
                          }
                        } else if (pScope === "member") {
                          if (!currentCustomer) {
                            isCustomerEligible = false;
                            customerIneligibleReason = "Khusus Member (Belum hubungkan pelanggan)";
                          }
                        } else if (pScope === "personal") {
                          if (!currentCustomer) {
                            isCustomerEligible = false;
                            customerIneligibleReason = `Khusus ${promo.assignedCustomerName || "Pelanggan Tertentu"}`;
                          } else if (promo.assignedCustomerId && currentCustomer.id !== promo.assignedCustomerId) {
                            isCustomerEligible = false;
                            customerIneligibleReason = `Khusus ${promo.assignedCustomerName || "Pelanggan Tertentu"}`;
                          }
                        }

                        // ATURAN PROMO: Harus memenuhi kelayakan pelanggan DAN nominal belanja >= minimal order!
                        const canApply = isCustomerEligible && isOrderAmountEligible;

                        let pot = 0;
                        if (canApply) {
                          if (promo.discountType === "percentage") {
                            pot = Math.round(currentSubtotal * (promo.discountValue / 100));
                            if (promo.maxDiscount) pot = Math.min(pot, promo.maxDiscount);
                          } else {
                            pot = Math.min(currentSubtotal, promo.discountValue);
                          }
                        }

                        return (
                          <div
                            key={promo.id}
                            className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${canApply
                                ? "bg-white border-slate-200 hover:border-[#003629] shadow-xs"
                                : "bg-slate-50/70 border-slate-200 opacity-60"
                              }`}
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div
                                className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 font-black text-xs ${canApply
                                    ? promo.discountType === "percentage"
                                      ? "bg-emerald-100 text-[#003629] border border-emerald-300"
                                      : "bg-amber-100 text-amber-900 border border-amber-300"
                                    : "bg-slate-100 text-slate-400 border border-slate-200"
                                  }`}
                              >
                                <span>{promo.discountType === "percentage" ? `${promo.discountValue}%` : "Rp"}</span>
                                <span className="text-[9px] font-bold">OFF</span>
                              </div>

                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`font-bold text-xs leading-snug ${canApply ? "text-slate-900" : "text-slate-600"}`}>
                                    {promo.name}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono font-bold text-[9px] border border-slate-200">
                                    {promo.code}
                                  </span>
                                  {/* Badge Target Pelanggan: HANYA jika memenuhi aturan member DAN minimal belanja */}
                                  {pScope !== "all" && isCustomerEligible && isOrderAmountEligible && (
                                    <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[9px] flex items-center gap-0.5 shadow-2xs">
                                      <span className="material-symbols-outlined text-[11px] text-amber-600">stars</span>
                                      Direkomendasikan
                                    </span>
                                  )}
                                  {pScope === "vip" ? (
                                    <span className="px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-900 border border-purple-200 font-bold text-[9px] flex items-center gap-0.5">
                                      <span className="material-symbols-outlined text-[11px]">workspace_premium</span>
                                      VIP
                                    </span>
                                  ) : pScope === "gold" ? (
                                    <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 border border-amber-200 font-bold text-[9px] flex items-center gap-0.5">
                                      <span className="material-symbols-outlined text-[11px]">stars</span>
                                      Gold &amp; VIP
                                    </span>
                                  ) : pScope === "member" ? (
                                    <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold text-[9px] flex items-center gap-0.5">
                                      <span className="material-symbols-outlined text-[11px]">group</span>
                                      Member
                                    </span>
                                  ) : pScope === "personal" ? (
                                    <span className="px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-[9px] flex items-center gap-0.5">
                                      <span className="material-symbols-outlined text-[11px]">person</span>
                                      {promo.assignedCustomerName || "Personal"}
                                    </span>
                                  ) : null}
                                </div>
                                {promo.description && (
                                  <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                    {promo.description}
                                  </p>
                                )}

                                <div className="flex items-center gap-2 mt-1 text-[10px] flex-wrap">
                                  {canApply ? (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {pot > 0 ? (
                                        <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                                          <span className="material-symbols-outlined text-xs">check</span>
                                          <span>Hemat {formatCurrency(pot)}</span>
                                        </span>
                                      ) : (
                                        <span className="text-emerald-700 font-medium">Siap digunakan</span>
                                      )}
                                      {promo.minOrderAmount ? (
                                        <span className="text-slate-500 font-medium">
                                          Min. {formatCurrency(promo.minOrderAmount)}
                                        </span>
                                      ) : null}
                                    </div>
                                  ) : !isOrderAmountEligible ? (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-xs text-amber-600">warning</span>
                                        <span>Min. Belanja {formatCurrency(promo.minOrderAmount || 0)} (Kurang {formatCurrency((promo.minOrderAmount || 0) - currentSubtotal)})</span>
                                      </span>
                                      {!isCustomerEligible && (
                                        <span className="text-purple-700 font-medium text-[9px]">
                                          • {customerIneligibleReason}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <span className="text-purple-700 font-semibold flex items-center gap-0.5">
                                        <span className="material-symbols-outlined text-xs text-purple-600">lock</span>
                                        {customerIneligibleReason}
                                      </span>
                                      {!currentCustomer && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPromoModalState((prev) => ({ ...prev, isOpen: false }));
                                            setCustomerModalState((prev) => ({
                                              ...prev,
                                              isOpen: true,
                                              target: promoModalState.target,
                                              search: "",
                                              isAddingNew: false,
                                            }));
                                          }}
                                          className="text-purple-800 underline font-bold cursor-pointer"
                                        >
                                          Pilih Pelanggan
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {(() => {
                              const isCurrentlyApplied = (promoModalState.target === "table" ? tablePromo?.id : takeawayPromo?.id) === promo.id;
                              if (isCurrentlyApplied) {
                                if (!canApply) {
                                  return (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="px-2.5 py-1.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm text-amber-700">warning</span>
                                        <span>Tidak Berlaku</span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (promoModalState.target === "table") {
                                            setTablePromo(null);
                                          } else {
                                            setTakeawayPromo(null);
                                          }
                                          showToast(`Promo ${promo.code} dilepas karena tidak memenuhi aturan belanja.`, "info");
                                        }}
                                        className="p-1.5 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                                        title="Lepas Promo"
                                      >
                                        <span className="material-symbols-outlined text-base">close</span>
                                      </button>
                                    </div>
                                  );
                                }
                                return (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="px-3 py-1.5 rounded-xl bg-emerald-100 border border-emerald-300 text-[#003629] font-bold text-xs flex items-center gap-1">
                                      <span className="material-symbols-outlined text-sm text-emerald-700">check_circle</span>
                                      <span>Aktif Digunakan</span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (promoModalState.target === "table") {
                                          setTablePromo(null);
                                        } else {
                                          setTakeawayPromo(null);
                                        }
                                        showToast(`Promo ${promo.code} dilepas.`, "info");
                                      }}
                                      className="p-1.5 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                                      title="Lepas Promo"
                                    >
                                      <span className="material-symbols-outlined text-base">close</span>
                                    </button>
                                  </div>
                                );
                              }

                              return (
                                <button
                                  type="button"
                                  disabled={!canApply}
                                  onClick={() => {
                                    if (!canApply) return;
                                    if (promoModalState.target === "table") {
                                      setTablePromo(promo);
                                      setTableCustomDiscount(null);
                                    } else {
                                      setTakeawayPromo(promo);
                                      setTakeawayCustomDiscount(null);
                                    }
                                    setPromoModalState((prev) => ({ ...prev, isOpen: false }));
                                    showToast(`Promo ${promo.code} berhasil diterapkan! Hemat ${formatCurrency(pot)}.`, "success");
                                  }}
                                  className="px-3.5 py-2 rounded-xl bg-[#003629] hover:bg-[#1a4a3e] active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs transition-all cursor-pointer shrink-0 shadow-xs"
                                >
                                  Gunakan
                                </button>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <div className="flex flex-col gap-4 text-xs">
                    {/* Tipe Diskon Switch */}
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-slate-700">Tipe Potongan Manual</label>
                      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setPromoModalState((prev) => ({ ...prev, customType: "percentage" }))}
                          className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${promoModalState.customType === "percentage"
                              ? "bg-[#003629] text-white shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                          <span className="material-symbols-outlined text-sm">percent</span>
                          <span>Persen (%)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPromoModalState((prev) => ({ ...prev, customType: "fixed" }))}
                          className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${promoModalState.customType === "fixed"
                              ? "bg-[#003629] text-white shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                          <span className="material-symbols-outlined text-sm">payments</span>
                          <span>Nominal Rp</span>
                        </button>
                      </div>
                    </div>

                    {/* Preset Buttons */}
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-slate-700">Pilihan Cepat Diskon</label>
                      <div className="grid grid-cols-4 gap-2">
                        {promoModalState.customType === "percentage"
                          ? [5, 10, 15, 20].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => setPromoModalState((prev) => ({ ...prev, customValue: pct }))}
                              className={`py-2 rounded-xl font-bold text-xs border transition-all cursor-pointer ${promoModalState.customValue === pct
                                  ? "bg-emerald-50 text-[#003629] border-[#003629] font-black"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                }`}
                            >
                              {pct}%
                            </button>
                          ))
                          : [10000, 20000, 50000, 100000].map((nom) => (
                            <button
                              key={nom}
                              type="button"
                              onClick={() => setPromoModalState((prev) => ({ ...prev, customValue: nom }))}
                              className={`py-2 rounded-xl font-bold text-xs border transition-all cursor-pointer ${promoModalState.customValue === nom
                                  ? "bg-amber-50 text-amber-900 border-amber-600 font-black"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                }`}
                            >
                              {nom >= 1000 ? `${nom / 1000}k` : nom}
                            </button>
                          ))}
                      </div>
                    </div>

                    {/* Input Nominal / Persen */}
                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-slate-700">
                        {promoModalState.customType === "percentage" ? "Masukkan Persen (%)" : "Masukkan Nominal (Rp)"}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={promoModalState.customType === "percentage" ? 100 : currentSubtotal}
                        value={promoModalState.customValue}
                        onChange={(e) =>
                          setPromoModalState((prev) => ({
                            ...prev,
                            customValue: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                        className="p-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800 focus:outline-none focus:border-primary"
                      />
                    </div>

                    {/* Alasan Diskon */}
                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-slate-700">Alasan / Keterangan Diskon</label>
                      <input
                        type="text"
                        value={promoModalState.customReason}
                        onChange={(e) =>
                          setPromoModalState((prev) => ({
                            ...prev,
                            customReason: e.target.value,
                          }))
                        }
                        placeholder="Contoh: Diskon Karyawan, Voucher Fisik, Komplain Layanan"
                        className="p-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
                      />
                    </div>

                    {/* Rincian Hasil Diskon */}
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-emerald-800 uppercase font-bold tracking-wider">
                          Potongan Diskon
                        </span>
                        <span className="font-black text-sm text-emerald-900">
                          -{formatCurrency(customCalcDiscount)}
                        </span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-emerald-800 uppercase font-bold tracking-wider">
                          Subtotal Setelah Diskon
                        </span>
                        <span className="font-black text-sm text-[#003629]">
                          {formatCurrency(Math.max(0, currentSubtotal - customCalcDiscount))}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (customCalcDiscount <= 0) {
                          showToast("Nilai diskon harus lebih besar dari 0!", "error");
                          return;
                        }
                        const discountObj = {
                          type: promoModalState.customType,
                          value: promoModalState.customValue,
                          reason: promoModalState.customReason.trim() || undefined,
                        };
                        if (promoModalState.target === "table") {
                          setTableCustomDiscount(discountObj);
                          setTablePromo(null);
                        } else {
                          setTakeawayCustomDiscount(discountObj);
                          setTakeawayPromo(null);
                        }
                        setPromoModalState((prev) => ({ ...prev, isOpen: false }));
                        showToast(`Diskon manual ${formatCurrency(customCalcDiscount)} berhasil diterapkan!`, "success");
                      }}
                      className="w-full py-3 rounded-xl bg-[#003629] hover:bg-[#1a4a3e] active:scale-[0.99] text-white font-bold text-xs sm:text-sm cursor-pointer shadow-sm transition-all flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-base">check</span>
                      <span>Terapkan Diskon ({formatCurrency(customCalcDiscount)})</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================
          MODAL PILIH / DAFTARKAN PELANGGAN & MEMBER KASIR
         ======================================================== */}
      {customerModalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl flex flex-col gap-4 max-h-[90vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#003629] text-2xl">person_search</span>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    {customerModalState.isAddingNew ? "Daftar Pelanggan / Member Baru" : "Pilih Pelanggan & Member"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Untuk pemesanan {customerModalState.target === "table" ? `Meja ${selectedTableNumber}` : "Take Away (Bungkus)"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomerModalState((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {customerModalState.isAddingNew ? (
              /* FORM DAFTAR PELANGGAN BARU */
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!customerModalState.newCustomer.name.trim() || !customerModalState.newCustomer.phone.trim()) {
                    alert("Nama dan nomor telepon pelanggan wajib diisi!");
                    return;
                  }
                  try {
                    const res = await fetch("/api/customers", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(customerModalState.newCustomer),
                    });
                    const result = await res.json();
                    if (!res.ok) {
                      alert(result.error || "Gagal mendaftarkan pelanggan");
                      return;
                    }

                    // Auto select the newly created customer
                    const targetScope = customerModalState.target === "table" ? "dine_in" : "takeaway";
                    const currentSub = customerModalState.target === "table" ? subtotal : cartSubtotal;
                    const rel = getMemberPromos(result, targetScope, availablePromos, currentSub);
                    if (customerModalState.target === "table") {
                      setSelectedTableCustomer(result);
                    } else {
                      setTakeawayCustomer(result);
                      setTakeawayCustomerName(result.name);
                    }
                    await loadCustomers();
                    setCustomerModalState((prev) => ({ ...prev, isOpen: false, isAddingNew: false }));
                    if (rel.length > 0) {
                      setPromoModalState({
                        isOpen: true,
                        target: customerModalState.target,
                        activeTab: "promos",
                        customType: "percentage",
                        customValue: 10,
                        customReason: "",
                      });
                      showToast(
                        `🎉 Member ${result.name} (${result.tier.toUpperCase()}) terdaftar! Ditemukan ${rel.length} voucher yang memenuhi syarat.`,
                        "success"
                      );
                    } else {
                      showToast(`Pelanggan ${result.name} berhasil didaftarkan & dipilih!`, "success");
                    }
                  } catch (err) {
                    console.error("Gagal tambah customer:", err);
                    alert("Terjadi kesalahan sistem saat menyimpan data pelanggan.");
                  }
                }}
                className="flex flex-col gap-3 text-xs"
              >
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-800">Nama Lengkap Pelanggan *</label>
                  <input
                    type="text"
                    required
                    value={customerModalState.newCustomer.name}
                    onChange={(e) =>
                      setCustomerModalState((prev) => ({
                        ...prev,
                        newCustomer: { ...prev.newCustomer, name: e.target.value },
                      }))
                    }
                    placeholder="Contoh: Bpk. Kurniawan / Ibu Siska"
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-primary font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-slate-800">Nomor HP / WhatsApp *</label>
                    <input
                      type="tel"
                      required
                      value={customerModalState.newCustomer.phone}
                      onChange={(e) =>
                        setCustomerModalState((prev) => ({
                          ...prev,
                          newCustomer: { ...prev.newCustomer, phone: e.target.value },
                        }))
                      }
                      placeholder="0812-xxxx-xxxx"
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-primary font-mono font-medium"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-slate-800">Kategori Member</label>
                    <select
                      value={customerModalState.newCustomer.tier}
                      onChange={(e) =>
                        setCustomerModalState((prev) => ({
                          ...prev,
                          newCustomer: { ...prev.newCustomer, tier: e.target.value as CustomerTier },
                        }))
                      }
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-primary font-bold cursor-pointer"
                    >
                      <option value="regular">Regular</option>
                      <option value="silver">🥈 Silver Member</option>
                      <option value="gold">⭐ Gold Member</option>
                      <option value="vip">👑 VIP Member</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-800">Catatan Selera / Alergi Makanan</label>
                  <input
                    type="text"
                    value={customerModalState.newCustomer.notes}
                    onChange={(e) =>
                      setCustomerModalState((prev) => ({
                        ...prev,
                        newCustomer: { ...prev.newCustomer, notes: e.target.value },
                      }))
                    }
                    placeholder="Contoh: Alergi kacang, suka pedas level 5, tanpa MSG"
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-primary font-medium"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
                  <button
                    type="button"
                    onClick={() => setCustomerModalState((prev) => ({ ...prev, isAddingNew: false }))}
                    className="px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                  >
                    ← Kembali ke Pencarian
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#003629] text-white font-bold hover:bg-[#1a4a3e] shadow-xs cursor-pointer"
                  >
                    Simpan &amp; Pilih
                  </button>
                </div>
              </form>
            ) : (
              /* LIST PENCARIAN PELANGGAN */
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                      search
                    </span>
                    <input
                      type="text"
                      autoFocus
                      value={customerModalState.search}
                      onChange={(e) =>
                        setCustomerModalState((prev) => ({ ...prev, search: e.target.value }))
                      }
                      placeholder="Cari nama, nomor HP, atau catatan..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-primary"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomerModalState((prev) => ({ ...prev, isAddingNew: true }))}
                    className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#003629] font-bold text-xs flex items-center gap-1 border border-emerald-200 shrink-0 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">person_add</span>
                    <span>+ Baru</span>
                  </button>
                </div>

                {/* List Hasil Pencarian */}
                <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-1">
                  {(() => {
                    const q = customerModalState.search.toLowerCase().trim();
                    const filtered = availableCustomers.filter((c) => {
                      if (!q) return true;
                      return (
                        c.name.toLowerCase().includes(q) ||
                        c.phone.toLowerCase().includes(q) ||
                        (c.email && c.email.toLowerCase().includes(q)) ||
                        (c.notes && c.notes.toLowerCase().includes(q))
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="py-8 text-center text-slate-500 flex flex-col items-center gap-2">
                          <span className="material-symbols-outlined text-3xl text-slate-300">person_off</span>
                          <p className="text-xs">Tidak ada pelanggan ditemukan</p>
                          <button
                            type="button"
                            onClick={() =>
                              setCustomerModalState((prev) => ({
                                ...prev,
                                isAddingNew: true,
                                newCustomer: { ...prev.newCustomer, name: prev.search },
                              }))
                            }
                            className="text-xs font-bold text-[#003629] hover:underline"
                          >
                            + Daftarkan &quot;{customerModalState.search}&quot; sebagai pelanggan baru
                          </button>
                        </div>
                      );
                    }

                    return filtered.map((c) => {
                      const tierStyle =
                        c.tier === "vip"
                          ? { bg: "bg-purple-100 text-purple-900", icon: "crown", label: "VIP" }
                          : c.tier === "gold"
                            ? { bg: "bg-amber-100 text-amber-900", icon: "star", label: "Gold" }
                            : c.tier === "silver"
                              ? { bg: "bg-slate-100 text-slate-800", icon: "military_tech", label: "Silver" }
                              : { bg: "bg-emerald-50 text-emerald-800", icon: "person", label: "Regular" };

                      return (
                        <div
                          key={c.id}
                          className="p-3 rounded-xl border border-slate-200 hover:border-emerald-300 bg-white hover:bg-emerald-50/30 flex items-center justify-between gap-3 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-[#003629] text-white font-black text-xs flex items-center justify-center shrink-0">
                              {c.name.charAt(0)}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-xs text-slate-900 truncate">{c.name}</span>
                                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${tierStyle.bg}`}>
                                  {tierStyle.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                                <span className="font-mono">{c.phone}</span>
                                <span>•</span>
                                <span className="text-amber-700 font-bold">★ {c.points || 0} Poin</span>
                                <span>•</span>
                                <span>{c.totalVisits || 0}x Kunjungan</span>
                              </div>
                              {c.notes && (
                                <p className="text-[10px] text-amber-800 italic mt-0.5 truncate max-w-xs">
                                  {c.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const targetScope = customerModalState.target === "table" ? "dine_in" : "takeaway";
                              const currentSub = customerModalState.target === "table" ? subtotal : cartSubtotal;
                              const rel = getMemberPromos(c, targetScope, availablePromos, currentSub);
                              if (customerModalState.target === "table") {
                                setSelectedTableCustomer(c);
                              } else {
                                setTakeawayCustomer(c);
                                setTakeawayCustomerName(c.name);
                              }
                              setCustomerModalState((prev) => ({ ...prev, isOpen: false }));
                              if (rel.length > 0) {
                                setPromoModalState({
                                  isOpen: true,
                                  target: customerModalState.target,
                                  activeTab: "promos",
                                  customType: "percentage",
                                  customValue: 10,
                                  customReason: "",
                                });
                                showToast(
                                  `🎉 Member ${c.name} (${c.tier.toUpperCase()}) terhubung! Ditemukan ${rel.length} voucher yang memenuhi syarat.`,
                                  "success"
                                );
                              } else {
                                showToast(`Pelanggan ${c.name} terpilih!`, "success");
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#003629] hover:bg-[#1a4a3e] active:scale-95 text-white text-xs font-bold shrink-0 cursor-pointer shadow-2xs"
                          >
                            Pilih
                          </button>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL PINDAH MEJA (TRANSFER TABLE - PRIORITAS 3)
         ======================================================== */}
      <PindahMejaModal
        isOpen={isMoveTableModalOpen}
        onClose={() => {
          setIsMoveTableModalOpen(false);
          setMoveSourceTable(null);
        }}
        sourceTable={moveSourceTable}
        tables={tables}
        onConfirmMove={handleConfirmMoveTable}
      />

    </div>
  );
}
