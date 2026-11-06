"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { OrderData, KitchenStatus, MasterProduct } from "@/types/pos";
import { useRestaurant } from "@/context/RestaurantContext";
import { formatCurrency } from "@/lib/formatters";

interface KitchenWorkspaceProps {
  orders?: OrderData[];
  onNavigateHome?: () => void;
  onUpdateOrderStatus?: (orderId: string, status: KitchenStatus) => void;
}

// Sound Synthesizer via Web Audio API (no external asset needed)
function playChime(type: "new_order" | "ready_dispatch" | "click") {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === "new_order") {
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(440, ctx.currentTime);
      osc1.frequency.setValueAtTime(554.37, ctx.currentTime + 0.15);
      gain1.gain.setValueAtTime(0.3, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.45);
    } else if (type === "ready_dispatch") {
      [659.25, 830.61, 987.77].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
        gain.gain.setValueAtTime(0.35, ctx.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.1);
        osc.stop(ctx.currentTime + i * 0.1 + 0.5);
      });
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(700, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    }
  } catch (e) {
    // Audio context policy
  }
}

// Channel Styling Helper: Dine In = Blue, Take Away = Amber, Ojol = Emerald
export function getChannelStyle(channel?: string, channelLabel?: string) {
  const normChannel = (channel || "").toLowerCase();
  const normLabel = (channelLabel || "").toLowerCase();

  const isDineIn = normChannel === "dine_in_qr" || normLabel.includes("dine");
  const isTakeaway =
    normChannel === "takeaway_walk_in" ||
    normLabel.includes("bungkus") ||
    normLabel.includes("take");

  if (isDineIn) {
    return {
      type: "dine_in" as const,
      name: "Dine In",
      subName: "Makan di Tempat",
      icon: "table_restaurant",
      borderLeft: "border-l-4 border-l-blue-600",
      cardBorder: "border-blue-300",
      cardBg: "bg-blue-50/50 hover:bg-blue-50/80",
      badgeBg: "bg-blue-600 text-white",
      pillBg: "bg-blue-100 text-blue-900 border border-blue-300",
      dotBg: "bg-blue-600",
      accentText: "text-blue-900",
      queueBadgeBg: "bg-blue-600 text-white",
    };
  }

  if (isTakeaway) {
    return {
      type: "takeaway" as const,
      name: "Take Away",
      subName: "Take Away",
      icon: "shopping_bag",
      borderLeft: "border-l-4 border-l-amber-600",
      cardBorder: "border-amber-300",
      cardBg: "bg-amber-50/50 hover:bg-amber-50/80",
      badgeBg: "bg-amber-600 text-white",
      pillBg: "bg-amber-100 text-amber-900 border border-amber-300",
      dotBg: "bg-amber-600",
      accentText: "text-amber-900",
      queueBadgeBg: "bg-amber-600 text-white",
    };
  }

  // Delivery / Online Platform (GoFood, GrabFood, ShopeeFood)
  return {
    type: "ojol" as const,
    name: channelLabel || "Delivery",
    subName: "Online Delivery",
    icon: "two_wheeler",
    borderLeft: "border-l-4 border-l-emerald-600",
    cardBorder: "border-emerald-300",
    cardBg: "bg-emerald-50/50 hover:bg-emerald-50/80",
    badgeBg: "bg-emerald-700 text-white",
    pillBg: "bg-emerald-100 text-emerald-900 border border-emerald-300",
    dotBg: "bg-emerald-600",
    accentText: "text-emerald-900",
    queueBadgeBg: "bg-emerald-700 text-white",
  };
}

