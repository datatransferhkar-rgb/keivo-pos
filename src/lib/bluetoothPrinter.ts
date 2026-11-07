/**
 * Web Bluetooth ESC/POS Thermal Printer Helper
 * Supports multiple printer manufacturers (Xprinter, Rongta, GOOJPRT, HM-10, POS-58, etc.)
 */

import { formatCurrency } from "@/lib/formatters";
import { OrderData, RestaurantSettings } from "@/types/pos";

export const BLE_PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // Common Chinese POS / Xprinter
  "0000ffe0-0000-1000-8000-00805f9b34fb", // HM-10 / CC2541 (most common in mini BT printers)
  "0000ffe1-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb", // Generic serial
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // Rongta / Zjiang BLE
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC / Microchip BLE
  "0000fff0-0000-1000-8000-00805f9b34fb",
  "0000ae00-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb", // Tencent POS
  "00001800-0000-1000-8000-00805f9b34fb", // Generic Access
  "00001801-0000-1000-8000-00805f9b34fb", // Generic Attribute
  "0000180a-0000-1000-8000-00805f9b34fb", // Device Info
];

/**
 * Robustly search for a writable GATT characteristic on any thermal printer
 */
export async function findPrinterWriteCharacteristic(
  server: BluetoothRemoteGATTServer
): Promise<BluetoothRemoteGATTCharacteristic> {
  const candidateServices = [
    "000018f0-0000-1000-8000-00805f9b34fb",
    "0000ffe0-0000-1000-8000-00805f9b34fb",
    "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
    "49535343-fe7d-4ae5-8fa9-9fafd205e455",
    "0000ff00-0000-1000-8000-00805f9b34fb",
    "0000fff0-0000-1000-8000-00805f9b34fb",
  ];

  // 1. Try known candidate services first
  for (const sUuid of candidateServices) {
    try {
      const service = await server.getPrimaryService(sUuid);
      const characteristics = await service.getCharacteristics();
      const writeChar = characteristics.find(
        (c) => c.properties.write || c.properties.writeWithoutResponse
      );
      if (writeChar) return writeChar;
    } catch {
      // try next service
    }
  }

  // 2. Fallback: discover all primary services
  try {
    const services = await server.getPrimaryServices();
    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        const writeChar = characteristics.find(
          (c) => c.properties.write || c.properties.writeWithoutResponse
        );
        if (writeChar) return writeChar;
      } catch {
        // continue
      }
    }
  } catch {
    // continue
  }

  throw new Error("Tidak menemukan karakteristik tulis (write characteristic) pada printer Bluetooth ini.");
}

/**
 * Send raw byte data to Bluetooth thermal printer in chunks
 */
export async function sendEscPosToPrinter(
  device: BluetoothDevice,
  data: Uint8Array
): Promise<void> {
  if (!device.gatt) {
    throw new Error("GATT tidak tersedia pada perangkat.");
  }

  const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
  const writeChar = await findPrinterWriteCharacteristic(server);

  // Send in chunks (BLE MTU limit ~180 bytes safe chunk size)
  const chunkSize = 180;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    if (writeChar.properties.writeWithoutResponse) {
      await writeChar.writeValueWithoutResponse(chunk);
    } else {
      await writeChar.writeValue(chunk);
    }
    await new Promise((r) => setTimeout(r, 40));
  }
}

/**
 * Connect to Bluetooth printer:
 * First attempts to reuse already granted devices via navigator.bluetooth.getDevices() (No popup!)
 * Falls back to requestDevice() if not found.
 */
export async function connectBluetoothDevice(
  existingDeviceId?: string,
  printerName?: string
): Promise<BluetoothDevice> {
  if (!navigator.bluetooth) {
    throw new Error("Browser Anda tidak mendukung Web Bluetooth. Gunakan Google Chrome atau Microsoft Edge.");
  }

  // 1. Check if browser already has permission for this device
  if (navigator.bluetooth.getDevices) {
    try {
      const permittedDevices = await navigator.bluetooth.getDevices();
      let matched = permittedDevices.find((d) => existingDeviceId && d.id === existingDeviceId);
      if (!matched && printerName) {
        matched = permittedDevices.find((d) => d.name === printerName);
      }
      if (matched) {
        if (!matched.gatt?.connected) {
          await matched.gatt?.connect();
        }
        return matched;
      }
    } catch (e) {
      console.warn("getDevices() attempt failed:", e);
    }
  }

  // 2. Request device from user with comprehensive service UUIDs
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: BLE_PRINTER_SERVICES,
  });

  if (!device.gatt?.connected) {
    await device.gatt?.connect();
  }

  return device;
}

