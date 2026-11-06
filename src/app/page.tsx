"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { SalesInfographicDashboard } from "@/components/dashboard/SalesInfographicDashboard";
import { PosWorkspace } from "@/components/pos/PosWorkspace";
import { KitchenWorkspace } from "@/components/kitchen/KitchenWorkspace";
import { TableMonitorWorkspace } from "@/components/tables/TableMonitorWorkspace";
import { MasterDataWorkspace } from "@/components/master/MasterDataWorkspace";
import { ReportsWorkspace } from "@/components/reports/ReportsWorkspace";
import { SettingsWorkspace } from "@/components/settings/SettingsWorkspace";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { TakeawayModal } from "@/components/modals/TakeawayModal";
import { OjolModal } from "@/components/modals/OjolModal";
import { PaymentModal } from "@/components/modals/PaymentModal";
import { ShiftCloseModal } from "@/components/modals/ShiftCloseModal";
import { PrintModal } from "@/components/modals/PrintModal";
import { OrderData, RestaurantSettings, CashDrawerData } from "@/types/pos";
import { useRestaurant } from "@/context/RestaurantContext";
import { SystemMenu, UserRole } from "@/types/auth";
import { LoginWorkspace } from "@/components/auth/LoginWorkspace";

export default function RestaurantPosApp() {
  const {
    settings,
    updateSettings,
    isSettingsOpen,
    setIsSettingsOpen,
    currentUser,
    canAccessMenu,
    isAuthenticated,
    logout,
  } = useRestaurant();

  const [orders, setOrders] = useState<OrderData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeNav, setActiveNav] = useState<string>("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Cash drawer state
  const [cashDrawer, setCashDrawer] = useState<CashDrawerData>({
    floatAmount: 500000,
    cashReceived: 1640000,
    cashOut: 45000,
    cashOutReason: "Es Batu & Parkir",
    totalDrawer: 2095000,
  });

  // Modals
  const [isTakeawayOpen, setIsTakeawayOpen] = useState(false);
  const [isOjolOpen, setIsOjolOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedPaymentOrder, setSelectedPaymentOrder] = useState<OrderData | null>(null);
  const [isShiftCloseOpen, setIsShiftCloseOpen] = useState(false);
  const [printModalState, setPrintModalState] = useState<{
    isOpen: boolean;
    type: "receipt" | "waiter_ticket" | "shift_report";
    order?: OrderData | null;
  }>({ isOpen: false, type: "receipt" });

  // Handle successful login redirect by role
  const handleLoginSuccess = (role: UserRole) => {
    if (role === "kasir") {
      setActiveNav("pos");
      if (typeof window !== "undefined") window.location.hash = "pos";
    } else if (role === "kitchen") {
      setActiveNav("kitchen");
      if (typeof window !== "undefined") window.location.hash = "kitchen";
    } else if (role === "waiters") {
      setActiveNav("area_meja");
      if (typeof window !== "undefined") window.location.hash = "area_meja";
    } else {
      setActiveNav("dashboard");
      if (typeof window !== "undefined") window.location.hash = "dashboard";
    }
  };

  // Sync activeNav with URL hash (#pos, #kitchen, etc.)
  useEffect(() => {
    const handleHashSync = () => {
      if (typeof window === "undefined") return;
      const hash = window.location.hash.replace("#", "") as SystemMenu;
      const validMenus: SystemMenu[] = [
        "dashboard",
        "pos",
        "kitchen",
        "area_meja",
        "master_data",
        "laporan",
        "pengaturan",
      ];
      if (hash && validMenus.includes(hash)) {
        if (canAccessMenu(hash)) {
          setActiveNav(hash);
        }
      }
    };

    handleHashSync();
    window.addEventListener("hashchange", handleHashSync);
    return () => window.removeEventListener("hashchange", handleHashSync);
  }, [canAccessMenu]);

  // Auto-redirect based on user role when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    if (currentUser.role === "kasir" && activeNav !== "pos") {
      setActiveNav("pos");
    } else if (currentUser.role === "kitchen" && activeNav !== "kitchen") {
      setActiveNav("kitchen");
    } else if (currentUser.role === "waiters" && activeNav !== "area_meja") {
      setActiveNav("area_meja");
    }
  }, [currentUser.role, activeNav, isAuthenticated]);

  // Fetch initial orders & sync with database (with cache-busting)
  const fetchOrdersFromApi = async () => {
    try {
      const res = await fetch(`/api/orders?_t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setOrders(data);
      }
    } catch (err) {
      console.log("Using initial fallback orders:", err);
    }
  };

  useEffect(() => {
    fetchOrdersFromApi();
    const interval = setInterval(fetchOrdersFromApi, 2500);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        bc = new BroadcastChannel("keivo_pos_orders_sync");
        bc.onmessage = () => {
          fetchOrdersFromApi();
        };
      }
    } catch (e) {
      // ignore
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "keivo_order_sync_trigger") {
        fetchOrdersFromApi();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      clearInterval(interval);
      if (bc) bc.close();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Keyboard Shortcuts (F2: Search, F3: Takeaway, F4: Ojol, F5: New Table)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        const input = document.getElementById("global-search-input");
        if (input) input.focus();
      } else if (e.key === "F3") {
        e.preventDefault();
        if (activeNav !== "pos") setIsTakeawayOpen(true);
      } else if (e.key === "F4") {
        e.preventDefault();
        if (activeNav !== "pos") setIsOjolOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handlers
  const handleAddOrder = async (newOrder: OrderData, alreadySavedToDb: boolean = false) => {
    setOrders((prev) => {
      if (prev.some((o) => o.id === newOrder.id || (newOrder.orderNumber && o.orderNumber === newOrder.orderNumber))) {
        return prev;
      }
      return [newOrder, ...prev];
    });

    if (alreadySavedToDb) {
      try {
        if (typeof window !== "undefined") {
          if ("BroadcastChannel" in window) {
            const bc = new BroadcastChannel("keivo_pos_orders_sync");
            bc.postMessage({ type: "SYNC_ORDERS", timestamp: Date.now() });
            bc.close();
          }
          localStorage.setItem("keivo_order_sync_trigger", Date.now().toString());
        }
      } catch (e) {
        // ignore
      }
      return;
    }

    try {
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceChannel: newOrder.channel,
          customerName:
            newOrder.channel === "takeaway_walk_in"
              ? newOrder.tableOrGuest
              : newOrder.guestSubtext || "Pelanggan",
          externalPlatformName:
            newOrder.channel === "online_platform" ? newOrder.channelLabel : undefined,
          externalOrderId:
            newOrder.channel === "online_platform" ? newOrder.tableOrGuest : undefined,
          items: newOrder.items,
          notes: newOrder.specialNote,
          paymentStatus: newOrder.paymentStatus,
          paymentMethod: newOrder.paymentMethod,
          cashierId: newOrder.cashierId || currentUser.id,
        }),
      });

      // Notify all tabs / screens instantly
      try {
        if (typeof window !== "undefined") {
          if ("BroadcastChannel" in window) {
            const bc = new BroadcastChannel("keivo_pos_orders_sync");
            bc.postMessage({ type: "SYNC_ORDERS", timestamp: Date.now() });
            bc.close();
          }
          localStorage.setItem("keivo_order_sync_trigger", Date.now().toString());
        }
      } catch (e) {
        // ignore
      }
    } catch (err) {
      console.error("Failed to save order to database:", err);
    }
  };

  const handleProcessPayment = (order: OrderData) => {
    setSelectedPaymentOrder(order);
    setIsPaymentOpen(true);
  };

  const handleConfirmPayment = async (
    orderId: string,
    method: "cash" | "static_qr" | "bank_transfer",
    amountPaid: number,
    change: number,
    orderData?: OrderData
  ) => {
    const tableNumber = orderData?.tableOrGuest;
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId || (tableNumber && o.tableOrGuest.toLowerCase() === tableNumber.toLowerCase())) {
          return {
            ...o,
            paymentStatus: "paid",
            paymentStatusLabel:
              method === "cash"
                ? `Lunas (Kembali Rp${change.toLocaleString("id-ID")})`
                : method === "static_qr"
                ? "Lunas (QRIS)"
                : "Lunas (Transfer)",
            paymentMethod: method,
            cashierId: orderData?.cashierId || currentUser.id,
            cashierName: orderData?.cashierName || currentUser.name,
          };
        }
        return o;
      })
    );

    if (method === "cash") {
      setCashDrawer((prev) => ({
        ...prev,
        cashReceived: prev.cashReceived + (amountPaid - change),
        totalDrawer: prev.totalDrawer + (amountPaid - change),
      }));
    }

    try {
      await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          paymentStatus: "paid",
          paymentMethod: method,
          amountPaid,
          changeAmount: change,
          cashierId: orderData?.cashierId || currentUser.id,
          tableNumber,
          items: orderData?.items,
          total: orderData?.total,
          customerName: orderData?.guestSubtext,
        }),
      });
      fetchOrdersFromApi();
    } catch (err) {
      console.error("Failed to update payment status in backend:", err);
    }
  };

  const handlePrintTicket = (order: OrderData) => {
    setPrintModalState({
      isOpen: true,
      type: order.paymentStatus === "paid" ? "receipt" : "waiter_ticket",
      order,
    });
  };

  const handleViewDetail = (order: OrderData) => {
    setPrintModalState({
      isOpen: true,
      type: "receipt",
      order,
    });
  };

  const handleUpdateOrderStatus = (orderId: string, kitchenStatus: import("@/types/pos").KitchenStatus) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              kitchenStatus,
              kitchenStatusLabel:
                kitchenStatus === "ready"
                  ? "Selesai Masak"
                  : kitchenStatus === "in_progress"
                  ? "Dimasak"
                  : kitchenStatus === "completed" || kitchenStatus === "served"
                  ? "Selesai Disajikan"
                  : "Pesanan Baru",
            }
          : o
      )
    );
  };

  const handlePrintWaiterSheet = (table: string, orderOrItems?: OrderData | string) => {
    let targetOrder: OrderData | undefined;
    if (orderOrItems && typeof orderOrItems === "object") {
      targetOrder = orderOrItems;
    } else {
      targetOrder = orders.find((o) => o.tableOrGuest.toLowerCase() === table.toLowerCase() && o.paymentStatus !== "paid");
    }

    if (!targetOrder) {
      targetOrder = orders.find((o) => o.tableOrGuest.toLowerCase() === table.toLowerCase());
    }

    if (targetOrder) {
      setPrintModalState({
        isOpen: true,
        type: "waiter_ticket",
        order: targetOrder,
      });
    }
  };

  const handleCloseShift = async (physicalCash: number, notes: string) => {
    try {
      await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "close_shift",
          physicalCashAmount: physicalCash,
          discrepancyNotes: notes,
        }),
      });
    } catch (err) {
      console.error("Failed to close shift:", err);
    }

    setPrintModalState({
      isOpen: true,
      type: "shift_report",
      order: null,
    });
  };

  const handleSaveSettings = async (newSettings: RestaurantSettings) => {
    await updateSettings(newSettings);
  };

  const existingOccupiedTables = orders
    .filter((o) => o.channel === "dine_in_qr")
    .map((o) => o.tableOrGuest);

  // RULE 4: Menu POS, Kitchen, dan Area Meja TIDAK ADA SIDE MENU / FULL LAYAR
  const isFullScreen = activeNav === "pos" || activeNav === "kitchen" || activeNav === "area_meja";

  // Login Gate: Display LoginWorkspace if not authenticated
  if (!isAuthenticated) {
    return <LoginWorkspace onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface antialiased">
      {/* 1. Left Fixed Sidebar (Only rendered when NOT full-screen) */}
      {!isFullScreen && (
        <Sidebar
          settings={settings}
          activePath={activeNav}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((prev) => !prev)}
          onNavigate={(path) => {
            setActiveNav(path);
            if (typeof window !== "undefined") window.location.hash = path;
          }}
          onOpenSettings={() => {
            setActiveNav("pengaturan");
            if (typeof window !== "undefined") window.location.hash = "pengaturan";
          }}
          orderCount={orders.length}
        />
      )}

      {/* Main Content Container: pl-72 when expanded, pl-[72px] when collapsed (icon-only), w-full when full-screen */}
      <div className={`transition-all duration-300 ease-in-out ${!isFullScreen ? (isSidebarOpen ? "pl-72" : "pl-[72px]") : "w-full"}`}>
        {/* 2. Top Fixed Header (Only rendered when NOT full-screen) */}
        {!isFullScreen && (
          <Header
            isSidebarOpen={isSidebarOpen}
            onLogout={logout}
          />
        )}

        {/* 3. Main Views corresponding to the 7 System Menus */}
        <main className={`w-full bg-surface ${!isFullScreen ? "pt-16 min-h-screen" : "h-screen overflow-hidden"}`}>
          {/* Permission Check Fallback */}
          {!canAccessMenu(activeNav as SystemMenu) ? (
            <div className="p-8 text-center flex flex-col items-center justify-center min-h-[60vh] gap-3">
              <span className="material-symbols-outlined text-5xl text-rose-600">lock</span>
              <h2 className="text-xl font-bold text-on-surface">Akses Menu Ditolak</h2>
              <p className="text-sm text-on-surface-variant max-w-md">
                Role Anda (<strong>{currentUser.roleLabel}</strong>) tidak memiliki izin untuk membuka menu ini.
              </p>
              <button
                onClick={() => {
                  if (currentUser.role === "kasir") setActiveNav("pos");
                  else if (currentUser.role === "kitchen") setActiveNav("kitchen");
                  else if (currentUser.role === "waiters") setActiveNav("area_meja");
                  else setActiveNav("dashboard");
                }}
                className="mt-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-xs hover:bg-primary/90 transition-all cursor-pointer shadow-xs"
              >
                Kembali ke Halaman Role ({currentUser.role.toUpperCase()})
              </button>
            </div>
          ) : activeNav === "dashboard" ? (
            <SalesInfographicDashboard
              orders={orders}
              onNavigateToPos={() => {
                setActiveNav("pos");
                if (typeof window !== "undefined") window.location.hash = "pos";
              }}
              onProcessPayment={handleProcessPayment}
              onPrintTicket={handlePrintTicket}
              onViewDetail={handleViewDetail}
            />
          ) : activeNav === "pos" ? (
            <PosWorkspace
              orders={orders}
              onProcessPayment={handleProcessPayment}
              onPrintTicket={handlePrintTicket}
              onPrintWaiterSheet={handlePrintWaiterSheet}
              onConfirmDirectPayment={handleConfirmPayment}
              onNavigateHome={() => {
                setActiveNav("dashboard");
                if (typeof window !== "undefined") window.location.hash = "dashboard";
              }}
              onAddNewOrder={handleAddOrder}
            />
          ) : activeNav === "kitchen" ? (
            <KitchenWorkspace
              orders={orders}
              onNavigateHome={() => {
                setActiveNav("dashboard");
                if (typeof window !== "undefined") window.location.hash = "dashboard";
              }}
              onUpdateOrderStatus={handleUpdateOrderStatus}
            />
          ) : activeNav === "area_meja" ? (
            <TableMonitorWorkspace
              orders={orders}
              onNavigateHome={() => {
                setActiveNav("dashboard");
                if (typeof window !== "undefined") window.location.hash = "dashboard";
              }}
              onOpenPos={() => {
                setActiveNav("pos");
                if (typeof window !== "undefined") window.location.hash = "pos";
              }}
              onUpdateOrderStatus={handleUpdateOrderStatus}
            />
          ) : activeNav === "master_data" ? (
            <MasterDataWorkspace />
          ) : activeNav === "laporan" ? (
            <ReportsWorkspace
              orders={orders}
              defaultTab="history"
              onProcessPayment={handleProcessPayment}
              onPrintTicket={handlePrintTicket}
              onViewDetail={handleViewDetail}
              onCloseShiftClick={() => setIsShiftCloseOpen(true)}
            />
          ) : activeNav === "pengaturan" ? (
            <SettingsWorkspace />
          ) : (
            <SalesInfographicDashboard
              orders={orders}
              onNavigateToPos={() => {
                setActiveNav("pos");
                if (typeof window !== "undefined") window.location.hash = "pos";
              }}
              onProcessPayment={handleProcessPayment}
              onPrintTicket={handlePrintTicket}
              onViewDetail={handleViewDetail}
            />
          )}
        </main>
      </div>

      {/* Interactive Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      <TakeawayModal
        isOpen={isTakeawayOpen}
        onClose={() => setIsTakeawayOpen(false)}
        onAddOrder={handleAddOrder}
      />

      <OjolModal
        isOpen={isOjolOpen}
        onClose={() => setIsOjolOpen(false)}
        onAddOrder={handleAddOrder}
        existingOrders={orders}
      />

      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        order={selectedPaymentOrder}
        settings={settings}
        onConfirmPayment={handleConfirmPayment}
      />

      <ShiftCloseModal
        isOpen={isShiftCloseOpen}
        onClose={() => setIsShiftCloseOpen(false)}
        cashData={cashDrawer}
        onConfirmClose={handleCloseShift}
      />

      <PrintModal
        isOpen={printModalState.isOpen}
        onClose={() => setPrintModalState({ ...printModalState, isOpen: false })}
        type={printModalState.type}
        order={printModalState.order}
        settings={settings}
      />
    </div>
  );
}
