export interface PrinterConfig {
  id: string;
  name: string;
  target: "cashier" | "kitchen" | "bar";
  connectionType: "lan" | "usb" | "bluetooth" | "system";
  paperWidth: "58mm" | "80mm";
  ipAddress?: string;
  bluetoothDeviceId?: string; // stored Bluetooth device identifier
  autoCut: boolean;
  isActive: boolean;
  connectionStatus?: "connected" | "disconnected" | "connecting" | "error";
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export interface RestaurantSettings {
  restaurantName: string;
  branchName: string;
  posTerminal: string;
  logoUrl: string;
  address: string;
  phone: string;
  receiptFooter: string;
  staticQrImageUrl?: string;
  staticQrLabel: string;
  staticQrInstructions?: string;
  bankTransferInstructions: string;
  bankAccounts?: BankAccount[];
  taxEnabled?: boolean;
  taxRate?: number;
  serviceChargeEnabled?: boolean;
  serviceChargeRate?: number;
  printers?: PrinterConfig[];
  // Akun Media Sosial Restoran (Branding Struk & QR Meja)
  instagram?: string;
  showInstagram?: boolean;
  facebook?: string;
  showFacebook?: boolean;
  tiktok?: string;
  showTiktok?: boolean;
}

export interface ProductAddon {
  id: string;
  name: string;
  price: number;
}

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
  productCount?: number;
}

export interface TableAreaCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
  tableCount?: number;
}

export interface CustomerTierCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  badgeColor?: string;
  sortOrder?: number;
  isActive?: boolean;
  customerCount?: number;
}

export interface MasterProduct {
  id: string;
  code?: string;
  name: string;
  category: string;
  price: number;
  description?: string;
  isAvailable: boolean;
  imageUrl?: string;
  image?: string;
  addons?: ProductAddon[];
  // Fitur Promo Produk / Menu
  promoPrice?: number;
  promoBadge?: string;
  promoName?: string;
}

export interface MasterTable {
  id: string;
  tableNumber: string;
  displayName: string;
  qrToken?: string;
  area: "indoor" | "outdoor" | "vip" | "smoking" | string;
  capacity: number;
  status: "tersedia" | "terisi" | "reservasi";
}

export type PromoCustomerScope = "all" | "member" | "gold" | "vip" | "personal";

export interface PromoDiscount {
  id: string;
  code: string;
  name: string;
  description?: string;
  discountType: "percentage" | "fixed";
  discountValue: number; // 10 for 10%, 20000 for Rp 20.000
  minOrderAmount?: number;
  maxDiscount?: number;
  scope?: "all" | "dine_in" | "takeaway";
  customerScope?: PromoCustomerScope;
  assignedCustomerId?: string;
  assignedCustomerName?: string;
  isActive: boolean;
  usageCount?: number;
  createdAt?: string;
}

export interface ProductPromo {
  id: string;
  name: string;
  description?: string;
  discountType: "percentage" | "fixed" | "special_price";
  discountValue: number; // 20 for 20%, 5000 for Rp5.000 off, or 25000 for special price
  targetType: "all_products" | "category" | "specific_products";
  targetCategory?: string;
  targetProductIds?: string[]; // IDs or codes of products
  startDate?: string;
  endDate?: string;
  timeStart?: string; // e.g. "14:00"
  timeEnd?: string;   // e.g. "17:00"
  badgeLabel?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type CustomerTier = "regular" | "silver" | "gold" | "vip" | string;

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tier: CustomerTier;
  points: number;
  totalVisits: number;
  totalSpent: number;
  notes?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type OrderChannel = "dine_in_qr" | "takeaway_walk_in" | "online_platform";
export type KitchenStatus = "new" | "in_progress" | "plating" | "ready_check" | "ready" | "completed" | "served" | "cancelled";
export type PaymentStatus = "unpaid" | "paid";

export interface OrderItemData {
  name: string;
  qty: number;
  price: number;
  note?: string;
  selectedAddons?: ProductAddon[];
  originalPrice?: number;
  isPromo?: boolean;
  promoName?: string;
}

export interface OrderData {
  id: string;
  orderNumber: string;
  channel: OrderChannel;
  channelLabel: string; // "Dine-in", "Take Away", "Delivery", "GoFood", "ShopeeFood", "GrabFood"
  tableOrGuest: string; // "Meja 08", "#GF-8921", "Ibu Maya", etc.
  guestSubtext?: string; // "Bpk. Hendra", "Dr: Joko (Bpk Denny)", "Antrian #TK-089"
  customerId?: string;
  customerPhone?: string;
  customerTier?: CustomerTier | string;
  orderTime: string; // "12:15 WIB"
  timeAgo: string; // "18m lalu"
  items: OrderItemData[];
  specialNote?: string;
  customerComment?: string;
  subtotal?: number;
  discountAmount?: number;
  discountName?: string;
  promoCode?: string;
  taxAmount?: number;
  serviceAmount?: number;
  serviceChargeAmount?: number;
  total: number;
  paymentNote?: string; // "Tunai Rp150k" or "Kembali Rp5k"
  kitchenStatus: KitchenStatus;
  kitchenStatusLabel: string; // "Siap Diantar", "Dimasak", "Pesanan Baru"
  paymentStatus: PaymentStatus;
  paymentStatusLabel: string; // "Belum Bayar", "Lunas (GoPay)", "Lunas (ShopeePay)"
  paymentMethod?: "cash" | "static_qr" | "bank_transfer" | "online_channel" | string;
  cashierId?: string;
  cashierName?: string;
  createdAt?: string;
}

export interface MetricCardData {
  occupiedTables: number;
  totalTables: number;
  unbilledTables: number;
  activeOrders: number;
  dineInOrders: number;
  takeawayOrders: number;
  onlineOrders: number;
  readyFromKitchen: number;
  unpaidOrders: number;
  unpaidTotal: number;
}

export interface CashDrawerData {
  floatAmount: number;
  cashReceived: number;
  cashOut: number;
  cashOutReason: string;
  totalDrawer: number;
}
