"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useParams } from "next/navigation";
import { formatCurrency } from "@/lib/formatters";
import { useRestaurant } from "@/context/RestaurantContext";
import { PromoDiscount, ProductPromo } from "@/types/pos";
import { calculateProductPromoPrice } from "@/lib/productPromoHelper";

interface MenuItemClient {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  imageUrl?: string;
  isAvailable?: boolean;
  rating?: number;
  reviewsCount?: string;
  portionTag?: string;
  cookingTime?: string;
  addons?: {
    id: string;
    name: string;
    price: number;
  }[];
}

interface CartItem {
  item: MenuItemClient;
  qty: number;
  note: string;
  selectedAddOns: { [key: string]: boolean };
}

interface ActiveOrderInfo {
  orderNumber: string;
  customerName: string;
  tableNumber: string;
  orderTime: string;
  kitchenStatus?: string;
  paymentStatus?: string;
  items: {
    name: string;
    qty: number;
    price: number;
    note?: string;
    imageUrl?: string;
    statusLabel?: string;
  }[];
  totalAmount: number;
}

// Menu items dimuat secara murni dari database server (PostgreSQL / SQLite)

function CustomerMenuContent() {
  const params = useParams();
  const token = (params?.tableToken as string) || "";
  const { settings } = useRestaurant();

  // Navigation tab states: "menu" | "promo" | "pesanan" (Bantuan telah dihilangkan)
  const [activeTab, setActiveTab] = useState<"menu" | "promo" | "pesanan">("menu");
  const [pesananSubTab, setPesananSubTab] = useState<"cart" | "status">("cart");

  // Table state details
  const [tableNumber, setTableNumber] = useState(() => {
    if (token) {
      const numMatch = token.match(/\d+/);
      if (numMatch) return `Meja ${numMatch[0].padStart(2, "0")}`;
    }
    return "Meja 01";
  });
  const [tableArea, setTableArea] = useState("Area Indoor AC");
  const [tableCapacity, setTableCapacity] = useState(4);

  // Customer Name Input (Mandatory)
  const [customerName, setCustomerName] = useState("");

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [menuItems, setMenuItems] = useState<MenuItemClient[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("dine_in_menu_cache") || sessionStorage.getItem("dine_in_menu_cache");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [];
  });
  const [isMenuLoading, setIsMenuLoading] = useState(true);

  // Cart State
  const [cart, setCart] = useState<{ [id: string]: CartItem }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Detail Modal State
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<MenuItemClient | null>(null);
  const [detailQty, setDetailQty] = useState(1);
  const [detailNote, setDetailNote] = useState("");
  const [detailAddOns, setDetailAddOns] = useState<{ [key: string]: boolean }>({});
  const [showDetailSuccessToast, setShowDetailSuccessToast] = useState(false);

  // Order Confirmation Dialog Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Active / Submitted Order State
  const [activeOrder, setActiveOrder] = useState<ActiveOrderInfo | null>(null);

  // Assistance feedback toast
  const [assistanceNotice, setAssistanceNotice] = useState<string | null>(null);

  // Promo Produk (Item-Level Discounts) from Master Data
  const [productPromos, setProductPromos] = useState<ProductPromo[]>([]);

  useEffect(() => {
    fetch("/api/product-promos?active=true")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setProductPromos(data.filter((p: ProductPromo) => p.isActive));
        }
      })
      .catch((err) => console.log("Failed to fetch product promos for customer menu:", err));
  }, []);

  // Filter menu items that currently have active product promo
  const promoProductsList = useMemo(() => {
    return menuItems
      .map((item) => {
        const promoCalc = calculateProductPromoPrice(item, productPromos);
        return {
          item,
          promoCalc,
        };
      })
      .filter((x) => x.promoCalc.isPromo && x.item.isAvailable !== false);
  }, [menuItems, productPromos]);

  // 1. Fetch table details based on tableToken from SQLite
  useEffect(() => {
    fetch("/api/tables")
      .then((res) => res.json())
      .then((tables) => {
        if (Array.isArray(tables)) {
          const matched = tables.find(
            (t: any) =>
              t.qrToken === token ||
              (token && t.tableNumber && token.includes(t.tableNumber.replace(/\D/g, "")))
          );

          if (matched) {
            setTableNumber(matched.displayName || matched.tableNumber);
            setTableArea(matched.areaLabel || "Area Indoor AC");
            setTableCapacity(matched.capacity || 4);
            if (matched.customerName && !customerName) {
              setCustomerName(matched.customerName);
            }
          } else {
            // Fallback derivation
            const numMatch = token.match(/\d+/);
            if (numMatch) {
              const numStr = numMatch[0].padStart(2, "0");
              setTableNumber(`Meja ${numStr}`);
            }
          }
        }
      })
      .catch((err) => console.log("Using default table derivation:", err));
  }, [token]);

  // 2. Fetch menu items from API (murni dari database server)
  useEffect(() => {
    fetch("/api/menu")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const items: MenuItemClient[] = [];
          data.forEach((c: any) => {
            c.items?.forEach((it: any) => {
              let parsedAddons: { id: string; name: string; price: number }[] = [];
              if (Array.isArray(it.addons)) {
                parsedAddons = it.addons;
              } else if (typeof it.addons === "string") {
                try {
                  parsedAddons = JSON.parse(it.addons);
                } catch {
                  parsedAddons = [];
                }
              }
              items.push({
                id: it.id,
                name: it.name,
                category: c.name,
                price: it.price,
                description: it.description || "",
                imageUrl: it.imageUrl || "",
                isAvailable: it.isAvailable !== false,
                rating: 4.8,
                reviewsCount: "100+ ulasan",
                portionTag: "Porsi 1 Orang",
                cookingTime: "10-15 Menit",
                addons: parsedAddons,
              });
            });
          });

          setMenuItems((prev) => {
            if (JSON.stringify(prev) === JSON.stringify(items)) return prev;
            return items;
          });
          setIsMenuLoading(false);
          try {
            localStorage.setItem("dine_in_menu_cache", JSON.stringify(items));
            sessionStorage.setItem("dine_in_menu_cache", JSON.stringify(items));
          } catch {}
        }
      })
      .catch((err) => {
        console.error("Gagal memuat menu dari server:", err);
        setIsMenuLoading(false);
      });
  }, []);

  // 3. Live polling for active order on this table to synchronize Kitchen status
  useEffect(() => {
    if (!tableNumber) return;

    const checkActiveOrder = async () => {
      try {
        const res = await fetch("/api/orders?channel=dine_in_qr");
        const orders = await res.json();
        if (Array.isArray(orders)) {
          const match = orders.find(
            (o: any) =>
              o.tableOrGuest?.toLowerCase() === tableNumber.toLowerCase() &&
              (o.paymentStatus !== "paid" || (activeOrder && o.orderNumber === activeOrder.orderNumber))
          );

          if (match) {
            const kStatus = match.kitchenStatus || "new";
            setActiveOrder((prev) => {
              const items = match.items?.map((it: any) => {
                let statusLabel = "Menunggu giliran koki";
                if (kStatus === "in_progress") statusLabel = "Sedang dimasak di dapur";
                else if (kStatus === "ready") statusLabel = "🔔 Siap disajikan • Sedang diantar";
                else if (kStatus === "completed" || kStatus === "served") statusLabel = "✓ Sudah disajikan di meja";

                const foundMenu = menuItems.find((m) => m.name === it.name);
                return {
                  name: it.name,
                  qty: it.qty,
                  price: it.price,
                  note: it.note,
                  imageUrl: foundMenu?.imageUrl,
                  statusLabel,
                };
              }) || prev?.items || [];

              return {
                orderNumber: match.orderNumber,
                customerName: match.guestSubtext || match.customerName || prev?.customerName || customerName || "Tamu",
                tableNumber,
                orderTime: match.orderTime || prev?.orderTime || "12:15 WIB",
                kitchenStatus: kStatus,
                paymentStatus: match.paymentStatus || "unpaid",
                items,
                totalAmount: match.total || prev?.totalAmount || 0,
              };
            });
          }
        }
      } catch (err) {
        console.log("Error checking active order:", err);
      }
    };

    checkActiveOrder();
    const interval = setInterval(checkActiveOrder, 4000);
    return () => clearInterval(interval);
  }, [tableNumber, menuItems]);

  // Compute categories & item counts dynamically from actual menuItems
  const categoriesWithCounts = useMemo(() => {
    const counts: { [cat: string]: number } = { Semua: menuItems.length };
    const categorySet = new Set<string>();

    menuItems.forEach((m) => {
      counts[m.category] = (counts[m.category] || 0) + 1;
      if (m.category) categorySet.add(m.category);
    });

    const categories = ["Semua", ...Array.from(categorySet)];

    return categories.map((cat) => ({
      name: cat,
      count: counts[cat] || 0,
    }));
  }, [menuItems]);

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchCategory = selectedCategory === "Semua" ? true : item.category === selectedCategory;
      const matchSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // Cart operations
  const handleQuickAdd = (item: MenuItemClient) => {
    if (item.isAvailable === false) return;
    setPesananSubTab("cart");
    setCart((prev) => {
      const existing = prev[item.id] || { item, qty: 0, note: "", selectedAddOns: {} };
      return {
        ...prev,
        [item.id]: {
          ...existing,
          qty: existing.qty + 1,
        },
      };
    });
  };

  const handleQuickMinus = (item: MenuItemClient) => {
    setCart((prev) => {
      const existing = prev[item.id];
      if (!existing) return prev;
      if (existing.qty <= 1) {
        const next = { ...prev };
        delete next[item.id];
        return next;
      }
      return {
        ...prev,
        [item.id]: {
          ...existing,
          qty: existing.qty - 1,
        },
      };
    });
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const handleOpenDetailModal = (item: MenuItemClient) => {
    const inCart = cart[item.id];
    setSelectedItemForDetail(item);
    setDetailQty(inCart ? inCart.qty : 1);
    setDetailNote(inCart ? inCart.note : "");
    setDetailAddOns(inCart ? inCart.selectedAddOns : {});
    setShowDetailSuccessToast(false);
  };

  const handleSaveDetailToCart = () => {
    if (!selectedItemForDetail) return;
    setPesananSubTab("cart");
    setCart((prev) => ({
      ...prev,
      [selectedItemForDetail.id]: {
        item: selectedItemForDetail,
        qty: detailQty,
        note: detailNote.trim(),
        selectedAddOns: { ...detailAddOns },
      },
    }));

    setShowDetailSuccessToast(true);
    setTimeout(() => {
      setShowDetailSuccessToast(false);
      setSelectedItemForDetail(null);
    }, 1000);
  };

  // Cart calculations
  const cartList = Object.values(cart);
  const totalItemCount = cartList.reduce((acc, c) => acc + c.qty, 0);

  const subtotal = cartList.reduce((acc, c) => {
    const promoCalc = calculateProductPromoPrice(c.item, productPromos);
    let itemPrice = promoCalc.isPromo ? promoCalc.effectivePrice : c.item.price;
    const availableAddons = c.item.addons || [];
    Object.entries(c.selectedAddOns).forEach(([addonId, isSelected]) => {
      if (isSelected) {
        const addon = availableAddons.find((a: any) => a.id === addonId);
        if (addon) itemPrice += addon.price;
      }
    });
    return acc + itemPrice * c.qty;
  }, 0);

  const taxPb1 = settings.taxEnabled
    ? Math.round(subtotal * ((settings.taxRate ?? 0) / 100))
    : 0;
  const serviceCharge = settings.serviceChargeEnabled
    ? Math.round(subtotal * ((settings.serviceChargeRate ?? 0) / 100))
    : 0;
  const rounding = subtotal > 0 ? (subtotal % 100 === 0 ? 0 : 100 - (subtotal % 100)) : 0;
  const grandTotal = subtotal + taxPb1 + serviceCharge + rounding;

  // Send Order to Kitchen
  const handleProcessOrder = async () => {
    if (!customerName.trim()) {
      setErrorMessage("Silakan isi nama pemesan terlebih dahulu sebelum mengirim pesanan!");
      setShowConfirmModal(false);
      setActiveTab("pesanan");
      return;
    }

    if (cartList.length === 0) {
      setErrorMessage("Pilih minimal satu menu untuk dipesan!");
      setShowConfirmModal(false);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceChannel: "dine_in_qr",
          customerName: customerName.trim(),
          tableNumber,
          items: cartList.map((c) => {
            const availableAddons = c.item.addons || [];
            const selectedAddonObjects: any[] = [];
            Object.entries(c.selectedAddOns)
              .filter(([_, sel]) => sel)
              .forEach(([id]) => {
                const addon = availableAddons.find((a: any) => a.id === id);
                if (addon) selectedAddonObjects.push(addon);
              });

            const addOnsList = selectedAddonObjects.map((a) => a.name);
            const addonPriceSum = selectedAddonObjects.reduce((sum, a) => sum + (a.price || 0), 0);

            const combinedNote = [c.note, addOnsList.length > 0 ? `+ ${addOnsList.join(", ")}` : ""]
              .filter(Boolean)
              .join(" | ");

            const promoCalc = calculateProductPromoPrice(c.item, productPromos);
            const baseEffectivePrice = promoCalc.isPromo ? promoCalc.effectivePrice : c.item.price;

            return {
              name: c.item.name,
              qty: c.qty,
              price: baseEffectivePrice + addonPriceSum,
              note: combinedNote || undefined,
              selectedAddons: selectedAddonObjects.length > 0 ? selectedAddonObjects : undefined,
            };
          }),
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Gagal memproses pesanan.");
      }

      const generatedNum = resData.orderNumber || `#PN-${Math.floor(1000 + Math.random() * 9000)}`;

      // Setup active order info for live status tracking
      const newActiveOrder: ActiveOrderInfo = {
        orderNumber: generatedNum,
        customerName: customerName.trim(),
        tableNumber,
        orderTime: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB",
        kitchenStatus: "new",
        paymentStatus: "unpaid",
        items: cartList.map((c, idx) => ({
          name: c.item.name,
          qty: c.qty,
          price: c.item.price,
          note: c.note || undefined,
          imageUrl: c.item.imageUrl,
          statusLabel: idx === 0 ? "Siap disajikan" : idx === 1 ? "Sedang dimasak koki" : "Menunggu giliran koki",
        })),
        totalAmount: grandTotal,
      };

      setActiveOrder(newActiveOrder);
      setCart({});
      setShowConfirmModal(false);
      setPesananSubTab("status");
      setActiveTab("pesanan"); // Navigate to live order tracker
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kendala saat mengirim pesanan ke dapur.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestAssistance = (type: string) => {
    setAssistanceNotice(`Permintaan "${type}" telah dikirim ke waiter ${tableNumber}. Petugas segera datang!`);
    setTimeout(() => {
      setAssistanceNotice(null);
    }, 4000);
  };

  return (
    <div className="bg-surface font-body-md text-on-surface min-h-screen flex flex-col antialiased selection:bg-primary-fixed max-w-md mx-auto relative shadow-2xl">
      {/* 1. STICKY TOP HEADER */}
      <header className="fixed top-0 w-full max-w-md z-50 pt-safe bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-surface-container-high/50">
        <div className="h-16 px-margin flex items-center justify-between gap-space-sm">
          {activeTab === "pesanan" && (pesananSubTab === "cart" || !activeOrder) ? (
            <div className="flex items-center gap-space-sm min-w-0">
              <button
                aria-label="Kembali ke Menu"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-low text-on-surface active:scale-95 transition-all flex-shrink-0 cursor-pointer"
                onClick={() => setActiveTab("menu")}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
              <div className="flex flex-col min-w-0">
                <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">
                  Keranjang &amp; Checkout
                </h1>
                <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                  {tableNumber} • {settings.branchName || "Cabang Senopati"}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-space-sm min-w-0">
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-headline-sm text-headline-sm text-primary tracking-tight font-bold truncate">
                    {settings.restaurantName || "Pawon Nusantara"}
                  </span>
                </div>
                <div className="flex items-center gap-space-xs mt-0.5">
                  <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                    {settings.branchName || "Senopati"}
                  </span>
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm font-bold tracking-wide">
                    {tableNumber}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Quick Header Action (Cart icon always accessible if items in cart) */}
          {totalItemCount > 0 && activeTab !== "pesanan" && (
            <button
              onClick={() => {
                setActiveTab("pesanan");
                setPesananSubTab("cart");
              }}
              className="relative w-10 h-10 rounded-full bg-primary-fixed text-on-primary-fixed-variant flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
              title="Lihat Keranjang & Submit"
            >
              <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-secondary-container text-on-secondary-container text-[11px] font-bold flex items-center justify-center shadow-xs">
                {totalItemCount}
              </span>
            </button>
          )}
        </div>
      </header>

      {/* Assistance Toast Notice */}
      {assistanceNotice && (
        <div className="fixed top-20 left-4 right-4 max-w-md mx-auto z-50 p-3.5 bg-primary text-on-primary rounded-2xl shadow-xl flex items-center gap-2.5 animate-in slide-in-from-top duration-300">
          <span className="material-symbols-outlined text-secondary-container text-[22px]">
            support_agent
          </span>
          <span className="font-label-sm text-label-sm leading-snug flex-1">{assistanceNotice}</span>
        </div>
      )}

      {/* 2. MAIN CONTENT AREA */}
      <main className="flex flex-col relative w-full pt-16 pb-28 bg-surface min-h-screen px-margin">
        {/* ============================================================== */}
        {/* TAB 1: MENU & KATALOG RESTORAN */}
        {/* ============================================================== */}
        {activeTab === "menu" && (
          <div className="flex flex-col w-full pb-8">
            {/* Top Table Context Card */}
            <section className="relative overflow-hidden bg-surface-container-low rounded-2xl p-space-md mb-space-md shadow-sm border border-outline-variant/30 mt-2">
              <div className="flex items-start justify-between gap-space-sm relative z-10">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-space-xs mb-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm">
                      <span
                        className="material-symbols-outlined text-[13px]"
                        style={{ fontVariationSettings: '"FILL" 1' }}
                      >
                        verified
                      </span>
                      QR Terverifikasi
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse"></span>
                      Sesi Aktif
                    </span>
                  </div>
                  <h1 className="font-headline-sm text-headline-sm text-primary font-bold tracking-tight">
                    {tableNumber} • {tableArea}
                  </h1>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    Kapasitas {tableCapacity} Orang • {settings.restaurantName || "Pawon Nusantara"}{" "}
                    {settings.branchName || "Senopati"}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center flex-shrink-0 text-primary shadow-xs">
                  <span className="material-symbols-outlined text-[24px]">table_restaurant</span>
                </div>
              </div>
              {/* Subtle Botanical Watermark Decorator */}
              <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none text-primary">
                <svg fill="currentColor" height="120" viewBox="0 0 100 100" width="120">
                  <path d="M50 0 C60 30 70 40 100 50 C70 60 60 70 50 100 C40 70 30 60 0 50 C30 40 40 30 50 0 Z"></path>
                </svg>
              </div>
            </section>

            {/* Customer Name Input (Mandatory for PRD QR Dine In) */}
            <section className="bg-primary-container text-on-primary rounded-2xl p-space-md mb-space-md shadow-sm">
              <div className="flex items-center gap-1.5 font-label-md text-label-md font-bold mb-1.5">
                <span className="material-symbols-outlined text-[18px]">person</span>
                <span>Pesanan Atas Nama (Wajib Diisi):</span>
              </div>
              <input
                type="text"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  if (errorMessage) setErrorMessage("");
                }}
                placeholder="Ketik nama Anda (misal: Bpk. Hendra)..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-lowest text-on-surface placeholder:text-outline font-semibold focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
              />
              <p className="font-body-sm text-[11px] text-on-primary-container mt-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">info</span>
                Koki akan memproses pesanan dan pelayan mengantar hidangan ke {tableNumber}.
              </p>
            </section>

            {/* Search & Filter Bar */}
            <div className="flex items-center gap-space-xs mb-space-md">
              <div className="flex-1 relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-outline text-[20px] pointer-events-none">
                  search
                </span>
                <input
                  className="w-full bg-surface-container-lowest text-on-surface font-body-md text-body-md pl-10 pr-10 py-3 rounded-xl shadow-xs border border-outline-variant/30 outline-none placeholder:text-outline focus:border-primary transition-all"
                  placeholder="Cari makanan, minuman, sambal..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    aria-label="Bersihkan pencarian"
                    className="absolute right-3 w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant active:scale-90 transition-transform"
                    onClick={() => setSearchQuery("")}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[15px]">close</span>
                  </button>
                )}
              </div>
              <button
                aria-label="Filter menu"
                onClick={() => setSelectedCategory("Semua")}
                className="h-[46px] px-3.5 rounded-xl bg-surface-container-lowest text-primary shadow-xs border border-outline-variant/30 flex items-center justify-center active:scale-95 transition-transform"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">tune</span>
              </button>
            </div>

            {/* Category Pills (Horizontal Scrollable) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-margin px-margin no-scrollbar mb-space-md">
              {categoriesWithCounts.map((cat) => {
                const isActive = selectedCategory === cat.name;
                return (
                  <button
                    key={cat.name}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-full font-label-md text-label-md shadow-xs transition-all flex items-center gap-1.5 ${
                      isActive
                        ? "bg-primary text-on-primary font-bold shadow-sm"
                        : "bg-surface-container-lowest text-on-surface-variant hover:text-primary border border-outline-variant/20"
                    }`}
                    type="button"
                  >
                    <span>{cat.name}</span>
                    <span
                      className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                        isActive ? "bg-white/25 text-white" : "bg-surface-container text-on-surface-variant"
                      }`}
                    >
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Promo / Rekomendasi Koki Banner */}
            {!searchQuery && selectedCategory === "Semua" && (
              <div className="relative w-full rounded-2xl overflow-hidden mb-space-lg shadow-sm bg-primary-container text-on-primary">
                <div
                  className="w-full h-40 bg-cover bg-center relative"
                  style={{
                    backgroundImage: `url("https://lh3.googleusercontent.com/aida-public/AB6AXuAMZMqNaX4nw8cxFKca7wxD6uzuYu9qxq8NjOArcfrNlnO9wYamNCJR89sP_Oy4trnrLkqqHGsVqpamEKXbD57R7dDoXVUPf9XieNwCJZfKJrhf5JBpR3tpejzEYGhAwRdxetlSvqIjCsOnuxUV9WKECefYEE-DNndJgt-viDQYFHFZRaVwiHoraQANFD5PLQfbAxSu1Rn33EbBM18N3Q08mElwbSq9gTBqEvZ3Q-4cWyC2iiYgzr0h")`,
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/60 to-transparent"></div>
                  <div className="absolute inset-0 p-space-md flex flex-col justify-end">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm uppercase font-bold tracking-wider">
                        <span className="material-symbols-outlined text-[13px]">
                          local_fire_department
                        </span>
                        Rekomendasi Koki
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-surface-container-lowest/90 text-primary font-label-sm text-label-sm font-bold">
                        Hemat 15%
                      </span>
                    </div>
                    <h2 className="font-headline-sm text-headline-sm text-on-primary font-bold">
                      Paket Liwet Komplit Berempat
                    </h2>
                    <p className="font-body-sm text-body-sm text-on-primary-container line-clamp-1">
                      Nasi liwet wangi kasturi, ayam goreng lengkuas, cumi asin cabe ijo &amp; es teh sereh.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Menu Section Header */}
            <div className="flex items-center justify-between mb-space-sm px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                <h3 className="font-headline-sm text-headline-sm text-primary font-bold">
                  {selectedCategory === "Semua" ? "Pilihan Populer & Favorit" : selectedCategory}
                </h3>
              </div>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {filteredItems.length} Menu Tersedia
              </span>
            </div>

            {/* Menu Item Cards List */}
            {isMenuLoading && menuItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30 gap-3 my-4 shadow-xs">
                <div className="w-9 h-9 rounded-full border-3 border-primary border-t-transparent animate-spin" />
                <div>
                  <p className="font-bold text-sm text-primary">Memuat Menu Restoran...</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Mengambil data menu langsung dari database server</p>
                </div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30 gap-2 my-4 shadow-xs">
                <span className="material-symbols-outlined text-4xl text-outline">search_off</span>
                <p className="font-bold text-sm text-on-surface">Tidak ada menu yang ditemukan</p>
                <p className="text-xs text-on-surface-variant">Coba cari dengan kata kunci lain atau pilih kategori Semua</p>
              </div>
            ) : (
              <div className="flex flex-col gap-space-md mb-space-md">
                {filteredItems.map((item) => {
                const inCart = cart[item.id];
                const inCartQty = inCart?.qty || 0;
                const isOutOfStock = item.isAvailable === false;
                const itemPromoCalc = calculateProductPromoPrice(item, productPromos);

                return (
                  <article
                    key={item.id}
                    className={`bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border border-outline-variant/30 flex flex-col gap-3 transition-all ${
                      isOutOfStock ? "opacity-60 bg-surface-container-low" : "hover:border-primary/40"
                    }`}
                  >
                    <div className="flex gap-space-md">
                      {/* Food Image */}
                      <div
                        onClick={() => !isOutOfStock && handleOpenDetailModal(item)}
                        className={`w-24 h-24 rounded-xl bg-cover bg-center flex-shrink-0 relative overflow-hidden shadow-inner cursor-pointer ${
                          isOutOfStock ? "grayscale" : ""
                        }`}
                        style={{
                          backgroundImage: `url("${
                            item.imageUrl ||
                            "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80"
                          }")`,
                        }}
                      >
                        {isOutOfStock ? (
                          <div className="absolute inset-0 bg-on-surface/40 flex items-center justify-center">
                            <span className="px-2 py-0.5 rounded-full bg-error text-on-error font-label-sm text-label-sm font-bold uppercase tracking-wider">
                              Habis
                            </span>
                          </div>
                        ) : (
                          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-surface-container-lowest/95 text-primary font-label-sm text-label-sm font-bold flex items-center gap-0.5 shadow-xs">
                            <span
                              className="material-symbols-outlined text-[12px] text-secondary-container"
                              style={{ fontVariationSettings: '"FILL" 1' }}
                            >
                              star
                            </span>
                            {item.rating || 4.9}
                          </div>
                        )}
                        {!isOutOfStock && itemPromoCalc.isPromo && (
                          <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[#003629] text-white text-[9px] font-black shadow-xs">
                            {itemPromoCalc.badge}
                          </span>
                        )}
                      </div>

                      {/* Content details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div
                          className="cursor-pointer"
                          onClick={() => !isOutOfStock && handleOpenDetailModal(item)}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="font-label-lg text-label-lg text-on-surface font-bold leading-tight">
                              {item.name}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-body-sm text-[11px] text-outline">
                              {item.reviewsCount || "100+ ulasan"}
                            </span>
                            {item.portionTag && (
                              <span className="px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant text-[10px] font-semibold">
                                {item.portionTag}
                              </span>
                            )}
                          </div>
                          <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mt-1">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Price and Action bar */}
                    <div className="flex items-center justify-between pt-1 border-t border-surface-container-low">
                      <div className="flex flex-col">
                        {itemPromoCalc.isPromo ? (
                          <>
                            <span className="text-[11px] text-outline line-through leading-none">
                              {formatCurrency(item.price)}
                            </span>
                            <span className="font-currency-row text-currency-row text-emerald-800 font-black">
                              {formatCurrency(itemPromoCalc.effectivePrice)}
                            </span>
                          </>
                        ) : (
                          <span className="font-currency-row text-currency-row text-primary font-bold">
                            {formatCurrency(item.price)}
                          </span>
                        )}
                      </div>

                      {isOutOfStock ? (
                        <button
                          disabled
                          className="px-3.5 py-2 rounded-xl bg-surface-container text-outline font-label-md text-label-md font-bold flex items-center gap-1 cursor-not-allowed"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[16px]">block</span>
                          Stok Habis
                        </button>
                      ) : inCartQty > 0 ? (
                        <div className="flex items-center gap-2 bg-surface-container-low px-2 py-1 rounded-xl border border-outline-variant/30">
                          <button
                            aria-label={`Kurangi ${item.name}`}
                            onClick={() => handleQuickMinus(item)}
                            className="w-7 h-7 rounded-lg bg-surface-container-lowest text-primary shadow-xs flex items-center justify-center active:scale-90 transition-transform font-bold"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[16px]">remove</span>
                          </button>
                          <span className="font-label-lg text-label-lg text-primary font-bold px-1 min-w-[16px] text-center">
                            {inCartQty}
                          </span>
                          <button
                            aria-label={`Tambah ${item.name}`}
                            onClick={() => handleQuickAdd(item)}
                            className="w-7 h-7 rounded-lg bg-primary text-on-primary shadow-xs flex items-center justify-center active:scale-90 transition-transform font-bold"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[16px]">add</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleQuickAdd(item)}
                          className="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-bold shadow-sm flex items-center gap-1 active:scale-95 transition-all hover:bg-primary-container"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[18px]">add</span>
                          Tambah
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

            {/* Special Dietary Request Alert */}
            <div className="bg-surface-container rounded-2xl p-space-md flex items-center gap-3 mb-space-lg shadow-xs">
              <div className="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center text-primary flex-shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-[20px]">room_service</span>
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="font-label-md text-label-md text-primary font-bold">
                  Ada Alergi atau Pantangan Makanan?
                </h5>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Tuliskan catatan khusus di tahap konfirmasi pesanan agar koki menyiapkannya secara terpisah.
                </p>
              </div>
            </div>

            {/* Floating Cart Summary Bar (fixed above bottom navigation) */}
            {totalItemCount > 0 && (
              <div className="fixed bottom-20 left-0 right-0 z-40 px-margin pointer-events-none max-w-md mx-auto">
                <div className="pointer-events-auto bg-surface-container-lowest rounded-2xl p-2.5 pl-4 shadow-xl border border-outline-variant/30 flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-primary text-on-primary flex-shrink-0 shadow-md">
                      <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
                      <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary-container opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-secondary-container text-on-secondary-container text-[10px] font-bold items-center justify-center">
                          {totalItemCount}
                        </span>
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        {totalItemCount} Item Dipilih
                      </span>
                      <span className="font-currency-row text-currency-row text-primary truncate">
                        {formatCurrency(subtotal)}
                      </span>
                    </div>
                  </div>
                  <button
                    className="h-11 px-4 rounded-xl bg-[#003629] text-white font-label-md text-label-md font-bold shadow-md flex items-center gap-1.5 active:scale-95 transition-all flex-shrink-0 hover:bg-[#00261d] cursor-pointer"
                    onClick={() => {
                      setActiveTab("pesanan");
                      setPesananSubTab("cart");
                    }}
                    type="button"
                  >
                    <span>Submit Pesanan</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: PROMO PRODUK (ITEM-LEVEL DISCOUNTS) */}
        {/* ============================================================== */}
        {activeTab === "promo" && (
          <div className="flex flex-col w-full pb-24 space-y-4 pt-2">
            {/* Header Tab Promo */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">restaurant_menu</span>
                </div>
                <div>
                  <h2 className="font-headline-sm text-base font-bold text-on-surface">
                    Promo Menu &amp; Produk
                  </h2>
                  <p className="font-body-sm text-[11px] text-on-surface-variant">
                    Diskon khusus untuk menu pilihan santap di {tableNumber}
                  </p>
                </div>
              </div>
              {promoProductsList.length > 0 && (
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full shrink-0 shadow-2xs">
                  {promoProductsList.length} Menu Promo
                </span>
              )}
            </div>



            {/* Daftar Menu yang Kena Promo Produk */}
            {promoProductsList.length > 0 ? (
              <div className="flex flex-col gap-3.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider px-1">
                  Daftar Menu Diskon Hari Ini:
                </span>

                {promoProductsList.map(({ item, promoCalc }) => {
                  const inCart = cart[item.id];
                  const inCartQty = inCart?.qty || 0;
                  const discountDiff = Math.max(0, item.price - promoCalc.effectivePrice);

                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl p-3.5 shadow-sm border border-emerald-100/90 hover:border-emerald-300 transition-all flex flex-col gap-3"
                    >
                      <div className="flex items-start gap-3">
                        {/* Food Image with Floating Promo Badge */}
                        <div
                          onClick={() => handleOpenDetailModal(item)}
                          className="w-22 h-22 rounded-2xl bg-surface-container overflow-hidden shrink-0 relative shadow-2xs cursor-pointer"
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-outline">
                              <span className="material-symbols-outlined text-3xl">restaurant</span>
                            </div>
                          )}
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-[#003629] text-white text-[9px] font-black tracking-wide shadow-xs">
                            {promoCalc.badge}
                          </span>
                        </div>

                        {/* Title, Category & Desc */}
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => handleOpenDetailModal(item)}
                        >
                          <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider block mb-0.5">
                            {item.category}
                          </span>
                          <h3 className="font-headline-sm text-sm font-bold text-slate-900 leading-snug">
                            {item.name}
                          </h3>
                          {item.description && (
                            <p className="font-body-sm text-[11px] text-slate-600 line-clamp-2 mt-1 leading-snug">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Pricing & Add to Cart Action */}
                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400 line-through">
                              {formatCurrency(item.price)}
                            </span>
                            {discountDiff > 0 && (
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                Hemat {formatCurrency(discountDiff)}
                              </span>
                            )}
                          </div>
                          <span className="text-base font-black text-emerald-800 tracking-tight">
                            {formatCurrency(promoCalc.effectivePrice)}
                          </span>
                        </div>

                        {/* Action buttons */}
                        {inCartQty > 0 ? (
                          <div className="flex items-center gap-2 bg-emerald-50 px-2 py-1 rounded-xl border border-emerald-200 shadow-2xs">
                            <button
                              type="button"
                              aria-label={`Kurangi ${item.name}`}
                              onClick={() => handleQuickMinus(item)}
                              className="w-7 h-7 rounded-lg bg-white text-emerald-800 shadow-xs flex items-center justify-center active:scale-90 transition-transform font-bold cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">remove</span>
                            </button>
                            <span className="font-bold text-sm text-emerald-900 px-1 min-w-[16px] text-center">
                              {inCartQty}
                            </span>
                            <button
                              type="button"
                              aria-label={`Tambah ${item.name}`}
                              onClick={() => handleQuickAdd(item)}
                              className="w-7 h-7 rounded-lg bg-[#003629] text-white shadow-xs flex items-center justify-center active:scale-90 transition-transform font-bold cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">add</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleQuickAdd(item)}
                            className="px-4 py-2 rounded-xl bg-[#003629] hover:bg-[#00261d] active:scale-95 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>
                            <span>Pesan Promo</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center rounded-2xl bg-white border border-slate-200/80 flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl">restaurant</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800">Belum Ada Menu Promo</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Saat ini belum ada menu dengan diskon produk aktif. Cek pilihan menu lezat lainnya pada katalog restoran.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("menu")}
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-xs active:scale-95 cursor-pointer"
                >
                  Lihat Daftar Menu
                </button>
              </div>
            )}

            {/* Sticky Floating Mini Cart if items in cart */}
            {totalItemCount > 0 && (
              <div className="fixed bottom-20 left-0 right-0 max-w-md mx-auto px-4 z-30 pointer-events-none">
                <div className="pointer-events-auto bg-[#003629] text-white rounded-2xl p-3 shadow-xl flex items-center justify-between border border-emerald-800/40 animate-in slide-in-from-bottom-2 duration-150">
                  <div className="flex items-center gap-3 pl-1">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                      {totalItemCount}
                    </div>
                    <div>
                      <span className="text-[11px] text-emerald-200 block leading-tight">Total Sementara</span>
                      <span className="font-bold text-sm text-white">{formatCurrency(grandTotal)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("pesanan");
                      setPesananSubTab("cart");
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs shadow-xs active:scale-95 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>Submit Pesanan</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: PESANAN (KERANJANG ATAU STATUS TRACKER) */}
        {/* ============================================================== */}
        {activeTab === "pesanan" && (
          <div className="flex flex-col w-full pb-8">
            {/* SUB-TAB TOGGLE: JIKA SUDAH ADA PESANAN AKTIF SEBELUMNYA */}
            {activeOrder && (
              <div className="flex items-center gap-1.5 p-1 bg-surface-container rounded-2xl mb-4 shrink-0 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setPesananSubTab("cart")}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    pesananSubTab === "cart"
                      ? "bg-[#003629] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">shopping_cart</span>
                  <span>Keranjang Baru</span>
                  {cartList.length > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${
                        pesananSubTab === "cart" ? "bg-white text-[#003629]" : "bg-[#003629] text-white"
                      }`}
                    >
                      {totalItemCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setPesananSubTab("status")}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    pesananSubTab === "status"
                      ? "bg-[#003629] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">skillet</span>
                  <span>Status Dapur</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                </button>
              </div>
            )}

            {/* VIEW 1: KDS LIVE TRACKER (Status Pemrosesan Koki) */}
            {activeOrder && (pesananSubTab === "status" || cartList.length === 0) ? (
              <div className="flex flex-col w-full space-y-4 pt-2">
                {/* Top Success Feedback Card */}
                <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-space-md shadow-sm border border-outline-variant/30">
                  <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-primary-fixed/30 rounded-full blur-2xl pointer-events-none"></div>
                  <div className="flex items-start gap-space-sm">
                    <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary flex items-center justify-center flex-shrink-0 shadow-sm">
                      <span
                        className="material-symbols-outlined text-[26px]"
                        style={{ fontVariationSettings: '"FILL" 1' }}
                      >
                        check_circle
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-space-xs mb-0.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm font-bold tracking-wider">
                          {activeOrder.orderNumber}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm font-semibold">
                          {activeOrder.tableNumber} • {tableArea}
                        </span>
                      </div>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">
                        Pesanan Terkirim ke Dapur!
                      </h2>
                      <div className="flex items-center gap-1 text-on-surface-variant font-body-sm text-body-sm mt-0.5">
                        <span className="material-symbols-outlined text-[15px]">schedule</span>
                        <span>Dipesan {activeOrder.orderTime} (Baru saja)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Progress Tracker (Step Indicator) */}
                <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/30">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-label-md text-label-md font-bold text-on-surface">
                      Status Pemrosesan Koki (KDS)
                    </h4>
                    {activeOrder.kitchenStatus === "ready" ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-900 border border-orange-300 font-bold text-[10px] animate-pulse flex items-center gap-1 shadow-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-ping"></span>
                        <span className="material-symbols-outlined text-[13px] text-orange-600">room_service</span>
                        <span>SIAP DISAJIKAN</span>
                      </span>
                    ) : activeOrder.kitchenStatus === "completed" || activeOrder.kitchenStatus === "served" ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center gap-1 border border-emerald-300">
                        <span className="material-symbols-outlined text-[13px]">check_circle</span>
                        <span>SUDAH DISAJIKAN</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center gap-1 border border-amber-300">
                        <span className="material-symbols-outlined text-[13px]">skillet</span>
                        <span>SEDANG DIMASAK</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between relative px-2">
                    {/* Step 1: Diterima */}
                    <div className="flex flex-col items-center z-10">
                      <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-sm font-bold shadow-xs">
                        <span className="material-symbols-outlined text-[16px]">check</span>
                      </div>
                      <span className="font-label-sm text-[11px] font-bold text-primary mt-1">Diterima</span>
                    </div>

                    {/* Connecting Line 1 -> 2 */}
                    <div className={`flex-1 h-1 -mt-4 mx-1 transition-colors ${
                      activeOrder.kitchenStatus === "in_progress" || activeOrder.kitchenStatus === "ready" || activeOrder.kitchenStatus === "completed" || activeOrder.kitchenStatus === "served"
                        ? "bg-primary"
                        : "bg-surface-container"
                    }`}></div>

                    {/* Step 2: Dimasak */}
                    <div className="flex flex-col items-center z-10">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all shadow-xs ${
                        activeOrder.kitchenStatus === "ready" || activeOrder.kitchenStatus === "completed" || activeOrder.kitchenStatus === "served"
                          ? "bg-primary text-on-primary"
                          : activeOrder.kitchenStatus === "in_progress"
                          ? "bg-secondary-container text-on-secondary-container ring-4 ring-orange-200 animate-pulse"
                          : "bg-surface-container text-on-surface-variant"
                      }`}>
                        <span className="material-symbols-outlined text-[16px]">
                          {activeOrder.kitchenStatus === "ready" || activeOrder.kitchenStatus === "completed" || activeOrder.kitchenStatus === "served"
                            ? "check"
                            : "local_fire_department"}
                        </span>
                      </div>
                      <span className={`font-label-sm text-[11px] font-bold mt-1 ${
                        activeOrder.kitchenStatus === "in_progress"
                          ? "text-secondary font-black"
                          : activeOrder.kitchenStatus === "ready" || activeOrder.kitchenStatus === "completed" || activeOrder.kitchenStatus === "served"
                          ? "text-primary"
                          : "text-outline"
                      }`}>
                        Dimasak
                      </span>
                    </div>

                    {/* Connecting Line 2 -> 3 */}
                    <div className={`flex-1 h-1 -mt-4 mx-1 transition-colors ${
                      activeOrder.kitchenStatus === "ready" || activeOrder.kitchenStatus === "completed" || activeOrder.kitchenStatus === "served"
                        ? "bg-primary"
                        : "bg-surface-container"
                    }`}></div>

                    {/* Step 3: Siap Diantar / Disajikan */}
                    <div className="flex flex-col items-center z-10">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all shadow-xs ${
                        activeOrder.kitchenStatus === "ready"
                          ? "bg-orange-500 text-white ring-4 ring-orange-300 animate-bounce"
                          : activeOrder.kitchenStatus === "completed" || activeOrder.kitchenStatus === "served"
                          ? "bg-emerald-600 text-white"
                          : "bg-surface-container text-on-surface-variant"
                      }`}>
                        <span className="material-symbols-outlined text-[16px]">
                          {activeOrder.kitchenStatus === "completed" || activeOrder.kitchenStatus === "served"
                            ? "check"
                            : "room_service"}
                        </span>
                      </div>
                      <span className={`font-label-sm text-[11px] font-bold mt-1 ${
                        activeOrder.kitchenStatus === "ready"
                          ? "text-orange-600 font-black animate-pulse"
                          : activeOrder.kitchenStatus === "completed" || activeOrder.kitchenStatus === "served"
                          ? "text-emerald-700 font-bold"
                          : "text-outline"
                      }`}>
                        {activeOrder.kitchenStatus === "ready" ? "Siap Diantar" : "Disajikan"}
                      </span>
                    </div>
                  </div>

                  {/* Contextual Status Banner */}
                  {activeOrder.kitchenStatus === "ready" && (
                    <div className="mt-4 p-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-950 text-xs flex items-center gap-2.5 animate-pulse">
                      <span className="material-symbols-outlined text-orange-600 text-2xl shrink-0">room_service</span>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">🔔 Makanan Anda Siap Disajikan!</span>
                        <span className="text-[11px] text-orange-800">
                          Koki telah selesai memasak di dapur. Waiter sedang mengantarkan hidangan ke {activeOrder.tableNumber}.
                        </span>
                      </div>
                    </div>
                  )}

                  {(activeOrder.kitchenStatus === "completed" || activeOrder.kitchenStatus === "served") && (
                    <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-emerald-600 text-2xl shrink-0">restaurant</span>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">✓ Selamat Menikmati Hidangan!</span>
                        <span className="text-[11px] text-emerald-800">
                          Semua pesanan Anda telah disajikan di meja. Silakan hubungi waiter jika butuh bantuan.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Real-time Kitchen Order Items (KDS Live Feed) */}
                <div className="rounded-2xl bg-surface-container-lowest p-space-md shadow-sm border border-outline-variant/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-label-lg text-label-lg text-on-surface font-bold">
                        Progres Menu {activeOrder.tableNumber}
                      </h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Pembaruan sinkron langsung dari layar koki dapur
                      </p>
                    </div>
                    <span className="font-label-sm text-label-sm font-bold text-primary px-2 py-0.5 rounded-full bg-primary-fixed">
                      {activeOrder.items.length} Rincian Item
                    </span>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    {activeOrder.items.map((it, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low transition-colors"
                      >
                        <div className="flex items-center gap-space-sm min-w-0">
                          <img
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                            src={
                              it.imageUrl ||
                              "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80"
                            }
                            alt={it.name}
                          />
                          <div className="min-w-0">
                            <p className="font-label-lg text-label-lg text-on-surface font-bold truncate">
                              {it.qty}x {it.name}
                            </p>
                            <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                              {it.note || "Standar sajian koki"}
                            </p>
                          </div>
                        </div>
                        <span className="font-label-sm text-[11px] font-bold text-secondary bg-secondary-fixed/30 px-2 py-0.5 rounded-full shrink-0">
                          {it.statusLabel || "Sedang diproses"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Operational Cashier Guidance Banner */}
                <div className="rounded-2xl bg-surface-container-high p-space-md shadow-sm">
                  <div className="flex items-start gap-space-sm">
                    <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-on-primary flex-shrink-0 shadow-xs">
                      <span className="material-symbols-outlined text-[22px]">point_of_sale</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">
                        Selesaikan Pembayaran di Meja Kasir
                      </h4>
                      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed mt-0.5">
                        Bawa tanda pengenal <strong className="text-primary font-semibold">{tableNumber}</strong>{" "}
                        atau sebutkan nama pemesan (
                        <strong className="text-on-surface font-semibold">{activeOrder.customerName}</strong>) ke
                        kasir setelah santap selesai.
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-lowest text-on-surface font-label-sm text-label-sm font-semibold shadow-xs">
                          <span className="material-symbols-outlined text-[14px] text-primary">payments</span>
                          Tunai
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-lowest text-on-surface font-label-sm text-label-sm font-semibold shadow-xs">
                          <span className="material-symbols-outlined text-[14px] text-primary">
                            qr_code_scanner
                          </span>
                          QRIS Statis
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-lowest text-on-surface font-label-sm text-label-sm font-semibold shadow-xs">
                          <span className="material-symbols-outlined text-[14px] text-primary">
                            account_balance
                          </span>
                          Transfer Bank
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons: Keranjang Baru vs Pesan Menu Tambahan */}
                {cartList.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setPesananSubTab("cart")}
                    className="w-full h-12 rounded-xl bg-[#003629] text-white font-bold text-xs sm:text-sm flex items-center justify-between px-4 shadow-md active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">shopping_cart</span>
                      <span>Ada {totalItemCount} Menu Baru di Keranjang</span>
                    </div>
                    <span className="flex items-center gap-1 font-bold">
                      <span>Lihat &amp; Submit</span>
                      <span className="material-symbols-outlined text-base">arrow_forward</span>
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveTab("menu")}
                    className="w-full h-12 rounded-xl bg-[#003629] text-white font-label-lg text-label-lg font-bold flex items-center justify-center gap-space-xs shadow-md active:scale-[0.98] transition-transform cursor-pointer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[20px]">add_circle</span>
                    <span>+ Pesan Menu Tambahan ke {tableNumber}</span>
                  </button>
                )}
              </div>
            ) : cartList.length === 0 ? (
              /* EMPTY CART STATE */
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center text-outline mb-3">
                  <span className="material-symbols-outlined text-4xl">shopping_cart</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                  Keranjang Masih Kosong
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant max-w-xs mt-1">
                  Pilih aneka hidangan Nusantara lezat favorit Anda dari menu untuk memulai pesanan.
                </p>
                <button
                  onClick={() => setActiveTab("menu")}
                  className="mt-4 px-6 py-2.5 rounded-xl bg-[#003629] text-white font-bold font-label-md text-label-md shadow-xs active:scale-95 cursor-pointer"
                >
                  Buka Katalog Menu
                </button>
              </div>
            ) : (
              /* ACTIVE CART & CHECKOUT BREAKDOWN */
              <div className="flex flex-col w-full pb-24 pt-2">
                {/* Status & Table Identification Card */}
                <section className="mb-4 bg-surface-container-low rounded-xl p-space-md shadow-xs border border-outline-variant/30">
                  <div className="flex items-center justify-between gap-space-sm">
                    <div className="flex items-center gap-space-sm min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed shrink-0">
                        <span
                          className="material-symbols-outlined text-[20px]"
                          style={{ fontVariationSettings: '"FILL" 1' }}
                        >
                          table_restaurant
                        </span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                            {tableNumber}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm">
                            {tableArea}
                          </span>
                        </div>
                        <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                          Sesi Pesanan Aktif • {settings.restaurantName || "Pawon Nusantara"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container font-label-sm text-label-sm text-primary font-bold">
                        <span className="w-2 h-2 rounded-full bg-secondary-container animate-pulse"></span>
                        {cartList.length} Menu
                      </span>
                    </div>
                  </div>
                </section>

                {/* Customer Name Banner in Cart (Mandatory) */}
                <div
                  className={`mb-4 p-3.5 rounded-2xl flex flex-col gap-2 shadow-2xs border transition-colors ${
                    !customerName.trim()
                      ? "bg-rose-50 border-rose-300 text-rose-950"
                      : "bg-surface-container-low border-outline-variant/30 text-on-surface"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="customer-name-cart-input"
                      className="flex items-center gap-1.5 font-bold text-xs cursor-pointer"
                    >
                      <span
                        className={`material-symbols-outlined text-[18px] ${
                          !customerName.trim() ? "text-rose-600" : "text-primary"
                        }`}
                      >
                        person
                      </span>
                      <span>Nama Pemesan / Tamu *:</span>
                    </label>
                    {!customerName.trim() ? (
                      <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider bg-rose-100 px-2 py-0.5 rounded-full">
                        Wajib Diisi
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        ✓ Terisi
                      </span>
                    )}
                  </div>
                  <input
                    id="customer-name-cart-input"
                    type="text"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      if (errorMessage) setErrorMessage("");
                    }}
                    placeholder="Ketik nama Anda (misal: Bpk. Hendra)..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-lowest text-on-surface placeholder:text-outline font-semibold focus:outline-none focus:ring-2 focus:ring-primary shadow-xs border border-outline-variant/40 text-xs sm:text-sm"
                  />
                  <p className="text-[11px] text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-primary">info</span>
                    <span>Koki dapur akan menyiapkan pesanan atas nama ini untuk {tableNumber}.</span>
                  </p>
                </div>

                {/* Section Header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">Item Pilihan</h2>
                    <span className="px-2 py-0.5 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm">
                      {totalItemCount} Porsi
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab("menu")}
                    className="text-secondary font-label-md text-label-md flex items-center gap-1 active:opacity-75 transition-opacity"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">add_circle</span>
                    Tambah Menu Lain
                  </button>
                </div>

                {/* Items Cart List */}
                <div className="flex flex-col gap-3">
                  {cartList.map((c) => {
                    let unitPrice = c.item.price;
                    const availableAddons = c.item.addons || [];
                    const addOnsList = Object.entries(c.selectedAddOns)
                      .filter(([_, sel]) => sel)
                      .map(([id]) => {
                        const addon = availableAddons.find((a: any) => a.id === id);
                        if (addon) unitPrice += addon.price;
                        return addon?.name;
                      })
                      .filter(Boolean);

                    const lineSubtotal = unitPrice * c.qty;

                    return (
                      <article
                        key={c.item.id}
                        className="bg-surface-container-lowest rounded-xl p-space-md shadow-xs border border-outline-variant/30 flex flex-col gap-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-surface-container">
                            <img
                              className="w-full h-full object-cover"
                              src={
                                c.item.imageUrl ||
                                "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80"
                              }
                              alt={c.item.name}
                            />
                          </div>
                          <div className="flex flex-col flex-grow min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-label-lg text-label-lg font-bold text-on-surface truncate">
                                  {c.item.name}
                                </h3>
                                <span className="font-body-sm text-body-sm text-on-surface-variant">
                                  @{formatCurrency(unitPrice)} / porsi
                                </span>
                              </div>
                              <button
                                aria-label={`Hapus ${c.item.name}`}
                                onClick={() => handleRemoveFromCart(c.item.id)}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error bg-surface-container-low active:scale-90 transition-transform shrink-0"
                                type="button"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </div>
                            <p className="font-currency-row text-currency-row text-primary mt-0.5 font-bold">
                              {formatCurrency(lineSubtotal)}
                            </p>

                            {/* Note and add-ons display */}
                            {(c.note || addOnsList.length > 0) && (
                              <div className="mt-2 p-2 rounded-lg bg-surface-container-low flex items-start gap-1.5">
                                <span className="material-symbols-outlined text-secondary text-[16px] shrink-0 mt-0.5">
                                  stylus_note
                                </span>
                                <div className="font-body-sm text-body-sm text-on-surface-variant leading-snug">
                                  {c.note && <span>{c.note}</span>}
                                  {addOnsList.length > 0 && (
                                    <span className="text-secondary font-medium block">
                                      {addOnsList.join(", ")}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Portion adjustment bar */}
                        <div className="flex items-center justify-between pt-1 border-t border-surface-container-low">
                          <button
                            onClick={() => handleOpenDetailModal(c.item)}
                            className="text-primary font-label-sm text-label-sm flex items-center gap-1 active:opacity-75"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[15px]">edit</span>
                            Edit Catatan
                          </button>
                          <div className="flex items-center bg-surface-container rounded-full p-1">
                            <button
                              aria-label="Kurangi porsi"
                              onClick={() => handleQuickMinus(c.item)}
                              className="w-7 h-7 rounded-full bg-surface-container-lowest text-on-surface flex items-center justify-center shadow-xs active:scale-90 transition-transform font-bold"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[16px]">remove</span>
                            </button>
                            <span className="w-8 text-center font-label-md text-label-md font-bold text-on-surface">
                              {c.qty}
                            </span>
                            <button
                              aria-label="Tambah porsi"
                              onClick={() => handleQuickAdd(c.item)}
                              className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-xs active:scale-90 transition-transform font-bold"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[16px]">add</span>
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* Ringkasan Biaya (Billing Breakdown) */}
                <section className="mt-5 bg-surface-container-lowest rounded-xl p-space-md shadow-xs border border-outline-variant/30 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-surface-container-low">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[20px]">receipt_long</span>
                      <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                        Ringkasan Biaya
                      </h3>
                    </div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded-full">
                      Tagihan {tableNumber}
                    </span>
                  </div>

                  <div className="flex items-center justify-between font-body-md text-body-md text-on-surface-variant">
                    <span>Subtotal ({totalItemCount} Item)</span>
                    <span className="font-label-lg text-label-lg text-on-surface font-semibold">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>

                  {settings.taxEnabled && (settings.taxRate ?? 0) > 0 && (
                    <div className="flex items-center justify-between font-body-md text-body-md text-on-surface-variant">
                      <div className="flex items-center gap-1">
                        <span>Pajak Restoran PB1</span>
                        <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container px-1 rounded">
                          {settings.taxRate}%
                        </span>
                      </div>
                      <span className="font-label-lg text-label-lg text-on-surface">
                        {formatCurrency(taxPb1)}
                      </span>
                    </div>
                  )}

                  {settings.serviceChargeEnabled && (settings.serviceChargeRate ?? 0) > 0 && (
                    <div className="flex items-center justify-between font-body-md text-body-md text-on-surface-variant">
                      <div className="flex items-center gap-1">
                        <span>Biaya Layanan / Service</span>
                        <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container px-1 rounded">
                          {settings.serviceChargeRate}%
                        </span>
                      </div>
                      <span className="font-label-lg text-label-lg text-on-surface">
                        {formatCurrency(serviceCharge)}
                      </span>
                    </div>
                  )}

                  {rounding > 0 && (
                    <div className="flex items-center justify-between font-body-md text-body-md text-on-surface-variant">
                      <div className="flex items-center gap-1">
                        <span>Pembulatan Sistem</span>
                        <span className="material-symbols-outlined text-[14px] text-outline">help_outline</span>
                      </div>
                      <span className="font-label-lg text-label-lg text-secondary font-medium">
                        +{formatCurrency(rounding)}
                      </span>
                    </div>
                  )}

                  <div className="mt-2 pt-3 bg-surface-container-low rounded-lg p-3 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-label-sm text-label-sm text-on-surface-variant font-bold uppercase tracking-wider">
                        Total Estimasi
                      </span>
                      <span className="font-body-sm text-[11px] text-on-surface-variant">
                        Sudah termasuk pajak &amp; servis
                      </span>
                    </div>
                    <span className="font-currency-display text-2xl font-extrabold text-primary">
                      {formatCurrency(grandTotal)}
                    </span>
                  </div>
                </section>

                {/* Cashier Payment Workflow Alert */}
                <div className="mt-4 bg-secondary-fixed/40 rounded-xl p-space-md flex items-start gap-3 shadow-xs border border-secondary/20">
                  <div className="w-9 h-9 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container shrink-0 mt-0.5">
                    <span
                      className="material-symbols-outlined text-[20px]"
                      style={{ fontVariationSettings: '"FILL" 1' }}
                    >
                      point_of_sale
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <p className="font-label-md text-label-md font-bold text-on-secondary-container">
                      Pembayaran di Kasir
                    </p>
                    <p className="font-body-sm text-body-sm text-on-secondary-fixed-variant mt-0.5 leading-relaxed">
                      Anda dapat melunasi tagihan secara tunai, QRIS, atau transfer saat selesai bersantap langsung di
                      meja kasir.
                    </p>
                  </div>
                </div>

                {/* Floating Sticky Checkout Action Bar with Large Submit Button */}
                <div className="fixed bottom-0 left-0 right-0 p-3 bg-surface/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.12)] z-50 pb-safe max-w-md mx-auto border-t border-surface-container-high/60">
                  <button
                    id="btn-submit-dine-in-order"
                    className="w-full h-14 bg-[#003629] text-white rounded-2xl flex items-center justify-between px-4 sm:px-5 shadow-lg active:bg-emerald-950 active:scale-[0.99] transition-all cursor-pointer font-bold"
                    onClick={() => {
                      if (!customerName.trim()) {
                        setErrorMessage("Harap isi Nama Pemesan di atas terlebih dahulu!");
                        const nameInput = document.getElementById("customer-name-cart-input");
                        if (nameInput) {
                          nameInput.focus();
                          nameInput.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                        return;
                      }
                      setShowConfirmModal(true);
                    }}
                    type="button"
                  >
                    <div className="flex flex-col items-start text-left">
                      <span className="font-extrabold text-sm sm:text-base flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-lg">restaurant</span>
                        Submit Pesanan ke Dapur
                      </span>
                      <span className="text-[11px] text-emerald-200">
                        {tableNumber} • {totalItemCount} Item • Total {formatCurrency(grandTotal)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 rounded-xl text-xs font-black shrink-0 transition-colors shadow-2xs">
                      <span>Kirim</span>
                      <span
                        className="material-symbols-outlined text-base"
                        style={{ fontVariationSettings: '"FILL" 1' }}
                      >
                        send
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* ============================================================== */}
      {/* 3. DETAIL MENU & KUSTOMISASI MODAL (BOTTOM SHEET) */}
      {/* ============================================================== */}
      {selectedItemForDetail && (() => {
        const detailPromo = calculateProductPromoPrice(selectedItemForDetail, productPromos);
        const detailPrice = detailPromo.isPromo ? detailPromo.effectivePrice : selectedItemForDetail.price;

        return (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center max-w-md mx-auto p-0"
          onClick={() => setSelectedItemForDetail(null)}
        >
          <div
            className="w-full bg-surface-container-lowest rounded-t-3xl max-h-[88vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-250 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header Bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-container-low shrink-0">
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Detail Menu • {tableNumber}
              </span>
              <button
                onClick={() => setSelectedItemForDetail(null)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant active:scale-90"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto p-4 flex flex-col gap-4 flex-1">
              {/* Dish Hero Image */}
              <div className="relative w-full rounded-2xl overflow-hidden bg-surface-container-low shadow-sm h-52 shrink-0">
                <img
                  src={
                    selectedItemForDetail.imageUrl ||
                    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80"
                  }
                  alt={selectedItemForDetail.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent pointer-events-none"></div>

                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-surface-container-lowest/90 backdrop-blur-md px-2.5 py-1 rounded-full shadow-xs">
                  <span
                    className="material-symbols-outlined text-[15px] text-secondary"
                    style={{ fontVariationSettings: '"FILL" 1' }}
                  >
                    star
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface font-bold tracking-wide">
                    {detailPromo.isPromo ? detailPromo.badge : "Favorit Pengunjung"}
                  </span>
                </div>

                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-on-primary">
                  <div className="flex items-center gap-1.5 bg-primary-container/80 backdrop-blur-md px-2.5 py-1 rounded-full">
                    <span className="material-symbols-outlined text-[14px] text-tertiary-fixed">skillet</span>
                    <span className="font-label-sm text-label-sm text-on-primary">
                      {selectedItemForDetail.cookingTime || "15-20 Menit"}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    {detailPromo.isPromo && (
                      <span className="text-xs text-white/80 line-through">
                        {formatCurrency(selectedItemForDetail.price)}
                      </span>
                    )}
                    <span className="font-currency-display text-2xl text-primary-fixed font-extrabold drop-shadow-sm">
                      {formatCurrency(detailPrice)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Title & Story */}
              <div className="flex flex-col">
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  {selectedItemForDetail.name}
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1.5 leading-relaxed">
                  {selectedItemForDetail.description}
                </p>
              </div>

              {/* Pilihan Pelengkap / Add-ons (Hanya ditampilkan jika produk memiliki tambahan di master data) */}
              {selectedItemForDetail.addons && selectedItemForDetail.addons.length > 0 && (
                <div className="flex flex-col bg-surface-container-low rounded-xl p-3.5 gap-2.5">
                  <span className="font-label-md text-label-md font-bold text-on-surface">
                    Pilihan Tambahan / Pelengkap
                  </span>
                  {selectedItemForDetail.addons.map((addon: any) => {
                    const isChecked = !!detailAddOns[addon.id];
                    return (
                      <label
                        key={addon.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest cursor-pointer active:bg-surface-container transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) =>
                              setDetailAddOns((prev) => ({
                                ...prev,
                                [addon.id]: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded text-primary focus:ring-primary"
                          />
                          <span className="font-body-sm text-body-sm text-on-surface">{addon.name}</span>
                        </div>
                        <span className="font-label-sm text-label-sm text-primary font-bold">
                          +{formatCurrency(addon.price)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Catatan Khusus untuk Dapur */}
              <div className="flex flex-col bg-surface-container-low rounded-xl p-3.5 gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-primary">edit_note</span>
                    <span className="font-label-md text-label-md font-bold text-on-surface">
                      Catatan untuk Koki Dapur
                    </span>
                  </div>
                  <span className="font-label-sm text-[11px] text-on-surface-variant">
                    {detailNote.length}/120
                  </span>
                </div>
                <textarea
                  maxLength={120}
                  rows={2}
                  value={detailNote}
                  onChange={(e) => setDetailNote(e.target.value)}
                  placeholder="Contoh: Bumbu manis gurih kental, bakar agak kering, sambal pisah ya pak..."
                  className="w-full bg-surface-container-lowest text-on-surface rounded-lg p-2.5 font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30"
                />
              </div>
            </div>

            {/* Bottom Stepper and Action Bar attached cleanly to sheet */}
            <div className="p-4 bg-surface-container-lowest border-t border-surface-container-high flex items-center gap-3 shrink-0">
              <div className="flex items-center bg-surface-container-low rounded-xl px-2 py-1 flex-shrink-0">
                <button
                  onClick={() => setDetailQty(Math.max(1, detailQty - 1))}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface font-bold text-lg active:scale-90 transition-transform"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">remove</span>
                </button>
                <span className="font-currency-row text-currency-row w-8 text-center text-on-surface font-extrabold">
                  {detailQty}
                </span>
                <button
                  onClick={() => setDetailQty(detailQty + 1)}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface font-bold text-lg active:scale-90 transition-transform"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </button>
              </div>

              <button
                onClick={handleSaveDetailToCart}
                className="flex-1 min-w-0 h-12 bg-primary hover:bg-primary-container text-on-primary rounded-xl flex items-center justify-between px-3.5 font-label-lg text-label-lg font-bold shadow-md active:scale-[0.98] transition-all cursor-pointer"
                type="button"
              >
                {showDetailSuccessToast ? (
                  <span className="flex items-center justify-center w-full gap-2 text-primary-fixed">
                    <span
                      className="material-symbols-outlined text-[20px]"
                      style={{ fontVariationSettings: '"FILL" 1' }}
                    >
                      check_circle
                    </span>
                    <span>Tersimpan di Keranjang!</span>
                  </span>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5 min-w-0 truncate">
                      <span className="material-symbols-outlined text-[18px] flex-shrink-0">
                        restaurant_menu
                      </span>
                      <span className="truncate">Tambah Pesanan</span>
                    </span>
                    <span className="font-currency-row text-currency-row text-primary-fixed ml-2 whitespace-nowrap flex-shrink-0 font-bold">
                      {formatCurrency(
                        (detailPrice +
                          Object.entries(detailAddOns).reduce((acc, [id, sel]) => {
                            if (!sel) return acc;
                            const availableAddons = selectedItemForDetail.addons || [];
                            return acc + (availableAddons.find((a: any) => a.id === id)?.price || 0);
                          }, 0)) *
                          detailQty
                      )}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ============================================================== */}
      {/* 4. CONFIRMATION DIALOG MODAL ("Apakah Pesanan Anda Sudah Sesuai?") */}
      {/* ============================================================== */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 max-w-md mx-auto"
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            className="w-full max-w-sm bg-surface-container-lowest rounded-3xl p-space-lg shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-primary-fixed flex items-center justify-center text-primary mx-auto shadow-inner">
              <span className="material-symbols-outlined text-[28px]">fact_check</span>
            </div>
            <div className="text-center">
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Submit Pesanan ke Dapur?
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1.5 leading-relaxed">
                Pilihan menu {tableNumber} ({totalItemCount} porsi) atas nama <strong>{customerName}</strong> ({formatCurrency(grandTotal)}) akan langsung dikirim ke sistem dapur koki. Mohon periksa kembali agar pesanan Anda tepat.
              </p>
            </div>

            {errorMessage && (
              <div className="p-2.5 bg-error-container text-on-error-container rounded-xl text-xs font-semibold">
                {errorMessage}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button
                disabled={isSubmitting}
                onClick={handleProcessOrder}
                className="w-full h-12 bg-[#003629] text-white font-label-lg text-label-lg font-bold rounded-xl shadow active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                type="button"
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                    <span>Mengirim ke Dapur...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    <span>Ya, Kirim Pesanan Sekarang</span>
                  </>
                )}
              </button>
              <button
                disabled={isSubmitting}
                onClick={() => setShowConfirmModal(false)}
                className="w-full h-11 bg-surface-container text-on-surface font-label-md text-label-md font-semibold rounded-xl active:bg-surface-container-high transition-colors cursor-pointer"
                type="button"
              >
                Periksa Kembali
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. BOTTOM NAVIGATION BAR (Hidden during active cart checkout) */}
      {/* ============================================================== */}
      {!(activeTab === "pesanan" && ((pesananSubTab === "cart" && cartList.length > 0) || (!activeOrder && cartList.length > 0))) && (
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto w-full z-40 pb-safe bg-surface/95 backdrop-blur-xl shadow-[0_-2px_12px_rgba(0,0,0,0.05)] border-t border-surface-container-high">
        <div className="flex justify-around items-center h-16 px-space-sm">
          <button
            onClick={() => setActiveTab("menu")}
            className={`flex flex-col items-center justify-center gap-0.5 w-16 h-12 transition-colors ${
              activeTab === "menu" ? "text-primary font-bold" : "text-on-surface-variant hover:text-on-surface"
            }`}
            type="button"
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={{ fontVariationSettings: activeTab === "menu" ? '"FILL" 1' : '"FILL" 0' }}
            >
              restaurant_menu
            </span>
            <span className="font-label-md text-[11px]">Menu</span>
          </button>

          <button
            onClick={() => setActiveTab("promo")}
            className={`relative flex flex-col items-center justify-center gap-0.5 w-16 h-12 transition-colors ${
              activeTab === "promo" ? "text-primary font-bold" : "text-on-surface-variant hover:text-on-surface"
            }`}
            type="button"
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={{ fontVariationSettings: activeTab === "promo" ? '"FILL" 1' : '"FILL" 0' }}
            >
              local_offer
            </span>
            {promoProductsList.length > 0 && (
              <span className="absolute top-1 right-2.5 w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                {promoProductsList.length}
              </span>
            )}
            <span className="font-label-md text-[11px]">Promo</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("pesanan");
              if (cartList.length > 0) setPesananSubTab("cart");
            }}
            className={`relative flex flex-col items-center justify-center gap-0.5 w-16 h-12 transition-colors ${
              activeTab === "pesanan" ? "text-primary font-bold" : "text-on-surface-variant hover:text-on-surface"
            }`}
            type="button"
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={{ fontVariationSettings: activeTab === "pesanan" ? '"FILL" 1' : '"FILL" 0' }}
            >
              receipt_long
            </span>
            {totalItemCount > 0 ? (
              <span className="absolute top-1 right-3 w-4 h-4 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold flex items-center justify-center">
                {totalItemCount}
              </span>
            ) : activeOrder ? (
              <span className="absolute top-1.5 right-3.5 w-2.5 h-2.5 rounded-full bg-on-tertiary-container animate-pulse"></span>
            ) : null}
            <span className="font-label-md text-[11px]">Pesanan</span>
          </button>
        </div>
      </nav>
      )}
    </div>
  );
}

export default function CustomerMenuPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }
    >
      <CustomerMenuContent />
    </Suspense>
  );
}
