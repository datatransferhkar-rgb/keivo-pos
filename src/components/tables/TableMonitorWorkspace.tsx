"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { OrderData, KitchenStatus } from "@/types/pos";
import { useRestaurant } from "@/context/RestaurantContext";
import { formatCurrency } from "@/lib/formatters";

interface TableMonitorWorkspaceProps {
  orders?: OrderData[];
  onNavigateHome?: () => void;
  onOpenPos?: () => void;
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
function getChannelStyle(channel?: string, channelLabel?: string) {
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

export function TableMonitorWorkspace({
  orders,
  onNavigateHome,
  onOpenPos,
  onUpdateOrderStatus,
}: TableMonitorWorkspaceProps) {
  const { settings, currentUser, switchRole, logout } = useRestaurant();
  const [allOrders, setAllOrders] = useState<OrderData[]>(orders || []);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Time state for live clock
  const [currentTime, setCurrentTime] = useState<string>("");

  // Tracking checklist state for Waiters: orderId -> list of checked item indices
  const [checkedDeliveryMap, setCheckedDeliveryMap] = useState<Record<string, number[]>>({});

  // Input komentar customer per kartu pesanan (opsional, tidak mandatori)
  const [customerComments, setCustomerComments] = useState<Record<string, string>>({});

  // Delivered order IDs in current session
  const [deliveredOrderIds, setDeliveredOrderIds] = useState<string[]>([]);

  // History Modal State (Pesanan yang sudah diantarkan)
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyFilterChannel, setHistoryFilterChannel] = useState<string>("all");
  const [historySearchQuery, setHistorySearchQuery] = useState<string>("");

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fullscreen kiosk state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showIosFullscreenGuide, setShowIosFullscreenGuide] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = async () => {
    try {
      const isIOS =
        typeof navigator !== "undefined" &&
        (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) &&
        !(window as any).MSStream;

      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        const docEl = document.documentElement as any;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
          setIsFullscreen(true);
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
          setIsFullscreen(true);
        } else if (isIOS) {
          setShowIosFullscreenGuide(true);
        } else {
          setIsFullscreen((prev) => !prev);
        }
      } else {
        const doc = document as any;
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
        setIsFullscreen(false);
      }
    } catch (e) {
      console.log("Fullscreen request notice:", e);
      setShowIosFullscreenGuide(true);
    }
  };

  const isPrivileged = ["owner", "admin", "manager"].includes(currentUser.role);
  const prevReadyCountRef = useRef<number>(0);

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
      const res = await fetch(`/api/orders?_t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        const readyOrders = data.filter((o) => o.kitchenStatus === "ready");
        if (
          soundEnabled &&
          prevReadyCountRef.current > 0 &&
          readyOrders.length > prevReadyCountRef.current
        ) {
          playChime("new_order");
        }
        prevReadyCountRef.current = readyOrders.length;
        setAllOrders(data);
      }
    } catch (err) {
      console.log("Error loading orders in TableMonitor:", err);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => fetchOrders(true), 2000);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        bc = new BroadcastChannel("keivo_pos_orders_sync");
        bc.onmessage = () => {
          fetchOrders(true);
        };
      }
    } catch (e) {
      // ignore
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "keivo_order_sync_trigger") {
        fetchOrders(true);
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      clearInterval(interval);
      if (bc) bc.close();
      window.removeEventListener("storage", handleStorage);
    };
  }, [soundEnabled]);

  // Sync with orders prop if provided
  useEffect(() => {
    if (orders && Array.isArray(orders)) {
      setAllOrders(orders);
    }
  }, [orders]);

  // Trigger Toast
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 4000);
  };

  // Toggle item checklist in Column 2 (Siap Disajikan - Checklist Pengantaran oleh Waiters)
  const handleToggleItemCheck = (orderId: string, itemIdx: number) => {
    if (soundEnabled) playChime("click");
    setCheckedDeliveryMap((prev) => {
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
    setCheckedDeliveryMap((prev) => ({
      ...prev,
      [orderId]: Array.from({ length: totalCount }, (_, i) => i),
    }));
  };

  // Update Status Pesanan Sudah Diantarkan (Action by Waiters)
  const handleMarkDelivered = async (order: OrderData) => {
    if (soundEnabled) playChime("ready_dispatch");

    const comment = customerComments[order.id]?.trim() || "";

    // Add to delivered list so it immediately leaves the 4 active slots
    setDeliveredOrderIds((prev) => [...prev, order.id]);

    // Optimistic local state update
    setAllOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? {
              ...o,
              kitchenStatus: "served",
              kitchenStatusLabel: "Selesai Disajikan",
              customerComment: comment || o.customerComment,
            }
          : o
      )
    );

    if (onUpdateOrderStatus) {
      onUpdateOrderStatus(order.id, "served");
    }

    try {
      // 1. Update order in database to "served" with optional customerComment
      await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          kitchenStatus: "served",
          tableNumber: order.tableOrGuest,
          customerComment: comment || undefined,
        }),
      });

      // 2. If dine-in, also update table's foodStatus in database to "served"
      if (order.channel === "dine_in_qr" || order.tableOrGuest.toLowerCase().includes("meja")) {
        await fetch("/api/tables", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tableNumber: order.tableOrGuest,
            foodStatus: "served",
            foodStatusLabel: "Semua Makanan Sudah Disajikan",
            isProcessing: false,
          }),
        }).catch(() => {});
      }

      fetchOrders(true);
    } catch (err) {
      console.error("Failed to mark order as delivered:", err);
    }

    triggerToast(`✓ Pesanan ${order.tableOrGuest} (${order.orderNumber}) berhasil diantarkan ke tamu!`);
  };

  // =========================================================================
  // KOLOM 1 (20%): Pesanan Sedang Dimasak di Dapur
  // =========================================================================
  const cookingOrders = useMemo(() => {
    return allOrders
      .filter((o) => {
        if (deliveredOrderIds.includes(o.id)) return false;
        if (
          o.kitchenStatus === "completed" ||
          o.kitchenStatus === "served" ||
          o.kitchenStatus === "ready" ||
          o.kitchenStatus === "cancelled"
        ) {
          return false;
        }
        // Orders being prepared in kitchen
        return (
          o.kitchenStatus === "in_progress" ||
          o.kitchenStatus === "plating" ||
          o.kitchenStatus === "ready_check" ||
          o.kitchenStatus === "new"
        );
      })
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA && timeB) return timeA - timeB;
        return (a.id || "").localeCompare(b.id || "");
      });
  }, [allOrders, deliveredOrderIds]);

  // =========================================================================
  // KOLOM 2 (80%): Pesanan Siap Disajikan & Checklist (1 Baris 4 Kartu)
  // =========================================================================
  const allReadyOrders = useMemo(() => {
    return allOrders
      .filter((o) => {
        if (deliveredOrderIds.includes(o.id)) return false;
        if (
          o.kitchenStatus === "completed" ||
          o.kitchenStatus === "served" ||
          o.kitchenStatus === "cancelled"
        ) {
          return false;
        }
        return o.kitchenStatus === "ready";
      })
      .sort((a, b) => {
        // Earliest ready first
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA && timeB) return timeA - timeB;
        return (a.id || "").localeCompare(b.id || "");
      });
  }, [allOrders, deliveredOrderIds]);

  // Exactly 4 active cards in 1 row for Column 2 (80%)
  const readyChecklistCards = useMemo(() => {
    return allReadyOrders.slice(0, 4);
  }, [allReadyOrders]);

  // History Orders List: Pesanan yang sudah selesai diantarkan ke tamu
  const deliveredHistoryOrders = useMemo(() => {
    return allOrders
      .filter((o) => {
        const isDelivered =
          o.kitchenStatus === "served" ||
          o.kitchenStatus === "completed" ||
          deliveredOrderIds.includes(o.id);
        if (!isDelivered) return false;

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
        // Most recent first for history
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA && timeB) return timeB - timeA;
        return (b.id || "").localeCompare(a.id || "");
      });
  }, [allOrders, deliveredOrderIds, historyFilterChannel, historySearchQuery]);

  return (
    <div className="fixed inset-0 w-full h-[100dvh] max-h-[100dvh] flex flex-col bg-surface-container-high font-body-md text-on-surface overflow-hidden overscroll-none select-none">
      {/* ========================================================================= */}
      {/* 1. Header Bar: Minimalis & Clean dengan Icon Toolbar seperti POS         */}
      {/* ========================================================================= */}
      <header className="shrink-0 px-3 sm:px-4 py-2 bg-white border-b border-slate-200/80 flex items-center justify-between gap-3 shadow-2xs z-30">
        {/* Sisi Kiri: Back, Icon, Judul Bersih */}
        <div className="flex items-center gap-2.5 shrink-0 min-w-0">
          {isPrivileged && onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center justify-center shrink-0 shadow-2xs active:scale-95"
              title="Kembali ke Dashboard Utama"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
            </button>
          )}

          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <span className="material-symbols-outlined text-xl">room_service</span>
          </div>

          <div className="flex flex-col shrink-0">
            <div className="flex items-center gap-2">
              <h1 className="font-headline-sm text-sm sm:text-base font-black text-slate-900 leading-tight whitespace-nowrap">
                Monitor Waiters &amp; Tamu
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200 text-[10px] font-black uppercase tracking-wider shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                <span>Waiters</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight truncate">
              {settings.restaurantName}
            </p>
          </div>
        </div>

        {/* Sisi Kanan: User Badge & Minimalist Icon Toolbar (Identik dengan POS) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Active User Badge (Sama seperti POS) */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 shrink-0"
            title={`Waiters: ${currentUser.name} (${currentUser.role.toUpperCase()})`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-500 shrink-0"></span>
            <span className="truncate max-w-[85px] sm:max-w-[120px]">{currentUser.name}</span>
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-slate-200 mx-0.5 hidden sm:block shrink-0" />

          {/* 1. Buka POS Kasir (jika onOpenPos ada) */}
          {onOpenPos && (
            <button
              type="button"
              id="btn-waiter-pos"
              onClick={onOpenPos}
              className="w-9 h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0"
              title="Buka POS Kasir &amp; Transaksi"
            >
              <span className="material-symbols-outlined text-lg">point_of_sale</span>
            </button>
          )}

          {/* 2. Riwayat Pesanan Selesai Disajikan (Icon receipt_long) */}
          <button
            type="button"
            id="btn-waiter-riwayat"
            onClick={() => setShowHistoryModal(true)}
            className="relative w-9 h-9 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-center transition-all active:scale-95 shadow-2xs cursor-pointer shrink-0"
            title={`Riwayat Pesanan Selesai Disajikan (${deliveredHistoryOrders.length})`}
          >
            <span className="material-symbols-outlined text-lg text-slate-600">receipt_long</span>
            {deliveredHistoryOrders.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                {deliveredHistoryOrders.length}
              </span>
            )}
          </button>

          {/* 3. Mode Layar Penuh (Fullscreen Kiosk Mode) */}
          <button
            type="button"
            id="btn-waiter-fullscreen"
            onClick={handleToggleFullscreen}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0 ${
              isFullscreen
                ? "bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-900"
                : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
            }`}
            title={isFullscreen ? "Keluar Layar Penuh" : "Mode Layar Penuh Tablet Waiters"}
          >
            <span className="material-symbols-outlined text-lg text-slate-600">
              {isFullscreen ? "fullscreen_exit" : "fullscreen"}
            </span>
          </button>

          {/* 4. Notifikasi Suara (Audio Chime Toggle) */}
          <button
            type="button"
            id="btn-waiter-sound-toggle"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0 ${
              soundEnabled
                ? "bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-900"
                : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-400"
            }`}
            title={soundEnabled ? "Notifikasi Suara Waiters Aktif (Klik untuk Mode Bisu)" : "Suara Bisu / Mute (Klik untuk Mengaktifkan)"}
          >
            <span className="material-symbols-outlined text-lg">
              {soundEnabled ? "volume_up" : "volume_off"}
            </span>
          </button>

          {/* 5. Segarkan (Refresh) */}
          <button
            type="button"
            id="btn-waiter-refresh"
            onClick={() => fetchOrders()}
            className="w-9 h-9 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-center transition-all active:scale-95 shadow-2xs cursor-pointer shrink-0"
            title="Segarkan Status Antrean Waiters"
          >
            <span className={`material-symbols-outlined text-lg text-primary ${isRefreshing ? "animate-spin" : ""}`}>
              sync
            </span>
          </button>

          {/* 6. Keluar / Logout */}
          <button
            type="button"
            id="btn-waiter-logout"
            onClick={() => logout()}
            className="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-2xs active:scale-95"
            title="Keluar / Logout Akun"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
          </button>
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
      {/* 2. Main 2-Column Layout: Kolom Kiri 20% & Kolom Kanan 80% (Sama dengan KDS) */}
      {/* ========================================================================= */}
      <main className="flex-1 min-h-0 overflow-hidden p-3 grid grid-cols-1 lg:grid-cols-[20%_80%] gap-3">
        {/* ========================================================================= */}
        {/* KOLOM 1 (20%): Pesanan Sedang Dimasak di Dapur                           */}
        {/* ========================================================================= */}
        <section className="h-full flex flex-col bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs overflow-hidden">
          {/* Column Header */}
          <div className="px-3 py-2 bg-amber-50/80 border-b border-amber-200/70 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center shadow-2xs">
                <span className="material-symbols-outlined text-base">skillet</span>
              </div>
              <div>
                <h2 className="text-xs font-black uppercase text-amber-950 tracking-wide">
                  Sedang Dimasak
                </h2>
                <p className="text-[10px] text-amber-800 font-medium leading-none">
                  Proses Memasak di Dapur
                </p>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white font-mono font-black text-xs shadow-2xs">
              {cookingOrders.length}
            </span>
          </div>

          {/* Color Legend (Keterangan Saluran Pesanan) */}
          <div className="mx-2.5 mt-2 p-2 rounded-xl bg-surface-container border border-outline-variant/30 flex flex-col gap-1.5 shrink-0">
            <div className="flex items-center justify-between text-[10px] font-bold text-on-surface-variant">
              <span className="flex items-center gap-1 font-extrabold text-on-surface">
                <span className="material-symbols-outlined text-xs text-primary">palette</span>
                <span>Saluran Pesanan:</span>
              </span>
              <span className="text-[9px] text-on-surface-variant/70 italic">Kategori</span>
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

          {/* Tickets List: Pesanan yang sedang dimasak */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar overscroll-contain">
            {cookingOrders.map((order, idx) => {
              const channelStyle = getChannelStyle(order.channel, order.channelLabel);
              const totalItemsCount = order.items.reduce((s, it) => s + (it.qty || 1), 0);

              return (
                <div
                  key={order.id}
                  className={`rounded-xl border ${channelStyle.cardBorder} ${channelStyle.cardBg} ${channelStyle.borderLeft} p-2.5 transition-all shadow-2xs flex flex-col gap-1.5`}
                >
                  {/* Top Bar: Nomor Urut & Nomor Order */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-5 h-5 rounded-md ${channelStyle.queueBadgeBg} font-mono font-black text-[11px] flex items-center justify-center shrink-0 shadow-2xs`}
                        title={`Antrian Masak #${idx + 1}`}
                      >
                        #{idx + 1}
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

                  {/* Meja / Nama Pemesan & Waktu Pesan */}
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

                  {/* Catatan Pesanan jika ada */}
                  {order.specialNote && (
                    <div className="text-[10px] bg-amber-100/90 text-amber-950 px-1.5 py-0.5 rounded border border-amber-300 font-semibold flex items-center gap-1 truncate">
                      <span className="material-symbols-outlined text-[11px] text-amber-700">edit_note</span>
                      <span className="truncate">Note: {order.specialNote}</span>
                    </div>
                  )}

                  {/* Ringkasan Menu & Indikator Masak */}
                  <div className="flex items-center justify-between text-[11px] font-bold text-on-surface-variant bg-white/80 p-1.5 rounded-lg border border-outline-variant/20 mt-0.5">
                    <span className="flex items-center gap-1 truncate">
                      <span className="material-symbols-outlined text-xs text-primary">lunch_dining</span>
                      <span className="truncate">{order.items.length} Menu ({totalItemsCount} Porsi)</span>
                    </span>

                    <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-extrabold flex items-center gap-0.5 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                      <span>Di Dapur</span>
                    </span>
                  </div>
                </div>
              );
            })}

            {cookingOrders.length === 0 && (
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-4 rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-low text-on-surface-variant">
                <span className="material-symbols-outlined text-3xl text-on-surface-variant/40 mb-1">
                  done_all
                </span>
                <span className="font-bold text-xs text-on-surface">Semua Masakan Selesai</span>
                <span className="text-[10px] text-on-surface-variant mt-0.5">
                  Tidak ada pesanan yang sedang dimasak di dapur saat ini.
                </span>
              </div>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* ========================================================================= */}
        {/* KOLOM 2 (80%): Siap Disajikan & Checklist (1 BARIS 4 KARTU ANTRIAN ANTAR) */}
        {/* ========================================================================= */}
        <section className="h-full flex flex-col bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs overflow-hidden">
          {/* Column Header */}
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-200/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-2xs">
                <span className="material-symbols-outlined text-base">room_service</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-black uppercase text-blue-950 tracking-wide">
                    Siap Disajikan (Lanjutan dari KDS)
                  </h2>
                  <span className="px-1.5 py-0.2 rounded bg-blue-200 text-blue-900 text-[9px] font-black uppercase tracking-wider">
                    Checklist Waiters
                  </span>
                </div>
                <p className="text-[10px] text-blue-800 font-medium leading-none mt-0.5">
                  1 Baris 4 Kartu Antar • Centang menu yang telah diantarkan ke customer • Input komentar tamu bila ada (opsional)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-mono font-black text-xs shadow-2xs">
                {readyChecklistCards.length}/4 Slot Siap Antar
              </span>
            </div>
          </div>

          {/* Column Content: 1 BARIS 4 KARTU ANTRIAN CHECKLIST ANTAR (GRID COLS 4) */}
          <div className="flex-1 min-h-0 p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 overflow-hidden">
            {/* RENDER 4 SLOTS ANTAR (Slots 0 to 3) */}
            {[0, 1, 2, 3].map((slotIdx) => {
              const order = readyChecklistCards[slotIdx];

              if (!order) {
                // Empty Slot Placeholder
                return (
                  <div
                    key={`empty-delivery-slot-${slotIdx}`}
                    className="h-full rounded-2xl border-2 border-dashed border-outline-variant/40 bg-surface-container-low/70 flex flex-col items-center justify-center text-center p-4 text-on-surface-variant transition-all"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-400 flex items-center justify-center mb-2 border border-blue-100">
                      <span className="material-symbols-outlined text-2xl">table_restaurant</span>
                    </div>
                    <span className="font-mono font-extrabold text-[11px] text-slate-500 uppercase tracking-wider mb-0.5">
                      Slot Antar #{slotIdx + 1}
                    </span>
                    <span className="font-bold text-xs text-on-surface">Slot Tersedia</span>
                    <p className="text-[11px] text-on-surface-variant/80 mt-1 max-w-[180px]">
                      Pesanan yang selesai dimasak dari dapur (KDS) akan otomatis masuk ke slot ini untuk diantarkan waiters ke customer.
                    </p>
                  </div>
                );
              }

              // Active Ready Order Card
              const channelStyle = getChannelStyle(order.channel, order.channelLabel);
              const currentCheckedIndices = checkedDeliveryMap[order.id] || [];
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
                      : "border-blue-300 bg-surface-container-lowest"
                  }`}
                >
                  {/* Top Bar: Slot #, Table, Channel & Order Number */}
                  <div className="shrink-0 pb-2 border-b border-outline-variant/30 mb-1.5">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-1.5 py-0.5 rounded-md bg-blue-700 text-white font-mono font-black text-[10px] shrink-0">
                          Antar #{slotIdx + 1}
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
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[11px]">check_circle</span>
                        <span>Siap Saji dari Kitchen ({order.timeAgo})</span>
                      </span>
                    </div>

                    {order.guestSubtext && (
                      <p className="text-[10px] text-on-surface-variant font-medium truncate mt-0.5">
                        {order.guestSubtext}
                      </p>
                    )}

                    {/* Delivery Checklist Progress Bar & Quick Action */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isAllChecked ? "bg-emerald-600" : "bg-blue-600"
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        ></div>
                      </div>
                      <span
                        className={`text-[10px] font-black shrink-0 ${
                          isAllChecked ? "text-emerald-700" : "text-blue-800"
                        }`}
                      >
                        {currentCheckedIndices.length}/{totalItems} ({progressPercent}%)
                      </span>
                      <button
                        onClick={() => handleCheckAllItems(order.id, totalItems)}
                        className="px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-[9px] font-bold text-on-surface flex items-center gap-0.5 cursor-pointer transition-colors border border-outline-variant/30 shrink-0"
                        title="Centang semua menu yang sudah diserahkan ke tamu"
                      >
                        <span className="material-symbols-outlined text-[10px] text-emerald-700">done_all</span>
                        <span>Semua</span>
                      </button>
                    </div>
                  </div>

                  {/* Catatan Khusus Pesanan dari Customer atau Kasir */}
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

                  {/* Checklist Serah Terima Menu ke Tamu */}
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar mb-1.5 overscroll-contain">
                    {order.items.map((item, itemIdx) => {
                      const isChecked = currentCheckedIndices.includes(itemIdx);
                      return (
                        <div
                          key={itemIdx}
                          onClick={() => handleToggleItemCheck(order.id, itemIdx)}
                          className={`p-2 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                            isChecked
                              ? "bg-emerald-100/70 border-emerald-400 text-emerald-950"
                              : "bg-surface-container-lowest border-outline-variant/40 hover:border-blue-400"
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
                              {isChecked ? "Diantarkan" : "Belum"}
                            </span>
                          </div>

                          {/* Pilihan Pelengkap Tambahan */}
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

                          {/* Catatan Per Menu jika ada */}
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

                  {/* Input Komentar dari Customer (Opsional - Tidak Mandatori) */}
                  <div className="shrink-0 pt-1.5 pb-1 border-t border-outline-variant/20 mb-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-black text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-blue-600">rate_review</span>
                        <span>Komentar Customer</span>
                      </label>
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                        Opsional
                      </span>
                    </div>
                    <input
                      type="text"
                      value={customerComments[order.id] || ""}
                      onChange={(e) =>
                        setCustomerComments((prev) => ({ ...prev, [order.id]: e.target.value }))
                      }
                      placeholder="Input komentar / masukan tamu jika ada..."
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-surface-container/70 border border-outline-variant/30 focus:outline-hidden focus:border-blue-500 focus:bg-white text-on-surface font-medium placeholder:text-slate-400 placeholder:text-[10px] transition-colors"
                    />
                  </div>

                  {/* Tombol Update: Pesanan Sudah Diantarkan (Hanya Aktif Jika SEMUA Menu Sudah di-Checklist) */}
                  <div className="shrink-0 pt-1">
                    <button
                      disabled={!isAllChecked}
                      onClick={() => handleMarkDelivered(order)}
                      className={`w-full py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-sm ${
                        isAllChecked
                          ? "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-emerald-600/30 ring-2 ring-emerald-400 animate-pulse cursor-pointer"
                          : "bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed opacity-80"
                      }`}
                      title={
                        isAllChecked
                          ? "Semua menu telah diserahkan! Klik untuk update status pesanan sudah diantarkan."
                          : "Centang semua menu yang sudah diserahkan ke tamu sebelum menyelesaikan pesanan."
                      }
                    >
                      <span className="material-symbols-outlined text-base">
                        {isAllChecked ? "check_circle" : "lock"}
                      </span>
                      <span>
                        {isAllChecked
                          ? "✓ Update Selesai Disajikan"
                          : `Checklist Antar Belum Lengkap (${currentCheckedIndices.length}/${totalItems})`}
                      </span>
                    </button>
                    {!isAllChecked && (
                      <p className="text-[9px] text-center text-on-surface-variant font-medium mt-1">
                        Centang seluruh menu yang diserahkan untuk menyelesaikan pengantaran
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
      {/* 3. Modal Riwayat Pesanan yang Sudah Diantarkan                           */}
      {/* ========================================================================= */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-low shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">history</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-on-surface">
                    Riwayat Pesanan Selesai Disajikan
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">
                    Daftar seluruh pesanan yang telah selesai diserahkan oleh waiters ke tamu/customer
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
                  Semua ({deliveredHistoryOrders.length})
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
              <div className="relative min-w-[200px]">
                <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Cari Meja / No Order / Tamu..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="w-full pl-7 pr-3 py-1 bg-surface-container text-xs rounded-lg border border-outline-variant/30 focus:outline-hidden focus:ring-1 focus:ring-primary text-on-surface font-medium"
                />
              </div>
            </div>

            {/* Orders History List */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1 custom-scrollbar">
              {deliveredHistoryOrders.map((ord) => {
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
                          Note Pesanan: {ord.specialNote}
                        </p>
                      )}

                      {/* Komentar dari Customer saat Diantar */}
                      {ord.customerComment && (
                        <div className="text-[11px] text-blue-950 bg-blue-50/90 border border-blue-200/90 px-2.5 py-1.5 rounded-lg mb-1.5 flex items-start gap-1.5 shadow-2xs">
                          <span className="material-symbols-outlined text-sm text-blue-700 shrink-0 mt-0.5">
                            rate_review
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-black text-blue-900 uppercase tracking-wide block leading-none mb-0.5">
                              Komentar Customer:
                            </span>
                            <p className="text-xs font-semibold leading-tight text-blue-950 italic break-words">
                              &ldquo;{ord.customerComment}&rdquo;
                            </p>
                          </div>
                        </div>
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
                      <span className="material-symbols-outlined text-sm">verified</span>
                      <span>Selesai Disajikan</span>
                    </div>
                  </div>
                );
              })}

              {deliveredHistoryOrders.length === 0 && (
                <div className="text-center py-12 text-on-surface-variant flex flex-col items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-1">
                    history
                  </span>
                  <span className="text-xs font-bold">Belum Ada Riwayat Pesanan Selesai Disajikan</span>
                  <span className="text-[11px] text-on-surface-variant/70">
                    Pesanan yang telah di-checklist dan di-update selesai diantar akan tersimpan di sini.
                  </span>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-3 border-t border-outline-variant/30 bg-surface-container-low flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-on-surface-variant">
                Total Riwayat: {deliveredHistoryOrders.length} Pesanan Telah Diantarkan
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

      {/* ========================================================
          MODAL PANDUAN FULLSCREEN / KIOSK IPAD (IOS SAFARI)
         ======================================================== */}
      {showIosFullscreenGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowIosFullscreenGuide(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">tablet_mac</span>
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 leading-tight">
                  Mode Kiosk Layar Penuh di iPad
                </h3>
                <p className="text-xs text-slate-500">
                  Jalankan Monitor Waiters tanpa bilah alamat browser Safari
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
                  Buka dari ikon di Home Screen iPad. Layar Waiters akan otomatis berjalan <strong>100% Layar Penuh (Fullscreen Kiosk)</strong> tanpa bilah Safari dan anti scroll!
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosFullscreenGuide(false)}
              className="w-full py-3 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-xs transition-colors cursor-pointer"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