/**
 * Connect to USB / Serial thermal printer via Web Serial API (Desktop Chrome / Edge)
 */
export async function connectSerialDevice(baudRate: number = 9600): Promise<any> {
  if (typeof navigator === "undefined" || !("serial" in navigator)) {
    throw new Error("Browser Anda tidak mendukung Web Serial. Gunakan Google Chrome atau Edge di Laptop/PC.");
  }
  const port = await (navigator as any).serial.requestPort();
  await port.open({ baudRate });
  return port;
}

/**
 * Send raw byte data to Serial / USB thermal printer
 */
export async function sendEscPosToSerial(port: any, data: Uint8Array): Promise<void> {
  if (!port || !port.writable) {
    throw new Error("Port serial printer tidak siap menerima data.");
  }
  const writer = port.writable.getWriter();
  try {
    await writer.write(data);
  } finally {
    writer.releaseLock();
  }
}

/**
 * Attempt to reconnect to previously authorized Serial ports
 */
export async function autoReconnectSerialPort(baudRate: number = 9600): Promise<any | null> {
  if (typeof navigator === "undefined" || !("serial" in navigator)) return null;
  try {
    const ports = await (navigator as any).serial.getPorts();
    if (ports && ports.length > 0) {
      const port = ports[0];
      try {
        await port.open({ baudRate });
      } catch (e) {
        // already open
      }
      return port;
    }
  } catch (err) {
    console.warn("Serial auto-reconnect error:", err);
  }
  return null;
}

/**
 * Build standard ESC/POS formatted receipt text
 */
