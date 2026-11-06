"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { PosWorkspace } from "@/components/pos/PosWorkspace";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { TakeawayModal } from "@/components/modals/TakeawayModal";
import { OjolModal } from "@/components/modals/OjolModal";
import { PaymentModal } from "@/components/modals/PaymentModal";
import { ShiftCloseModal } from "@/components/modals/ShiftCloseModal";
import { PrintModal } from "@/components/modals/PrintModal";
import { OrderData, RestaurantSettings, CashDrawerData } from "@/types/pos";
import { useRestaurant } from "@/context/RestaurantContext";

export default function PosPage() {
  const { settings, updateSettings, isSettingsOpen, setIsSettingsOpen } = useRestaurant();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
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

  // Sync orders from API with cache-busting
  const fetchOrders = async () => {
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
      console.log("Using fallback POS orders:", err);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 2500);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        bc = new BroadcastChannel("keivo_pos_orders_sync");
        bc.onmessage = () => {
          fetchOrders();
        };
      }
    } catch (e) {
      // ignore
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "keivo_order_sync_trigger") {
        fetchOrders();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      clearInterval(interval);
      if (bc) bc.close();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Handlers
  const handleAddOrder = async (newOrder: OrderData, alreadySavedToDb: boolean = false) => {
    setOrders((prev) => {
      if (prev.some((o) => o.id === newOrder.id || (newOrder.orderNumber && o.orderNumber === newOrder.orderNumber))) {
        return prev;
      }
      return [newOrder, ...prev];
    });

    if (alreadySavedToDb) return;

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
        }),
      });
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
          };
        }
        return o;
      })
    );

    // Persist payment to backend
    try {
      await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          paymentStatus: "paid",
          tableNumber,
          items: orderData?.items,
          total: orderData?.total,
          customerName: orderData?.guestSubtext,
        }),
      });
      fetchOrders();
    } catch (err) {
      console.error("Failed to update payment status:", err);
    }

    // Open print receipt modal
    const updatedOrder = orders.find((o) => o.id === orderId) || orderData;
    if (updatedOrder) {
      setPrintModalState({
        isOpen: true,
        type: "receipt",
        order: {
          ...updatedOrder,
          paymentStatus: "paid",
          paymentNote:
            method === "cash"
              ? `Uang Pas / Kembali Rp${change.toLocaleString("id-ID")}`
              : undefined,
        },
      });
    }
  };

  const handlePrintTicket = (order: OrderData) => {
    setPrintModalState({
      isOpen: true,
      type: order.paymentStatus === "paid" ? "receipt" : "waiter_ticket",
      order,
    });
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

  const existingOccupiedTables = orders
    .filter((o) => o.channel === "dine_in_qr")
    .map((o) => o.tableOrGuest);

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-surface font-body-md text-on-surface antialiased">
      <main className="w-full h-screen overflow-hidden bg-surface">
        <PosWorkspace
          orders={orders}
          onProcessPayment={handleProcessPayment}
          onPrintTicket={handlePrintTicket}
          onPrintWaiterSheet={handlePrintWaiterSheet}
          onConfirmDirectPayment={handleConfirmPayment}
          onNavigateHome={() => {
            window.location.href = "/";
          }}
          onAddNewOrder={handleAddOrder}
        />
      </main>

      {/* Interactive Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={async (newSettings) => {
          await updateSettings(newSettings);
        }}
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
        cashData={{
          floatAmount: 500000,
          cashReceived: 1640000,
          cashOut: 45000,
          cashOutReason: "Es Batu & Parkir",
          totalDrawer: 2095000,
        }}
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
