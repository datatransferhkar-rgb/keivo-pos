"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { formatCurrency } from "@/lib/formatters";
import { MasterProduct, MasterTable, ProductAddon, PromoDiscount, ProductPromo, Customer, CustomerTier, ProductCategory, TableAreaCategory, CustomerTierCategory, BankAccount } from "@/types/pos";
import { calculateProductPromoPrice } from "@/lib/productPromoHelper";
import { useRestaurant } from "@/context/RestaurantContext";
import { TableQrModal } from "@/components/modals/TableQrModal";
import { PrintAllTablesQrModal } from "@/components/modals/PrintAllTablesQrModal";
import { ProductDetailModal } from "@/components/modals/ProductDetailModal";

const INITIAL_PRODUCTS: MasterProduct[] = [
  {
    id: "prod-1",
    code: "PRD-001",
    name: "Nasi Liwet Komplit",
    category: "Makanan Utama",
    price: 42000,
    description: "Nasi liwet gurih dengan ayam suwir, orek tempe, tahu bacem & sambal terasi khas.",
    isAvailable: true,
    imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: "prod-2",
    code: "PRD-002",
    name: "Gurame Bakar Cobek (800g)",
    category: "Seafood",
    price: 85000,
    description: "Gurame segar dibakar arang dengan rempah cobek manis gurih pedas.",
    isAvailable: true,
    imageUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: "prod-3",
    code: "PRD-003",
    name: "Ayam Bakar Taliwang",
    category: "Makanan Utama",
    price: 48000,
    description: "Ayam kampung muda dibakar bumbu taliwang khas Lombok pedas menggigit.",
    isAvailable: true,
    imageUrl: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: "prod-4",
    code: "PRD-004",
    name: "Bebek Goreng Kremes",
    category: "Makanan Utama",
    price: 45000,
    description: "Bebek empuk bumbu kuning gurih berlimpah taburan kremes renyah.",
    isAvailable: true,
    imageUrl: "https://images.unsplash.com/photo-1514944298352-f41e57c617b0?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: "prod-5",
    code: "PRD-005",
    name: "Sup Buntut Sapi",
    category: "Sup & Sayur",
    price: 65000,
    description: "Kuah kaldu bening gurih hangat dengan potongan buntut sapi empuk berempah.",
    isAvailable: true,
    imageUrl: "https://images.unsplash.com/photo-1547496502-affa22d38842?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: "prod-6",
    code: "PRD-006",
    name: "Cah Kangkung Terasi",
    category: "Sup & Sayur",
    price: 22000,
    description: "Tumisan kangkung hijau segar dengan terasi udang khas Cirebon harum gurih.",
    isAvailable: true,
    imageUrl: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: "prod-7",
    code: "PRD-007",
    name: "Sate Ayam Madura (10 tsk)",
    category: "Makanan Utama",
    price: 35000,
    description: "Daging ayam fillet panggang lembut disiram saus kacang kental & kecap manis.",
    isAvailable: true,
    imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: "prod-8",
    code: "PRD-008",
    name: "Es Kelapa Muda Batok",
    category: "Minuman",
    price: 18000,
    description: "Air kelapa murni disajikan langsung dalam batok kelapa segar pilihan.",
    isAvailable: true,
    imageUrl: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: "prod-9",
    code: "PRD-009",
    name: "Es Cendol Durian",
    category: "Minuman",
    price: 25000,
    description: "Cendol pandan harum dengan santan segar, gula aren organik & topping daging durian.",
    isAvailable: true,
    imageUrl: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: "prod-10",
    code: "PRD-010",
    name: "Tempe Mendoan (4 pcs)",
    category: "Camilan",
    price: 18000,
    description: "Tempe kedelai berbalut adonan daun bawang digoreng setengah matang gurih renyah.",
    isAvailable: true,
    imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&auto=format&fit=crop&q=80",
  },
];

const INITIAL_TABLES: MasterTable[] = [
  { id: "tbl-01", tableNumber: "Meja 01", displayName: "Meja 01", qrToken: "tbl-token-01-xyz", area: "indoor", capacity: 4, status: "tersedia" },
  { id: "tbl-02", tableNumber: "Meja 02", displayName: "Meja 02", qrToken: "tbl-token-02-xyz", area: "indoor", capacity: 2, status: "tersedia" },
  { id: "tbl-03", tableNumber: "Meja 03", displayName: "Meja 03", qrToken: "tbl-token-03-xyz", area: "indoor", capacity: 4, status: "tersedia" },
  { id: "tbl-04", tableNumber: "Meja 04", displayName: "Meja 04", qrToken: "tbl-token-04-xyz", area: "indoor", capacity: 2, status: "tersedia" },
  { id: "tbl-05", tableNumber: "Meja 05", displayName: "Meja 05", qrToken: "tbl-token-05-xyz", area: "indoor", capacity: 6, status: "tersedia" },
  { id: "tbl-06", tableNumber: "Meja 06", displayName: "Meja 06", qrToken: "tbl-token-06-xyz", area: "indoor", capacity: 3, status: "tersedia" },
  { id: "tbl-07", tableNumber: "Meja 07", displayName: "Meja 07", qrToken: "tbl-token-07-xyz", area: "indoor", capacity: 5, status: "tersedia" },
  { id: "tbl-08", tableNumber: "Meja 08", displayName: "Meja 08", qrToken: "tbl-token-08-xyz", area: "indoor", capacity: 4, status: "tersedia" },
  { id: "tbl-09", tableNumber: "Meja 09", displayName: "Meja 09", qrToken: "tbl-token-09-xyz", area: "indoor", capacity: 4, status: "tersedia" },
  { id: "tbl-10", tableNumber: "Meja 10", displayName: "Meja 10", qrToken: "tbl-token-10-xyz", area: "outdoor", capacity: 2, status: "tersedia" },
  { id: "tbl-11", tableNumber: "Meja 11", displayName: "Meja 11", qrToken: "tbl-token-11-xyz", area: "outdoor", capacity: 4, status: "tersedia" },
  { id: "tbl-12", tableNumber: "Meja 12", displayName: "Meja 12", qrToken: "tbl-token-12-xyz", area: "vip", capacity: 6, status: "tersedia" },
  { id: "tbl-13", tableNumber: "Meja 13", displayName: "Meja 13", qrToken: "tbl-token-13-xyz", area: "outdoor", capacity: 4, status: "tersedia" },
  { id: "tbl-14", tableNumber: "Meja 14", displayName: "Meja 14", qrToken: "tbl-token-14-xyz", area: "outdoor", capacity: 4, status: "tersedia" },
  { id: "tbl-15", tableNumber: "Meja 15", displayName: "Meja 15", qrToken: "tbl-token-15-xyz", area: "outdoor", capacity: 2, status: "tersedia" },
  { id: "tbl-16", tableNumber: "Meja 16", displayName: "Meja 16", qrToken: "tbl-token-16-xyz", area: "vip", capacity: 6, status: "tersedia" },
  { id: "tbl-17", tableNumber: "Meja 17", displayName: "Meja 17", qrToken: "tbl-token-17-xyz", area: "indoor", capacity: 4, status: "tersedia" },
  { id: "tbl-18", tableNumber: "Meja 18", displayName: "Meja 18", qrToken: "tbl-token-18-xyz", area: "indoor", capacity: 2, status: "tersedia" },
  { id: "tbl-19", tableNumber: "Meja 19", displayName: "Meja 19", qrToken: "tbl-token-19-xyz", area: "outdoor", capacity: 4, status: "tersedia" },
  { id: "tbl-20", tableNumber: "Meja 20", displayName: "Meja 20", qrToken: "tbl-token-20-xyz", area: "vip", capacity: 6, status: "tersedia" },
];

const DEFAULT_SYSTEM_CATEGORIES: ProductCategory[] = [
  { id: "cat-utama", name: "Makanan Utama", sortOrder: 1, isActive: true },
  { id: "cat-ayam-ikan", name: "Hidangan Ayam & Ikan", sortOrder: 2, isActive: true },
  { id: "cat-sayur", name: "Sayuran & Pelengkap", sortOrder: 3, isActive: true },
  { id: "cat-minuman", name: "Minuman Segar", sortOrder: 4, isActive: true },
  { id: "cat-seafood", name: "Seafood", sortOrder: 5, isActive: true },
  { id: "cat-sup-sayur", name: "Sup & Sayur", sortOrder: 6, isActive: true },
  { id: "cat-camilan", name: "Camilan", sortOrder: 7, isActive: true },
  { id: "cat-paket", name: "Paket Hemat", sortOrder: 8, isActive: true },
];

const DEFAULT_TABLE_AREAS: TableAreaCategory[] = [
  { id: "area-indoor", code: "indoor", name: "Indoor AC", description: "Area ber-AC di dalam ruangan yang nyaman & sejuk", sortOrder: 1, isActive: true },
  { id: "area-outdoor", code: "outdoor", name: "Outdoor Garden", description: "Area terbuka di taman dengan nuansa alam asri", sortOrder: 2, isActive: true },
  { id: "area-vip", code: "vip", name: "Gazebo VIP", description: "Ruang gazebo privat untuk keluarga & tamu khusus", sortOrder: 3, isActive: true },
  { id: "area-smoking", code: "smoking", name: "Smoking Area", description: "Area khusus bebas merokok yang terpisah", sortOrder: 4, isActive: true },
];

const DEFAULT_CUSTOMER_TIERS: CustomerTierCategory[] = [
  { id: "tier-regular", code: "regular", name: "Regular", description: "Pelanggan umum atau member yang baru bergabung", badgeColor: "emerald", sortOrder: 1, isActive: true },
  { id: "tier-silver", code: "silver", name: "Silver Member", description: "Member loyal tingkat perak dengan reward poin standar", badgeColor: "slate", sortOrder: 2, isActive: true },
  { id: "tier-gold", code: "gold", name: "Gold Member", description: "Member setia prioritas tingkat emas dengan penawaran khusus", badgeColor: "amber", sortOrder: 3, isActive: true },
  { id: "tier-vip", code: "vip", name: "VIP Member", description: "Member kehormatan tertinggi restoran Pawon Nusantara", badgeColor: "purple", sortOrder: 4, isActive: true },
];