export function buildReceiptEscPos(
  order: OrderData,
  settings: RestaurantSettings,
  cashierName: string
): string {
  const ESC = "\x1B";
  const LF = "\n";
  const lines: string[] = [];

  // Init printer + center align
  lines.push(`${ESC}@`); // reset printer
  lines.push(`${ESC}a\x01`); // center

  lines.push(settings.restaurantName.toUpperCase());
  if (settings.branchName) lines.push(settings.branchName);
  if (settings.address) lines.push(settings.address);
  if (settings.phone) lines.push(`Telp: ${settings.phone}`);
  lines.push("--------------------------------");

  lines.push(`${ESC}a\x00`); // left align

  lines.push(`No. Transaksi: ${order.orderNumber}`);
  lines.push(`Waktu       : ${order.orderTime}`);
  lines.push(`Kasir       : ${cashierName}`);
  lines.push(`Meja/Tamu   : ${order.tableOrGuest}`);
  lines.push(`Saluran     : ${order.channelLabel}`);
  if (order.customerTier || order.customerId) {
    const tierName = (order.customerTier || "Member").toUpperCase();
    lines.push(`Pelanggan   : [${tierName} MEMBER]`);
  }
  lines.push("--------------------------------");

  order.items.forEach((it) => {
    const subtotal = it.price * it.qty;
    const priceStr = formatCurrency(subtotal);
    const qtyPrefix = `${it.qty}x `;
    const maxNameLen = 32 - priceStr.length - 1 - qtyPrefix.length;

    if (it.name.length <= maxNameLen) {
      // Pas dalam 1 baris sejajar (32 kolom)
      const itemPart = `${qtyPrefix}${it.name}`;
      const spaces = Math.max(1, 32 - itemPart.length - priceStr.length);
      lines.push(`${itemPart}${" ".repeat(spaces)}${priceStr}`);
    } else {
      // Nama menu panjang: potong rapi di baris 1 bersama harga, sisanya di baris 2
      const firstLineName = it.name.slice(0, maxNameLen);
      const restName = it.name.slice(maxNameLen);
      const itemPart = `${qtyPrefix}${firstLineName}`;
      const spaces = Math.max(1, 32 - itemPart.length - priceStr.length);
      lines.push(`${itemPart}${" ".repeat(spaces)}${priceStr}`);
      lines.push(`   ${restName}`);
    }

    if (it.selectedAddons && it.selectedAddons.length > 0) {
      it.selectedAddons.forEach((add) => {
        lines.push(`   + ${add.name}`);
      });
    }
    if (it.note) lines.push(`   *${it.note}`);
  });

  lines.push("--------------------------------");
  const itemsSubtotal = order.subtotal || order.items.reduce((s, it) => s + it.price * it.qty, 0);
  const discount = order.discountAmount || 0;
  const netSubtotal = Math.max(0, itemsSubtotal - discount);

  const taxRate = settings.taxRate || 5;
  const taxAmt = order.taxAmount !== undefined
    ? order.taxAmount
    : (settings.taxEnabled ? Math.round(netSubtotal * (taxRate / 100)) : 0);

  const srvRate = settings.serviceChargeRate || 5;
  const srvAmt = order.serviceChargeAmount !== undefined
    ? order.serviceChargeAmount
    : (order.serviceAmount !== undefined
        ? order.serviceAmount
        : (settings.serviceChargeEnabled ? Math.round(netSubtotal * (srvRate / 100)) : 0));

  const formatLineRight = (label: string, value: string) => {
    const spaces = Math.max(1, 32 - label.length - value.length);
    return `${label}${" ".repeat(spaces)}${value}`;
  };

  lines.push(formatLineRight("Subtotal:", formatCurrency(itemsSubtotal)));
  if (discount > 0) {
    lines.push(formatLineRight(`Diskon (${order.discountName || "Promo"}):`, `-${formatCurrency(discount)}`));
  }
  if (taxAmt > 0 || (settings.taxEnabled && (settings.taxRate ?? 0) > 0)) {
    lines.push(formatLineRight(`Pajak Restoran PB1 (${taxRate}%):`, formatCurrency(taxAmt)));
  }
  if (srvAmt > 0 || (settings.serviceChargeEnabled && (settings.serviceChargeRate ?? 0) > 0)) {
    lines.push(formatLineRight(`Biaya Layanan (${srvRate}%):`, formatCurrency(srvAmt)));
  }
  lines.push("................................");
  lines.push(formatLineRight("TOTAL:", formatCurrency(order.total)));

  const paymentMethodDisplay =
    order.paymentMethod === "cash"
      ? "Tunai"
      : order.paymentMethod === "static_qr"
      ? "QRIS"
      : order.paymentMethod === "bank_transfer"
      ? "Transfer Bank"
      : order.paymentMethod || order.channelLabel || "Tunai";

  lines.push(formatLineRight("Metode Bayar:", paymentMethodDisplay));
  lines.push(formatLineRight("Status:", "LUNAS"));
  if (order.paymentNote) {
    lines.push(`Keterangan: ${order.paymentNote}`);
  }
  lines.push("--------------------------------");

  // Kupon Promo Kunjungan Berikutnya Khusus Member
  if (order.customerId || order.customerTier) {
    const tier = (order.customerTier || "").toLowerCase();
    const nextCouponCode = tier === "vip" ? "VIPHEMAT20" : tier === "gold" ? "GOLDHEMAT15" : "HEMAT10";
    const nextCouponDisc = tier === "vip" ? "Diskon 20%" : tier === "gold" ? "Diskon 15%" : "Diskon 10%";
    lines.push(`${ESC}a\x01`); // center align
    lines.push(`* KUPON SPESIAL MEMBER RESTO *`);
    lines.push(`KODE PROMO: ${nextCouponCode}`);
    lines.push(`${nextCouponDisc} Kunjungan Berikutnya`);
    lines.push(`Tunjukkan struk ini ke kasir!`);
    lines.push("--------------------------------");
  }

  lines.push(`${ESC}a\x01`); // center align
  lines.push(settings.receiptFooter || "Terima kasih atas kunjungan Anda!");

  // Social Media ESC/POS lines (jika diaktifkan)
  const socials: string[] = [];
  if (settings.showInstagram && settings.instagram) socials.push(`IG: ${settings.instagram}`);
  if (settings.showFacebook && settings.facebook) socials.push(`FB: ${settings.facebook}`);
  if (settings.showTiktok && settings.tiktok) socials.push(`TikTok: ${settings.tiktok}`);
  if (socials.length > 0) {
    lines.push(socials.join(" | "));
  }

  lines.push("Sistem POS didukung oleh Keivo");
  lines.push(LF + LF + LF); // feed paper

  return lines.join(LF);
}