export function KitchenWorkspace({ orders, onNavigateHome, onUpdateOrderStatus }: KitchenWorkspaceProps) {
  const { settings, currentUser, switchRole, logout } = useRestaurant();
  const [kitchenOrders, setKitchenOrders] = useState<OrderData[]>(orders || []);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Sync orders from parent when props change
  useEffect(() => {
    if (orders && orders.length > 0) {
      setKitchenOrders(orders);
    }
  }, [orders]);

  // Time state for live clock
  const [currentTime, setCurrentTime] = useState<string>("");

  // Tracking checklist state for Column 2: orderId -> list of checked item indices
  const [checkedItemsMap, setCheckedItemsMap] = useState<Record<string, number[]>>({});

  // Set of order IDs finished in current session
  const [dispatchedOrderIds, setDispatchedOrderIds] = useState<string[]>([]);

  // Manual priority override order IDs list
  const [priorityOrderIds, setPriorityOrderIds] = useState<string[]>([]);

  // History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyFilterChannel, setHistoryFilterChannel] = useState<string>("all");
  const [historySearchQuery, setHistorySearchQuery] = useState<string>("");

  // Product Stock Management Modal State (Point 5)
  const [showStockModal, setShowStockModal] = useState(false);
  const [productsList, setProductsList] = useState<MasterProduct[]>([]);
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [stockCategoryFilter, setStockCategoryFilter] = useState("all");
  const [isUpdatingStockId, setIsUpdatingStockId] = useState<string | null>(null);

  // Success toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isPrivileged = ["owner", "admin", "manager"].includes(currentUser.role);
  const prevOrdersCountRef = useRef<number>(0);

  // Live Clock updater
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "Asia/Jakarta",
        }) + " WIB"
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch orders from API
  const fetchOrders = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (Array.isArray(data)) {
        const newOrders = data.filter((o) => o.kitchenStatus === "new");
        if (
          soundEnabled &&
          prevOrdersCountRef.current > 0 &&
          newOrders.length > prevOrdersCountRef.current
        ) {
          playChime("new_order");
        }
        prevOrdersCountRef.current = newOrders.length;
        setKitchenOrders(data);
      }
    } catch (err) {
      console.log("Error loading orders in KDS:", err);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  // Fetch products for Stock Management
  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/menu-items");
      const data = await res.json();
      if (Array.isArray(data)) {
        setProductsList(data);
      }
    } catch (err) {
      console.log("Error loading products in KDS:", err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchProducts();
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 3500);
    return () => clearInterval(interval);
  }, [soundEnabled]);

  // Show temporary toast
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 4000);
  };

  // Helper to toggle product availability (Point 5)
  const handleToggleProductStock = async (product: MasterProduct) => {
    if (soundEnabled) playChime("click");
    const nextStatus = !product.isAvailable;
    setIsUpdatingStockId(product.id);

    // Optimistic UI update
    setProductsList((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, isAvailable: nextStatus } : p))
    );

    try {
      const res = await fetch("/api/menu-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, isAvailable: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(
          `Status "${product.name}" diubah menjadi: ${nextStatus ? "TERSEDIA" : "STOK HABIS"}`
        );
      }
    } catch (err) {
      console.error("Failed to toggle stock status:", err);
      triggerToast("Gagal memperbarui status stok produk.");
      // Rollback
      fetchProducts();
    } finally {
      setIsUpdatingStockId(null);
    }
  };

  // Helper to update kitchen status
  const updateStatus = async (orderId: string, nextStatus: KitchenStatus) => {
    if (soundEnabled) playChime("click");

    setKitchenOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          return {
            ...o,
            kitchenStatus: nextStatus,
            kitchenStatusLabel:
              nextStatus === "ready"
                ? "Selesai Masak"
                : nextStatus === "in_progress"
                ? "Dimasak"
                : nextStatus === "completed" || nextStatus === "served"
                ? "Selesai Disajikan"
                : "Pesanan Baru",
          };
        }
        return o;
      })
    );

    // Update parent orders if callback provided in updateStatus
    if (onUpdateOrderStatus) {
      onUpdateOrderStatus(orderId, nextStatus);
    }

    try {
      await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, kitchenStatus: nextStatus }),
      });
      fetchOrders(true);
    } catch (err) {
      console.error("Failed to update status on server:", err);
    }
  };

  // Toggle item checklist in Column 2 (Sedang Dimasak & Checklist)
  const handleToggleItemCheck = (orderId: string, itemIdx: number) => {
    if (soundEnabled) playChime("click");
    setCheckedItemsMap((prev) => {
      const currentList = prev[orderId] || [];
      const isChecked = currentList.includes(itemIdx);
      const updatedList = isChecked
        ? currentList.filter((i) => i !== itemIdx)
        : [...currentList, itemIdx];
      return { ...prev, [orderId]: updatedList };
    });
  };

  // Select all items in Column 2
  const handleCheckAllItems = (orderId: string, totalCount: number) => {
    if (soundEnabled) playChime("click");
    setCheckedItemsMap((prev) => ({
      ...prev,
      [orderId]: Array.from({ length: totalCount }, (_, i) => i),
    }));
  };

  // Action in Column 2: Update Siap Disajikan (Point 4)
  const handleCookingDoneAndDispatch = async (order: OrderData) => {
    if (soundEnabled) playChime("ready_dispatch");

    // Add to dispatched list so it immediately disappears from KDS screen
    setDispatchedOrderIds((prev) => [...prev, order.id]);

    // Update parent orders if callback provided in dispatch
    if (onUpdateOrderStatus) {
      onUpdateOrderStatus(order.id, "ready");
    }

    try {
      await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          kitchenStatus: "ready",
          tableNumber: order.tableOrGuest,
        }),
      });
      fetchOrders(true);
    } catch (err) {
      console.error("Failed to finish order:", err);
    }

    triggerToast(`✓ Pesanan ${order.tableOrGuest} (${order.orderNumber}) SIAP DISAJIKAN!`);
  };

  // Manual priority trigger: move order immediately into cooking slots
  const handlePrioritizeOrder = (orderId: string) => {
    if (soundEnabled) playChime("click");
    setPriorityOrderIds((prev) => [orderId, ...prev.filter((id) => id !== orderId)]);
    updateStatus(orderId, "in_progress");
    triggerToast("Pesanan diprioritaskan masuk ke slot masak!");
  };

  // All active kitchen orders waiting or cooking (sorted by FIFO, earliest first)
  const allActiveOrders = useMemo(() => {
    return kitchenOrders
      .filter((o) => {
        if (dispatchedOrderIds.includes(o.id)) return false;
        if (
          o.kitchenStatus === "completed" ||
          o.kitchenStatus === "served" ||
          o.kitchenStatus === "ready" ||
          o.kitchenStatus === "cancelled"
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Priority override first
        const isPriorityA = priorityOrderIds.includes(a.id);
        const isPriorityB = priorityOrderIds.includes(b.id);
        if (isPriorityA && !isPriorityB) return -1;
        if (!isPriorityA && isPriorityB) return 1;

        // Earliest timestamp first (FIFO)
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA && timeB) {
          return timeA - timeB;
        }
        return (a.id || "").localeCompare(b.id || "");
      });
  }, [kitchenOrders, dispatchedOrderIds, priorityOrderIds]);

  // Point 2 & 4:
  // Kolom Sedang Dimasak & Checklist (80%) mengambil giliran pertama maksimal 4 kartu (1 baris 4 kartu)
  const cookingChecklistOrders = useMemo(() => {
    return allActiveOrders.slice(0, 4);
  }, [allActiveOrders]);

  // Point 1 & 4:
  // Kolom Antrian Masuk (20%) hanya menampilkan pesanan yang masih menunggu giliran berikutnya (mulai dari urutan ke-5 dst)
  const queueWaitingOrders = useMemo(() => {
    return allActiveOrders.slice(4);
  }, [allActiveOrders]);

  // History Orders List (Pesanan yang sudah selesai dimasak)
  const completedHistoryOrders = useMemo(() => {
    return kitchenOrders
      .filter((o) => {
        const isDone =
          o.kitchenStatus === "completed" ||
          o.kitchenStatus === "served" ||
          o.kitchenStatus === "ready" ||
          dispatchedOrderIds.includes(o.id);
        if (!isDone) return false;

        // Channel filter
        if (historyFilterChannel !== "all") {
          if (historyFilterChannel === "dine_in" && o.channel !== "dine_in_qr") return false;
          if (historyFilterChannel === "takeaway" && o.channel !== "takeaway_walk_in") return false;
          if (historyFilterChannel === "online" && o.channel !== "online_platform") return false;
        }

        // Search query
        if (historySearchQuery.trim()) {
          const q = historySearchQuery.toLowerCase();
          const matchTable = (o.tableOrGuest || "").toLowerCase().includes(q);
          const matchNum = (o.orderNumber || "").toLowerCase().includes(q);
          const matchCustomer = (o.guestSubtext || "").toLowerCase().includes(q);
          if (!matchTable && !matchNum && !matchCustomer) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA && timeB) return timeB - timeA;
        return (b.id || "").localeCompare(a.id || "");
      });
  }, [kitchenOrders, dispatchedOrderIds, historyFilterChannel, historySearchQuery]);

  // Out-of-stock items count (Point 5)
  const outOfStockCount = useMemo(() => {
    return productsList.filter((p) => p.isAvailable === false).length;
  }, [productsList]);

  // Categories list for stock modal
  const stockCategories = useMemo(() => {
    const cats = Array.from(new Set(productsList.map((p) => p.category))).filter(Boolean);
    return [{ id: "all", label: "Semua Kategori" }, ...cats.map((c) => ({ id: c, label: c }))];
  }, [productsList]);

  // Filtered products in stock modal
  const filteredStockProducts = useMemo(() => {
    return productsList.filter((p) => {
      if (stockCategoryFilter !== "all" && p.category !== stockCategoryFilter) {
        return false;
      }
      if (stockSearchQuery.trim()) {
        const q = stockSearchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchCode = (p.code || "").toLowerCase().includes(q);
        const matchCat = (p.category || "").toLowerCase().includes(q);
        return matchName || matchCode || matchCat;
      }
      return true;
    });
  }, [productsList, stockCategoryFilter, stockSearchQuery]);

  return (
    <div className="h-screen w-full flex flex-col bg-surface-container-high font-body-md text-on-surface overflow-hidden select-none">
      {/* ========================================================================= */}
      {/* 1. KDS Fixed Header Bar                                                  */}
      {/* ========================================================================= */}
      <header className="shrink-0 px-4 py-2.5 bg-surface-container-lowest border-b border-outline-variant/30 flex items-center justify-between gap-3 shadow-xs z-30">
        {/* Left: Branding & Back Button */}
        <div className="flex items-center gap-3">
          {isPrivileged && onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="Kembali ke Dashboard Utama"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              <span className="hidden sm:inline">Menu Utama</span>
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-2xl">skillet</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-headline-sm text-base font-extrabold text-on-surface leading-none">
                  Kitchen Display System (KDS)
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-wider">
                  Chef & Cooking Station
                </span>
              </div>
              <span className="text-[11px] text-on-surface-variant font-medium">
                {settings.restaurantName} • Format: Antrian 20% & Sedang Dimasak 80% (1 Baris 4 Kartu)
              </span>
            </div>
          </div>
        </div>

        {/* Center: Live Real-time Clock & Sound Indicator */}
        <div className="hidden md:flex items-center gap-3">
          <div className="px-3 py-1 rounded-xl bg-surface-container font-mono text-xs font-bold text-on-surface flex items-center gap-2 border border-outline-variant/30 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{currentTime || "Memuat Jam..."}</span>
          </div>

          <button
            onClick={() => setSoundEnabled((prev) => !prev)}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
              soundEnabled
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                : "bg-surface-container text-on-surface-variant border-outline-variant/30"
            }`}
            title="Toggle Suara Bell Notifikasi KDS"
          >
            <span className="material-symbols-outlined text-sm">
              {soundEnabled ? "volume_up" : "volume_off"}
            </span>
            <span>{soundEnabled ? "Suara: Aktif" : "Mute"}</span>
          </button>
        </div>

        {/* Right: Point 5 (Stok Menu), Point 7 (Riwayat), Refresh & Role Switcher */}
        <div className="flex items-center gap-2">
          {/* Point 5: Button Kelola Stok Habis (Sinkronisasi POS & Customer) */}
          <button
            onClick={() => {
              fetchProducts();
              setShowStockModal(true);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border shadow-2xs ${
              outOfStockCount > 0
                ? "bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100"
                : "bg-surface-container hover:bg-surface-container-high text-on-surface border-outline-variant/30"
            }`}
            title="Kelola status stok menu habis untuk kasir dan customer"
          >
            <span
              className={`material-symbols-outlined text-base ${
                outOfStockCount > 0 ? "text-rose-600 animate-pulse" : "text-amber-600"
              }`}
            >
              inventory_2
            </span>
            <span>Kelola Stok Menu</span>
            {outOfStockCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-mono text-[10px] font-black">
                {outOfStockCount} Habis
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px] font-black">
                Semua Ada
              </span>
            )}
          </button>

          {/* Button Riwayat Pesanan Selesai Masak */}
          <button
            onClick={() => setShowHistoryModal(true)}
            className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface flex items-center gap-1.5 transition-colors cursor-pointer border border-outline-variant/30 shadow-2xs"
            title="Buka Riwayat Pesanan Selesai Masak"
          >
            <span className="material-symbols-outlined text-base text-primary">history</span>
            <span className="hidden sm:inline">Riwayat</span>
            {completedHistoryOrders.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-mono text-[10px] font-black">
                {completedHistoryOrders.length}
              </span>
            )}
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => {
              fetchOrders();
              fetchProducts();
            }}
            className={`p-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
              isRefreshing ? "animate-spin text-primary" : ""
            }`}
            title="Refresh Antrean KDS & Stok"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
          </button>

          {/* User Role Switcher Dropdown */}
          <div className="relative group">
            <button className="px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface flex items-center gap-1.5 cursor-pointer border border-outline-variant/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="hidden sm:inline">{currentUser.name}</span>
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>
            <div className="absolute right-0 top-full mt-1 w-44 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/30 py-1 hidden group-hover:block z-50 text-xs">
              <button
                onClick={() => switchRole("owner")}
                className="w-full text-left px-3 py-1.5 hover:bg-surface-container font-semibold"
              >
                Owner
              </button>
              <button
                onClick={() => switchRole("admin")}
                className="w-full text-left px-3 py-1.5 hover:bg-surface-container font-semibold"
              >
                Admin
              </button>
              <button
                onClick={() => switchRole("manager")}
                className="w-full text-left px-3 py-1.5 hover:bg-surface-container font-semibold"
              >
                Manager
              </button>
              <button
                onClick={() => switchRole("kasir")}
                className="w-full text-left px-3 py-1.5 hover:bg-surface-container font-semibold"
              >
                Kasir (POS)
              </button>
              <button
                onClick={() => switchRole("waiters")}
                className="w-full text-left px-3 py-1.5 hover:bg-surface-container font-semibold"
              >
                Waiters (Meja)
              </button>
              <button
                onClick={() => switchRole("kitchen")}
                className="w-full text-left px-3 py-1.5 hover:bg-surface-container font-semibold text-primary"
              >
                Kitchen (KDS)
              </button>
              <div className="pt-1 mt-1 border-t border-slate-100">
                <button
                  onClick={() => logout()}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-50 font-bold text-rose-700 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">logout</span>
                  <span>Keluar (Logout)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="material-symbols-outlined text-base text-emerald-400">check_circle</span>
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white ml-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. Main 2-Column KDS Layout: 20% Antrian Masuk & 80% Sedang Dimasak       */}
      {/* ========================================================================= */}
      <main className="flex-1 min-h-0 overflow-hidden p-3 grid grid-cols-1 lg:grid-cols-[20%_80%] gap-3">
        {/* ========================================================================= */}
        {/* KOLOM 1 (20%): Antrian Masuk (Pesanan yang menunggu giliran masuk slot)    */}
        {/* ========================================================================= */}
        <section className="h-full flex flex-col bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs overflow-hidden">
          {/* Column Header */}
          <div className="px-3 py-2 bg-slate-100 border-b border-outline-variant/30 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center shadow-2xs">
                <span className="material-symbols-outlined text-base">receipt_long</span>
              </div>
              <div>
                <h2 className="text-xs font-black uppercase text-on-surface tracking-wide">
                  Antrian Masuk
                </h2>
                <p className="text-[10px] text-on-surface-variant font-medium leading-none">
                  Menunggu Giliran Slot Masak
                </p>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-white font-mono font-black text-xs shadow-2xs">
              {queueWaitingOrders.length}
            </span>
          </div>

          {/* Color Legend (Keterangan Warna Dine In, Take Away, Ojol) */}
          <div className="mx-2.5 mt-2 p-2 rounded-xl bg-surface-container border border-outline-variant/30 flex flex-col gap-1.5 shrink-0">
            <div className="flex items-center justify-between text-[10px] font-bold text-on-surface-variant">
              <span className="flex items-center gap-1 font-extrabold text-on-surface">
                <span className="material-symbols-outlined text-xs text-primary">palette</span>
                <span>Saluran:</span>
              </span>
              <span className="text-[9px] text-on-surface-variant/70 italic">Kategori Pesanan</span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[10px] font-extrabold">
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-300">
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
                <span className="truncate">Dine In</span>
              </div>
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0"></span>
                <span className="truncate">Take Away</span>
              </div>
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0"></span>
                <span className="truncate">Delivery</span>
              </div>
            </div>
          </div>

          {/* Column Content: Scrollable Tickets Antrian Menunggu */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar">
            {queueWaitingOrders.map((order, idx) => {
              const channelStyle = getChannelStyle(order.channel, order.channelLabel);
              const totalItemsCount = order.items.reduce((s, it) => s + (it.qty || 1), 0);
              // Global queue position is index + 5 because slots #1, #2, #3, #4 are active in Column 2
              const globalQueueNum = idx + 5;

              return (
                <div
                  key={order.id}
                  className={`rounded-xl border ${channelStyle.cardBorder} ${channelStyle.cardBg} ${channelStyle.borderLeft} p-2.5 transition-all shadow-2xs flex flex-col gap-1.5`}
                >
                  {/* Top Bar: Queue Number & Order Number */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-5 h-5 rounded-md ${channelStyle.queueBadgeBg} font-mono font-black text-[11px] flex items-center justify-center shrink-0 shadow-2xs`}
                        title={`Urutan Antrian #${globalQueueNum}`}
                      >
                        #{globalQueueNum}
                      </span>
                      <span className="font-mono font-bold text-xs text-primary">
                        {order.orderNumber}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-md ${channelStyle.badgeBg} text-[10px] font-black uppercase tracking-wider shadow-2xs flex items-center gap-1`}
                    >
                      <span className="material-symbols-outlined text-[12px]">
                        {channelStyle.icon}
                      </span>
                      <span>{channelStyle.name}</span>
                    </span>
                  </div>

                  {/* Table / Customer Name & Time Ago */}
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="font-headline-sm text-sm font-extrabold text-on-surface leading-tight truncate">
                      {order.tableOrGuest}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold ${channelStyle.accentText} flex items-center gap-0.5 shrink-0`}
                    >
                      <span className="material-symbols-outlined text-[11px]">schedule</span>
                      <span>{order.timeAgo}</span>
                    </span>
                  </div>

                  {order.guestSubtext && (
                    <p className="text-[10px] text-on-surface-variant font-medium truncate">
                      {order.guestSubtext}
                    </p>
                  )}

                  {/* Catatan Khusus di Kartu Antrian jika ada */}
                  {order.specialNote && (
                    <div className="text-[10px] bg-amber-100/80 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300 font-semibold flex items-center gap-1 truncate">
                      <span className="material-symbols-outlined text-[11px] text-amber-700">edit_note</span>
                      <span className="truncate">Note: {order.specialNote}</span>
                    </div>
                  )}

                  {/* Ringkasan Menu & Tombol Prioritas */}
                  <div className="flex items-center justify-between text-[11px] font-bold text-on-surface-variant bg-white/80 p-1.5 rounded-lg border border-outline-variant/20 mt-0.5">
                    <span className="flex items-center gap-1 truncate">
                      <span className="material-symbols-outlined text-xs text-primary">lunch_dining</span>
                      <span className="truncate">{order.items.length} Menu ({totalItemsCount} Porsi)</span>
                    </span>

                    <button
                      onClick={() => handlePrioritizeOrder(order.id)}
                      className="px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black cursor-pointer flex items-center gap-0.5 shrink-0 shadow-2xs"
                      title="Dahulukan pesanan ini ke slot masak aktif"
                    >
                      <span>Masak</span>
                      <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {queueWaitingOrders.length === 0 && (
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-4 rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-low text-on-surface-variant">
                <span className="material-symbols-outlined text-3xl text-on-surface-variant/40 mb-1">
                  done_all
                </span>
                <span className="font-bold text-xs text-on-surface">Antrian Menunggu Kosong</span>
                <span className="text-[10px] text-on-surface-variant mt-0.5">
                  Semua pesanan yang ada saat ini sedang aktif di 4 Slot Masak (Kolom Kanan).
                </span>
              </div>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* KOLOM 2 (80%): Sedang Dimasak & Checklist (1 BARIS 4 KARTU ANTRIAN)       */}
        {/* ========================================================================= */}
        <section className="h-full flex flex-col bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs overflow-hidden">
          {/* Column Header */}
          <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center shadow-2xs">
                <span className="material-symbols-outlined text-base">checklist_rtl</span>
              </div>
              <div>
                <h2 className="text-xs font-black uppercase text-emerald-950 tracking-wide">
                  Sedang Dimasak & Checklist (Aktif di Dapur)
                </h2>
                <p className="text-[10px] text-emerald-800 font-medium leading-none">
                  1 Baris 4 Kartu Antrian Masak • Centang semua pesanan untuk mengupdate Siap Disajikan
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-700 text-white font-mono font-black text-xs shadow-2xs">
                {cookingChecklistOrders.length}/4 Slot Masak Aktif
              </span>
            </div>
          </div>

          {/* Column Content: 1 BARIS 4 KARTU ANTRIAN CHECKLIST (GRID COLS 4) */}
          <div className="flex-1 min-h-0 p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 overflow-hidden">
            {/* RENDER 4 SLOTS (Slots 0 to 3) */}
            {[0, 1, 2, 3].map((slotIdx) => {
              const order = cookingChecklistOrders[slotIdx];

              if (!order) {
                // Empty Slot Placeholder
                return (
                  <div
                    key={`empty-slot-${slotIdx}`}
                    className="h-full rounded-2xl border-2 border-dashed border-outline-variant/40 bg-surface-container-low/70 flex flex-col items-center justify-center text-center p-4 text-on-surface-variant transition-all"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-slate-200/70 text-slate-400 flex items-center justify-center mb-2">
                      <span className="material-symbols-outlined text-2xl">skillet</span>
                    </div>
                    <span className="font-mono font-extrabold text-[11px] text-slate-500 uppercase tracking-wider mb-0.5">
                      Slot Masak #{slotIdx + 1}
                    </span>
                    <span className="font-bold text-xs text-on-surface">Slot Tersedia</span>
                    <p className="text-[11px] text-on-surface-variant/80 mt-1 max-w-[180px]">
                      Pesanan baru dari antrian masuk akan otomatis menempati slot ini saat gilirannya tiba.
                    </p>
                  </div>
                );
              }

              // Active Cooking Order Card
              const channelStyle = getChannelStyle(order.channel, order.channelLabel);
              const currentCheckedIndices = checkedItemsMap[order.id] || [];
              const totalItems = order.items.length;
              const isAllChecked = totalItems > 0 && currentCheckedIndices.length === totalItems;
              const progressPercent =
                totalItems > 0 ? Math.round((currentCheckedIndices.length / totalItems) * 100) : 0;

              return (
                <div
                  key={order.id}
                  className={`h-full min-h-0 rounded-2xl border-2 ${channelStyle.borderLeft} p-3 shadow-xs flex flex-col justify-between overflow-hidden transition-all duration-200 ${
                    isAllChecked
                      ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-300/50"
                      : "border-slate-300 bg-surface-container-lowest"
                  }`}
                >
                  {/* Top Bar: Slot #, Table, Channel & Order Number */}
                  <div className="shrink-0 pb-2 border-b border-outline-variant/30 mb-1.5">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-white font-mono font-black text-[10px] shrink-0">
                          Masak #{slotIdx + 1}
                        </span>
                        <span className="font-headline-sm text-sm font-black text-on-surface truncate">
                          {order.tableOrGuest}
                        </span>
                      </div>

                      {/* Channel Badge */}
                      <span
                        className={`px-2 py-0.5 rounded-md ${channelStyle.badgeBg} text-[10px] font-black uppercase tracking-wider shadow-2xs flex items-center gap-1 shrink-0`}
                      >
                        <span className="material-symbols-outlined text-[11px]">
                          {channelStyle.icon}
                        </span>
                        <span>{channelStyle.name}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-primary text-[11px]">
                        {order.orderNumber}
                      </span>
                      <span className="text-[10px] font-bold text-on-surface-variant flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[11px]">schedule</span>
                        <span>{order.timeAgo}</span>
                      </span>
                    </div>

                    {order.guestSubtext && (
                      <p className="text-[10px] text-on-surface-variant font-medium truncate mt-0.5">
                        {order.guestSubtext}
                      </p>
                    )}

                    {/* Checklist Progress Bar & Quick Action */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isAllChecked ? "bg-emerald-600" : "bg-amber-500"
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        ></div>
                      </div>
                      <span
                        className={`text-[10px] font-black shrink-0 ${
                          isAllChecked ? "text-emerald-700" : "text-amber-800"
                        }`}
                      >
                        {currentCheckedIndices.length}/{totalItems} ({progressPercent}%)
                      </span>
                      <button
                        onClick={() => handleCheckAllItems(order.id, totalItems)}
                        className="px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-[9px] font-bold text-on-surface flex items-center gap-0.5 cursor-pointer transition-colors border border-outline-variant/30 shrink-0"
                        title="Centang semua menu sekaligus"
                      >
                        <span className="material-symbols-outlined text-[10px] text-emerald-700">done_all</span>
                        <span>Semua</span>
                      </button>
                    </div>
                  </div>

                  {/* Point 3: Catatan Khusus Pesanan dari Customer atau Kasir */}
                  {order.specialNote && (
                    <div className="shrink-0 p-2 rounded-xl bg-amber-50 border border-amber-300/80 text-amber-950 flex items-start gap-1.5 shadow-2xs mb-1.5">
                      <span className="material-symbols-outlined text-sm text-amber-700 shrink-0 mt-0.5">
                        sticky_note_2
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-black text-amber-900 uppercase tracking-wide block leading-none mb-0.5">
                          Catatan Pesanan ({order.guestSubtext || "Kasir/Customer"}):
                        </span>
                        <p className="text-[11px] font-bold leading-tight break-words text-amber-950">
                          {order.specialNote}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Point 3: Inner Scrollable Checklist dengan Catatan Per Menu */}
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar mb-2">
                    {order.items.map((item, itemIdx) => {
                      const isChecked = currentCheckedIndices.includes(itemIdx);
                      return (
                        <div
                          key={itemIdx}
                          onClick={() => handleToggleItemCheck(order.id, itemIdx)}
                          className={`p-2 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                            isChecked
                              ? "bg-emerald-100/70 border-emerald-400 text-emerald-950"
                              : "bg-surface-container-lowest border-outline-variant/40 hover:border-amber-400"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                                  isChecked
                                    ? "bg-emerald-600 text-white"
                                    : "border-2 border-slate-300 bg-white"
                                }`}
                              >
                                {isChecked && (
                                  <span className="material-symbols-outlined text-sm font-black">
                                    check
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-mono font-black text-xs text-primary">
                                  {item.qty}x
                                </span>
                                <span
                                  className={`text-xs font-bold leading-tight ${
                                    isChecked
                                      ? "line-through text-emerald-900/80"
                                      : "text-on-surface"
                                  }`}
                                >
                                  {item.name}
                                </span>
                              </div>
                            </div>

                            <span
                              className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${
                                isChecked
                                  ? "bg-emerald-200 text-emerald-900"
                                  : "bg-surface-container text-on-surface-variant"
                              }`}
                            >
                              {isChecked ? "Siap" : "Belum"}
                            </span>
                          </div>

                          {/* Pelengkap / Add-ons Tambahan */}
                          {item.selectedAddons && item.selectedAddons.length > 0 && (
                            <div className="ml-7 flex flex-wrap gap-1 mt-0.5">
                              {item.selectedAddons.map((addon, aIdx) => (
                                <span
                                  key={aIdx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-[10px] font-extrabold shadow-2xs"
                                >
                                  <span className="material-symbols-outlined text-[11px] text-amber-700">add_circle</span>
                                  <span>{addon.name}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Point 3: Item-level note (Keterangan per menu jika ada) */}
                          {item.note && (
                            <div className="ml-7 text-[10px] font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200/80 flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs text-amber-700 shrink-0">
                                edit_note
                              </span>
                              <span className="break-words">Note: {item.note}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Point 4: Tombol "Update Siap Disajikan" (Hanya Aktif Jika SEMUA Menu Sudah di-Checklist) */}
                  <div className="shrink-0 pt-1 border-t border-outline-variant/20">
                    <button
                      disabled={!isAllChecked}
                      onClick={() => handleCookingDoneAndDispatch(order)}
                      className={`w-full py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-sm ${
                        isAllChecked
                          ? "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-emerald-600/30 ring-2 ring-emerald-400 animate-pulse cursor-pointer"
                          : "bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed opacity-80"
                      }`}
                      title={
                        isAllChecked
                          ? "Semua menu selesai dimasak! Klik untuk update siap disajikan."
                          : "Centang semua pesanan terlebih dahulu sebelum update siap disajikan."
                      }
                    >
                      <span className="material-symbols-outlined text-base">
                        {isAllChecked ? "check_circle" : "lock"}
                      </span>
                      <span>
                        {isAllChecked
                          ? "✓ Update Siap Disajikan"
                          : `Checklist Belum Lengkap (${currentCheckedIndices.length}/${totalItems})`}
                      </span>
                    </button>
                    {!isAllChecked && (
                      <p className="text-[9px] text-center text-on-surface-variant font-medium mt-1">
                        Centang seluruh menu untuk mengaktifkan update siap disajikan
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* 3. Point 5: Modal Kelola Stok Produk Menu (Stok Habis / Tersedia)           */}
      {/* ========================================================================= */}
      {showStockModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-2xl max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-low shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-xl">inventory_2</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-sm text-on-surface">
                      Kelola Ketersediaan Stok Menu (Dapur)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black uppercase">
                      Kitchen Stock
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Klik tombol pada menu untuk menandai stok habis atau membuka kembali stok secara instan.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  <span>{productsList.length - outOfStockCount} Tersedia</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                  <span>{outOfStockCount} Stok Habis</span>
                </span>
                <button
                  onClick={() => setShowStockModal(false)}
                  className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant cursor-pointer transition-colors ml-1"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-3 border-b border-outline-variant/20 bg-surface-container-lowest flex flex-wrap items-center justify-between gap-2.5 shrink-0">
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {stockCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setStockCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      stockCategoryFilter === cat.id
                        ? "bg-primary text-on-primary shadow-2xs"
                        : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Search Input */}
              <div className="relative min-w-[220px]">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Cari nama menu..."
                  value={stockSearchQuery}
                  onChange={(e) => setStockSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-surface-container text-xs rounded-lg border border-outline-variant/30 focus:outline-hidden focus:ring-1 focus:ring-primary text-on-surface font-medium placeholder:text-on-surface-variant/60"
                />
              </div>
            </div>

            {/* Products Clean & Proportional Grid */}
            <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredStockProducts.map((prod) => {
                  const isAvailable = prod.isAvailable !== false;
                  const isUpdating = isUpdatingStockId === prod.id;
                  const img = prod.imageUrl || prod.image;

                  return (
                    <div
                      key={prod.id}
                      className={`rounded-2xl p-2.5 border transition-all flex flex-col justify-between gap-2 shadow-2xs ${
                        isAvailable
                          ? "bg-surface-container-lowest border-outline-variant/30 hover:border-primary/40 hover:shadow-xs"
                          : "bg-rose-50/70 border-rose-300 ring-1 ring-rose-300/50"
                      }`}
                    >
                      {/* 1. Foto Produk */}
                      <div
                        className={`relative w-full aspect-4/3 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 shrink-0 ${
                          !isAvailable ? "grayscale contrast-125" : ""
                        }`}
                      >
                        {img ? (
                          <img
                            src={img}
                            alt={prod.name}
                            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1">
                            <span className="material-symbols-outlined text-2xl">restaurant</span>
                            <span className="text-[10px]">Tanpa Foto</span>
                          </div>
                        )}

                        {/* Status Overlay Badge */}
                        <div className="absolute top-2 left-2 z-10">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs ${
                              isAvailable
                                ? "bg-emerald-600 text-white"
                                : "bg-rose-600 text-white animate-pulse"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[11px]">
                              {isAvailable ? "check_circle" : "block"}
                            </span>
                            <span>{isAvailable ? "Tersedia" : "Habis"}</span>
                          </span>
                        </div>
                      </div>

                      {/* 2. Nama Produk (Clean, Tanpa Kode, Kategori, atau Harga) */}
                      <div className="flex-1 min-w-0 px-0.5 flex items-center">
                        <h4
                          className={`font-bold text-xs lg:text-sm leading-snug line-clamp-2 ${
                            isAvailable ? "text-slate-900" : "text-rose-950"
                          }`}
                          title={prod.name}
                        >
                          {prod.name}
                        </h4>
                      </div>

                      {/* 3. Tombol Untuk Stok Habis / Tersedia */}
                      <button
                        disabled={isUpdating}
                        onClick={() => handleToggleProductStock(prod)}
                        className={`w-full py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 ${
                          isAvailable
                            ? "bg-slate-100 hover:bg-rose-600 hover:text-white text-rose-700 border border-slate-200/80 hover:border-rose-600"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                        }`}
                        title={
                          isAvailable
                            ? "Klik untuk menandai menu ini Stok Habis"
                            : "Klik untuk membuka kembali stok menu ini"
                        }
                      >
                        {isUpdating ? (
                          <span className="material-symbols-outlined text-sm animate-spin">
                            progress_activity
                          </span>
                        ) : (
                          <span className="material-symbols-outlined text-sm">
                            {isAvailable ? "block" : "check_circle"}
                          </span>
                        )}
                        <span>{isAvailable ? "Tandai Habis" : "Buka Stok"}</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {filteredStockProducts.length === 0 && (
                <div className="text-center py-12 text-on-surface-variant flex flex-col items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-1">
                    search_off
                  </span>
                  <span className="text-xs font-bold">Menu Tidak Ditemukan</span>
                  <span className="text-[11px] text-on-surface-variant/70">
                    Coba sesuaikan kata kunci pencarian atau kategori filter.
                  </span>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-3 border-t border-outline-variant/30 bg-surface-container-low flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-on-surface-variant">
                Total: {productsList.length} Menu •{" "}
                <span className="text-rose-600 font-extrabold">{outOfStockCount} Stok Habis</span>
              </span>
              <button
                onClick={() => setShowStockModal(false)}
                className="px-4 py-1.5 rounded-xl bg-primary text-on-primary hover:bg-primary/90 text-xs font-bold cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. Modal Riwayat Pesanan Selesai Masak                                    */}
      {/* ========================================================================= */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-low shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">history</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-on-surface">Riwayat Pesanan Dapur</h3>
                  <p className="text-[11px] text-on-surface-variant">
                    Daftar seluruh pesanan yang telah selesai dimasak di dapur
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-3 border-b border-outline-variant/20 bg-surface-container-lowest flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setHistoryFilterChannel("all")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    historyFilterChannel === "all"
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  Semua ({completedHistoryOrders.length})
                </button>
                <button
                  onClick={() => setHistoryFilterChannel("dine_in")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    historyFilterChannel === "dine_in"
                      ? "bg-blue-600 text-white"
                      : "bg-blue-50 text-blue-800 border border-blue-200"
                  }`}
                >
                  Dine In
                </button>
                <button
                  onClick={() => setHistoryFilterChannel("takeaway")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    historyFilterChannel === "takeaway"
                      ? "bg-amber-600 text-white"
                      : "bg-amber-50 text-amber-800 border border-amber-200"
                  }`}
                >
                  Take Away
                </button>
                <button
                  onClick={() => setHistoryFilterChannel("online")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    historyFilterChannel === "online"
                      ? "bg-emerald-700 text-white"
                      : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  }`}
                >
                  Delivery
                </button>
              </div>

              {/* Search Input */}
              <div className="relative min-w-[180px]">
                <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Cari Meja / No..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="w-full pl-7 pr-3 py-1 bg-surface-container text-xs rounded-lg border border-outline-variant/30 focus:outline-hidden focus:ring-1 focus:ring-primary text-on-surface font-medium"
                />
              </div>
            </div>

            {/* Orders History List */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1 custom-scrollbar">
              {completedHistoryOrders.map((ord) => {
                const channelStyle = getChannelStyle(ord.channel, ord.channelLabel);

                return (
                  <div
                    key={ord.id}
                    className={`p-3 rounded-xl border ${channelStyle.cardBorder} ${channelStyle.cardBg} ${channelStyle.borderLeft} flex items-start justify-between gap-3 shadow-2xs`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-extrabold text-sm text-on-surface">
                          {ord.tableOrGuest}
                        </span>
                        <span className="font-mono text-xs text-primary font-bold">
                          {ord.orderNumber}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md ${channelStyle.badgeBg} font-extrabold flex items-center gap-1`}
                        >
                          <span className="material-symbols-outlined text-[11px]">
                            {channelStyle.icon}
                          </span>
                          <span>{channelStyle.name}</span>
                        </span>
                        <span className="text-[11px] font-mono text-on-surface-variant">
                          {ord.orderTime} ({ord.timeAgo})
                        </span>
                      </div>

                      {ord.guestSubtext && (
                        <p className="text-[11px] text-on-surface-variant font-medium mb-1 truncate">
                          {ord.guestSubtext}
                        </p>
                      )}

                      {ord.specialNote && (
                        <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded mb-1 font-medium">
                          Note: {ord.specialNote}
                        </p>
                      )}

                      {/* Items List */}
                      <div className="text-xs text-on-surface font-semibold flex flex-wrap gap-x-3 gap-y-1 mt-1 bg-white/70 p-2 rounded-lg border border-outline-variant/20">
                        {ord.items.map((i, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1">
                            <span className="font-mono font-bold text-primary">{i.qty}x</span>
                            <span>{i.name}</span>
                            {i.selectedAddons && i.selectedAddons.length > 0 && (
                              <span className="text-amber-800 text-[10px] font-bold">
                                (+{i.selectedAddons.map((a) => a.name).join(", ")})
                              </span>
                            )}
                            {i.note && <span className="text-amber-800 text-[10px]">({i.note})</span>}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-700 text-white text-xs font-bold shadow-2xs">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      <span>Selesai Masak</span>
                    </div>
                  </div>
                );
              })}

              {completedHistoryOrders.length === 0 && (
                <div className="text-center py-12 text-on-surface-variant flex flex-col items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-1">
                    history
                  </span>
                  <span className="text-xs font-bold">Belum Ada Riwayat Pesanan Selesai</span>
                  <span className="text-[11px] text-on-surface-variant/70">
                    Pesanan yang selesai dimasak akan tercatat dan dapat dilihat di sini.
                  </span>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-3 border-t border-outline-variant/30 bg-surface-container-low flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-on-surface-variant">
                Total Riwayat: {completedHistoryOrders.length} Pesanan Selesai
              </span>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