export function MasterDataWorkspace() {
  const { settings, updateSettings } = useRestaurant();
  const [activeTab, setActiveTab] = useState<"products" | "tables" | "promos" | "customers" | "categories" | "payments">("products");
  const [categorySubTab, setCategorySubTab] = useState<"product" | "area" | "member">("product");
  const [products, setProducts] = useState<MasterProduct[]>(INITIAL_PRODUCTS);
  const [tables, setTables] = useState<MasterTable[]>(INITIAL_TABLES);
  const [promos, setPromos] = useState<PromoDiscount[]>([]);
  const [isLoadingPromos, setIsLoadingPromos] = useState(false);

  // Payment Data State (QRIS & Bank Accounts)
  const [paymentSubTab, setPaymentSubTab] = useState<"qris" | "bank">("qris");
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoadingBankAccounts, setIsLoadingBankAccounts] = useState<boolean>(false);
  const [qrisLabel, setQrisLabel] = useState<string>("QRIS Pawon Nusantara (BCA)");
  const [qrisImageUrl, setQrisImageUrl] = useState<string>("");
  const [qrisInstructions, setQrisInstructions] = useState<string>(
    "Arahkan layar tablet ini ke pelanggan untuk dipindai via BCA Mobile, GoPay, OVO, ShopeePay, atau DANA."
  );
  const [isSavingQris, setIsSavingQris] = useState<boolean>(false);
  const fileInputQrRef = useRef<HTMLInputElement>(null);

  const [bankAccountModal, setBankAccountModal] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    data?: BankAccount;
  }>({ isOpen: false, mode: "add" });

  const [bankAccountForm, setBankAccountForm] = useState<{
    bankName: string;
    customBankName: string;
    accountNumber: string;
    accountName: string;
    isDefault: boolean;
    isActive: boolean;
  }>({
    bankName: "BCA",
    customBankName: "",
    accountNumber: "",
    accountName: "",
    isDefault: false,
    isActive: true,
  });

  const POPULAR_BANKS = [
    "BCA",
    "Bank Mandiri",
    "BRI",
    "BNI",
    "BSI (Bank Syariah Indonesia)",
    "CIMB Niaga",
    "Bank Permata",
    "Bank Danamon",
    "Bank BTN",
    "Bank Jago",
    "SeaBank",
    "Bank Neo Commerce",
    "Lainnya...",
  ];

  // Customer Data State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [selectedCustomerTier, setSelectedCustomerTier] = useState("all");
  const [customerModal, setCustomerModal] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    data?: Customer;
  }>({ isOpen: false, mode: "add" });
  const [customerFormData, setCustomerFormData] = useState<{
    name: string;
    phone: string;
    email: string;
    tier: CustomerTier;
    points: number;
    notes: string;
    isActive: boolean;
  }>({
    name: "",
    phone: "",
    email: "",
    tier: "regular",
    points: 0,
    notes: "",
    isActive: true,
  });

  // Table QR Code Modals
  const [selectedQrTable, setSelectedQrTable] = useState<MasterTable | null>(null);
  const [isPrintAllQrOpen, setIsPrintAllQrOpen] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedArea, setSelectedArea] = useState("all");
  const [selectedPromoScope, setSelectedPromoScope] = useState("all");
  const [selectedProductPromoTarget, setSelectedProductPromoTarget] = useState("all");

  // Promo Modal & Form State
  const [promoModal, setPromoModal] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    data?: PromoDiscount;
  }>({ isOpen: false, mode: "add" });
  const [promoFormType, setPromoFormType] = useState<"percentage" | "fixed">("percentage");
  const [promoCustomerScope, setPromoCustomerScope] = useState<"all" | "member" | "gold" | "vip" | "personal">("all");
  const [promoAssignedCustomerId, setPromoAssignedCustomerId] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // WhatsApp Broadcast Modal State
  const [broadcastModal, setBroadcastModal] = useState<{
    isOpen: boolean;
    promo: PromoDiscount | null;
  }>({ isOpen: false, promo: null });

  // Sub-tab Promo: Voucher Transaksi vs Promo Produk
  const [promoSubTab, setPromoSubTab] = useState<"vouchers" | "product_promos">("vouchers");
  const [productPromos, setProductPromos] = useState<ProductPromo[]>([]);
  const [isLoadingProductPromos, setIsLoadingProductPromos] = useState(false);
  const [productPromoModal, setProductPromoModal] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    promoId?: string;
  }>({ isOpen: false, mode: "add" });
  const [productPromoForm, setProductPromoForm] = useState<{
    name: string;
    description: string;
    discountType: "percentage" | "fixed" | "special_price";
    discountValue: number;
    targetType: "all_products" | "category" | "specific_products";
    targetCategory: string;
    targetProductIds: string[];
    badgeLabel: string;
    timeStart: string;
    timeEnd: string;
    isActive: boolean;
  }>({
    name: "",
    description: "",
    discountType: "percentage",
    discountValue: 15,
    targetType: "specific_products",
    targetCategory: "",
    targetProductIds: [],
    badgeLabel: "",
    timeStart: "",
    timeEnd: "",
    isActive: true,
  });
  const [productSearchInPromoModal, setProductSearchInPromoModal] = useState("");
  const [broadcastMessageTemplate, setBroadcastMessageTemplate] = useState<string>("");
  const [broadcastAudienceScope, setBroadcastAudienceScope] = useState<string>("auto");
  const [broadcastSentIds, setBroadcastSentIds] = useState<string[]>([]);
  const [isCopiedBroadcastPhones, setIsCopiedBroadcastPhones] = useState(false);

  // Manual Modals
  const [productModal, setProductModal] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    data?: MasterProduct;
  }>({ isOpen: false, mode: "add" });

  // Product Preview Modal State
  const [previewProduct, setPreviewProduct] = useState<MasterProduct | null>(null);

  // Dynamic Categories State
  const [categoriesList, setCategoriesList] = useState<ProductCategory[]>(DEFAULT_SYSTEM_CATEGORIES);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  // Dynamic Table Areas State
  const [tableAreasList, setTableAreasList] = useState<TableAreaCategory[]>(DEFAULT_TABLE_AREAS);
  const [isLoadingAreas, setIsLoadingAreas] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaDesc, setNewAreaDesc] = useState("");
  const [isAddingArea, setIsAddingArea] = useState(false);

  // Dynamic Customer Tiers State
  const [customerTiersList, setCustomerTiersList] = useState<CustomerTierCategory[]>(DEFAULT_CUSTOMER_TIERS);
  const [isLoadingTiers, setIsLoadingTiers] = useState(false);
  const [newTierName, setNewTierName] = useState("");
  const [newTierDesc, setNewTierDesc] = useState("");
  const [newTierColor, setNewTierColor] = useState("emerald");
  const [isAddingTier, setIsAddingTier] = useState(false);

  // Edit Category Modal State (Product, Area, Member)
  const [editCategoryModal, setEditCategoryModal] = useState<{
    isOpen: boolean;
    type: "product" | "area" | "member";
    id: string;
    code?: string;
    name: string;
    description: string;
    badgeColor?: string;
  }>({
    isOpen: false,
    type: "product",
    id: "",
    name: "",
    description: "",
    badgeColor: "emerald",
  });

  const [productImage, setProductImage] = useState<string>("");
  const [productImageUrlInput, setProductImageUrlInput] = useState<string>("");
  const [imageError, setImageError] = useState<string>("");

  // Pilihan Tambahan / Pelengkap Produk
  const [productAddons, setProductAddons] = useState<ProductAddon[]>([]);
  const [newAddonName, setNewAddonName] = useState("");
  const [newAddonPrice, setNewAddonPrice] = useState<number>(5000);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setImageError("Ukuran file foto maksimal 5MB!");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const res = evt.target?.result as string;
      if (res) {
        setProductImage(res);
        setProductImageUrlInput("");
        setImageError("");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const [tableModal, setTableModal] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    data?: MasterTable;
  }>({ isOpen: false, mode: "add" });

  // Import Modal & Review Data State
  const [importModal, setImportModal] = useState<{
    isOpen: boolean;
    type: "products" | "tables";
    fileName: string;
    parsedRows: any[];
    validRows: any[];
    invalidRows: { rowNumber: number; reason: string; raw: any }[];
  }>({
    isOpen: false,
    type: "products",
    fileName: "",
    parsedRows: [],
    validRows: [],
    invalidRows: [],
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize master data with SQLite database
  const loadDataFromDb = async () => {
    try {
      const [prodRes, tblRes, promoRes, custRes, catRes, areaRes, tierRes, prodPromoRes] = await Promise.allSettled([
        fetch("/api/menu-items").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/tables").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/promos").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/customers").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/categories").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/table-areas").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/customer-tiers").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/product-promos").then((r) => (r.ok ? r.json() : null)),
      ]);

      if (prodRes.status === "fulfilled" && Array.isArray(prodRes.value) && prodRes.value.length > 0) {
        setProducts(prodRes.value);
      }
      if (tblRes.status === "fulfilled" && Array.isArray(tblRes.value) && tblRes.value.length > 0) {
        setTables(tblRes.value);
      }
      if (promoRes.status === "fulfilled" && Array.isArray(promoRes.value) && promoRes.value.length > 0) {
        setPromos(promoRes.value);
      }
      if (prodPromoRes.status === "fulfilled" && Array.isArray(prodPromoRes.value)) {
        setProductPromos(prodPromoRes.value);
      }
      if (custRes.status === "fulfilled" && Array.isArray(custRes.value) && custRes.value.length > 0) {
        setCustomers(custRes.value);
      }
      if (catRes.status === "fulfilled" && Array.isArray(catRes.value) && catRes.value.length > 0) {
        setCategoriesList(catRes.value);
      }
      if (areaRes.status === "fulfilled" && Array.isArray(areaRes.value) && areaRes.value.length > 0) {
        setTableAreasList(areaRes.value);
      }
      if (tierRes.status === "fulfilled" && Array.isArray(tierRes.value) && tierRes.value.length > 0) {
        setCustomerTiersList(tierRes.value);
      }
    } catch (err) {
      console.log("Error loading master data from db:", err);
    }
  };

  const fetchCategories = async () => {
    try {
      setIsLoadingCategories(true);
      const res = await fetch("/api/categories");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCategoriesList(data);
        }
      }
    } catch (err) {
      console.error("Gagal load kategori:", err);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const fetchTableAreas = async () => {
    try {
      setIsLoadingAreas(true);
      const res = await fetch("/api/table-areas");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setTableAreasList(data);
        }
      }
    } catch (err) {
      console.error("Gagal load area meja:", err);
    } finally {
      setIsLoadingAreas(false);
    }
  };

  const fetchCustomerTiers = async () => {
    try {
      setIsLoadingTiers(true);
      const res = await fetch("/api/customer-tiers");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCustomerTiersList(data);
        }
      }
    } catch (err) {
      console.error("Gagal load kategori member:", err);
    } finally {
      setIsLoadingTiers(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      setIsLoadingCustomers(true);
      const res = await fetch("/api/customers");
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error("Gagal load data pelanggan:", err);
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const handleToggleCustomerActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch("/api/customers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !currentStatus }),
      });
      if (res.ok) {
        setCustomers((prev) =>
          prev.map((c) => (c.id === id ? { ...c, isActive: !currentStatus } : c))
        );
      }
    } catch (err) {
      console.error("Gagal update status pelanggan:", err);
    }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus data pelanggan "${name}"?`)) return;
    try {
      const res = await fetch(`/api/customers?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setCustomers((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (err) {
      console.error("Gagal menghapus pelanggan:", err);
    }
  };

  const handleSaveCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!customerFormData.name.trim() || !customerFormData.phone.trim()) {
      alert("Nama dan nomor telepon pelanggan wajib diisi!");
      return;
    }

    try {
      if (customerModal.mode === "add") {
        const res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(customerFormData),
        });
        const result = await res.json();
        if (!res.ok) {
          alert(result.error || "Gagal menambah pelanggan");
          return;
        }
        setCustomers((prev) => [result, ...prev]);
      } else if (customerModal.mode === "edit" && customerModal.data) {
        const res = await fetch("/api/customers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: customerModal.data.id,
            ...customerFormData,
          }),
        });
        const result = await res.json();
        if (!res.ok) {
          alert(result.error || "Gagal mengupdate pelanggan");
          return;
        }
        setCustomers((prev) =>
          prev.map((c) => (c.id === customerModal.data!.id ? result : c))
        );
      }
      setCustomerModal({ isOpen: false, mode: "add" });
    } catch (err) {
      console.error("Gagal menyimpan data pelanggan:", err);
      alert("Terjadi kesalahan saat menyimpan data pelanggan.");
    }
  };

  const fetchPromos = async () => {
    try {
      setIsLoadingPromos(true);
      const res = await fetch("/api/promos");
      if (res.ok) {
        const data = await res.json();
        setPromos(data);
      }
    } catch (err) {
      console.error("Gagal load data promo:", err);
    } finally {
      setIsLoadingPromos(false);
    }
  };

  const fetchProductPromos = async () => {
    try {
      setIsLoadingProductPromos(true);
      const res = await fetch("/api/product-promos");
      if (res.ok) {
        const data = await res.json();
        setProductPromos(data);
      }
    } catch (err) {
      console.error("Gagal load data promo produk:", err);
    } finally {
      setIsLoadingProductPromos(false);
    }
  };

  const handleToggleProductPromoActive = async (promo: ProductPromo) => {
    try {
      const res = await fetch("/api/product-promos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: promo.id, isActive: !promo.isActive }),
      });
      if (res.ok) {
        setProductPromos((prev) =>
          prev.map((p) => (p.id === promo.id ? { ...p, isActive: !p.isActive } : p))
        );
      }
    } catch (err) {
      console.error("Gagal update status promo produk:", err);
    }
  };

  const handleDeleteProductPromo = async (id: string, name: string) => {
    if (!confirm(`Hapus kampanye promo produk "${name}"? Menu yang terhubung akan kembali ke harga normal.`)) return;
    try {
      const res = await fetch(`/api/product-promos?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setProductPromos((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (err) {
      console.error("Gagal menghapus promo produk:", err);
    }
  };

  const handleOpenAddProductPromo = () => {
    setProductPromoForm({
      name: "",
      description: "",
      discountType: "percentage",
      discountValue: 20,
      targetType: "specific_products",
      targetCategory: categoriesList[0]?.name || "",
      targetProductIds: [],
      badgeLabel: "",
      timeStart: "",
      timeEnd: "",
      isActive: true,
    });
    setProductSearchInPromoModal("");
    setProductPromoModal({ isOpen: true, mode: "add" });
  };

  const handleOpenEditProductPromo = (promo: ProductPromo) => {
    setProductPromoForm({
      name: promo.name,
      description: promo.description || "",
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      targetType: promo.targetType,
      targetCategory: promo.targetCategory || "",
      targetProductIds: promo.targetProductIds || [],
      badgeLabel: promo.badgeLabel || "",
      timeStart: promo.timeStart || "",
      timeEnd: promo.timeEnd || "",
      isActive: promo.isActive,
    });
    setProductSearchInPromoModal("");
    setProductPromoModal({ isOpen: true, mode: "edit", promoId: promo.id });
  };

  const handleSaveProductPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productPromoForm.name.trim()) {
      alert("Nama promo produk wajib diisi!");
      return;
    }
    if (!productPromoForm.discountValue || productPromoForm.discountValue <= 0) {
      alert("Nilai diskon atau harga spesial harus lebih besar dari 0!");
      return;
    }
    if (productPromoForm.targetType === "category" && !productPromoForm.targetCategory) {
      alert("Pilih kategori target untuk promo ini!");
      return;
    }
    if (
      productPromoForm.targetType === "specific_products" &&
      productPromoForm.targetProductIds.length === 0
    ) {
      alert("Pilih minimal 1 menu produk untuk promo ini!");
      return;
    }

    try {
      const isEdit = productPromoModal.mode === "edit" && productPromoModal.promoId;
      const res = await fetch("/api/product-promos", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: productPromoModal.promoId,
          ...productPromoForm,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || "Gagal menyimpan promo produk");
        return;
      }

      await fetchProductPromos();
      setProductPromoModal({ isOpen: false, mode: "add" });
    } catch (err) {
      console.error("Error saving product promo:", err);
      alert("Terjadi kesalahan saat menyimpan promo produk.");
    }
  };

  const handleTogglePromoActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch("/api/promos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !currentStatus }),
      });
      if (res.ok) {
        setPromos((prev) =>
          prev.map((p) => (p.id === id ? { ...p, isActive: !currentStatus } : p))
        );
      }
    } catch (err) {
      console.error("Gagal update status promo:", err);
    }
  };

  const handleDeletePromo = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus promo "${name}"?`)) return;
    try {
      const res = await fetch(`/api/promos?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setPromos((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (err) {
      console.error("Gagal menghapus promo:", err);
    }
  };

  const handleOpenBroadcastModal = (promo: PromoDiscount) => {
    const diskonLabel =
      promo.discountType === "percentage"
        ? `${promo.discountValue}% OFF`
        : `${formatCurrency(promo.discountValue)} OFF`;
    const minOrderText =
      promo.minOrderAmount && promo.minOrderAmount > 0
        ? `Minimal belanja ${formatCurrency(promo.minOrderAmount)}`
        : "Tanpa minimal belanja";

    const defaultMsg = `Halo Kak {nama}! 🎉\n\nAda promo spesial dari ${settings.restaurantName || "Pawon Nusantara"} khusus untuk Anda:\n\n🎟️ *KODE PROMO: ${promo.code}*\n🎁 *DISKON: ${diskonLabel}*\n📌 *Syarat:* ${minOrderText}\n\nTunjukkan pesan ini atau sebutkan kode promo kepada kasir saat memesan ya Kak. Ditunggu kunjungannya! 😊🍽️`;

    setBroadcastMessageTemplate(defaultMsg);
    setBroadcastAudienceScope("auto");
    setBroadcastSentIds([]);
    setIsCopiedBroadcastPhones(false);
    setBroadcastModal({ isOpen: true, promo });
  };

  const handleSavePromo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const code = (formData.get("code") as string)?.trim().toUpperCase();
    const name = (formData.get("name") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();
    const discountType = promoFormType;
    const discountValue = Number(formData.get("discountValue")) || 0;
    const minOrderAmount = Number(formData.get("minOrderAmount")) || 0;
    const maxDiscountRaw = formData.get("maxDiscount") as string;
    const maxDiscount = maxDiscountRaw ? Number(maxDiscountRaw) : null;
    const scope = (formData.get("scope") as string) || "all";
    const isActive = formData.get("isActive") === "on";
    const customerScope = promoCustomerScope;
    const assignedCustomerId = promoCustomerScope === "personal" ? (promoAssignedCustomerId || null) : null;

    if (!code || !name) {
      alert("Kode promo dan nama promo wajib diisi!");
      return;
    }
    if (discountValue <= 0) {
      alert("Nilai diskon harus lebih besar dari 0!");
      return;
    }

    try {
      if (promoModal.mode === "add") {
        const res = await fetch("/api/promos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            name,
            description,
            discountType,
            discountValue,
            minOrderAmount,
            maxDiscount,
            scope,
            customerScope,
            assignedCustomerId,
            isActive,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Gagal membuat promo");
          return;
        }
        setPromos((prev) => [data, ...prev]);
      } else if (promoModal.mode === "edit" && promoModal.data) {
        const res = await fetch("/api/promos", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: promoModal.data.id,
            code,
            name,
            description,
            discountType,
            discountValue,
            minOrderAmount,
            maxDiscount,
            scope,
            customerScope,
            assignedCustomerId,
            isActive,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Gagal update promo");
          return;
        }
        setPromos((prev) => prev.map((p) => (p.id === data.id ? data : p)));
      }
      setPromoModal({ isOpen: false, mode: "add" });
    } catch (err: any) {
      alert(err.message || "Gagal menyimpan promo");
    }
  };

  useEffect(() => {
    loadDataFromDb();
    fetchCategories();
    fetchTableAreas();
    fetchCustomerTiers();
    fetchBankAccounts();
  }, []);

  useEffect(() => {
    if (settings) {
      if (settings.staticQrLabel) setQrisLabel(settings.staticQrLabel);
      if (settings.staticQrImageUrl !== undefined) setQrisImageUrl(settings.staticQrImageUrl || "");
      if (settings.staticQrInstructions) setQrisInstructions(settings.staticQrInstructions);
      if (settings.bankAccounts && settings.bankAccounts.length > 0) {
        setBankAccounts(settings.bankAccounts);
      }
    }
  }, [settings]);

  const fetchBankAccounts = async () => {
    setIsLoadingBankAccounts(true);
    try {
      const res = await fetch("/api/bank-accounts");
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setBankAccounts(data);
        updateSettings({ bankAccounts: data });
      }
    } catch (e) {
      console.error("Failed to fetch bank accounts:", e);
    } finally {
      setIsLoadingBankAccounts(false);
    }
  };

  const handleOpenAddBankAccount = () => {
    setBankAccountForm({
      bankName: "BCA",
      customBankName: "",
      accountNumber: "",
      accountName: "",
      isDefault: bankAccounts.length === 0,
      isActive: true,
    });
    setBankAccountModal({ isOpen: true, mode: "add" });
  };

  const handleOpenEditBankAccount = (acc: BankAccount) => {
    const isStandardBank = POPULAR_BANKS.includes(acc.bankName);
    setBankAccountForm({
      bankName: isStandardBank ? acc.bankName : "Lainnya...",
      customBankName: isStandardBank ? "" : acc.bankName,
      accountNumber: acc.accountNumber,
      accountName: acc.accountName,
      isDefault: Boolean(acc.isDefault),
      isActive: acc.isActive !== false,
    });
    setBankAccountModal({ isOpen: true, mode: "edit", data: acc });
  };

  const handleSaveBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalBankName =
      bankAccountForm.bankName === "Lainnya..."
        ? bankAccountForm.customBankName.trim()
        : bankAccountForm.bankName.trim();

    if (!finalBankName || !bankAccountForm.accountNumber.trim() || !bankAccountForm.accountName.trim()) {
      alert("Nama bank, nomor rekening, dan nama pemilik rekening wajib diisi.");
      return;
    }

    try {
      if (bankAccountModal.mode === "add") {
        const res = await fetch("/api/bank-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bankName: finalBankName,
            accountNumber: bankAccountForm.accountNumber.trim(),
            accountName: bankAccountForm.accountName.trim(),
            isDefault: bankAccountForm.isDefault,
            isActive: bankAccountForm.isActive,
          }),
        });
        const created = await res.json();
        if (created && created.id) {
          let updatedList = [...bankAccounts];
          if (bankAccountForm.isDefault) {
            updatedList = updatedList.map((a) => ({ ...a, isDefault: false }));
          }
          updatedList.push(created);
          setBankAccounts(updatedList);
          updateSettings({ bankAccounts: updatedList });
        }
      } else if (bankAccountModal.mode === "edit" && bankAccountModal.data) {
        const res = await fetch("/api/bank-accounts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: bankAccountModal.data.id,
            bankName: finalBankName,
            accountNumber: bankAccountForm.accountNumber.trim(),
            accountName: bankAccountForm.accountName.trim(),
            isDefault: bankAccountForm.isDefault,
            isActive: bankAccountForm.isActive,
          }),
        });
        const updated = await res.json();
        if (updated && updated.id) {
          let updatedList = bankAccounts.map((a) => {
            if (a.id === updated.id) return updated;
            if (bankAccountForm.isDefault) return { ...a, isDefault: false };
            return a;
          });
          setBankAccounts(updatedList);
          updateSettings({ bankAccounts: updatedList });
        }
      }
      setBankAccountModal({ isOpen: false, mode: "add" });
    } catch (err) {
      console.error("Error saving bank account:", err);
      alert("Terjadi kesalahan saat menyimpan data rekening.");
    }
  };

  const handleDeleteBankAccount = async (id: string, name: string) => {
    if (bankAccounts.length <= 1) {
      alert("Minimal harus ada 1 nomor rekening bank tersimpan.");
      return;
    }
    if (!confirm(`Apakah Anda yakin ingin menghapus rekening "${name}"?`)) return;

    try {
      await fetch(`/api/bank-accounts?id=${id}`, { method: "DELETE" });
      const filtered = bankAccounts.filter((a) => a.id !== id);
      if (filtered.length > 0 && !filtered.some((a) => a.isDefault)) {
        filtered[0].isDefault = true;
      }
      setBankAccounts(filtered);
      updateSettings({ bankAccounts: filtered });
    } catch (e) {
      console.error("Error deleting bank account:", e);
    }
  };

  const handleSetDefaultBankAccount = async (acc: BankAccount) => {
    try {
      await fetch("/api/bank-accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: acc.id, isDefault: true }),
      });
      const updated = bankAccounts.map((a) => ({
        ...a,
        isDefault: a.id === acc.id,
      }));
      setBankAccounts(updated);
      updateSettings({ bankAccounts: updated });
    } catch (e) {
      console.error("Error setting default bank account:", e);
    }
  };

  const handleToggleBankAccountActive = async (acc: BankAccount) => {
    const nextActive = !acc.isActive;
    try {
      await fetch("/api/bank-accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: acc.id, isActive: nextActive }),
      });
      const updated = bankAccounts.map((a) =>
        a.id === acc.id ? { ...a, isActive: nextActive } : a
      );
      setBankAccounts(updated);
      updateSettings({ bankAccounts: updated });
    } catch (e) {
      console.error("Error toggling bank account active:", e);
    }
  };

  const handleSaveQrisSettings = async () => {
    setIsSavingQris(true);
    try {
      await updateSettings({
        staticQrImageUrl: qrisImageUrl,
        staticQrLabel: qrisLabel,
        staticQrInstructions: qrisInstructions,
      });
      alert("Pengaturan QRIS berhasil disimpan dan akan langsung aktif pada pop-up konfirmasi pembayaran kasir!");
    } catch (e) {
      console.error("Failed to save QRIS settings:", e);
      alert("Gagal menyimpan pengaturan QRIS.");
    } finally {
      setIsSavingQris(false);
    }
  };

  const handleQrFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("File yang dipilih harus berupa file gambar (PNG, JPG, JPEG, WEBP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Ukuran file gambar maksimal 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setQrisImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (activeTab === "products" || activeTab === "categories") {
      fetchCategories();
      fetchTableAreas();
      fetchCustomerTiers();
    }
    if (activeTab === "promos") {
      fetchPromos();
      fetchProductPromos();
    }
  }, [activeTab]);

  // Categories list dynamically derived from categoriesList and products
  const categories = useMemo(() => {
    const set = new Set<string>();
    categoriesList.forEach((c) => {
      if (c.name) set.add(c.name);
    });
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    if (set.size === 0) {
      DEFAULT_SYSTEM_CATEGORIES.forEach((c) => set.add(c.name));
    }
    return ["all", ...Array.from(set)];
  }, [categoriesList, products]);

  const handleCreateCategory = async (name: string, description?: string) => {
    if (!name.trim()) {
      alert("Nama kategori tidak boleh kosong!");
      return;
    }
    setIsAddingCategory(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description?.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal menambah kategori");
        return;
      }
      setCategoriesList((prev) => {
        const exists = prev.some((c) => c.id === data.id || c.name.toLowerCase() === data.name.toLowerCase());
        return exists ? prev : [...prev, data];
      });
      setNewCategoryName("");
      setNewCategoryDesc("");
      fetchCategories();
    } catch (err: any) {
      alert(err.message || "Gagal membuat kategori baru");
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleDeleteCategory = async (cat: ProductCategory) => {
    if (categoriesList.length <= 1) {
      alert("Minimal harus ada 1 kategori di restoran. Anda tidak dapat menghapus kategori terakhir.");
      return;
    }

    const count =
      products.filter((p) => p.category?.toLowerCase() === cat.name.toLowerCase()).length ||
      cat.productCount ||
      0;
    let confirmMsg = `Hapus kategori "${cat.name}"?`;
    if (count > 0) {
      confirmMsg = `Kategori "${cat.name}" saat ini digunakan oleh ${count} menu. Jika dihapus, menu-menu tersebut akan otomatis dialihkan ke kategori lain agar tidak terhapus. Lanjutkan hapus kategori ini?`;
    }

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/categories?id=${encodeURIComponent(cat.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal menghapus kategori");
        return;
      }
      // Reload categories & products to reflect reassignment
      await Promise.all([fetchCategories(), loadDataFromDb()]);
    } catch (err: any) {
      alert(err.message || "Gagal menghapus kategori");
    }
  };

  // ==================== AREA / ZONA MEJA HANDLERS ====================
  const handleCreateArea = async (name: string, description?: string) => {
    if (!name.trim()) {
      alert("Nama area/zona meja tidak boleh kosong!");
      return;
    }
    setIsAddingArea(true);
    try {
      const res = await fetch("/api/table-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description?.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal menambah area meja");
        return;
      }
      setNewAreaName("");
      setNewAreaDesc("");
      await fetchTableAreas();
    } catch (err: any) {
      alert(err.message || "Gagal membuat area baru");
    } finally {
      setIsAddingArea(false);
    }
  };

  const handleDeleteArea = async (area: TableAreaCategory) => {
    if (tableAreasList.length <= 1) {
      alert("Minimal harus ada 1 area meja di restoran.");
      return;
    }
    const count = tables.filter((t) => t.area?.toLowerCase() === area.code.toLowerCase()).length || area.tableCount || 0;
    let msg = `Hapus kategori area "${area.name}"?`;
    if (count > 0) {
      msg = `Kategori area "${area.name}" saat ini digunakan oleh ${count} meja. Jika dihapus, meja-meja tersebut akan otomatis dialihkan ke area lain secara aman. Lanjutkan?`;
    }
    if (!confirm(msg)) return;

    try {
      const res = await fetch(`/api/table-areas?id=${encodeURIComponent(area.id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal menghapus area meja");
        return;
      }
      await Promise.all([fetchTableAreas(), loadDataFromDb()]);
    } catch (err: any) {
      alert(err.message || "Gagal menghapus area");
    }
  };

  // ==================== CUSTOMER TIER HANDLERS ====================
  const handleCreateTier = async (name: string, description?: string, badgeColor: string = "emerald") => {
    if (!name.trim()) {
      alert("Nama kategori member tidak boleh kosong!");
      return;
    }
    setIsAddingTier(true);
    try {
      const res = await fetch("/api/customer-tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description?.trim(), badgeColor }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal menambah kategori member");
        return;
      }
      setNewTierName("");
      setNewTierDesc("");
      await fetchCustomerTiers();
    } catch (err: any) {
      alert(err.message || "Gagal membuat kategori member baru");
    } finally {
      setIsAddingTier(false);
    }
  };

  const handleDeleteTier = async (tier: CustomerTierCategory) => {
    if (customerTiersList.length <= 1) {
      alert("Minimal harus ada 1 kategori member di restoran.");
      return;
    }
    const count = customers.filter((c) => c.tier?.toLowerCase() === tier.code.toLowerCase()).length || tier.customerCount || 0;
    let msg = `Hapus kategori member "${tier.name}"?`;
    if (count > 0) {
      msg = `Kategori member "${tier.name}" saat ini digunakan oleh ${count} pelanggan. Jika dihapus, pelanggan-pelanggan tersebut akan otomatis dialihkan ke kategori member lain secara aman. Lanjutkan?`;
    }
    if (!confirm(msg)) return;

    try {
      const res = await fetch(`/api/customer-tiers?id=${encodeURIComponent(tier.id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal menghapus kategori member");
        return;
      }
      await Promise.all([fetchCustomerTiers(), loadDataFromDb()]);
    } catch (err: any) {
      alert(err.message || "Gagal menghapus kategori member");
    }
  };

  // ==================== SAVE EDIT CATEGORY MODAL (PRODUCT, AREA, MEMBER) ====================
  const handleSaveEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCategoryModal.name.trim()) {
      alert("Nama kategori tidak boleh kosong!");
      return;
    }

    try {
      if (editCategoryModal.type === "product") {
        const res = await fetch("/api/categories", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editCategoryModal.id,
            name: editCategoryModal.name.trim(),
            description: editCategoryModal.description?.trim() || "",
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          alert(err.error || "Gagal update kategori produk");
          return;
        }
        await Promise.all([fetchCategories(), loadDataFromDb()]);
      } else if (editCategoryModal.type === "area") {
        const res = await fetch("/api/table-areas", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editCategoryModal.id,
            name: editCategoryModal.name.trim(),
            description: editCategoryModal.description?.trim() || "",
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          alert(err.error || "Gagal update area meja");
          return;
        }
        await Promise.all([fetchTableAreas(), loadDataFromDb()]);
      } else {
        const res = await fetch("/api/customer-tiers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editCategoryModal.id,
            name: editCategoryModal.name.trim(),
            description: editCategoryModal.description?.trim() || "",
            badgeColor: editCategoryModal.badgeColor || "emerald",
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          alert(err.error || "Gagal update kategori member");
          return;
        }
        await Promise.all([fetchCustomerTiers(), loadDataFromDb()]);
      }

      setEditCategoryModal({ ...editCategoryModal, isOpen: false });
    } catch (err: any) {
      alert(err.message || "Gagal menyimpan perubahan kategori");
    }
  };

  // ==================== TEMPLATE DOWNLOAD ====================
  const handleDownloadTemplate = (type: "products" | "tables") => {
    if (type === "products") {
      const templateData = [
        {
          kode_produk: "PRD-101",
          nama_produk: "Ayam Goreng Lengkuas",
          kategori: "Makanan Utama",
          harga: 38000,
          deskripsi: "Ayam kampung goreng tabur lengkuas gurih",
          status_tersedia: "YA",
          url_gambar: "", // Opsional (Bisa dikosongkan & dilengkapi menyusul saat edit produk di sistem)
        },
        {
          kode_produk: "PRD-102",
          nama_produk: "Jus Alpukat Kocok",
          kategori: "Minuman",
          harga: 22000,
          deskripsi: "Alpukat mentega dengan susu cokelat kental",
          status_tersedia: "YA",
          url_gambar: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=300",
        },
      ];
      const worksheet = XLSX.utils.json_to_sheet(templateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Template Produk");
      XLSX.writeFile(workbook, "template_import_katalog_produk.xlsx");
    } else {
      const templateData = [
        {
          nomor_meja: "Meja 21",
          nama_tampilan: "Meja 21",
          area: "indoor",
          kapasitas_pax: 4,
          status: "tersedia",
        },
        {
          nomor_meja: "Meja 22",
          nama_tampilan: "Meja 22",
          area: "outdoor",
          kapasitas_pax: 6,
          status: "tersedia",
        },
      ];
      const worksheet = XLSX.utils.json_to_sheet(templateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Template Meja");
      XLSX.writeFile(workbook, "template_import_data_meja.xlsx");
    }
  };

  // ==================== FILE IMPORT PARSER ====================
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (activeTab === "products") {
          validateAndPreviewProducts(file.name, jsonData);
        } else {
          validateAndPreviewTables(file.name, jsonData);
        }
      } catch (err) {
        alert("Gagal membaca file Excel/CSV! Pastikan format file sesuai.");
      }
    };
    reader.readAsBinaryString(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validateAndPreviewProducts = (fileName: string, rawRows: any[]) => {
    const valid: any[] = [];
    const invalid: any[] = [];

    rawRows.forEach((row, index) => {
      const rowNum = index + 2; // header is row 1
      const name = String(row.nama_produk || row.Nama || row.name || "").trim();
      const category = String(row.kategori || row.Kategori || row.category || "Makanan Utama").trim();
      const priceRaw = row.harga ?? row.Harga ?? row.price;
      const price = Number(priceRaw);
      const desc = String(row.deskripsi || row.Deskripsi || row.description || "").trim();
      const code = String(row.kode_produk || row.Kode || row.code || `PRD-${Date.now()}-${index}`).trim();
      const availRaw = String(row.status_tersedia || row.status || "YA").toUpperCase();
      const isAvailable = availRaw === "YA" || availRaw === "TRUE" || availRaw === "1" || availRaw === "TERSEDIA";
      // Foto produk: TIDAK MANDATORI pada import excel (bisa di-input menyusul di sistem saat edit produk)
      const imageUrl = String(row.url_gambar || row.foto || row.gambar || row.image || row.imageUrl || "").trim();

      const errors: string[] = [];
      if (!name) errors.push("Nama produk wajib diisi");
      if (isNaN(price) || price <= 0) errors.push("Harga harus berupa angka positif");

      if (errors.length > 0) {
        invalid.push({
          rowNumber: rowNum,
          reason: errors.join(", "),
          raw: row,
        });
      } else {
        valid.push({
          id: `prod-imp-${Date.now()}-${index}`,
          code,
          name,
          category: category || "Umum",
          price,
          description: desc,
          isAvailable,
          imageUrl: imageUrl || undefined,
          image: imageUrl || undefined,
        });
      }
    });

    setImportModal({
      isOpen: true,
      type: "products",
      fileName,
      parsedRows: rawRows,
      validRows: valid,
      invalidRows: invalid,
    });
  };

  const validateAndPreviewTables = (fileName: string, rawRows: any[]) => {
    const valid: any[] = [];
    const invalid: any[] = [];

    rawRows.forEach((row, index) => {
      const rowNum = index + 2;
      const tableNumber = String(row.nomor_meja || row.meja || row.Table || "").trim();
      const displayName = String(row.nama_tampilan || row.display || tableNumber).trim();
      const areaRaw = String(row.area || row.lokasi || "indoor").toLowerCase().trim();
      const capacityRaw = row.kapasitas_pax ?? row.kapasitas ?? row.pax ?? row.capacity;
      const capacity = Number(capacityRaw);

      const area = (["indoor", "outdoor", "vip", "smoking"].includes(areaRaw) ? areaRaw : "indoor") as any;

      const errors: string[] = [];
      if (!tableNumber) errors.push("Nomor meja wajib diisi");
      if (isNaN(capacity) || capacity <= 0) errors.push("Kapasitas harus berupa angka positif (min. 1 pax)");

      if (errors.length > 0) {
        invalid.push({
          rowNumber: rowNum,
          reason: errors.join(", "),
          raw: row,
        });
      } else {
        valid.push({
          id: `tbl-imp-${Date.now()}-${index}`,
          tableNumber,
          displayName,
          area,
          capacity,
          status: "tersedia",
        });
      }
    });

    setImportModal({
      isOpen: true,
      type: "tables",
      fileName,
      parsedRows: rawRows,
      validRows: valid,
      invalidRows: invalid,
    });
  };

  const handleConfirmImport = async () => {
    if (importModal.type === "products") {
      setProducts((prev) => [...prev, ...importModal.validRows]);
      try {
        await fetch("/api/menu-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: importModal.validRows }),
        });
      } catch (err) {
        console.error("Failed to import products to database:", err);
      }
    } else {
      setTables((prev) => [...prev, ...importModal.validRows]);
      try {
        await fetch("/api/tables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "import", tables: importModal.validRows }),
        });
      } catch (err) {
        console.error("Failed to import tables to database:", err);
      }
    }
    alert(
      `Sukses! Berhasil mengimpor ${importModal.validRows.length} data ${
        importModal.type === "products" ? "katalog produk" : "meja"
      } ke database.`
    );
    setImportModal({ ...importModal, isOpen: false });
    loadDataFromDb();
  };

  // ==================== MANUAL HANDLERS ====================
  const handleSaveProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get("name") as string;
    const code = fd.get("code") as string;
    const category = fd.get("category") as string;
    const price = Number(fd.get("price"));
    const description = fd.get("description") as string;
    const isAvailable = fd.get("isAvailable") === "on";

    // Validasi Foto Produk:
    if (productModal.mode === "add" && !productImage.trim()) {
      setImageError("Foto produk wajib diunggah untuk penambahan produk manual!");
      return;
    }

    if (productModal.mode === "add") {
      const newP: MasterProduct = {
        id: `prod-${Date.now()}`,
        code: code || `PRD-${products.length + 1}`,
        name,
        category,
        price,
        description,
        isAvailable,
        imageUrl: productImage.trim() || undefined,
        image: productImage.trim() || undefined,
        addons: productAddons,
      };
      setProducts((prev) => [newP, ...prev]);

      try {
        await fetch("/api/menu-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newP),
        });
        loadDataFromDb();
      } catch (err) {
        console.error("Failed to save product to database:", err);
      }
    } else if (productModal.data) {
      const updatedP = {
        id: productModal.data.id,
        name,
        code,
        category,
        price,
        description,
        isAvailable,
        imageUrl: productImage.trim() || productModal.data.imageUrl || undefined,
        image: productImage.trim() || productModal.data.image || undefined,
        addons: productAddons,
      };

      setProducts((prev) =>
        prev.map((p) =>
          p.id === productModal.data?.id
            ? { ...p, ...updatedP }
            : p
        )
      );

      try {
        await fetch("/api/menu-items", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedP),
        });
        loadDataFromDb();
      } catch (err) {
        console.error("Failed to update product in database:", err);
      }
    }
    setProductModal({ isOpen: false, mode: "add" });
    setProductImage("");
    setProductImageUrlInput("");
    setImageError("");
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus produk ini dari katalog?")) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      try {
        await fetch(`/api/menu-items?id=${id}`, { method: "DELETE" });
        loadDataFromDb();
      } catch (err) {
        console.error("Failed to delete product from database:", err);
      }
    }
  };

  const handleSaveTable = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const tableNumber = fd.get("tableNumber") as string;
    const displayName = fd.get("displayName") as string;
    const area = fd.get("area") as any;
    const capacity = Number(fd.get("capacity"));
    const status = (fd.get("status") || "tersedia") as any;

    if (tableModal.mode === "add") {
      const newT: MasterTable = {
        id: `tbl-${Date.now()}`,
        tableNumber,
        displayName: displayName || tableNumber,
        area,
        capacity,
        status,
      };
      setTables((prev) => [...prev, newT]);

      try {
        await fetch("/api/tables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            tableNumber,
            displayName: displayName || tableNumber,
            area,
            capacity,
            status,
          }),
        });
        loadDataFromDb();
      } catch (err) {
        console.error("Failed to create table in database:", err);
      }
    } else if (tableModal.data) {
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableModal.data?.id
            ? { ...t, tableNumber, displayName: displayName || tableNumber, area, capacity, status }
            : t
        )
      );

      try {
        await fetch("/api/tables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            id: tableModal.data.id,
            tableNumber,
            displayName: displayName || tableNumber,
            area,
            capacity,
            status,
          }),
        });
        loadDataFromDb();
      } catch (err) {
        console.error("Failed to update table in database:", err);
      }
    }
    setTableModal({ isOpen: false, mode: "add" });
  };

  const handleDeleteTable = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus data meja ini?")) {
      setTables((prev) => prev.filter((t) => t.id !== id));
      try {
        await fetch(`/api/tables?id=${id}`, { method: "DELETE" });
        loadDataFromDb();
      } catch (err) {
        console.error("Failed to delete table from database:", err);
      }
    }
  };

  // Filtered lists
  const filteredProducts = products.filter((p) => {
    if (selectedCategory !== "all" && p.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q));
    }
    return true;
  });

  const filteredTables = tables.filter((t) => {
    if (selectedArea !== "all" && t.area !== selectedArea) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return t.tableNumber.toLowerCase().includes(q) || t.displayName.toLowerCase().includes(q);
    }
    return true;
  });

  const filteredPromos = promos.filter((p) => {
    if (selectedPromoScope !== "all") {
      if (selectedPromoScope === "dine_in" && p.scope !== "dine_in") return false;
      if (selectedPromoScope === "takeaway" && p.scope !== "takeaway") return false;
      if (selectedPromoScope === "vip" && p.customerScope !== "vip") return false;
      if (selectedPromoScope === "gold" && p.customerScope !== "gold") return false;
      if (selectedPromoScope === "member" && p.customerScope !== "member") return false;
      if (selectedPromoScope === "personal" && p.customerScope !== "personal") return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.assignedCustomerName && p.assignedCustomerName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const filteredProductPromos = productPromos.filter((p) => {
    if (selectedProductPromoTarget !== "all" && p.targetType !== selectedProductPromoTarget) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.targetCategory && p.targetCategory.toLowerCase().includes(q)) ||
        (p.badgeLabel && p.badgeLabel.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const promoProductsCount = useMemo(() => {
    return products.filter((prod) => {
      const calc = calculateProductPromoPrice(prod, productPromos);
      return calc.isPromo;
    }).length;
  }, [products, productPromos]);

  const filteredCustomers = customers.filter((c) => {
    if (selectedCustomerTier !== "all" && c.tier !== selectedCustomerTier) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="w-full min-h-screen bg-surface px-6 py-8">
      {/* Hidden File Input for Excel Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Header Title & Subtabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-container-high pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">database</span>
            <h1 className="font-headline-sm text-2xl font-bold text-on-surface">
              Master Data Restoran
            </h1>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Kelola katalog produk menu, denah meja, promo &amp; diskon, serta database pelanggan &amp; member restoran.
          </p>
        </div>

        {/* Action Buttons: Print All QR, Import & Download Template, Add Item */}
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === "tables" && (
            <button
              onClick={() => setIsPrintAllQrOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#003629] hover:bg-[#1a4a3e] active:scale-95 text-white text-xs font-bold transition-all cursor-pointer shadow-xs border border-[#003629]"
              title="Cetak seluruh QR Code meja sekaligus untuk standing akrilik / tent card meja"
            >
              <span className="material-symbols-outlined text-base text-amber-300">print</span>
              <span>Cetak Semua QR Meja</span>
            </button>
          )}

          {activeTab !== "promos" && activeTab !== "customers" && activeTab !== "categories" && activeTab !== "payments" && (
            <>
              <button
                onClick={() => handleDownloadTemplate(activeTab as "products" | "tables")}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold transition-all border border-outline-variant/40 cursor-pointer shadow-xs"
                title="Download template Excel terstandarisasi untuk import data"
              >
                <span className="material-symbols-outlined text-base text-primary">download</span>
                <span>Download Template ({activeTab === "products" ? "Produk" : "Meja"})</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary text-on-secondary hover:bg-secondary/90 text-xs font-bold transition-all cursor-pointer shadow-xs"
                title="Unggah file Excel / CSV untuk import data massal"
              >
                <span className="material-symbols-outlined text-base">upload_file</span>
                <span>Import Excel / CSV</span>
              </button>

              {activeTab === "products" && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("categories");
                    setCategorySubTab("product");
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold transition-all border border-outline-variant/40 cursor-pointer shadow-xs"
                  title="Buka Tab Menu Kelola Kategori Produk"
                >
                  <span className="material-symbols-outlined text-base text-primary">category</span>
                  <span>Kelola Kategori ({categoriesList.length})</span>
                </button>
              )}
            </>
          )}

          {activeTab !== "categories" && activeTab !== "payments" ? (
            <button
              onClick={() => {
                if (activeTab === "products") {
                  setProductImage("");
                  setProductImageUrlInput("");
                  setImageError("");
                  setProductAddons([]);
                  setNewAddonName("");
                  setNewAddonPrice(5000);
                  setProductModal({ isOpen: true, mode: "add" });
                } else if (activeTab === "tables") {
                  setTableModal({ isOpen: true, mode: "add" });
                } else if (activeTab === "promos") {
                  if (promoSubTab === "product_promos") {
                    handleOpenAddProductPromo();
                  } else {
                    setPromoFormType("percentage");
                    setPromoCustomerScope("all");
                    setPromoAssignedCustomerId("");
                    setPromoModal({ isOpen: true, mode: "add" });
                  }
                } else {
                  setCustomerFormData({
                    name: "",
                    phone: "",
                    email: "",
                    tier: "regular",
                    points: 0,
                    notes: "",
                    isActive: true,
                  });
                  setCustomerModal({ isOpen: true, mode: "add" });
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary/90 text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span>
                {activeTab === "products"
                  ? "+ Tambah Menu"
                  : activeTab === "tables"
                  ? "+ Tambah Meja"
                  : activeTab === "promos"
                  ? (promoSubTab === "product_promos" ? "+ Tambah Promo Produk" : "+ Tambah Voucher")
                  : "+ Tambah Pelanggan"}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (categorySubTab === "product") {
                  const input = document.getElementById("newCategoryNameInput");
                  input?.focus();
                } else if (categorySubTab === "area") {
                  const input = document.getElementById("newAreaNameInput");
                  input?.focus();
                } else {
                  const input = document.getElementById("newTierNameInput");
                  input?.focus();
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary/90 text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span>
                {categorySubTab === "product"
                  ? "+ Tambah Kategori Menu"
                  : categorySubTab === "area"
                  ? "+ Tambah Area Meja"
                  : "+ Tambah Kategori Member"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex items-center gap-3 mt-6 border-b border-surface-container-high overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab("products");
            setSearchQuery("");
          }}
          className={`pb-3 px-3 font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer border-b-2 shrink-0 ${
            activeTab === "products"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-lg">restaurant_menu</span>
          <span>Katalog Produk Menu ({products.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("tables");
            setSearchQuery("");
          }}
          className={`pb-3 px-3 font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer border-b-2 shrink-0 ${
            activeTab === "tables"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-lg">table_restaurant</span>
          <span>Data Meja ({tables.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("promos");
            setSearchQuery("");
          }}
          className={`pb-3 px-3 font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer border-b-2 shrink-0 ${
            activeTab === "promos"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-lg">local_offer</span>
          <span>Promo &amp; Diskon ({promos.length + productPromos.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("customers");
            setSearchQuery("");
          }}
          className={`pb-3 px-3 font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer border-b-2 shrink-0 ${
            activeTab === "customers"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-lg">group</span>
          <span>Pelanggan &amp; Member ({customers.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("categories");
            setSearchQuery("");
          }}
          className={`pb-3 px-3 font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer border-b-2 shrink-0 ${
            activeTab === "categories"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-lg">category</span>
          <span>Kelola Kategori</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("payments");
            setSearchQuery("");
          }}
          className={`pb-3 px-3 font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer border-b-2 shrink-0 ${
            activeTab === "payments"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-lg">payments</span>
          <span>Data Pembayaran</span>
        </button>
      </div>

      {/* SUB-TAB NAV KHUSUS TAB DATA PEMBAYARAN */}
      {activeTab === "payments" && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-1 border-b border-surface-container-high pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaymentSubTab("qris")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-2xs ${
                paymentSubTab === "qris"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "bg-surface-container text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-base">qr_code_2</span>
              <span>1. QRIS Statis Restoran</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentSubTab("bank")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-2xs ${
                paymentSubTab === "bank"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "bg-surface-container text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-base">account_balance</span>
              <span>2. Rekening Bank Transfer</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                paymentSubTab === "bank" ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
              }`}>
                {bankAccounts.length}
              </span>
            </button>
          </div>

          {paymentSubTab === "bank" && (
            <button
              type="button"
              onClick={handleOpenAddBankAccount}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary/90 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span>+ Tambah Rekening Bank</span>
            </button>
          )}

          {paymentSubTab === "qris" && (
            <button
              type="button"
              onClick={handleSaveQrisSettings}
              disabled={isSavingQris}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#003629] text-white hover:bg-[#00261d] text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">save</span>
              <span>{isSavingQris ? "Menyimpan..." : "Simpan Pengaturan QRIS"}</span>
            </button>
          )}
        </div>
      )}

      

      {/* SUB-TAB NAV KHUSUS TAB PROMO & DISKON (Ditempatkan di atas Search & Filter) */}
      {activeTab === "promos" && (
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-1">
          <button
            type="button"
            onClick={() => {
              setPromoSubTab("vouchers");
              setSearchQuery("");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              promoSubTab === "vouchers"
                ? "bg-primary text-on-primary shadow-xs"
                : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-outline-variant/30"
            }`}
          >
            <span className="material-symbols-outlined text-base">receipt_long</span>
            <span>1. Voucher Transaksi (Order-Level)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] ${
                promoSubTab === "vouchers"
                  ? "bg-white/20 text-white"
                  : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              {promos.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPromoSubTab("product_promos");
              setSearchQuery("");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              promoSubTab === "product_promos"
                ? "bg-[#003629] text-white shadow-xs"
                : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-outline-variant/30"
            }`}
          >
            <span className="material-symbols-outlined text-base">restaurant_menu</span>
            <span>2. Promo Menu / Produk (Item-Level)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] ${
                promoSubTab === "product_promos"
                  ? "bg-white/20 text-white"
                  : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              {productPromos.length}
            </span>
          </button>
        </div>
      )}

      {/* Filters Bar */}
      {activeTab !== "categories" && activeTab !== "payments" && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 mt-3.5">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Search Box */}
            <div className="relative flex-1 md:w-72">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === "products"
                    ? "Cari nama / kode menu..."
                    : activeTab === "tables"
                    ? "Cari nomor meja..."
                    : activeTab === "promos"
                    ? promoSubTab === "vouchers"
                      ? "Cari nama / kode voucher..."
                      : "Cari nama promo produk / menu..."
                    : "Cari nama / No. HP / email / catatan..."
                }
                className="w-full pl-9 pr-3 py-2 bg-surface-container-low rounded-xl text-xs font-medium text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary shadow-inner"
              />
            </div>

            {/* Category, Area, Promo Scope, or Customer Tier Filter */}
            {activeTab === "products" ? (
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 bg-surface-container-low rounded-xl text-xs font-bold text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="all">
                    Semua Kategori ({Math.max(categoriesList.length, categories.length - 1)} Kategori)
                  </option>
                  {categories.slice(1).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("categories");
                    setCategorySubTab("product");
                  }}
                  className="px-2.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-xs font-bold text-on-surface flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                  title="Buka Tab Menu Kelola Kategori Produk"
                >
                  <span className="material-symbols-outlined text-sm text-primary">category</span>
                  <span className="hidden sm:inline">Kelola Kategori</span>
                </button>
              </div>
            ) : activeTab === "tables" ? (
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="px-3 py-2 bg-surface-container-low rounded-xl text-xs font-bold text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary cursor-pointer shrink-0"
              >
                <option value="all">Semua Area ({tableAreasList.length} Area)</option>
                {tableAreasList.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.name}
                  </option>
                ))}
              </select>
            ) : activeTab === "promos" ? (
              promoSubTab === "vouchers" ? (
                <select
                  value={selectedPromoScope}
                  onChange={(e) => setSelectedPromoScope(e.target.value)}
                  className="px-3 py-2 bg-surface-container-low rounded-xl text-xs font-bold text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary cursor-pointer shrink-0"
                >
                  <option value="all">Semua Saluran &amp; Target</option>
                  <option value="dine_in">🍽️ Khusus Dine-in</option>
                  <option value="takeaway">🥡 Khusus Take Away</option>
                  <option value="vip">👑 Target: Khusus VIP</option>
                  <option value="gold">⭐ Target: Gold &amp; VIP</option>
                  <option value="member">👥 Target: Semua Member</option>
                  <option value="personal">👤 Target: Personal</option>
                </select>
              ) : (
                <select
                  value={selectedProductPromoTarget}
                  onChange={(e) => setSelectedProductPromoTarget(e.target.value)}
                  className="px-3 py-2 bg-surface-container-low rounded-xl text-xs font-bold text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary cursor-pointer shrink-0"
                >
                  <option value="all">Semua Target Promo ({productPromos.length})</option>
                  <option value="specific_products">🍔 Menu Pilihan</option>
                  <option value="category">📂 Per Kategori Menu</option>
                  <option value="all_products">🌐 Semua Menu Resto</option>
                </select>
              )
            ) : (
              <select
                value={selectedCustomerTier}
                onChange={(e) => setSelectedCustomerTier(e.target.value)}
                className="px-3 py-2 bg-surface-container-low rounded-xl text-xs font-bold text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary cursor-pointer shrink-0"
              >
                <option value="all">Semua Kategori Member ({customerTiersList.length} Kategori)</option>
                {customerTiersList.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <span className="text-xs text-on-surface-variant font-medium shrink-0">
            Menampilkan{" "}
            <strong>
              {activeTab === "products"
                ? filteredProducts.length
                : activeTab === "tables"
                ? filteredTables.length
                : activeTab === "promos"
                ? (promoSubTab === "product_promos" ? filteredProductPromos.length : filteredPromos.length)
                : filteredCustomers.length}
            </strong>{" "}
            data
          </span>
        </div>
      )}

      {/* TAB CONTENT: KATALOG PRODUK */}
      {activeTab === "products" && (
        <div className="mt-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-container-high text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  <th className="py-3 px-4">Foto</th>
                  <th className="py-3 px-4">Kode</th>
                  <th className="py-3 px-4">Nama Produk</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Harga Jual</th>
                  <th className="py-3 px-4">Deskripsi</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container text-xs">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3 px-4">
                      {p.imageUrl || p.image ? (
                        <div className="relative group w-12 h-12 rounded-xl overflow-hidden border border-outline-variant/30 shadow-2xs shrink-0 bg-surface-container-low">
                          <img
                            src={p.imageUrl || p.image}
                            alt={p.name}
                            className="w-full h-full object-cover transition-transform group-hover:scale-110"
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setProductImage("");
                            setProductImageUrlInput("");
                            setImageError("");
                            setProductAddons(p.addons ? [...p.addons] : []);
                            setNewAddonName("");
                            setNewAddonPrice(5000);
                            setProductModal({ isOpen: true, mode: "edit", data: p });
                          }}
                          className="w-12 h-12 rounded-xl bg-surface-container border border-dashed border-outline-variant/60 flex flex-col items-center justify-center text-outline hover:text-primary hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group"
                          title="Belum ada foto. Klik untuk upload foto menyusul"
                        >
                          <span className="material-symbols-outlined text-base group-hover:scale-110 transition-transform">add_a_photo</span>
                          <span className="text-[9px] font-bold mt-0.5 text-center leading-none text-outline group-hover:text-primary">Upload</span>
                        </button>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-primary">
                      {p.code || "PRD-000"}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-on-surface">
                      <div>{p.name}</div>
                      {p.addons && p.addons.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-bold">
                            <span className="material-symbols-outlined text-[12px] text-amber-700">extension</span>
                            <span>{p.addons.length} Pelengkap</span>
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-full bg-surface-container font-medium text-[11px] text-on-surface-variant">
                        {p.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-on-surface">
                      {formatCurrency(p.price)}
                    </td>
                    <td className="py-3.5 px-4 text-on-surface-variant max-w-xs truncate" title={p.description}>
                      {p.description || "-"}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={async () => {
                          const newStatus = !p.isAvailable;
                          setProducts((prev) =>
                            prev.map((item) =>
                              item.id === p.id ? { ...item, isAvailable: newStatus } : item
                            )
                          );
                          try {
                            await fetch("/api/menu-items", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: p.id, isAvailable: newStatus }),
                            });
                            loadDataFromDb();
                          } catch (err) {
                            console.error("Failed to toggle availability:", err);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                          p.isAvailable
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : "bg-rose-100 text-rose-800 border border-rose-300"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        <span>{p.isAvailable ? "Tersedia" : "Habis"}</span>
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewProduct(p)}
                          className="p-1.5 rounded-lg text-outline hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
                          title="Lihat Pratinjau Menu"
                        >
                          <span className="material-symbols-outlined text-base">visibility</span>
                        </button>
                        <button
                          onClick={() => {
                            setProductImage(p.imageUrl || p.image || "");
                            setProductImageUrlInput(p.imageUrl || p.image || "");
                            setImageError("");
                            setProductAddons(p.addons ? [...p.addons] : []);
                            setNewAddonName("");
                            setNewAddonPrice(5000);
                            setProductModal({ isOpen: true, mode: "edit", data: p });
                          }}
                          className="p-1.5 rounded-lg text-outline hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
                          title="Edit Produk"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/40 transition-colors cursor-pointer"
                          title="Hapus Produk"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* TAB CONTENT: DATA MEJA */}
      {activeTab === "tables" && (
        <div className="mt-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-container-high text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  <th className="py-3 px-4">Nomor Meja</th>
                  <th className="py-3 px-4">Nama Tampilan</th>
                  <th className="py-3 px-4">Area / Zona</th>
                  <th className="py-3 px-4">Kapasitas (Pax)</th>
                  <th className="py-3 px-4">Status Sekarang</th>
                  <th className="py-3 px-4 text-center">QR Code Pemesanan</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container text-xs">
                {filteredTables.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-primary">
                      {t.tableNumber}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-on-surface">
                      {t.displayName}
                    </td>
                    <td className="py-3.5 px-4">
                      {(() => {
                        const matchingArea = tableAreasList.find(
                          (a) => a.code.toLowerCase() === t.area?.toLowerCase()
                        );
                        return (
                          <span className="px-2.5 py-1 rounded-full bg-surface-container font-medium text-[11px] text-on-surface-variant">
                            {matchingArea?.name || t.area}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-on-surface">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-outline">group</span>
                        <span>{t.capacity} Kursi</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          t.status === "tersedia"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : t.status === "terisi"
                            ? "bg-blue-100 text-blue-800 border border-blue-300"
                            : "bg-amber-100 text-amber-800 border border-amber-300"
                        }`}
                      >
                        {t.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedQrTable(t)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-[#003629] border border-emerald-300 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                        title={`Lihat & Cetak QR Code Pemesanan ${t.tableNumber}`}
                      >
                        <span className="material-symbols-outlined text-sm text-emerald-700">qr_code_2</span>
                        <span>Lihat QR</span>
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSelectedQrTable(t)}
                          className="p-1.5 rounded-lg text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 transition-colors cursor-pointer"
                          title="Lihat & Cetak QR Code Meja"
                        >
                          <span className="material-symbols-outlined text-base">qr_code</span>
                        </button>
                        <button
                          onClick={() => setTableModal({ isOpen: true, mode: "edit", data: t })}
                          className="p-1.5 rounded-lg text-outline hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
                          title="Edit Meja"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteTable(t.id)}
                          className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/40 transition-colors cursor-pointer"
                          title="Hapus Meja"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* TAB CONTENT: PROMO & DISKON */}
      {activeTab === "promos" && (
        <div className="mt-4 flex flex-col gap-5">
          {promoSubTab === "vouchers" && (
            <div className="flex flex-col gap-5">
              {/* Summary Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3.5 shadow-2xs">
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">local_offer</span>
              </div>
              <div>
                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  Total Promo Terdaftar
                </p>
                <p className="text-xl font-black text-on-surface mt-0.5">
                  {promos.length} <span className="text-xs font-normal text-on-surface-variant">Promo</span>
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3.5 shadow-2xs">
              <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">check_circle</span>
              </div>
              <div>
                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  Promo Aktif Saat Ini
                </p>
                <p className="text-xl font-black text-emerald-700 mt-0.5">
                  {promos.filter((p) => p.isActive).length} <span className="text-xs font-normal text-emerald-600">Siap Dipakai</span>
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3.5 shadow-2xs">
              <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">trending_up</span>
              </div>
              <div>
                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  Total Klaim Transaksi
                </p>
                <p className="text-xl font-black text-amber-800 mt-0.5">
                  {promos.reduce((s, p) => s + (p.usageCount || 0), 0)} <span className="text-xs font-normal text-amber-700">Kali Digunakan</span>
                </p>
              </div>
            </div>
          </div>

          {/* Promo Cards Grid */}
          {filteredPromos.length === 0 ? (
            <div className="p-12 text-center bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant/40 flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-surface-container-low flex items-center justify-center text-outline">
                <span className="material-symbols-outlined text-3xl">local_offer</span>
              </div>
              <h3 className="font-bold text-base text-on-surface">Tidak Ada Promo Ditemukan</h3>
              <p className="text-xs text-on-surface-variant max-w-sm">
                Belum ada promo yang sesuai dengan pencarian atau filter yang dipilih. Silakan buat promo baru.
              </p>
              <button
                type="button"
                onClick={() => {
                  setPromoFormType("percentage");
                  setPromoModal({ isOpen: true, mode: "add" });
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">add</span>
                <span>Buat Promo Baru</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPromos.map((promo) => {
                const isCopied = copiedCode === promo.code;
                return (
                  <div
                    key={promo.id}
                    className={`p-5 rounded-2xl bg-surface-container-lowest border transition-all flex flex-col justify-between shadow-2xs relative overflow-hidden ${
                      promo.isActive
                        ? "border-outline-variant/40 hover:border-primary/50 hover:shadow-md"
                        : "border-outline-variant/20 opacity-70 bg-surface-container-low/40"
                    }`}
                  >
                    {/* Top Accent Strip */}
                    <div
                      className={`absolute top-0 inset-x-0 h-1.5 ${
                        promo.isActive
                          ? promo.discountType === "percentage"
                            ? "bg-[#003629]"
                            : "bg-amber-600"
                          : "bg-slate-300"
                      }`}
                    />

                    <div>
                      {/* Badge Tipe & Nilai Diskon */}
                      <div className="flex items-center justify-between gap-2 mt-1 mb-2.5">
                        <div
                          className={`px-3 py-1 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-2xs ${
                            promo.discountType === "percentage"
                              ? "bg-emerald-100 text-[#003629] border border-emerald-300"
                              : "bg-amber-100 text-amber-900 border border-amber-300"
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {promo.discountType === "percentage" ? "percent" : "payments"}
                          </span>
                          <span>
                            {promo.discountType === "percentage"
                              ? `${promo.discountValue}% OFF`
                              : `${formatCurrency(promo.discountValue)} OFF`}
                          </span>
                        </div>

                        {/* Copy Code Pill */}
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(promo.code);
                            setCopiedCode(promo.code);
                            setTimeout(() => setCopiedCode(null), 2000);
                          }}
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                            isCopied
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-surface-container-low text-on-surface hover:bg-surface-container border-outline-variant/40"
                          }`}
                          title="Klik untuk menyalin kode promo"
                        >
                          <span className="material-symbols-outlined text-xs">
                            {isCopied ? "check" : "content_copy"}
                          </span>
                          <span>{isCopied ? "Disalin!" : promo.code}</span>
                        </button>
                      </div>

                      {/* Judul & Deskripsi */}
                      <h4 className="font-bold text-sm text-on-surface leading-snug">
                        {promo.name}
                      </h4>
                      {promo.description && (
                        <p className="text-xs text-on-surface-variant mt-1 line-clamp-2 leading-relaxed">
                          {promo.description}
                        </p>
                      )}

                      {/* Detail Syarat & Ketentuan */}
                      <div className="mt-3.5 pt-3 border-t border-surface-container-high flex flex-col gap-1.5 text-xs text-on-surface-variant">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px]">Minimal Belanja:</span>
                          <span className="font-bold text-on-surface">
                            {promo.minOrderAmount && promo.minOrderAmount > 0
                              ? formatCurrency(promo.minOrderAmount)
                              : "Tanpa Minimal"}
                          </span>
                        </div>

                        {promo.discountType === "percentage" && (
                          <div className="flex items-center justify-between">
                            <span className="text-[11px]">Maks. Potongan:</span>
                            <span className="font-bold text-on-surface">
                              {promo.maxDiscount
                                ? formatCurrency(promo.maxDiscount)
                                : "Tanpa Batas"}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-[11px]">Berlaku Saluran:</span>
                          <span className="font-bold px-2 py-0.5 rounded-md bg-surface-container-high text-[10px]">
                            {promo.scope === "dine_in"
                              ? "Dine-in Saja"
                              : promo.scope === "takeaway"
                              ? "Take Away Saja"
                              : "Semua Saluran"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[11px]">Target Pelanggan:</span>
                          {promo.customerScope === "vip" ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">workspace_premium</span>
                              Khusus VIP
                            </span>
                          ) : promo.customerScope === "gold" ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">stars</span>
                              Member Gold &amp; VIP
                            </span>
                          ) : promo.customerScope === "member" ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">group</span>
                              Semua Member
                            </span>
                          ) : promo.customerScope === "personal" ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-900 border border-indigo-300 flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">person</span>
                              {promo.assignedCustomerName || "Personal"}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">public</span>
                              Semua Pelanggan
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[11px]">Frekuensi Dipakai:</span>
                          <span className="font-bold text-amber-700">
                            {promo.usageCount || 0}x transaksi
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Switch Toggle & Actions */}
                    <div className="mt-4 pt-3 border-t border-surface-container-high flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleTogglePromoActive(promo.id, promo.isActive)}
                          className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                            promo.isActive ? "bg-emerald-600" : "bg-slate-300"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-0.5 ${
                              promo.isActive ? "right-0.5" : "left-0.5"
                            }`}
                          />
                        </button>
                        <span className="text-[11px] font-bold text-on-surface">
                          {promo.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenBroadcastModal(promo)}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                          title="Broadcast Promo ini via WhatsApp ke Pelanggan"
                        >
                          <span className="material-symbols-outlined text-sm">send_to_mobile</span>
                          <span className="hidden sm:inline">Broadcast WA</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPromoFormType(promo.discountType);
                            setPromoCustomerScope(promo.customerScope || "all");
                            setPromoAssignedCustomerId(promo.assignedCustomerId || "");
                            setPromoModal({ isOpen: true, mode: "edit", data: promo });
                          }}
                          className="p-1.5 rounded-lg text-outline hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
                          title="Edit Promo"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePromo(promo.id, promo.name)}
                          className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/40 transition-colors cursor-pointer"
                          title="Hapus Promo"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
            </div>
          )}

          {/* SUB-TAB: PROMO MENU / PRODUK */}
          {promoSubTab === "product_promos" && (
            <div className="flex flex-col gap-5">
              {/* Summary Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3.5 shadow-2xs">
                  <div className="w-11 h-11 rounded-xl bg-[#003629]/10 text-[#003629] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-2xl">restaurant_menu</span>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                      Total Kampanye Promo
                    </p>
                    <p className="text-xl font-black text-on-surface mt-0.5">
                      {productPromos.length} <span className="text-xs font-normal text-on-surface-variant">Kampanye</span>
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3.5 shadow-2xs">
                  <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-2xl">check_circle</span>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                      Kampanye Aktif
                    </p>
                    <p className="text-xl font-black text-emerald-700 mt-0.5">
                      {productPromos.filter((p) => p.isActive).length} <span className="text-xs font-normal text-emerald-600">Berjalan</span>
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3.5 shadow-2xs">
                  <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-2xl">sell</span>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                      Menu Terdampak Promo
                    </p>
                    <p className="text-xl font-black text-amber-800 mt-0.5">
                      {promoProductsCount} <span className="text-xs font-normal text-amber-700">Menu di Katalog</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Product Promos Grid */}
              {filteredProductPromos.length === 0 ? (
                <div className="p-12 text-center bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant/40 flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-surface-container-low flex items-center justify-center text-outline">
                    <span className="material-symbols-outlined text-3xl">restaurant_menu</span>
                  </div>
                  <h3 className="font-bold text-base text-on-surface">Belum Ada Promo Menu / Produk</h3>
                  <p className="text-xs text-on-surface-variant max-w-sm">
                    Buat diskon khusus menu tertentu, diskon per kategori, atau promo Happy Hour jam tertentu.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenAddProductPromo}
                    className="mt-2 px-4 py-2 rounded-xl bg-[#003629] text-white font-bold text-xs hover:bg-[#1a4a3e] transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    <span>Buat Promo Produk Baru</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProductPromos.map((promo) => {
                    return (
                      <div
                        key={promo.id}
                        className={`p-5 rounded-2xl bg-surface-container-lowest border transition-all flex flex-col justify-between shadow-2xs relative overflow-hidden ${
                          promo.isActive
                            ? "border-outline-variant/40 hover:border-primary/50 hover:shadow-md"
                            : "border-outline-variant/20 opacity-70 bg-surface-container-low/40"
                        }`}
                      >
                        {/* Top Accent Strip */}
                        <div
                          className={`absolute top-0 inset-x-0 h-1.5 ${
                            promo.isActive
                              ? promo.discountType === "percentage"
                                ? "bg-[#003629]"
                                : promo.discountType === "special_price"
                                ? "bg-purple-600"
                                : "bg-amber-600"
                              : "bg-slate-300"
                          }`}
                        />

                        <div>
                          {/* Badges */}
                          <div className="flex items-center justify-between gap-2 mt-1 mb-2.5">
                            <div
                              className={`px-3 py-1 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-2xs ${
                                promo.discountType === "percentage"
                                  ? "bg-emerald-100 text-[#003629] border border-emerald-300"
                                  : promo.discountType === "special_price"
                                  ? "bg-purple-100 text-purple-900 border border-purple-300"
                                  : "bg-amber-100 text-amber-900 border border-amber-300"
                              }`}
                            >
                              <span className="material-symbols-outlined text-sm">
                                {promo.discountType === "percentage"
                                  ? "percent"
                                  : promo.discountType === "special_price"
                                  ? "star"
                                  : "payments"}
                              </span>
                              <span>
                                {promo.discountType === "percentage"
                                  ? `${promo.discountValue}% OFF`
                                  : promo.discountType === "special_price"
                                  ? `Spesial ${formatCurrency(promo.discountValue)}`
                                  : `${formatCurrency(promo.discountValue)} OFF`}
                              </span>
                            </div>

                            {promo.badgeLabel && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider bg-rose-100 text-rose-800 border border-rose-300 uppercase">
                                {promo.badgeLabel}
                              </span>
                            )}
                          </div>

                          {/* Judul & Deskripsi */}
                          <h4 className="font-bold text-sm text-on-surface leading-snug">
                            {promo.name}
                          </h4>
                          {promo.description && (
                            <p className="text-xs text-on-surface-variant mt-1 line-clamp-2 leading-relaxed">
                              {promo.description}
                            </p>
                          )}

                          {/* Detail Aturan Produk */}
                          <div className="mt-3.5 pt-3 border-t border-surface-container-high flex flex-col gap-1.5 text-xs text-on-surface-variant">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px]">Cakupan Target:</span>
                              <span className="font-bold px-2 py-0.5 rounded-md bg-surface-container-high text-[10px] text-on-surface">
                                {promo.targetType === "all_products"
                                  ? "Semua Menu Resto"
                                  : promo.targetType === "category"
                                  ? `Kategori: ${promo.targetCategory}`
                                  : `${promo.targetProductIds?.length || 0} Menu Pilihan`}
                              </span>
                            </div>

                            {/* Happy Hour Time */}
                            {promo.timeStart && promo.timeEnd && (
                              <div className="flex items-center justify-between">
                                <span className="text-[11px]">Jadwal Happy Hour:</span>
                                <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-[10px] flex items-center gap-1">
                                  <span className="material-symbols-outlined text-xs">schedule</span>
                                  {promo.timeStart} - {promo.timeEnd}
                                </span>
                              </div>
                            )}

                            {/* Preview menu terpilih jika specific_products */}
                            {promo.targetType === "specific_products" && promo.targetProductIds && promo.targetProductIds.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {promo.targetProductIds.slice(0, 3).map((pid) => {
                                  const prod = products.find((p) => p.id === pid || p.code === pid);
                                  return (
                                    <span key={pid} className="px-2 py-0.5 rounded-md bg-surface-container text-[10px] font-medium text-on-surface truncate max-w-[140px]">
                                      {prod?.name || pid}
                                    </span>
                                  );
                                })}
                                {promo.targetProductIds.length > 3 && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-surface-container-high text-[10px] font-bold text-on-surface-variant">
                                    +{promo.targetProductIds.length - 3} lagi
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Footer: Switch Toggle & Actions */}
                        <div className="mt-4 pt-3 border-t border-surface-container-high flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleProductPromoActive(promo)}
                              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                                promo.isActive ? "bg-emerald-600" : "bg-slate-300"
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-0.5 ${
                                  promo.isActive ? "right-0.5" : "left-0.5"
                                }`}
                              />
                            </button>
                            <span className="text-[11px] font-bold text-on-surface">
                              {promo.isActive ? "Aktif" : "Nonaktif"}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditProductPromo(promo)}
                              className="p-1.5 rounded-lg text-outline hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
                              title="Edit Promo Produk"
                            >
                              <span className="material-symbols-outlined text-base">edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProductPromo(promo.id, promo.name)}
                              className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/40 transition-colors cursor-pointer"
                              title="Hapus Promo Produk"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      
{/* TAB CONTENT: PELANGGAN & MEMBER */}
      {activeTab === "customers" && (
        <div className="mt-4 flex flex-col gap-5">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3.5 shadow-2xs">
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">groups</span>
              </div>
              <div>
                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  Total Pelanggan Terdaftar
                </p>
                <p className="text-xl font-black text-on-surface mt-0.5">
                  {customers.length} <span className="text-xs font-normal text-on-surface-variant">Orang</span>
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3.5 shadow-2xs">
              <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-900 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">workspace_premium</span>
              </div>
              <div>
                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  Member VIP &amp; Gold
                </p>
                <p className="text-xl font-black text-purple-800 mt-0.5">
                  {customers.filter((c) => c.tier === "vip" || c.tier === "gold").length}{" "}
                  <span className="text-xs font-normal text-purple-600">Member</span>
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3.5 shadow-2xs">
              <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">stars</span>
              </div>
              <div>
                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  Poin Loyalitas Beredar
                </p>
                <p className="text-xl font-black text-amber-700 mt-0.5">
                  {customers.reduce((sum, c) => sum + (c.points || 0), 0).toLocaleString("id-ID")}{" "}
                  <span className="text-xs font-normal text-amber-600">Poin</span>
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3.5 shadow-2xs">
              <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">payments</span>
              </div>
              <div>
                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  Akumulasi Nilai Belanja
                </p>
                <p className="text-xl font-black text-emerald-700 mt-0.5 truncate">
                  {formatCurrency(customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0))}
                </p>
              </div>
            </div>
          </div>

          {/* Customers Table / Card List */}
          {isLoadingCustomers ? (
            <div className="p-12 text-center text-on-surface-variant flex flex-col items-center gap-2">
              <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
              <p className="text-xs font-medium">Memuat data pelanggan...</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-12 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center text-outline">
                <span className="material-symbols-outlined text-3xl">person_off</span>
              </div>
              <div>
                <h3 className="font-bold text-on-surface text-sm">Tidak ada pelanggan ditemukan</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {searchQuery || selectedCustomerTier !== "all"
                    ? "Coba ubah kata kunci pencarian atau filter kategori member."
                    : "Belum ada pelanggan terdaftar. Tambahkan pelanggan baru sekarang!"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCustomerFormData({
                    name: "",
                    phone: "",
                    email: "",
                    tier: "regular",
                    points: 0,
                    notes: "",
                    isActive: true,
                  });
                  setCustomerModal({ isOpen: true, mode: "add" });
                }}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 flex items-center gap-1.5 cursor-pointer shadow-xs mt-1"
              >
                <span className="material-symbols-outlined text-base">person_add</span>
                <span>+ Daftarkan Pelanggan Baru</span>
              </button>
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-surface-container-high text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                      <th className="py-3.5 px-4">Pelanggan</th>
                      <th className="py-3.5 px-4">Kategori Member</th>
                      <th className="py-3.5 px-4">Kunjungan &amp; Belanja</th>
                      <th className="py-3.5 px-4">Poin Reward</th>
                      <th className="py-3.5 px-4">Catatan / Selera Khusus</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-high text-xs">
                    {filteredCustomers.map((c) => {
                      const matchingTier = customerTiersList.find(
                        (t) => t.code.toLowerCase() === c.tier?.toLowerCase()
                      );
                      const badgeColor =
                        matchingTier?.badgeColor ||
                        (c.tier === "vip"
                          ? "purple"
                          : c.tier === "gold"
                          ? "amber"
                          : c.tier === "silver"
                          ? "slate"
                          : "emerald");
                      const tierLabel = matchingTier?.name || (c.tier ? c.tier.toUpperCase() : "Regular");

                      const tierStyle =
                        badgeColor === "purple"
                          ? { bg: "bg-purple-100 text-purple-900 border-purple-200", icon: "crown", label: tierLabel, iconColor: "text-amber-500", avatarBg: "bg-purple-600 text-white" }
                          : badgeColor === "amber"
                          ? { bg: "bg-amber-100 text-amber-900 border-amber-200", icon: "star", label: tierLabel, iconColor: "text-amber-600", avatarBg: "bg-amber-500 text-white" }
                          : badgeColor === "slate"
                          ? { bg: "bg-slate-100 text-slate-800 border-slate-300", icon: "military_tech", label: tierLabel, iconColor: "text-slate-500", avatarBg: "bg-slate-500 text-white" }
                          : badgeColor === "blue"
                          ? { bg: "bg-blue-100 text-blue-900 border-blue-200", icon: "verified", label: tierLabel, iconColor: "text-blue-600", avatarBg: "bg-blue-600 text-white" }
                          : badgeColor === "rose"
                          ? { bg: "bg-rose-100 text-rose-900 border-rose-200", icon: "loyalty", label: tierLabel, iconColor: "text-rose-600", avatarBg: "bg-rose-600 text-white" }
                          : { bg: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: "person", label: tierLabel, iconColor: "text-emerald-600", avatarBg: "bg-emerald-700 text-white" };

                      const initials = c.name
                        .replace(/^(Bpk\.?|Ibu\.?|dr\.?)\s+/i, "")
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase() || "PL";

                      return (
                        <tr key={c.id} className="hover:bg-surface-container-low/50 transition-colors">
                          {/* Nama & Kontak */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs shrink-0 shadow-2xs ${tierStyle.avatarBg}`}
                              >
                                {initials}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-on-surface text-sm">{c.name}</span>
                                <div className="flex items-center gap-2 mt-0.5 text-on-surface-variant text-[11px]">
                                  <a
                                    href={`https://wa.me/${c.phone.replace(/\D/g, "")}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hover:text-emerald-700 flex items-center gap-0.5 font-mono"
                                    title="Hubungi via WhatsApp"
                                  >
                                    <span className="material-symbols-outlined text-[12px] text-emerald-600">chat</span>
                                    {c.phone}
                                  </a>
                                  {c.email && (
                                    <>
                                      <span>•</span>
                                      <span className="truncate max-w-[150px]">{c.email}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Kategori Member */}
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-2xs ${tierStyle.bg}`}
                            >
                              <span className={`material-symbols-outlined text-[13px] ${tierStyle.iconColor}`}>
                                {tierStyle.icon}
                              </span>
                              <span>{tierStyle.label}</span>
                            </span>
                          </td>

                          {/* Kunjungan & Belanja */}
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-on-surface">{formatCurrency(c.totalSpent || 0)}</span>
                              <span className="text-[11px] text-on-surface-variant">{c.totalVisits || 0}x Kunjungan Transaksi</span>
                            </div>
                          </td>

                          {/* Poin Reward */}
                          <td className="py-3 px-4">
                            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-bold text-xs">
                              <span className="material-symbols-outlined text-sm text-amber-500">stars</span>
                              <span>{(c.points || 0).toLocaleString("id-ID")} Poin</span>
                            </div>
                          </td>

                          {/* Catatan / Selera Khusus */}
                          <td className="py-3 px-4 max-w-xs">
                            {c.notes ? (
                              <div className="p-2 rounded-xl bg-surface-container text-on-surface-variant text-[11px] leading-snug border border-outline-variant/30 flex items-start gap-1.5">
                                <span className="material-symbols-outlined text-primary text-[14px] shrink-0 mt-0.5">
                                  info
                                </span>
                                <span>{c.notes}</span>
                              </div>
                            ) : (
                              <span className="text-outline text-[11px] italic">Tidak ada catatan khusus</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleCustomerActive(c.id, c.isActive)}
                                className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${
                                  c.isActive ? "bg-emerald-600" : "bg-slate-300"
                                }`}
                              >
                                <div
                                  className={`w-3 h-3 rounded-full bg-white transition-transform absolute top-0.5 ${
                                    c.isActive ? "right-0.5" : "left-0.5"
                                  }`}
                                />
                              </button>
                              <span className="text-[11px] font-bold text-on-surface">
                                {c.isActive ? "Aktif" : "Nonaktif"}
                              </span>
                            </div>
                          </td>

                          {/* Aksi */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setCustomerFormData({
                                    name: c.name,
                                    phone: c.phone,
                                    email: c.email || "",
                                    tier: c.tier,
                                    points: c.points || 0,
                                    notes: c.notes || "",
                                    isActive: c.isActive,
                                  });
                                  setCustomerModal({ isOpen: true, mode: "edit", data: c });
                                }}
                                className="p-1.5 rounded-lg text-outline hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
                                title="Edit Pelanggan"
                              >
                                <span className="material-symbols-outlined text-base">edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomer(c.id, c.name)}
                                className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/40 transition-colors cursor-pointer"
                                title="Hapus Pelanggan"
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
          )}
        </div>
      )}

      
      

      {/* ==================== TAB CONTENT: KELOLA KATEGORI ==================== */}
      {activeTab === "categories" && (
        <div className="mt-4 flex flex-col gap-6 animate-in fade-in duration-150">
          {/* Sub-tab Navigation Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-surface-container-low rounded-2xl border border-outline-variant/30 shadow-2xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setCategorySubTab("product")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  categorySubTab === "product"
                    ? "bg-[#003629] text-white shadow-xs"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                <span className="material-symbols-outlined text-base text-amber-300">restaurant_menu</span>
                <span>1. Kategori Produk Menu ({categoriesList.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setCategorySubTab("area")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  categorySubTab === "area"
                    ? "bg-[#003629] text-white shadow-xs"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                <span className="material-symbols-outlined text-base text-amber-300">table_restaurant</span>
                <span>2. Kategori Area / Zona Meja ({tableAreasList.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setCategorySubTab("member")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  categorySubTab === "member"
                    ? "bg-[#003629] text-white shadow-xs"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                <span className="material-symbols-outlined text-base text-amber-300">workspace_premium</span>
                <span>3. Kategori Member &amp; Pelanggan ({customerTiersList.length})</span>
              </button>
            </div>

            <div className="px-3 text-[11px] text-on-surface-variant font-medium hidden lg:block">
              {categorySubTab === "product"
                ? "Kategori dinamis produk menu untuk kasir POS dan e-menu pelanggan"
                : categorySubTab === "area"
                ? "Kategori dinamis zona tata letak meja makan restoran"
                : "Kategori dinamis tingkatan member & loyalitas pelanggan"}
            </div>
          </div>

          {/* ==================== SUB-TAB 1: KATEGORI PRODUK MENU ==================== */}
          {categorySubTab === "product" && (
            <div className="flex flex-col gap-6">
              {/* Form Tambah Kategori Produk */}
              <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-base">add_circle</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-on-surface">Tambah Kategori Produk Menu Baru</h3>
                    <p className="text-[11px] text-on-surface-variant">
                      Kategori baru akan langsung tersedia pada katalog menu POS kasir dan formulir input produk.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-5 flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface">Nama Kategori *</label>
                    <input
                      id="newCategoryNameInput"
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Contoh: Dessert & Penutup, Sarapan Pagi, Paket Rombongan"
                      className="p-2.5 rounded-xl bg-surface-container-low text-xs font-bold text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="md:col-span-5 flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface">Deskripsi / Catatan Singkat (Opsional)</label>
                    <input
                      type="text"
                      value={newCategoryDesc}
                      onChange={(e) => setNewCategoryDesc(e.target.value)}
                      placeholder="Keterangan singkat tentang kelompok menu ini..."
                      className="p-2.5 rounded-xl bg-surface-container-low text-xs font-medium text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <button
                      type="button"
                      disabled={isAddingCategory || !newCategoryName.trim()}
                      onClick={() => handleCreateCategory(newCategoryName, newCategoryDesc)}
                      className="w-full py-2.5 px-4 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      <span>{isAddingCategory ? "Menyimpan..." : "Tambah Kategori"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Grid Daftar Kategori Produk Terdaftar */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-on-surface">Daftar Kategori Produk Terdaftar</h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {categoriesList.length} Kategori
                    </span>
                  </div>
                  <span className="text-xs text-on-surface-variant font-medium">
                    {products.length} Total Produk Terhubung
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {categoriesList.map((cat) => {
                    const count =
                      products.filter(
                        (p) => p.category?.toLowerCase() === cat.name.toLowerCase()
                      ).length ||
                      cat.productCount ||
                      0;
                    const isOnlyOne = categoriesList.length <= 1;

                    return (
                      <div
                        key={cat.id}
                        className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 hover:border-primary/40 flex flex-col justify-between gap-3 shadow-2xs transition-all group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                              <span className="material-symbols-outlined text-xl">label</span>
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-sm text-on-surface truncate">
                                {cat.name}
                              </span>
                              <span className="text-[11px] text-on-surface-variant line-clamp-1">
                                {cat.description || "Kategori aktif di sistem"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setEditCategoryModal({
                                  isOpen: true,
                                  type: "product",
                                  id: cat.id,
                                  name: cat.name,
                                  description: cat.description || "",
                                })
                              }
                              className="p-1.5 rounded-lg text-outline hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
                              title="Edit Kategori"
                            >
                              <span className="material-symbols-outlined text-base">edit</span>
                            </button>
                            <button
                              type="button"
                              disabled={isOnlyOne}
                              onClick={() => handleDeleteCategory(cat)}
                              className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/40 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-outline disabled:cursor-not-allowed transition-colors cursor-pointer"
                              title={isOnlyOne ? "Minimal harus ada 1 kategori" : `Hapus Kategori "${cat.name}"`}
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-surface-container-high/60 text-xs">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold text-[11px]">
                            <span className="material-symbols-outlined text-[13px] text-emerald-700">restaurant_menu</span>
                            <span>{count} Menu Menggunakan Kategori Ini</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ==================== SUB-TAB 2: KATEGORI AREA / ZONA MEJA ==================== */}
          {categorySubTab === "area" && (
            <div className="flex flex-col gap-6">
              {/* Form Tambah Area */}
              <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-base">add_circle</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-on-surface">Tambah Kategori Area / Zona Meja Baru</h3>
                    <p className="text-[11px] text-on-surface-variant">
                      Area baru akan langsung tersedia pada formulir pendaftaran meja, filter denah, dan cetak QR meja.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-5 flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface">Nama Area / Zona *</label>
                    <input
                      id="newAreaNameInput"
                      type="text"
                      value={newAreaName}
                      onChange={(e) => setNewAreaName(e.target.value)}
                      placeholder="Contoh: Lantai 2, Rooftop, Ruang VIP Melati"
                      className="p-2.5 rounded-xl bg-surface-container-low text-xs font-bold text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="md:col-span-5 flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface">Deskripsi Area (Opsional)</label>
                    <input
                      type="text"
                      value={newAreaDesc}
                      onChange={(e) => setNewAreaDesc(e.target.value)}
                      placeholder="Contoh: Area santai terbuka dengan pemandangan kota..."
                      className="p-2.5 rounded-xl bg-surface-container-low text-xs font-medium text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <button
                      type="button"
                      disabled={isAddingArea || !newAreaName.trim()}
                      onClick={() => handleCreateArea(newAreaName, newAreaDesc)}
                      className="w-full py-2.5 px-4 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      <span>{isAddingArea ? "Menyimpan..." : "Tambah Area"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Grid Daftar Area Terdaftar */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-on-surface">Daftar Kategori Area / Zona Meja</h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {tableAreasList.length} Area
                    </span>
                  </div>
                  <span className="text-xs text-on-surface-variant font-medium">
                    {tables.length} Total Meja Terdaftar
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tableAreasList.map((area) => {
                    const count =
                      tables.filter(
                        (t) => t.area?.toLowerCase() === area.code.toLowerCase()
                      ).length ||
                      area.tableCount ||
                      0;
                    const isOnlyOne = tableAreasList.length <= 1;

                    return (
                      <div
                        key={area.id}
                        className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 hover:border-primary/40 flex flex-col justify-between gap-3 shadow-2xs transition-all group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#003629] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                              <span className="material-symbols-outlined text-xl">table_restaurant</span>
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-sm text-on-surface truncate">
                                {area.name}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-surface-container text-on-surface-variant">
                                  {area.code}
                                </span>
                                <span className="text-[11px] text-on-surface-variant line-clamp-1">
                                  {area.description || "Area penempatan meja"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setEditCategoryModal({
                                  isOpen: true,
                                  type: "area",
                                  id: area.id,
                                  code: area.code,
                                  name: area.name,
                                  description: area.description || "",
                                })
                              }
                              className="p-1.5 rounded-lg text-outline hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
                              title="Edit Area"
                            >
                              <span className="material-symbols-outlined text-base">edit</span>
                            </button>
                            <button
                              type="button"
                              disabled={isOnlyOne}
                              onClick={() => handleDeleteArea(area)}
                              className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/40 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-outline disabled:cursor-not-allowed transition-colors cursor-pointer"
                              title={isOnlyOne ? "Minimal harus ada 1 area" : `Hapus Area "${area.name}"`}
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-surface-container-high/60 text-xs">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-900 border border-blue-200 font-bold text-[11px]">
                            <span className="material-symbols-outlined text-[13px] text-blue-700">chair</span>
                            <span>{count} Meja di Area Ini</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ==================== SUB-TAB 3: KATEGORI MEMBER & PELANGGAN ==================== */}
          {categorySubTab === "member" && (
            <div className="flex flex-col gap-6">
              {/* Form Tambah Tier Member */}
              <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-900 flex items-center justify-center">
                    <span className="material-symbols-outlined text-base">add_circle</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-on-surface">Tambah Kategori Member &amp; Pelanggan Baru</h3>
                    <p className="text-[11px] text-on-surface-variant">
                      Kategori member baru akan langsung tersedia pada form pendaftaran pelanggan, filter pelanggan, dan target kupon promo.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-4 flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface">Nama Kategori Member *</label>
                    <input
                      id="newTierNameInput"
                      type="text"
                      value={newTierName}
                      onChange={(e) => setNewTierName(e.target.value)}
                      placeholder="Contoh: Platinum Member, Corporate, Komunitas"
                      className="p-2.5 rounded-xl bg-surface-container-low text-xs font-bold text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="md:col-span-4 flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface">Deskripsi / Benefit Member (Opsional)</label>
                    <input
                      type="text"
                      value={newTierDesc}
                      onChange={(e) => setNewTierDesc(e.target.value)}
                      placeholder="Contoh: Diskon 15% setiap makan siang, prioritas meja..."
                      className="p-2.5 rounded-xl bg-surface-container-low text-xs font-medium text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="md:col-span-2 flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface">Warna Badge</label>
                    <select
                      value={newTierColor}
                      onChange={(e) => setNewTierColor(e.target.value)}
                      className="p-2.5 rounded-xl bg-surface-container-low text-xs font-bold text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="emerald">🟢 Emerald</option>
                      <option value="purple">🟣 Purple</option>
                      <option value="amber">🟡 Amber</option>
                      <option value="slate">⚪ Slate</option>
                      <option value="blue">🔵 Blue</option>
                      <option value="rose">🔴 Rose</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <button
                      type="button"
                      disabled={isAddingTier || !newTierName.trim()}
                      onClick={() => handleCreateTier(newTierName, newTierDesc, newTierColor)}
                      className="w-full py-2.5 px-4 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      <span>{isAddingTier ? "Menyimpan..." : "Tambah Member"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Grid Daftar Tier Member Terdaftar */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-on-surface">Daftar Kategori Member Terdaftar</h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 text-xs font-bold">
                      {customerTiersList.length} Tier
                    </span>
                  </div>
                  <span className="text-xs text-on-surface-variant font-medium">
                    {customers.length} Total Pelanggan Terdaftar
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {customerTiersList.map((tier) => {
                    const count =
                      customers.filter(
                        (c) => c.tier?.toLowerCase() === tier.code.toLowerCase()
                      ).length ||
                      tier.customerCount ||
                      0;
                    const isOnlyOne = customerTiersList.length <= 1;

                    const color = tier.badgeColor || "emerald";
                    const badgeClasses =
                      color === "purple"
                        ? "bg-purple-100 text-purple-900 border-purple-200"
                        : color === "amber"
                        ? "bg-amber-100 text-amber-900 border-amber-200"
                        : color === "slate"
                        ? "bg-slate-100 text-slate-800 border-slate-300"
                        : color === "blue"
                        ? "bg-blue-100 text-blue-900 border-blue-200"
                        : color === "rose"
                        ? "bg-rose-100 text-rose-900 border-rose-200"
                        : "bg-emerald-50 text-emerald-800 border-emerald-200";

                    const iconName =
                      color === "purple"
                        ? "crown"
                        : color === "amber"
                        ? "star"
                        : color === "slate"
                        ? "military_tech"
                        : color === "blue"
                        ? "verified"
                        : color === "rose"
                        ? "loyalty"
                        : "person";

                    return (
                      <div
                        key={tier.id}
                        className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 hover:border-primary/40 flex flex-col justify-between gap-3 shadow-2xs transition-all group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${badgeClasses} group-hover:scale-105 transition-transform`}>
                              <span className="material-symbols-outlined text-xl">{iconName}</span>
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-sm text-on-surface truncate">
                                {tier.name}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-surface-container text-on-surface-variant">
                                  {tier.code}
                                </span>
                                <span className="text-[11px] text-on-surface-variant line-clamp-1">
                                  {tier.description || "Kategori member aktif"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setEditCategoryModal({
                                  isOpen: true,
                                  type: "member",
                                  id: tier.id,
                                  code: tier.code,
                                  name: tier.name,
                                  description: tier.description || "",
                                  badgeColor: tier.badgeColor || "emerald",
                                })
                              }
                              className="p-1.5 rounded-lg text-outline hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
                              title="Edit Kategori Member"
                            >
                              <span className="material-symbols-outlined text-base">edit</span>
                            </button>
                            <button
                              type="button"
                              disabled={isOnlyOne}
                              onClick={() => handleDeleteTier(tier)}
                              className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/40 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-outline disabled:cursor-not-allowed transition-colors cursor-pointer"
                              title={isOnlyOne ? "Minimal harus ada 1 tier" : `Hapus Tier "${tier.name}"`}
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-surface-container-high/60 text-xs">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border font-bold text-[11px] ${badgeClasses}`}>
                            <span className="material-symbols-outlined text-[13px]">{iconName}</span>
                            <span>{count} Pelanggan Terdaftar</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB CONTENT: DATA PEMBAYARAN (QRIS & TRANSFER) ==================== */}
      {activeTab === "payments" && (
        <div className="mt-4 flex flex-col gap-6 animate-in fade-in duration-150">
          
          {/* ==================== SUB-TAB 1: QRIS STATIS RESTORAN ==================== */}
          {paymentSubTab === "qris" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Kolom Kiri: Form Input & Unggah Gambar (7 Cols) */}
              <div className="lg:col-span-7 flex flex-col gap-5">
                <div className="p-6 rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-xs flex flex-col gap-5">
                  <div className="flex items-center gap-3 border-b border-surface-container-high pb-4">
                    <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-2xl font-bold">qr_code_2</span>
                    </div>
                    <div>
                      <h2 className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">
                        Pengaturan QRIS Statis Restoran
                      </h2>
                      <p className="text-xs text-on-surface-variant">
                        Gambar QRIS dan label ini akan otomatis tampil saat kasir memilih pembayaran QRIS pada pop-up konfirmasi kasir.
                      </p>
                    </div>
                  </div>

                  {/* Input Label QRIS */}
                  <div>
                    <label className="text-xs font-bold text-on-surface block mb-1.5">
                      Nama / Label QRIS Merchant <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      value={qrisLabel}
                      onChange={(e) => setQrisLabel(e.target.value)}
                      placeholder="Contoh: QRIS Pawon Nusantara (BCA)"
                      className="w-full px-3.5 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/40 text-xs font-bold text-on-surface focus:outline-none focus:border-primary shadow-inner"
                    />
                    <span className="text-[11px] text-on-surface-variant mt-1 block">
                      Nama usaha atau merchant yang ditampilkan di atas kode QR pada layar kasir.
                    </span>
                  </div>

                  {/* Input Unggah Gambar QRIS */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-on-surface block">
                      Gambar Kode QRIS Statis <span className="text-error">*</span>
                    </label>

                    <input
                      ref={fileInputQrRef}
                      type="file"
                      accept="image/*"
                      onChange={handleQrFileUpload}
                      className="hidden"
                    />

                    {/* Box Upload Gambar */}
                    <div className="p-4 rounded-2xl bg-surface-container-low border-2 border-dashed border-outline-variant/60 flex flex-col items-center justify-center gap-3 text-center transition-all hover:border-primary/60">
                      {qrisImageUrl ? (
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-44 h-44 p-2 bg-white rounded-2xl border-2 border-slate-200 shadow-sm flex items-center justify-center overflow-hidden">
                            <img
                              src={qrisImageUrl}
                              alt="Gambar QRIS Statis Restoran"
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                              ✓ Gambar QRIS Tersedia
                            </span>
                            <button
                              type="button"
                              onClick={() => fileInputQrRef.current?.click()}
                              className="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-xs font-bold text-on-surface cursor-pointer transition-all"
                            >
                              Ganti Gambar
                            </button>
                            <button
                              type="button"
                              onClick={() => setQrisImageUrl("")}
                              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-700 cursor-pointer transition-all"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2.5 py-4">
                          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                            <span className="material-symbols-outlined text-3xl">add_photo_alternate</span>
                          </div>
                          <div>
                            <span className="text-xs font-bold text-on-surface block">
                              Belum ada gambar QRIS kustom
                            </span>
                            <span className="text-[11px] text-on-surface-variant block mt-0.5">
                              Format didukung: PNG, JPG, JPEG, WEBP (Maksimal 5MB)
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => fileInputQrRef.current?.click()}
                              className="px-4 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary/90 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                            >
                              Pilih File Gambar QRIS
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setQrisImageUrl(
                                  "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=00020101021226670014ID.LINKAJA.WWW01189360001400000102035204581253033605802ID5915PAWON+NUSANTARA6007JAKARTA61051219062070703A016304"
                                )
                              }
                              className="px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-xs font-bold text-on-surface transition-all cursor-pointer"
                            >
                              Gunakan Contoh QRIS Resto
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Alternatif Input Link / URL Gambar */}
                    <div className="mt-2">
                      <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                        Atau Masukkan URL Gambar QRIS:
                      </label>
                      <input
                        type="text"
                        value={qrisImageUrl}
                        onChange={(e) => setQrisImageUrl(e.target.value)}
                        placeholder="https://... atau data:image/..."
                        className="w-full px-3.5 py-2 bg-surface-container-low rounded-xl border border-outline-variant/40 text-xs font-mono text-on-surface focus:outline-none focus:border-primary shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Input Petunjuk Kasir & Pelanggan */}
                  <div>
                    <label className="text-xs font-bold text-on-surface block mb-1.5">
                      Petunjuk / Catatan Kasir &amp; Pelanggan
                    </label>
                    <textarea
                      rows={2}
                      value={qrisInstructions}
                      onChange={(e) => setQrisInstructions(e.target.value)}
                      placeholder="Petunjuk pemindaian QRIS..."
                      className="w-full px-3.5 py-2 bg-surface-container-low rounded-xl border border-outline-variant/40 text-xs text-on-surface focus:outline-none focus:border-primary shadow-inner"
                    />
                  </div>

                  {/* Tombol Simpan */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container-high">
                    <button
                      type="button"
                      onClick={handleSaveQrisSettings}
                      disabled={isSavingQris}
                      className="px-6 py-2.5 rounded-xl bg-[#003629] hover:bg-[#00261d] active:scale-95 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md cursor-pointer transition-all"
                    >
                      <span className="material-symbols-outlined text-base">save</span>
                      <span>{isSavingQris ? "Menyimpan..." : "Simpan Pengaturan QRIS"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Kolom Kanan: Pratinjau Tampilan Kasir POS (5 Cols) */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <div className="p-5 rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-xs flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-primary">visibility</span>
                      <span>Pratinjau di Layar Kasir POS</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                      Live Preview
                    </span>
                  </div>

                  {/* Mock Container Pop-up Kasir */}
                  <div className="p-5 bg-[#f0f4f9] rounded-2xl border border-slate-200/80 flex flex-col items-center text-center gap-3">
                    <span className="text-sm font-black text-slate-900">
                      {qrisLabel || "QRIS Kasir Pawon Nusantara (BCA)"}
                    </span>

                    <div className="w-52 h-52 bg-white p-3 rounded-2xl shadow-sm border-2 border-slate-200 flex items-center justify-center overflow-hidden">
                      <img
                        src={
                          qrisImageUrl ||
                          "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=00020101021226670014ID.LINKAJA.WWW01189360001400000102035204581253033605802ID5915PAWON+NUSANTARA6007JAKARTA61051219062070703A016304"
                        }
                        alt="QRIS Preview"
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <div className="bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200 text-emerald-900 text-xs font-medium max-w-xs leading-relaxed">
                      {qrisInstructions ||
                        "Arahkan layar ini ke pelanggan untuk dipindai via BCA Mobile, GoPay, OVO, atau ShopeePay."}
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-[11px] text-blue-900 flex items-start gap-2">
                    <span className="material-symbols-outlined text-base text-blue-700 shrink-0 mt-0.5">info</span>
                    <span>
                      Gambar dan label QRIS di atas akan langsung muncul saat kasir mengklik tombol <strong>QRIS Statis</strong> di kasir.
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ==================== SUB-TAB 2: DATA REKENING BANK TRANSFER ==================== */}
          {paymentSubTab === "bank" && (
            <div className="flex flex-col gap-6">
              
              {/* Info Header Banner */}
              <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-2xl font-bold">account_balance</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-base font-bold text-on-surface">
                      Daftar Rekening Bank Restoran ({bankAccounts.length})
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      Dapat di-input lebih dari 1 rekening. Kasir dapat memilih rekening tujuan secara fleksibel saat konfirmasi pembayaran transfer di POS.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddBankAccount}
                  className="px-4 py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary/90 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs active:scale-95 transition-all shrink-0"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  <span>Tambah Rekening Baru</span>
                </button>
              </div>

              {/* Cards Grid Rekening Bank */}
              {bankAccounts.length === 0 ? (
                <div className="p-12 text-center rounded-3xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-surface-container text-outline flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl">account_balance</span>
                  </div>
                  <h4 className="font-bold text-base text-on-surface">Belum Ada Rekening Bank</h4>
                  <p className="text-xs text-on-surface-variant max-w-sm">
                    Tambahkan rekening bank pertama Anda (misal: BCA, Mandiri, BRI) agar kasir dapat menampilkan nomor rekening saat pelanggan membayar via transfer.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenAddBankAccount}
                    className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold cursor-pointer transition-all shadow-xs"
                  >
                    + Tambah Rekening Pertama
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bankAccounts.map((acc) => {
                    const isBca = acc.bankName.toUpperCase().includes("BCA");
                    const isMandiri = acc.bankName.toUpperCase().includes("MANDIRI");
                    const isBri = acc.bankName.toUpperCase().includes("BRI");
                    const isBni = acc.bankName.toUpperCase().includes("BNI");
                    const isBsi = acc.bankName.toUpperCase().includes("BSI");

                    const cardBg = isBca
                      ? "bg-linear-to-br from-[#003629] to-[#014736] text-white"
                      : isMandiri
                      ? "bg-linear-to-br from-[#00264d] to-[#003b73] text-white"
                      : isBri
                      ? "bg-linear-to-br from-[#003b73] to-[#00529c] text-white"
                      : isBni
                      ? "bg-linear-to-br from-[#004d40] to-[#00695c] text-white"
                      : isBsi
                      ? "bg-linear-to-br from-[#004d40] to-[#00796b] text-white"
                      : "bg-linear-to-br from-slate-800 to-slate-900 text-white";

                    return (
                      <div
                        key={acc.id}
                        className={`p-5 rounded-3xl shadow-sm flex flex-col justify-between min-h-[195px] relative overflow-hidden transition-all hover:scale-[1.01] ${cardBg}`}
                      >
                        {/* Top Bank Name & Badges */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-2xl opacity-90">
                              account_balance
                            </span>
                            <span className="font-black text-lg tracking-wide uppercase">
                              {acc.bankName}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {acc.isDefault ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-300 text-amber-950 flex items-center gap-1 shadow-2xs">
                                <span>★</span>
                                <span>UTAMA</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSetDefaultBankAccount(acc)}
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/15 hover:bg-white/25 text-white cursor-pointer transition-all"
                                title="Jadikan rekening utama default"
                              >
                                Set Utama
                              </button>
                            )}

                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                acc.isActive !== false
                                  ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40"
                                  : "bg-white/10 text-white/60"
                              }`}
                            >
                              {acc.isActive !== false ? "Aktif" : "Nonaktif"}
                            </span>
                          </div>
                        </div>

                        {/* Middle: Nomor Rekening */}
                        <div className="my-3">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-white/70 block">
                            Nomor Rekening:
                          </span>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <span className="font-mono font-black text-xl sm:text-2xl tracking-wider truncate">
                              {acc.accountNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  acc.accountNumber.replace(/\D/g, "") || acc.accountNumber
                                );
                                alert(`Nomor rekening ${acc.bankName} (${acc.accountNumber}) berhasil disalin!`);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold text-white cursor-pointer transition-all shrink-0"
                              title="Salin nomor rekening"
                            >
                              Salin
                            </button>
                          </div>
                          <span className="text-xs text-white/80 font-medium block mt-1 truncate">
                            a/n {acc.accountName}
                          </span>
                        </div>

                        {/* Bottom Actions */}
                        <div className="flex items-center justify-between pt-2.5 border-t border-white/15 text-xs">
                          <button
                            type="button"
                            onClick={() => handleToggleBankAccountActive(acc)}
                            className="text-[11px] font-bold text-white/80 hover:text-white cursor-pointer transition-colors"
                          >
                            {acc.isActive !== false ? "Nonaktifkan" : "Aktifkan"}
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditBankAccount(acc)}
                              className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white cursor-pointer transition-all"
                              title="Edit Rekening"
                            >
                              <span className="material-symbols-outlined text-base">edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBankAccount(acc.id, acc.bankName)}
                              className="p-1.5 rounded-lg bg-white/15 hover:bg-rose-600/80 text-white cursor-pointer transition-all"
                              title="Hapus Rekening"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

        </div>
      )}


      {/* ==================== POP-UP REVIEW DATA IMPORT ==================== */}
      {importModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl bg-surface-container-lowest p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-secondary text-on-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">preview</span>
                </div>
                <div>
                  <h2 className="font-headline-sm text-lg font-bold text-on-surface">
                    Review Data Import ({importModal.type === "products" ? "Katalog Produk" : "Data Meja"})
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    File: <span className="font-mono font-bold text-primary">{importModal.fileName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setImportModal({ ...importModal, isOpen: false })}
                className="p-1.5 rounded-lg hover:bg-surface-container text-outline transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Validation Metric Badges */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col">
                <span className="text-[11px] font-bold text-on-surface-variant uppercase">Total Baris</span>
                <span className="text-xl font-bold text-on-surface">{importModal.parsedRows.length}</span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col">
                <span className="text-[11px] font-bold text-emerald-800 uppercase">Data Valid Siap Simpan</span>
                <span className="text-xl font-bold text-emerald-700">{importModal.validRows.length}</span>
              </div>
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex flex-col">
                <span className="text-[11px] font-bold text-rose-800 uppercase">Data Tidak Sesuai (Error)</span>
                <span className="text-xl font-bold text-rose-700">{importModal.invalidRows.length}</span>
              </div>
            </div>

            {/* Notifikasi jika ada data tidak sesuai */}
            {importModal.invalidRows.length > 0 && (
              <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-2.5 text-xs text-rose-900">
                <span className="material-symbols-outlined text-rose-600 text-lg shrink-0 mt-0.5">
                  warning
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-bold">
                    Peringatan: Terdapat {importModal.invalidRows.length} baris data yang tidak sesuai format!
                  </span>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                    {importModal.invalidRows.slice(0, 5).map((err, i) => (
                      <li key={i}>
                        Baris {err.rowNumber}: <span className="font-semibold">{err.reason}</span>
                      </li>
                    ))}
                    {importModal.invalidRows.length > 5 && (
                      <li>... dan {importModal.invalidRows.length - 5} baris lainnya.</li>
                    )}
                  </ul>
                  <span className="text-[11px] text-rose-700 mt-1">
                    Hanya data yang valid yang akan dimasukkan ke dalam sistem saat Anda mengonfirmasi.
                  </span>
                </div>
              </div>
            )}

            {/* Info Fleksibilitas Foto Produk pada Import Excel */}
            {importModal.type === "products" && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2.5 text-xs text-blue-900">
                <span className="material-symbols-outlined text-blue-600 text-lg shrink-0">image</span>
                <span className="text-[11px] leading-relaxed">
                  <strong>Foto Produk Fleksibel:</strong> Gambar produk tidak mandatori pada import file Excel. Produk tanpa foto tetap berhasil diimpor dan foto dapat diunggah menyusul kapan saja melalui tombol <strong>Edit</strong> di katalog produk.
                </span>
              </div>
            )}

            {/* Preview Table of Valid Rows */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-on-surface">Pratinjau Data Valid (Maks 10 baris pertama):</span>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-outline-variant/30">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-surface-container-low text-on-surface-variant font-bold sticky top-0">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      {importModal.type === "products" ? (
                        <>
                          <th className="py-2 px-3">Foto</th>
                          <th className="py-2 px-3">Kode</th>
                          <th className="py-2 px-3">Nama Produk</th>
                          <th className="py-2 px-3">Kategori</th>
                          <th className="py-2 px-3">Harga</th>
                          <th className="py-2 px-3">Status</th>
                        </>
                      ) : (
                        <>
                          <th className="py-2 px-3">No. Meja</th>
                          <th className="py-2 px-3">Nama Tampilan</th>
                          <th className="py-2 px-3">Area</th>
                          <th className="py-2 px-3">Kapasitas</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container">
                    {importModal.validRows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-surface-container-low/40">
                        <td className="py-2 px-3 text-outline">{i + 1}</td>
                        {importModal.type === "products" ? (
                          <>
                            <td className="py-2 px-3">
                              {row.imageUrl || row.image ? (
                                <img
                                  src={row.imageUrl || row.image}
                                  alt={row.name}
                                  className="w-8 h-8 rounded-lg object-cover border border-outline-variant/30"
                                />
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[10px] font-medium whitespace-nowrap">
                                  Menyusul
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-primary">{row.code}</td>
                            <td className="py-2 px-3 font-semibold">{row.name}</td>
                            <td className="py-2 px-3">{row.category}</td>
                            <td className="py-2 px-3 font-bold">{formatCurrency(row.price)}</td>
                            <td className="py-2 px-3">{row.isAvailable ? "Tersedia" : "Habis"}</td>
                          </>
                        ) : (
                          <>
                            <td className="py-2 px-3 font-bold text-primary">{row.tableNumber}</td>
                            <td className="py-2 px-3">{row.displayName}</td>
                            <td className="py-2 px-3 uppercase">{row.area}</td>
                            <td className="py-2 px-3">{row.capacity} Pax</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-container-high">
              <button
                type="button"
                onClick={() => setImportModal({ ...importModal, isOpen: false })}
                className="px-4 py-2 rounded-xl bg-surface-container text-on-surface text-xs font-bold hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={importModal.validRows.length === 0}
                onClick={handleConfirmImport}
                className="px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
              >
                Konfirmasi &amp; Simpan ({importModal.validRows.length} Data Valid)
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ==================== MANUAL PRODUCT MODAL ==================== */}
      {productModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-surface-container-lowest p-6 shadow-2xl flex flex-col gap-4 border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <h2 className="font-headline-sm text-lg font-bold text-on-surface">
                {productModal.mode === "add" ? "Tambah Produk Menu Baru" : "Edit Produk Menu"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setProductModal({ ...productModal, isOpen: false });
                  setProductImage("");
                  setProductImageUrlInput("");
                  setImageError("");
                }}
                className="p-1 rounded-lg hover:bg-surface-container text-outline transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="flex flex-col gap-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-on-surface text-xs leading-5">Kode Produk</label>
                  <input
                    type="text"
                    name="code"
                    defaultValue={productModal.data?.code || ""}
                    placeholder="Contoh: PRD-011"
                    className="h-10 w-full px-3 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-mono text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-on-surface text-xs leading-5">Kategori *</label>
                  <select
                    name="category"
                    defaultValue={productModal.data?.category || (categories.length > 1 ? categories[1] : "Makanan Utama")}
                    className="h-10 w-full px-3 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-bold text-xs cursor-pointer"
                  >
                    {categories.slice(1).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* INPUT GAMBAR / FOTO PRODUK */}
              <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <label className="font-bold text-on-surface">Foto Produk</label>
                    {productModal.mode === "add" ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold border border-rose-200">
                        * Wajib Diunggah (Mandatori)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[10px] font-medium border border-outline-variant/30">
                        Opsional / Bisa Diubah (Menyusul)
                      </span>
                    )}
                  </div>
                  {productImage && (
                    <button
                      type="button"
                      onClick={() => {
                        setProductImage("");
                        setProductImageUrlInput("");
                        if (productModal.mode === "add") {
                          setImageError("Foto produk wajib diunggah untuk penambahan produk manual!");
                        }
                      }}
                      className="text-[11px] text-error font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                      <span>Hapus Foto</span>
                    </button>
                  )}
                </div>

                {productImage ? (
                  <div className="flex items-center gap-3 pt-1">
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-outline-variant/40 shadow-xs shrink-0 bg-surface-container">
                      <img
                        src={productImage}
                        alt="Pratinjau Foto Produk"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        Foto Berhasil Dipilih
                      </span>
                      <p className="text-[11px] text-on-surface-variant line-clamp-2">
                        Foto akan tampil pada katalog produk kasir dan e-menu pemesanan pelanggan.
                      </p>
                      <label className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline cursor-pointer w-fit mt-0.5">
                        <span className="material-symbols-outlined text-sm">edit</span>
                        <span>Ganti Foto</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageFileChange}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 pt-1">
                    <label
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                        imageError
                          ? "border-rose-400 bg-rose-50/50"
                          : "border-outline-variant hover:border-primary hover:bg-surface-container/60"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1">
                        <span className="material-symbols-outlined text-xl">add_photo_alternate</span>
                      </div>
                      <span className="font-bold text-xs text-on-surface">Pilih File Foto Produk</span>
                      <span className="text-[10px] text-on-surface-variant mt-0.5">
                        JPG, PNG, WEBP (Maksimal 5MB)
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageFileChange}
                      />
                    </label>
                  </div>
                )}

                {imageError && (
                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold flex items-center gap-1.5 mt-1">
                    <span className="material-symbols-outlined text-sm shrink-0">error</span>
                    <span>{imageError}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface">Nama Produk Menu *</label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={productModal.data?.name || ""}
                  placeholder="Contoh: Ayam Bakar Madu"
                  className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface">Harga Jual (Rp) *</label>
                <input
                  type="number"
                  name="price"
                  required
                  min={1000}
                  step={500}
                  defaultValue={productModal.data?.price || 35000}
                  className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-bold"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface">Deskripsi Menu</label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={productModal.data?.description || ""}
                  placeholder="Keterangan bumbu, sajian, atau bahan makanan..."
                  className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isAvailableInput"
                  name="isAvailable"
                  defaultChecked={productModal.data?.isAvailable ?? true}
                  className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                />
                <label htmlFor="isAvailableInput" className="font-bold text-on-surface cursor-pointer">
                  Produk Tersedia untuk Dipesan (Ready Stock)
                </label>
              </div>

              {/* INPUT PELENGKAP / ADD-ONS MAKANAN */}
              <div className="flex flex-col gap-2.5 p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 mt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-amber-700">room_service</span>
                    <label className="font-bold text-on-surface text-xs">Pilihan Tambahan / Pelengkap Makanan</label>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                    {productAddons.length} Pelengkap
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Pelengkap ini akan muncul sebagai opsi tambahan saat tamu atau kasir memilih menu ini.
                </p>

                {/* List of currently configured addons */}
                {productAddons.length > 0 ? (
                  <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                    {productAddons.map((addon, aIdx) => (
                      <div
                        key={addon.id || aIdx}
                        className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-xs shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="material-symbols-outlined text-sm text-emerald-700 shrink-0">check_circle</span>
                          <span className="font-semibold text-on-surface truncate">{addon.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-bold text-emerald-800 text-[11px]">
                            +{formatCurrency(addon.price)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setProductAddons((prev) => prev.filter((_, idx) => idx !== aIdx));
                            }}
                            className="p-1 rounded hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
                            title="Hapus Pelengkap"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-dashed border-outline-variant/40 text-center text-[11px] text-on-surface-variant">
                    Belum ada pelengkap khusus untuk produk ini.
                  </div>
                )}

                {/* Form to add a new addon */}
                <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/20">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newAddonName}
                      onChange={(e) => setNewAddonName(e.target.value)}
                      placeholder="Nama Pelengkap (misal: Ekstra Sambal Bajak / Terasi)"
                      className="flex-1 p-2 text-xs rounded-lg bg-surface-container-lowest border border-outline-variant/30 focus:outline-none focus:border-primary"
                    />
                    <div className="flex items-center gap-1 w-28 shrink-0">
                      <span className="text-[11px] font-bold text-on-surface-variant">Rp</span>
                      <input
                        type="number"
                        min={0}
                        step={500}
                        value={newAddonPrice}
                        onChange={(e) => setNewAddonPrice(Number(e.target.value) || 0)}
                        placeholder="Harga"
                        className="w-full p-2 text-xs rounded-lg bg-surface-container-lowest border border-outline-variant/30 focus:outline-none focus:border-primary font-mono font-bold"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newAddonName.trim()) return;
                        setProductAddons((prev) => [
                          ...prev,
                          {
                            id: `addon-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                            name: newAddonName.trim(),
                            price: Number(newAddonPrice) || 0,
                          },
                        ]);
                        setNewAddonName("");
                        setNewAddonPrice(5000);
                      }}
                      disabled={!newAddonName.trim()}
                      className="px-3 py-2 rounded-lg bg-[#003629] text-white text-xs font-bold hover:bg-[#00261d] disabled:opacity-40 transition-all shrink-0 cursor-pointer"
                    >
                      + Tambah
                    </button>
                  </div>

                  {/* Preset Suggestions */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-on-surface-variant font-bold">Template Cepat:</span>
                    {[
                      { name: "Ekstra Sambal Bajak / Terasi", price: 5000 },
                      { name: "Lalapan Segar Komplit", price: 5000 },
                      { name: "Tahu & Tempe Bacem Hangat", price: 10000 },
                      { name: "Ekstra Es Batu", price: 2000 },
                    ].map((preset, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => {
                          if (productAddons.some((a) => a.name.toLowerCase() === preset.name.toLowerCase())) return;
                          setProductAddons((prev) => [
                            ...prev,
                            {
                              id: `addon-preset-${Date.now()}-${pIdx}`,
                              name: preset.name,
                              price: preset.price,
                            },
                          ]);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant/30 hover:border-primary hover:text-primary transition-colors cursor-pointer"
                      >
                        + {preset.name} (+{formatCurrency(preset.price)})
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => {
                    setProductModal({ ...productModal, isOpen: false });
                    setProductImage("");
                    setProductImageUrlInput("");
                    setImageError("");
                  }}
                  className="px-4 py-2 rounded-xl bg-surface-container text-on-surface font-bold hover:bg-surface-container-high cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary text-on-primary font-bold hover:bg-primary/90 cursor-pointer shadow-xs"
                >
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ==================== MANUAL TABLE MODAL ==================== */}
      {tableModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-2xl flex flex-col gap-4 border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <h2 className="font-headline-sm text-lg font-bold text-on-surface">
                {tableModal.mode === "add" ? "Tambah Meja Baru" : "Edit Data Meja"}
              </h2>
              <button
                onClick={() => setTableModal({ ...tableModal, isOpen: false })}
                className="p-1 rounded-lg hover:bg-surface-container text-outline"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveTable} className="flex flex-col gap-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Nomor Meja *</label>
                  <input
                    type="text"
                    name="tableNumber"
                    required
                    defaultValue={tableModal.data?.tableNumber || ""}
                    placeholder="Contoh: Meja 21"
                    className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-bold"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Nama Tampilan</label>
                  <input
                    type="text"
                    name="displayName"
                    defaultValue={tableModal.data?.displayName || ""}
                    placeholder="Contoh: Meja 21 VIP"
                    className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Area / Lokasi *</label>
                  <select
                    name="area"
                    defaultValue={tableModal.data?.area || tableAreasList[0]?.code || "indoor"}
                    className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-bold cursor-pointer"
                  >
                    {tableAreasList.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Kapasitas (Pax) *</label>
                  <input
                    type="number"
                    name="capacity"
                    required
                    min={1}
                    max={30}
                    defaultValue={tableModal.data?.capacity || 4}
                    className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-bold"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface">Status Awal</label>
                <select
                  name="status"
                  defaultValue={tableModal.data?.status || "tersedia"}
                  className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-bold cursor-pointer"
                >
                  <option value="tersedia">Tersedia</option>
                  <option value="terisi">Terisi</option>
                  <option value="reservasi">Reservasi</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => setTableModal({ ...tableModal, isOpen: false })}
                  className="px-4 py-2 rounded-xl bg-surface-container text-on-surface font-bold hover:bg-surface-container-high cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary text-on-primary font-bold hover:bg-primary/90 cursor-pointer shadow-xs"
                >
                  Simpan Meja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ==================== MODAL VIEW & PRINT QR MEJA TUNGGAL ==================== */}
      <TableQrModal
        isOpen={!!selectedQrTable}
        onClose={() => setSelectedQrTable(null)}
        table={selectedQrTable}
        restaurantName={settings.restaurantName}
        branchName={settings.branchName}
        logoUrl={settings.logoUrl}
        socials={settings}
      />

      {/* ==================== MODAL CETAK SEMUA QR MEJA (MASSAL) ==================== */}
      <PrintAllTablesQrModal
        isOpen={isPrintAllQrOpen}
        onClose={() => setIsPrintAllQrOpen(false)}
        tables={tables}
        restaurantName={settings.restaurantName}
        branchName={settings.branchName}
        logoUrl={settings.logoUrl}
        socials={settings}
      />

      {/* ==================== MODAL TAMBAH / EDIT PROMO & DISKON ==================== */}
      {promoModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-surface-container-lowest p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">local_offer</span>
                <h2 className="font-headline-sm text-lg font-bold text-on-surface">
                  {promoModal.mode === "add" ? "Tambah Promo / Diskon Baru" : "Edit Promo / Diskon"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPromoModal({ ...promoModal, isOpen: false })}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-outline cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <form onSubmit={handleSavePromo} className="flex flex-col gap-4 text-xs">
              {/* Tipe Diskon Switcher */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-on-surface">Tipe Diskon *</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-surface-container-low rounded-xl border border-outline-variant/30">
                  <button
                    type="button"
                    onClick={() => setPromoFormType("percentage")}
                    className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      promoFormType === "percentage"
                        ? "bg-[#003629] text-white shadow-xs"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">percent</span>
                    <span>Persentase (%)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromoFormType("fixed")}
                    className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      promoFormType === "fixed"
                        ? "bg-[#003629] text-white shadow-xs"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">payments</span>
                    <span>Nominal Rupiah (Rp)</span>
                  </button>
                </div>
              </div>

              {/* Kode Promo & Nilai Diskon */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Kode Promo *</label>
                  <input
                    type="text"
                    name="code"
                    required
                    defaultValue={promoModal.data?.code || ""}
                    placeholder="Contoh: HEMAT10"
                    className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-mono font-bold uppercase"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">
                    {promoFormType === "percentage" ? "Nilai Diskon (%) *" : "Nilai Diskon (Rp) *"}
                  </label>
                  <input
                    type="number"
                    name="discountValue"
                    required
                    min={1}
                    max={promoFormType === "percentage" ? 100 : 10000000}
                    defaultValue={promoModal.data?.discountValue || (promoFormType === "percentage" ? 10 : 20000)}
                    className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-bold"
                  />
                </div>
              </div>

              {/* Nama Promo */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface">Nama Promo / Keterangan Singkat *</label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={promoModal.data?.name || ""}
                  placeholder="Contoh: Diskon Member 10%"
                  className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-bold"
                />
              </div>

              {/* Deskripsi Lengkap */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface">Deskripsi (Opsional)</label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={promoModal.data?.description || ""}
                  placeholder="Contoh: Potongan khusus untuk pelanggan terdaftar atau pengunjung setia"
                  className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Minimal Belanja & Maksimal Potongan */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Minimal Order (Rp)</label>
                  <input
                    type="number"
                    name="minOrderAmount"
                    min={0}
                    defaultValue={promoModal.data?.minOrderAmount || 0}
                    placeholder="0 = Tanpa syarat"
                    className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-bold"
                  />
                  <span className="text-[10px] text-on-surface-variant">0 jika tanpa minimal belanja</span>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">
                    Maks. Diskon (Rp) {promoFormType !== "percentage" && "(Khusus %)"}
                  </label>
                  <input
                    type="number"
                    name="maxDiscount"
                    min={0}
                    disabled={promoFormType !== "percentage"}
                    defaultValue={promoModal.data?.maxDiscount || ""}
                    placeholder="Kosongkan jika tanpa batas"
                    className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-bold disabled:opacity-40"
                  />
                  <span className="text-[10px] text-on-surface-variant">Batas maksimal potongan</span>
                </div>
              </div>

              {/* Target Pelanggan Promo */}
              <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-surface-container-low border border-outline-variant/30">
                <label className="font-bold text-on-surface flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-primary">groups</span>
                    <span>Target Pelanggan Promo *</span>
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-normal">
                    Pemberian promo khusus member
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={promoCustomerScope}
                    onChange={(e) => setPromoCustomerScope(e.target.value as any)}
                    className="p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 focus:outline-none focus:border-primary font-bold cursor-pointer text-xs"
                  >
                    <option value="all">Semua Pelanggan (Umum)</option>
                    <option value="member">Semua Member Terdaftar</option>
                    <option value="gold">⭐ Member Gold &amp; VIP Saja</option>
                    <option value="vip">👑 Khusus Member VIP Saja</option>
                    <option value="personal">👤 Pelanggan Tertentu (Personal)</option>
                  </select>

                  {promoCustomerScope === "personal" ? (
                    <select
                      value={promoAssignedCustomerId}
                      onChange={(e) => setPromoAssignedCustomerId(e.target.value)}
                      required={promoCustomerScope === "personal"}
                      className="p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 focus:outline-none focus:border-primary font-bold cursor-pointer text-xs"
                    >
                      <option value="">-- Pilih Nama Pelanggan --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.tier.toUpperCase()}) - {c.phone}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-surface-container-lowest/60 text-[11px] text-on-surface-variant flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-primary">info</span>
                      <span>
                        {promoCustomerScope === "all"
                          ? "Berlaku umum untuk semua pengunjung tanpa syarat keanggotaan."
                          : promoCustomerScope === "member"
                          ? "Hanya bisa diklaim jika transaksi terhubung dengan data member."
                          : promoCustomerScope === "gold"
                          ? "Hanya untuk pelanggan tier Gold dan VIP."
                          : "Eksklusif tier VIP dengan reward loyalitas tertinggi."}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Saluran Berlaku & Status Aktif */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Berlaku Untuk</label>
                  <select
                    name="scope"
                    defaultValue={promoModal.data?.scope || "all"}
                    className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-bold cursor-pointer"
                  >
                    <option value="all">Semua Saluran</option>
                    <option value="dine_in">Khusus Dine-in</option>
                    <option value="takeaway">Khusus Take Away</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="promoIsActive"
                    name="isActive"
                    defaultChecked={promoModal.mode === "add" ? true : promoModal.data?.isActive ?? true}
                    className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                  />
                  <label htmlFor="promoIsActive" className="font-bold text-on-surface cursor-pointer select-none">
                    Status Promo Aktif
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-high mt-2">
                <button
                  type="button"
                  onClick={() => setPromoModal({ ...promoModal, isOpen: false })}
                  className="px-4 py-2 rounded-xl bg-surface-container text-on-surface font-bold hover:bg-surface-container-high cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary text-on-primary font-bold hover:bg-primary/90 cursor-pointer shadow-xs"
                >
                  Simpan Promo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ==================== MODAL BROADCAST PROMO WHATSAPP ==================== */}
      {broadcastModal.isOpen && broadcastModal.promo && (() => {
        const promo = broadcastModal.promo;
        const diskonLabel =
          promo.discountType === "percentage"
            ? `${promo.discountValue}% OFF`
            : `${formatCurrency(promo.discountValue)} OFF`;

        // Compute audience recipients based on filter
        let recipients = customers;
        const pScope = promo.customerScope || "all";

        if (broadcastAudienceScope === "auto") {
          if (pScope === "vip") {
            recipients = customers.filter((c) => c.tier === "vip");
          } else if (pScope === "gold") {
            recipients = customers.filter((c) => c.tier === "vip" || c.tier === "gold");
          } else if (pScope === "personal" && promo.assignedCustomerId) {
            recipients = customers.filter((c) => c.id === promo.assignedCustomerId);
          } else {
            recipients = customers;
          }
        } else if (broadcastAudienceScope === "vip") {
          recipients = customers.filter((c) => c.tier === "vip");
        } else if (broadcastAudienceScope === "gold") {
          recipients = customers.filter((c) => c.tier === "vip" || c.tier === "gold");
        } else if (broadcastAudienceScope === "member") {
          recipients = customers;
        }

        const handleSendSingle = (c: Customer) => {
          const rawPhone = c.phone.replace(/\D/g, "");
          const phoneFormatted = rawPhone.startsWith("0")
            ? "62" + rawPhone.slice(1)
            : rawPhone.startsWith("62")
            ? rawPhone
            : "62" + rawPhone;

          const text = broadcastMessageTemplate
            .replace(/{nama}/g, c.name)
            .replace(/{kode}/g, promo.code)
            .replace(/{diskon}/g, diskonLabel)
            .replace(/{min_order}/g, promo.minOrderAmount ? formatCurrency(promo.minOrderAmount) : "Tanpa minimal")
            .replace(/{nama_resto}/g, settings.restaurantName || "Pawon Nusantara");

          const url = `https://wa.me/${phoneFormatted}?text=${encodeURIComponent(text)}`;
          window.open(url, "_blank");

          setBroadcastSentIds((prev) => (prev.includes(c.id) ? prev : [...prev, c.id]));
        };

        const handleCopyAllPhones = () => {
          const phones = recipients
            .map((c) => c.phone.replace(/\D/g, "").replace(/^0/, "62"))
            .filter(Boolean)
            .join("\n");
          navigator.clipboard.writeText(phones);
          setIsCopiedBroadcastPhones(true);
          setTimeout(() => setIsCopiedBroadcastPhones(false), 2500);
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-2xl rounded-3xl bg-surface-container-lowest p-6 shadow-2xl flex flex-col gap-4 max-h-[92vh] overflow-y-auto border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-2xl">send_to_mobile</span>
                  </div>
                  <div>
                    <h2 className="font-headline-sm text-base font-bold text-on-surface flex items-center gap-2">
                      <span>Broadcast Promo WhatsApp</span>
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-[#003629] font-mono font-bold text-xs border border-emerald-300">
                        {promo.code}
                      </span>
                    </h2>
                    <p className="text-xs text-on-surface-variant">
                      Kirim pesan promo personal langsung ke WhatsApp pelanggan resto
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBroadcastModal({ isOpen: false, promo: null })}
                  className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-outline cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              {/* Template Editor */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-xs text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-emerald-600">edit_note</span>
                    <span>Teks Pesan Broadcast WhatsApp (Bisa Diedit)</span>
                  </label>
                  <span className="text-[10px] text-on-surface-variant">
                    Placeholder otomatis: &#123;nama&#125;, &#123;kode&#125;, &#123;diskon&#125;, &#123;min_order&#125;, &#123;nama_resto&#125;
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={broadcastMessageTemplate}
                  onChange={(e) => setBroadcastMessageTemplate(e.target.value)}
                  className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-xs font-sans text-on-surface focus:outline-none focus:border-primary leading-relaxed resize-none shadow-inner"
                />
                <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                  <span className="text-on-surface-variant font-medium">Klik untuk sisipkan:</span>
                  {["{nama}", "{kode}", "{diskon}", "{min_order}", "{nama_resto}"].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setBroadcastMessageTemplate((prev) => prev + " " + tag)}
                      className="px-2 py-0.5 rounded-md bg-surface-container hover:bg-surface-container-high text-on-surface font-mono font-bold border border-outline-variant/30 cursor-pointer transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter Target Audiens & Actions */}
              <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-primary">filter_list</span>
                  <span className="text-xs font-bold text-on-surface">Target Audiens:</span>
                  <select
                    value={broadcastAudienceScope}
                    onChange={(e) => setBroadcastAudienceScope(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs font-bold text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="auto">
                      Otomatis Sesuai Target Promo ({recipients.length} Orang)
                    </option>
                    <option value="all">Semua Pelanggan ({customers.length} Orang)</option>
                    <option value="vip">
                      Khusus VIP ({customers.filter((c) => c.tier === "vip").length} Orang)
                    </option>
                    <option value="gold">
                      Member Gold &amp; VIP ({customers.filter((c) => c.tier === "vip" || c.tier === "gold").length} Orang)
                    </option>
                    <option value="member">Semua Member ({customers.length} Orang)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleCopyAllPhones}
                  className="px-3 py-1.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/30 text-xs font-bold text-on-surface flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Salin semua nomor telepon audiens terfilter"
                >
                  <span className="material-symbols-outlined text-sm">
                    {isCopiedBroadcastPhones ? "check" : "content_copy"}
                  </span>
                  <span>{isCopiedBroadcastPhones ? "Nomor Disalin!" : "Salin Kontak WA"}</span>
                </button>
              </div>

              {/* Daftar Pelanggan Penerima */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-on-surface">
                    Daftar Pelanggan ({recipients.length} Kontak)
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700">
                    {broadcastSentIds.length} dari {recipients.length} Pesan Terkirim
                  </span>
                </div>

                {recipients.length === 0 ? (
                  <div className="p-8 text-center bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/40 text-on-surface-variant text-xs">
                    Tidak ada pelanggan dalam segmen ini.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                    {recipients.map((c) => {
                      const isSent = broadcastSentIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          className="p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 hover:border-primary/40 flex items-center justify-between gap-3 shadow-2xs transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-black text-xs flex items-center justify-center shrink-0">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-on-surface truncate">
                                  {c.name}
                                </span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                    c.tier === "vip"
                                      ? "bg-purple-100 text-purple-900 border border-purple-200"
                                      : c.tier === "gold"
                                      ? "bg-amber-100 text-amber-900 border border-amber-200"
                                      : "bg-emerald-100 text-emerald-900 border border-emerald-200"
                                  }`}
                                >
                                  {c.tier}
                                </span>
                              </div>
                              <span className="text-[11px] text-on-surface-variant font-mono">
                                {c.phone}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isSent && (
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">check_circle</span>
                                Terkirim
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleSendSingle(c)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                            >
                              <span className="material-symbols-outlined text-sm">send</span>
                              <span>Kirim WA</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-surface-container-high mt-1">
                <span className="text-[11px] text-on-surface-variant">
                  Setiap klik &quot;Kirim WA&quot; akan membuka WhatsApp dengan pesan yang sudah dipersonalisasi nama pelanggan.
                </span>
                <button
                  type="button"
                  onClick={() => setBroadcastModal({ isOpen: false, promo: null })}
                  className="px-5 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 cursor-pointer shadow-xs"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==================== MODAL TAMBAH / EDIT PELANGGAN ==================== */}
      {customerModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-surface-container-lowest p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">person</span>
                <h2 className="font-headline-sm text-lg font-bold text-on-surface">
                  {customerModal.mode === "add" ? "Tambah Pelanggan Baru" : "Edit Data Pelanggan"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCustomerModal({ ...customerModal, isOpen: false })}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="flex flex-col gap-4 text-xs">
              {/* Nama Lengkap */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface">Nama Lengkap Pelanggan *</label>
                <input
                  type="text"
                  required
                  value={customerFormData.name}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                  placeholder="Contoh: Bpk. Hendra Wijaya"
                  className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-medium"
                />
              </div>

              {/* No Handphone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Nomor HP / WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    value={customerFormData.phone}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                    placeholder="Contoh: 0812-3456-7890"
                    className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-mono font-medium"
                  />
                  <span className="text-[10px] text-on-surface-variant">Sebagai ID unik pencarian di POS</span>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Email (Opsional)</label>
                  <input
                    type="email"
                    value={customerFormData.email}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                    placeholder="nama@email.com"
                    className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-medium"
                  />
                </div>
              </div>

              {/* Kategori Member & Poin Loyalitas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Kategori / Tier Member</label>
                  <select
                    value={customerFormData.tier}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, tier: e.target.value as CustomerTier })}
                    className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-bold cursor-pointer"
                  >
                    {customerTiersList.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Poin Loyalitas</label>
                  <input
                    type="number"
                    min="0"
                    value={customerFormData.points}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, points: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-bold"
                  />
                  <span className="text-[10px] text-on-surface-variant">1 Poin per Rp10.000 belanja</span>
                </div>
              </div>

              {/* Catatan Selera / Alergi / Preferensi */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface">Catatan Khusus / Preferensi Selera Makanan</label>
                <textarea
                  rows={2}
                  value={customerFormData.notes}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, notes: e.target.value })}
                  placeholder="Contoh: Alergi kacang, suka pedas level 5, meja favorit Area Indoor 01"
                  className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary resize-none font-medium"
                />
                <span className="text-[10px] text-on-surface-variant">Catatan ini otomatis tampil saat pesanan dibuat di POS kasir</span>
              </div>

              {/* Status Aktif Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="customerIsActive"
                  checked={customerFormData.isActive}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                />
                <label htmlFor="customerIsActive" className="font-bold text-on-surface cursor-pointer select-none">
                  Pelanggan Aktif
                </label>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-high mt-2">
                <button
                  type="button"
                  onClick={() => setCustomerModal({ ...customerModal, isOpen: false })}
                  className="px-4 py-2 rounded-xl bg-surface-container text-on-surface font-bold hover:bg-surface-container-high cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary text-on-primary font-bold hover:bg-primary/90 cursor-pointer shadow-xs"
                >
                  {customerModal.mode === "add" ? "Simpan Pelanggan" : "Perbarui Data"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ==================== MODAL PREVIEW DETAIL PRODUK ==================== */}
      <ProductDetailModal
        isOpen={!!previewProduct}
        onClose={() => setPreviewProduct(null)}
        product={previewProduct}
        previewOnly={true}
        onEdit={(prod) => {
          setProductImage(prod.imageUrl || prod.image || "");
          setProductImageUrlInput(prod.imageUrl || prod.image || "");
          setImageError("");
          setProductAddons(prod.addons ? [...prod.addons] : []);
          setNewAddonName("");
          setNewAddonPrice(5000);
          setProductModal({ isOpen: true, mode: "edit", data: prod });
        }}
      />

      {/* ==================== MODAL EDIT KATEGORI (PRODUK / AREA / MEMBER) ==================== */}
      {editCategoryModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-surface-container-lowest p-6 shadow-2xl flex flex-col gap-4 border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">edit_note</span>
                </div>
                <div>
                  <h2 className="font-headline-sm text-base font-bold text-on-surface">
                    Edit {editCategoryModal.type === "product" ? "Kategori Produk" : editCategoryModal.type === "area" ? "Kategori Area Meja" : "Kategori Member"}
                  </h2>
                  <p className="text-xs text-on-surface-variant">Perbarui nama atau keterangan kategori</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditCategoryModal({ ...editCategoryModal, isOpen: false })}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-outline cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEditCategory} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">Nama Kategori *</label>
                <input
                  type="text"
                  value={editCategoryModal.name}
                  onChange={(e) => setEditCategoryModal({ ...editCategoryModal, name: e.target.value })}
                  placeholder="Nama kategori"
                  required
                  className="p-2.5 rounded-xl bg-surface-container-low text-xs font-bold text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">Keterangan / Deskripsi</label>
                <input
                  type="text"
                  value={editCategoryModal.description || ""}
                  onChange={(e) => setEditCategoryModal({ ...editCategoryModal, description: e.target.value })}
                  placeholder="Deskripsi singkat kategori (opsional)"
                  className="p-2.5 rounded-xl bg-surface-container-low text-xs font-medium text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary"
                />
              </div>

              {editCategoryModal.type === "member" && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-on-surface">Warna Label / Badge</label>
                  <select
                    value={editCategoryModal.badgeColor || "emerald"}
                    onChange={(e) => setEditCategoryModal({ ...editCategoryModal, badgeColor: e.target.value })}
                    className="p-2.5 rounded-xl bg-surface-container-low text-xs font-bold text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="slate">Slate / Abu-abu</option>
                    <option value="blue">Blue / Perak (Silver)</option>
                    <option value="amber">Amber / Emas (Gold)</option>
                    <option value="purple">Purple / Ungu (VIP)</option>
                    <option value="emerald">Emerald / Hijau</option>
                    <option value="rose">Rose / Merah</option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-high mt-1">
                <button
                  type="button"
                  onClick={() => setEditCategoryModal({ ...editCategoryModal, isOpen: false })}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 cursor-pointer shadow-xs"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TAMBAH / EDIT PROMO PRODUK */}
      {productPromoModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface-container-lowest rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-outline-variant/30 flex flex-col gap-4 max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#003629] text-2xl">restaurant_menu</span>
                <h2 className="font-headline-sm text-lg font-bold text-on-surface">
                  {productPromoModal.mode === "add" ? "Tambah Promo Menu / Produk" : "Edit Promo Menu / Produk"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setProductPromoModal({ ...productPromoModal, isOpen: false })}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveProductPromo} className="flex flex-col gap-4 text-xs overflow-y-auto pr-1">
              {/* Nama Promo */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface">Nama Kampanye Promo *</label>
                <input
                  type="text"
                  required
                  value={productPromoForm.name}
                  onChange={(e) => setProductPromoForm({ ...productPromoForm, name: e.target.value })}
                  placeholder="Contoh: Promo Spesial Bebek Crispy / Happy Hour Sore"
                  className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-medium"
                />
              </div>

              {/* Deskripsi */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface">Keterangan / Deskripsi (Opsional)</label>
                <input
                  type="text"
                  value={productPromoForm.description}
                  onChange={(e) => setProductPromoForm({ ...productPromoForm, description: e.target.value })}
                  placeholder="Contoh: Diskon spesial jam makan siang berlaku untuk semua pelanggan"
                  className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-medium"
                />
              </div>

              {/* Tipe & Nilai Diskon */}
              <div className="flex flex-col gap-2 p-3 rounded-2xl bg-surface-container-low/60 border border-outline-variant/20">
                <label className="font-bold text-on-surface">Tipe Diskon &amp; Nilai Potongan *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setProductPromoForm({ ...productPromoForm, discountType: "percentage" })}
                    className={`py-2 px-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1 border transition-all cursor-pointer ${
                      productPromoForm.discountType === "percentage"
                        ? "bg-[#003629] text-white border-[#003629] shadow-xs"
                        : "bg-surface-container text-on-surface border-outline-variant/30 hover:bg-surface-container-high"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">percent</span>
                    <span className="text-[11px]">Persentase (%)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProductPromoForm({ ...productPromoForm, discountType: "fixed" })}
                    className={`py-2 px-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1 border transition-all cursor-pointer ${
                      productPromoForm.discountType === "fixed"
                        ? "bg-[#003629] text-white border-[#003629] shadow-xs"
                        : "bg-surface-container text-on-surface border-outline-variant/30 hover:bg-surface-container-high"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">payments</span>
                    <span className="text-[11px]">Potongan (Rp)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProductPromoForm({ ...productPromoForm, discountType: "special_price" })}
                    className={`py-2 px-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1 border transition-all cursor-pointer ${
                      productPromoForm.discountType === "special_price"
                        ? "bg-[#003629] text-white border-[#003629] shadow-xs"
                        : "bg-surface-container text-on-surface border-outline-variant/30 hover:bg-surface-container-high"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">sell</span>
                    <span className="text-[11px]">Harga Jadi (Rp)</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold text-on-surface-variant min-w-[90px]">
                    {productPromoForm.discountType === "percentage"
                      ? "Diskon (%):"
                      : productPromoForm.discountType === "fixed"
                      ? "Hemat (Rp):"
                      : "Harga Baru (Rp):"}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={productPromoForm.discountType === "percentage" ? 100 : 10000000}
                    required
                    value={productPromoForm.discountValue || ""}
                    onChange={(e) =>
                      setProductPromoForm({
                        ...productPromoForm,
                        discountValue: Math.max(0, parseInt(e.target.value) || 0),
                      })
                    }
                    className="flex-1 p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 font-bold text-on-surface focus:outline-none focus:border-primary text-sm"
                    placeholder={productPromoForm.discountType === "percentage" ? "Contoh: 20" : "Contoh: 10000"}
                  />
                </div>
              </div>

              {/* Target Cakupan Produk */}
              <div className="flex flex-col gap-2 p-3 rounded-2xl bg-surface-container-low/60 border border-outline-variant/20">
                <label className="font-bold text-on-surface">Target Cakupan Menu *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setProductPromoForm({ ...productPromoForm, targetType: "specific_products" })}
                    className={`py-2 px-2.5 rounded-xl font-bold text-center border transition-all cursor-pointer ${
                      productPromoForm.targetType === "specific_products"
                        ? "bg-[#003629] text-white border-[#003629] shadow-xs"
                        : "bg-surface-container text-on-surface border-outline-variant/30 hover:bg-surface-container-high"
                    }`}
                  >
                    Menu Pilihan ({productPromoForm.targetProductIds.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setProductPromoForm({ ...productPromoForm, targetType: "category" })}
                    className={`py-2 px-2.5 rounded-xl font-bold text-center border transition-all cursor-pointer ${
                      productPromoForm.targetType === "category"
                        ? "bg-[#003629] text-white border-[#003629] shadow-xs"
                        : "bg-surface-container text-on-surface border-outline-variant/30 hover:bg-surface-container-high"
                    }`}
                  >
                    Per Kategori
                  </button>

                  <button
                    type="button"
                    onClick={() => setProductPromoForm({ ...productPromoForm, targetType: "all_products" })}
                    className={`py-2 px-2.5 rounded-xl font-bold text-center border transition-all cursor-pointer ${
                      productPromoForm.targetType === "all_products"
                        ? "bg-[#003629] text-white border-[#003629] shadow-xs"
                        : "bg-surface-container text-on-surface border-outline-variant/30 hover:bg-surface-container-high"
                    }`}
                  >
                    Semua Menu
                  </button>
                </div>

                {/* Sub-UI jika Kategori */}
                {productPromoForm.targetType === "category" && (
                  <div className="flex flex-col gap-1 mt-2">
                    <label className="text-[11px] font-bold text-on-surface">Pilih Kategori Menu:</label>
                    <select
                      value={productPromoForm.targetCategory}
                      onChange={(e) => setProductPromoForm({ ...productPromoForm, targetCategory: e.target.value })}
                      className="p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 font-bold text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                    >
                      {categoriesList.map((cat) => (
                        <option key={cat.id || cat.name} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Sub-UI jika Specific Products */}
                {productPromoForm.targetType === "specific_products" && (
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-on-surface">
                        Centang Menu ({productPromoForm.targetProductIds.length} dipilih):
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setProductPromoForm({
                              ...productPromoForm,
                              targetProductIds: products.map((p) => p.id),
                            })
                          }
                          className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                        >
                          Pilih Semua
                        </button>
                        <span className="text-outline-variant">•</span>
                        <button
                          type="button"
                          onClick={() =>
                            setProductPromoForm({
                              ...productPromoForm,
                              targetProductIds: [],
                            })
                          }
                          className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          Hapus Pilihan
                        </button>
                      </div>
                    </div>

                    {/* Filter pencarian menu di modal */}
                    <input
                      type="text"
                      value={productSearchInPromoModal}
                      onChange={(e) => setProductSearchInPromoModal(e.target.value)}
                      placeholder="Cari nama menu..."
                      className="p-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs focus:outline-none focus:border-primary"
                    />

                    {/* Daftar Checklist Produk */}
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-2 flex flex-col gap-1.5 divide-y divide-surface-container-high">
                      {products
                        .filter((p) =>
                          productSearchInPromoModal
                            ? p.name.toLowerCase().includes(productSearchInPromoModal.toLowerCase()) ||
                              (p.category && p.category.toLowerCase().includes(productSearchInPromoModal.toLowerCase()))
                            : true
                        )
                        .map((prod) => {
                          const isSelected = productPromoForm.targetProductIds.includes(prod.id);
                          return (
                            <label
                              key={prod.id}
                              className={`flex items-center justify-between gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                                isSelected ? "bg-emerald-50/70" : "hover:bg-surface-container-low"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setProductPromoForm({
                                        ...productPromoForm,
                                        targetProductIds: [...productPromoForm.targetProductIds, prod.id],
                                      });
                                    } else {
                                      setProductPromoForm({
                                        ...productPromoForm,
                                        targetProductIds: productPromoForm.targetProductIds.filter((id) => id !== prod.id),
                                      });
                                    }
                                  }}
                                  className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                                />
                                <div className="flex flex-col">
                                  <span className="font-bold text-xs text-on-surface">{prod.name}</span>
                                  <span className="text-[10px] text-on-surface-variant">
                                    {prod.category} • Normal: {formatCurrency(prod.price)}
                                  </span>
                                </div>
                              </div>

                              {/* Preview harga promo jika dipilih */}
                              {isSelected && (
                                <span className="text-[11px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                                  {productPromoForm.discountType === "percentage"
                                    ? formatCurrency(Math.max(0, Math.round(prod.price * (1 - productPromoForm.discountValue / 100))))
                                    : productPromoForm.discountType === "fixed"
                                    ? formatCurrency(Math.max(0, prod.price - productPromoForm.discountValue))
                                    : formatCurrency(productPromoForm.discountValue)}
                                </span>
                              )}
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Label Badge Custom & Happy Hour */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Label Badge (Opsional)</label>
                  <input
                    type="text"
                    value={productPromoForm.badgeLabel}
                    onChange={(e) => setProductPromoForm({ ...productPromoForm, badgeLabel: e.target.value })}
                    placeholder="Contoh: PROMO 20%, FAVORIT, BEST DEAL"
                    className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-medium"
                  />
                  <span className="text-[10px] text-on-surface-variant">Badge teks yang muncul di atas foto menu</span>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Jadwal Jam / Happy Hour (Opsional)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="time"
                      value={productPromoForm.timeStart}
                      onChange={(e) => setProductPromoForm({ ...productPromoForm, timeStart: e.target.value })}
                      className="p-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs font-mono font-bold"
                      title="Jam Mulai"
                    />
                    <input
                      type="time"
                      value={productPromoForm.timeEnd}
                      onChange={(e) => setProductPromoForm({ ...productPromoForm, timeEnd: e.target.value })}
                      className="p-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs font-mono font-bold"
                      title="Jam Selesai"
                    />
                  </div>
                  <span className="text-[10px] text-on-surface-variant">Kosongkan jika berlaku sepanjang hari</span>
                </div>
              </div>

              {/* Checkbox Status Aktif */}
              <label className="flex items-center gap-2 mt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={productPromoForm.isActive}
                  onChange={(e) => setProductPromoForm({ ...productPromoForm, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                />
                <span className="font-bold text-xs text-on-surface">Aktifkan promo ini langsung di kasir</span>
              </label>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-high mt-1">
                <button
                  type="button"
                  onClick={() => setProductPromoModal({ ...productPromoModal, isOpen: false })}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#003629] text-white font-bold text-xs hover:bg-[#1a4a3e] cursor-pointer shadow-xs"
                >
                  {productPromoModal.mode === "add" ? "Simpan Promo Produk" : "Update Promo Produk"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL TAMBAH / EDIT REKENING BANK ==================== */}
      {bankAccountModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-surface-container-lowest p-6 shadow-2xl flex flex-col gap-4 border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">account_balance</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-base font-bold text-on-surface">
                    {bankAccountModal.mode === "add" ? "Tambah Rekening Bank Baru" : "Edit Rekening Bank"}
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Rekening ini akan tampil pada opsi pembayaran Transfer di kasir POS
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBankAccountModal({ isOpen: false, mode: "add" })}
                className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveBankAccount} className="flex flex-col gap-4 text-xs">
              {/* Nama Bank */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-on-surface">
                  Nama Bank <span className="text-error">*</span>
                </label>
                <select
                  value={bankAccountForm.bankName}
                  onChange={(e) => setBankAccountForm({ ...bankAccountForm, bankName: e.target.value })}
                  className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-bold text-on-surface cursor-pointer"
                  required
                >
                  {POPULAR_BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                {bankAccountForm.bankName === "Lainnya..." && (
                  <input
                    type="text"
                    value={bankAccountForm.customBankName}
                    onChange={(e) => setBankAccountForm({ ...bankAccountForm, customBankName: e.target.value })}
                    placeholder="Tuliskan nama bank lainnya..."
                    className="mt-1 p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-bold text-on-surface"
                    required
                  />
                )}
              </div>

              {/* Nomor Rekening */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-on-surface">
                  Nomor Rekening <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={bankAccountForm.accountNumber}
                  onChange={(e) => setBankAccountForm({ ...bankAccountForm, accountNumber: e.target.value })}
                  placeholder="Contoh: 1234567890"
                  className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-mono font-bold text-on-surface text-sm"
                  required
                />
                <span className="text-[10px] text-on-surface-variant">
                  Nomor rekening resmi yang dituju oleh pelanggan saat transfer.
                </span>
              </div>

              {/* Atas Nama Rekening */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-on-surface">
                  Atas Nama Pemilik Rekening <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={bankAccountForm.accountName}
                  onChange={(e) => setBankAccountForm({ ...bankAccountForm, accountName: e.target.value })}
                  placeholder="Contoh: PT PAWON NUSANTARA JAYA / AHMAD"
                  className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary font-bold text-on-surface uppercase"
                  required
                />
                <span className="text-[10px] text-on-surface-variant">
                  Nama yang terdaftar di rekening bank agar kasir dan pelanggan mudah memverifikasi.
                </span>
              </div>

              {/* Checkboxes: Rekening Utama & Aktif */}
              <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col gap-2.5 mt-1">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bankAccountForm.isDefault}
                    onChange={(e) => setBankAccountForm({ ...bankAccountForm, isDefault: e.target.checked })}
                    className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-on-surface block">Jadikan Rekening Utama (Default)</span>
                    <span className="text-[10px] text-on-surface-variant block">
                      Akan terpilih otomatis saat kasir membuka konfirmasi pembayaran transfer.
                    </span>
                  </div>
                </label>

                <div className="border-t border-surface-container-high my-0.5" />

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bankAccountForm.isActive}
                    onChange={(e) => setBankAccountForm({ ...bankAccountForm, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-on-surface block">Aktifkan Rekening</span>
                    <span className="text-[10px] text-on-surface-variant block">
                      Rekening ini dapat dipilih pada kasir POS.
                    </span>
                  </div>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-high mt-1">
                <button
                  type="button"
                  onClick={() => setBankAccountModal({ isOpen: false, mode: "add" })}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 cursor-pointer shadow-xs active:scale-95 transition-all"
                >
                  {bankAccountModal.mode === "add" ? "Simpan Rekening" : "Perbarui Rekening"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