/**
 * Build ESC/POS formatted Shift Closing Report (Laporan Tutup Shift Kasir)
 */
export function buildShiftReportEscPos(data: {
  restaurantName: string;
  branchName?: string;
  shiftDate: string;
  cashierName: string;
  replacementCashierName: string;
  totalTransactions: number;
  dineInCount: number;
  takeawayCount: number;
  deliveryCount: number;
  totalSales: number;
  cashSales: number;
  qrisSales: number;
  transferSales: number;
  onlineSales?: number;
  openingCash: number;
  cashOut: number;
  expectedCash: number;
  physicalCash: number;
  difference: number;
  notes?: string;
}): string {
  const ESC = "\x1B";
  const LF = "\n";
  const lines: string[] = [];

  // Reset printer & Center Align
  lines.push(`${ESC}@`);
  lines.push(`${ESC}a\x01`);

  lines.push(data.restaurantName.toUpperCase());
  if (data.branchName) lines.push(data.branchName);
  lines.push("================================");
  lines.push("LAPORAN TUTUP KASIR & SHIFT");
  lines.push("================================");

  lines.push(`${ESC}a\x00`); // Left align

  lines.push(`Waktu Tutup : ${data.shiftDate}`);
  lines.push(`Kasir Lama  : ${data.cashierName}`);
  lines.push(`Kasir Baru  : ${data.replacementCashierName}`);
  lines.push("--------------------------------");

  lines.push("RINGKASAN TRANSAKSI:");
  lines.push(`Total Transaksi: ${data.totalTransactions} Pesanan`);
  lines.push(` - Dine In     : ${data.dineInCount}`);
  lines.push(` - Take Away   : ${data.takeawayCount}`);
  lines.push(` - Delivery    : ${data.deliveryCount}`);
  lines.push(`TOTAL OMSET    : ${formatCurrency(data.totalSales)}`);
  lines.push("--------------------------------");

  lines.push("METODE PEMBAYARAN:");
  lines.push(` - Tunai       : ${formatCurrency(data.cashSales)}`);
  lines.push(` - QRIS        : ${formatCurrency(data.qrisSales)}`);
  lines.push(` - Transfer    : ${formatCurrency(data.transferSales)}`);
  if (data.onlineSales && data.onlineSales > 0) {
    lines.push(` - Delivery    : ${formatCurrency(data.onlineSales)}`);
  }
  lines.push("--------------------------------");

  lines.push("REKONSILIASI KAS (LACI):");
  lines.push(`Modal Awal     : ${formatCurrency(data.openingCash)}`);
  lines.push(`+ Kas Masuk    : ${formatCurrency(data.cashSales)}`);
  lines.push(`- Kas Keluar   : ${formatCurrency(data.cashOut)}`);
  lines.push(`Kas Ekspektasi : ${formatCurrency(data.expectedCash)}`);
  lines.push(`Fisik Dipegang : ${formatCurrency(data.physicalCash)}`);
  const diffStr =
    data.difference === 0
      ? "Pas (Rp0)"
      : data.difference > 0
      ? `+${formatCurrency(data.difference)} (Lebih)`
      : `${formatCurrency(data.difference)} (Kurang)`;
  lines.push(`Selisih Kas    : ${diffStr}`);
  lines.push("--------------------------------");

  if (data.notes) {
    lines.push(`Catatan: ${data.notes}`);
    lines.push("--------------------------------");
  }

  lines.push(`${ESC}a\x01`); // Center align
  lines.push("SERAH TERIMA TUGAS KASIR");
  lines.push("Validasi PIN Terverifikasi");
  lines.push(LF);
  lines.push("Penyerah          Penerima");
  lines.push(LF + LF);
  lines.push(`(${data.cashierName.slice(0, 10)})      (${data.replacementCashierName.slice(0, 10)})`);
  lines.push("--------------------------------");
  lines.push("Sistem POS didukung Keivo");
  lines.push(LF + LF + LF);

  return lines.join(LF);
}
