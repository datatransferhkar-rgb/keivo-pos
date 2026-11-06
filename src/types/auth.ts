export type UserRole = "owner" | "admin" | "manager" | "kasir" | "waiters" | "kitchen";

export type SystemMenu =
  | "dashboard"
  | "pos"
  | "kitchen"
  | "area_meja"
  | "master_data"
  | "laporan"
  | "pengaturan";

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  email?: string;
  role: UserRole;
  roleLabel: string;
  avatarUrl?: string;
  isActive: boolean;
  phone?: string;
  pin?: string;
}

export interface ActiveCashierShift {
  cashierId: string;
  cashierName: string;
  cashierUsername: string;
  openedAt: string;
  status: "open" | "closed";
}

export interface RolePermission {
  role: UserRole;
  roleName: string;
  description: string;
  allowedMenus: SystemMenu[];
  badgeColor: string;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermission> = {
  owner: {
    role: "owner",
    roleName: "Owner / Pemilik",
    description: "Akses penuh tanpa batas ke semua menu, laporan keuangan, dan pengaturan.",
    allowedMenus: [
      "dashboard",
      "pos",
      "kitchen",
      "area_meja",
      "master_data",
      "laporan",
      "pengaturan",
    ],
    badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
  },
  admin: {
    role: "admin",
    roleName: "Administrator",
    description: "Akses lengkap operasional, master data, laporan, dan konfigurasi sistem.",
    allowedMenus: [
      "dashboard",
      "pos",
      "kitchen",
      "area_meja",
      "master_data",
      "laporan",
      "pengaturan",
    ],
    badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
  },
  manager: {
    role: "manager",
    roleName: "Manager Restoran",
    description: "Supervisi seluruh operasional, stok master data, laporan omzet, dan shift.",
    allowedMenus: [
      "dashboard",
      "pos",
      "kitchen",
      "area_meja",
      "master_data",
      "laporan",
      "pengaturan",
    ],
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
  },
  kasir: {
    role: "kasir",
    roleName: "Kasir (Cashier)",
    description: "Hanya berhak mengakses menu POS untuk transaksi pemesanan dan pembayaran.",
    allowedMenus: ["pos"],
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  waiters: {
    role: "waiters",
    roleName: "Waiters / Pramusaji",
    description: "Hanya berhak mengakses menu Waiters untuk memonitor ketersediaan & pesanan tamu.",
    allowedMenus: ["area_meja"],
    badgeColor: "bg-cyan-100 text-cyan-800 border-cyan-300",
  },
  kitchen: {
    role: "kitchen",
    roleName: "Kitchen Chef / KDS",
    description: "Hanya berhak mengakses monitor kitchen untuk memasak dan update status makanan.",
    allowedMenus: ["kitchen"],
    badgeColor: "bg-orange-100 text-orange-800 border-orange-300",
  },
};

export const DEFAULT_USERS: UserProfile[] = [
  {
    id: "usr-owner-1",
    name: "Bpk. Bambang Sutrisno",
    username: "owner",
    email: "bambang.owner@pawonnusantara.id",
    role: "owner",
    roleLabel: "Owner Restoran",
    avatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    isActive: true,
    phone: "0811-9876-5432",
    pin: "1234",
  },
  {
    id: "usr-admin-1",
    name: "Hendri Kurniawan",
    username: "admin",
    email: "hendri.admin@pawonnusantara.id",
    role: "admin",
    roleLabel: "System Administrator",
    avatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    isActive: true,
    phone: "0812-1122-3344",
    pin: "8888",
  },
  {
    id: "usr-mgr-1",
    name: "Anita Wijaya",
    username: "manager",
    email: "anita.manager@pawonnusantara.id",
    role: "manager",
    roleLabel: "Manager Restoran",
    avatarUrl:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    isActive: true,
    phone: "0813-4455-6677",
    pin: "5555",
  },
  {
    id: "usr-kasir-1",
    name: "Siti Rahmawati",
    username: "kasir",
    email: "siti.kasir@pawonnusantara.id",
    role: "kasir",
    roleLabel: "Kasir Senior (Shift Pagi)",
    avatarUrl:
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
    isActive: true,
    phone: "0856-7788-9900",
    pin: "1111",
  },
  {
    id: "usr-kasir-2",
    name: "Rian Pratama",
    username: "kasir2",
    email: "rian.kasir@pawonnusantara.id",
    role: "kasir",
    roleLabel: "Kasir Shift Siang",
    avatarUrl:
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    isActive: true,
    phone: "0812-9988-7766",
    pin: "2222",
  },
  {
    id: "usr-waiter-1",
    name: "Dimas Prasetyo",
    username: "waiter",
    email: "dimas.waiter@pawonnusantara.id",
    role: "waiters",
    roleLabel: "Head Waiter",
    avatarUrl:
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
    isActive: true,
    phone: "0877-3344-5566",
    pin: "2222",
  },
  {
    id: "usr-kitchen-1",
    name: "Chef Wayan",
    username: "kitchen",
    email: "wayan.kitchen@pawonnusantara.id",
    role: "kitchen",
    roleLabel: "Head Chef",
    avatarUrl:
      "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=150&auto=format&fit=crop&q=80",
    isActive: true,
    phone: "0819-2233-4455",
    pin: "3333",
  },
];
