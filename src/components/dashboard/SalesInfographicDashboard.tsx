"use client";

import React, { useState, useMemo } from "react";
import { formatCurrency } from "@/lib/formatters";
import { OrderData } from "@/types/pos";
import { useRestaurant } from "@/context/RestaurantContext";
import { DEFAULT_CATALOG_PRODUCTS } from "@/lib/catalogData";

type TimeHorizon = "today" | "weekly" | "monthly" | "all" | "custom";
type ChartViewMode = "spline" | "bars";

interface SalesInfographicDashboardProps {
  orders?: OrderData[];
  onNavigateToPos?: () => void;
  onProcessPayment?: (order: OrderData) => void;
  onPrintTicket?: (order: OrderData) => void;
  onViewDetail?: (order: OrderData) => void;
}

interface RankedMenuItem {
  rank: number;
  name: string;
  category: string;
  qty: number;
  revenue: number;
  percentage: number;
}

export function SalesInfographicDashboard({
  orders = [],
  onNavigateToPos,
  onProcessPayment,
  onPrintTicket,
  onViewDetail,
}: SalesInfographicDashboardProps) {
  const { settings } = useRestaurant();

  // Controls & Filters
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>("weekly");
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toLocaleDateString("en-CA");
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toLocaleDateString("en-CA");
  });

  const [chartViewMode, setChartViewMode] = useState<ChartViewMode>("spline");
  const [activeChartIndex, setActiveChartIndex] = useState<number | null>(null);

  // Live Transactions Section State
  const [liveSearchQuery, setLiveSearchQuery] = useState("");
  const [liveChannelFilter, setLiveChannelFilter] = useState<
    "all" | "dine_in" | "takeaway" | "ojol" | "unpaid" | "paid"
  >("all");
  const [liveVisibleCount, setLiveVisibleCount] = useState(8);

  // 1. FILTER ORDERS BY TIME HORIZON & CUSTOM DATE RANGE
  const filteredOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];

    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA");

    const getOrderDateStr = (createdAt?: string | Date) => {
      if (!createdAt) return todayStr;
      try {
        const d = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
        if (isNaN(d.getTime())) return todayStr;
        return d.toLocaleDateString("en-CA");
      } catch {
        return todayStr;
      }
    };

    if (timeHorizon === "all") return orders;

    if (timeHorizon === "today") {
      const todayOrders = orders.filter((o) => getOrderDateStr(o.createdAt) === todayStr);
      if (todayOrders.length > 0) return todayOrders;

      // Fallback: use date of most recent order if no orders today
      const latestOrder = orders.reduce((latest, curr) => {
        const dCurr = curr.createdAt ? new Date(curr.createdAt).getTime() : 0;
        const dLatest = latest.createdAt ? new Date(latest.createdAt).getTime() : 0;
        return dCurr > dLatest ? curr : latest;
      }, orders[0]);
      const anchorDateStr = getOrderDateStr(latestOrder?.createdAt);
      const matched = orders.filter((o) => getOrderDateStr(o.createdAt) === anchorDateStr);
      return matched.length > 0 ? matched : orders;
    }

    if (timeHorizon === "weekly") {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const sevenDaysAgoStr = sevenDaysAgo.toLocaleDateString("en-CA");
      const weeklyOrders = orders.filter((o) => getOrderDateStr(o.createdAt) >= sevenDaysAgoStr);
      if (weeklyOrders.length > 0) return weeklyOrders;

      const latestOrder = orders.reduce((latest, curr) => {
        const dCurr = curr.createdAt ? new Date(curr.createdAt).getTime() : 0;
        const dLatest = latest.createdAt ? new Date(latest.createdAt).getTime() : 0;
        return dCurr > dLatest ? curr : latest;
      }, orders[0]);
      const anchorTime = latestOrder?.createdAt ? new Date(latestOrder.createdAt).getTime() : now.getTime();
      const cutoff = new Date(anchorTime - 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-CA");
      const matched = orders.filter((o) => getOrderDateStr(o.createdAt) >= cutoff);
      return matched.length > 0 ? matched : orders;
    }

    if (timeHorizon === "monthly") {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgoStr = thirtyDaysAgo.toLocaleDateString("en-CA");
      const monthlyOrders = orders.filter((o) => getOrderDateStr(o.createdAt) >= thirtyDaysAgoStr);
      if (monthlyOrders.length > 0) return monthlyOrders;

      const latestOrder = orders.reduce((latest, curr) => {
        const dCurr = curr.createdAt ? new Date(curr.createdAt).getTime() : 0;
        const dLatest = latest.createdAt ? new Date(latest.createdAt).getTime() : 0;
        return dCurr > dLatest ? curr : latest;
      }, orders[0]);
      const anchorTime = latestOrder?.createdAt ? new Date(latestOrder.createdAt).getTime() : now.getTime();
      const cutoff = new Date(anchorTime - 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-CA");
      const matched = orders.filter((o) => getOrderDateStr(o.createdAt) >= cutoff);
      return matched.length > 0 ? matched : orders;
    }

    if (timeHorizon === "custom") {
      const matched = orders.filter((o) => {
        const orderDate = getOrderDateStr(o.createdAt);
        if (customStartDate && orderDate < customStartDate) return false;
        if (customEndDate && orderDate > customEndDate) return false;
        return true;
      });
      return matched.length > 0 ? matched : orders;
    }

    return orders;
  }, [orders, timeHorizon, customStartDate, customEndDate]);

  // 2. DYNAMIC SUMMARY METRICS
  const summaryMetrics = useMemo(() => {
    const list = filteredOrders.length > 0 ? filteredOrders : orders;

    let realizedRevenue = 0;
    let pendingRevenue = 0;
    let paidOrdersCount = 0;
    let dineInOrdersCount = 0;
    let takeawayOrdersCount = 0;
    let ojolOrdersCount = 0;

    let qrisAmount = 0;
    let qrisCount = 0;
    let cashAmount = 0;
    let cashCount = 0;
    let transferAmount = 0;
    let transferCount = 0;
    let ojolPayAmount = 0;
    let ojolPayCount = 0;

    let activeTablesCount = 0;

    list.forEach((o) => {
      const isPaid = o.paymentStatus === "paid";
      const total = o.total || 0;

      if (isPaid) {
        realizedRevenue += total;
        paidOrdersCount += 1;

        // Payment method breakdown
        const method = (o.paymentMethod || "").toLowerCase();
        const pLabel = (o.paymentStatusLabel || "").toLowerCase();

        if (method === "cash" || pLabel.includes("kembali") || pLabel.includes("tunai")) {
          cashAmount += total;
          cashCount += 1;
        } else if (method === "static_qr" || method === "qris" || pLabel.includes("qris")) {
          qrisAmount += total;
          qrisCount += 1;
        } else if (method === "bank_transfer" || pLabel.includes("transfer")) {
          transferAmount += total;
          transferCount += 1;
        } else {
          ojolPayAmount += total;
          ojolPayCount += 1;
        }
      } else {
        pendingRevenue += total;
      }

      // Channel counts
      if (o.channel === "dine_in_qr") {
        dineInOrdersCount += 1;
        if (o.kitchenStatus !== "completed" && o.kitchenStatus !== "served" && o.kitchenStatus !== "cancelled") {
          activeTablesCount += 1;
        }
      } else if (o.channel === "takeaway_walk_in") {
        takeawayOrdersCount += 1;
      } else {
        ojolOrdersCount += 1;
      }
    });

    const totalOrdersCount = list.length;
    const aov = paidOrdersCount > 0 ? Math.round(realizedRevenue / paidOrdersCount) : 0;
    // Estimated 20 tables total in restaurant
    const totalTablesCapacity = 20;
    const occupancyRate = Math.min(100, Math.round((activeTablesCount / totalTablesCapacity) * 100));

    // Determine top payment method
    const paymentMethods = [
      { name: "QRIS", amount: qrisAmount, count: qrisCount, color: "#10b981" },
      { name: "Tunai", amount: cashAmount, count: cashCount, color: "#f59e0b" },
      { name: "Transfer", amount: transferAmount, count: transferCount, color: "#3b82f6" },
      { name: "Delivery", amount: ojolPayAmount, count: ojolPayCount, color: "#8b5cf6" },
    ];
    paymentMethods.sort((a, b) => b.amount - a.amount);
    const topMethod = paymentMethods[0];
    const topMethodPct = realizedRevenue > 0 ? Math.round((topMethod.amount / realizedRevenue) * 100) : 0;

    return {
      realizedRevenue,
      pendingRevenue,
      totalOrdersCount,
      paidOrdersCount,
      aov,
      occupancyRate,
      activeTablesCount,
      dineInOrdersCount,
      takeawayOrdersCount,
      ojolOrdersCount,
      paymentBreakdown: {
        qris: {
          name: "QRIS Dinamis / Statis",
          amount: qrisAmount,
          count: qrisCount,
          pct: realizedRevenue > 0 ? Math.round((qrisAmount / realizedRevenue) * 100) : 0,
          color: "#10b981",
        },
        cash: {
          name: "Tunai / Cash Fisik",
          amount: cashAmount,
          count: cashCount,
          pct: realizedRevenue > 0 ? Math.round((cashAmount / realizedRevenue) * 100) : 0,
          color: "#f59e0b",
        },
        transfer: {
          name: "Transfer Bank Langsung",
          amount: transferAmount,
          count: transferCount,
          pct: realizedRevenue > 0 ? Math.round((transferAmount / realizedRevenue) * 100) : 0,
          color: "#3b82f6",
        },
        ojol: {
          name: "Delivery (GoPay / Shopee)",
          amount: ojolPayAmount,
          count: ojolPayCount,
          pct: realizedRevenue > 0 ? Math.round((ojolPayAmount / realizedRevenue) * 100) : 0,
          color: "#8b5cf6",
        },
      },
      topMethodName: topMethod.name,
      topMethodPct,
    };
  }, [filteredOrders, orders]);

  // 3. TOP 10 MENU BEST SELLER (MEMASTIKAN 10 PRODUK TERLARIS SELALU TAMPIL)
  const top10MenuItems = useMemo(() => {
    const list = filteredOrders.length > 0 ? filteredOrders : orders;
    const itemMap: Record<
      string,
      { name: string; category: string; qty: number; revenue: number }
    > = {};

    list.forEach((order) => {
      if (!order.items) return;
      order.items.forEach((item) => {
        const key = item.name.trim();
        if (!itemMap[key]) {
          let cat = "Makanan Utama";
          const lower = key.toLowerCase();
          if (
            lower.includes("es ") ||
            lower.includes("teh") ||
            lower.includes("jeruk") ||
            lower.includes("kopi") ||
            lower.includes("cendol")
          ) {
            cat = "Minuman Segar";
          } else if (
            lower.includes("gurame") ||
            lower.includes("udang") ||
            lower.includes("cumi") ||
            lower.includes("ikan")
          ) {
            cat = "Seafood";
          } else if (lower.includes("sup") || lower.includes("soto") || lower.includes("kangkung")) {
            cat = "Sup & Sayur";
          } else if (
            lower.includes("mendoan") ||
            lower.includes("tahu") ||
            lower.includes("tempe") ||
            lower.includes("pisang")
          ) {
            cat = "Camilan";
          }

          itemMap[key] = {
            name: item.name,
            category: cat,
            qty: 0,
            revenue: 0,
          };
        }

        const qty = item.qty || 1;
        const price = item.price || 0;
        itemMap[key].qty += qty;
        itemMap[key].revenue += qty * price;
      });
    });

    // Melengkapi hingga minimal 10 item menggunakan katalog jika belum mencukupi
    DEFAULT_CATALOG_PRODUCTS.forEach((prod) => {
      const key = prod.name.trim();
      if (!itemMap[key]) {
        itemMap[key] = {
          name: prod.name,
          category: prod.category || "Makanan Utama",
          qty: 0,
          revenue: 0,
        };
      }
    });

    const sorted = Object.values(itemMap).sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);
    const top10 = sorted.slice(0, 10);
    const maxQty = Math.max(top10[0]?.qty || 1, 1);

    return top10.map((item, idx) => ({
      rank: idx + 1,
      name: item.name,
      category: item.category,
      qty: item.qty,
      revenue: item.revenue,
      percentage: Math.max(6, Math.round((item.qty / maxQty) * 100)),
    }));
  }, [filteredOrders, orders]);

  // 4. CHART DATA COMPUTATION (DINAMIS MENYESUAIKAN HARI INI, MINGGUAN, BULANAN, SEMUA, DAN KUSTOM)
  const chartData = useMemo(() => {
    const list = filteredOrders.length > 0 ? filteredOrders : orders;

    // CASE 1: HARI INI (GRAFIK PER JAM: 08:00 s/d 22:00)
    if (timeHorizon === "today") {
      const hours = [8, 10, 12, 14, 16, 18, 20, 22];
      const hoursMap: Record<number, any> = {};

      hours.forEach((h) => {
        const hourStr = `${h.toString().padStart(2, "0")}:00`;
        const nextHourStr = `${(h + 2).toString().padStart(2, "0")}:00`;
        hoursMap[h] = {
          dayKey: `hour-${h}`,
          label: hourStr,
          fullLabel: `Pukul ${hourStr} - ${nextHourStr}`,
          dateStr: "Hari Ini",
          dineIn: 0,
          takeaway: 0,
          ojol: 0,
          total: 0,
          orderCount: 0,
        };
      });

      list.forEach((o) => {
        let hour = 12;
        if (o.createdAt) {
          try {
            const d = new Date(o.createdAt);
            if (!isNaN(d.getTime())) hour = d.getHours();
          } catch {}
        }
        const bucket = Math.max(8, Math.min(22, Math.floor(hour / 2) * 2));
        if (hoursMap[bucket]) {
          const tot = o.total || 0;
          hoursMap[bucket].total += tot;
          hoursMap[bucket].orderCount += 1;
          if (o.channel === "dine_in_qr") hoursMap[bucket].dineIn += tot;
          else if (o.channel === "takeaway_walk_in") hoursMap[bucket].takeaway += tot;
          else hoursMap[bucket].ojol += tot;
        }
      });

      const points = Object.values(hoursMap);
      const maxVal = Math.max(...points.map((p) => p.total), 500000);
      const peakDay = points.reduce((prev, curr) => (curr.total > prev.total ? curr : prev), points[0]);

      return {
        points,
        maxVal,
        peakDay,
        dailyAverage: Math.round(points.reduce((sum, p) => sum + p.total, 0) / points.length),
        unitLabel: "jam",
      };
    }

    // CASE 2: MINGGUAN (7 HARI TERAKHIR)
    if (timeHorizon === "weekly") {
      const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
      const fullDayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const daysMap: Record<string, any> = {};

      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateKey = d.toLocaleDateString("en-CA");
        const dayIdx = d.getDay();
        daysMap[dateKey] = {
          dayKey: dateKey,
          label: dayNames[dayIdx],
          fullLabel: `${fullDayNames[dayIdx]}, ${d.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
          })}`,
          dateStr: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
          dineIn: 0,
          takeaway: 0,
          ojol: 0,
          total: 0,
          orderCount: 0,
        };
      }

      list.forEach((o) => {
        if (!o.createdAt) return;
        const dateKey = new Date(o.createdAt).toLocaleDateString("en-CA");
        if (daysMap[dateKey]) {
          const tot = o.total || 0;
          daysMap[dateKey].total += tot;
          daysMap[dateKey].orderCount += 1;
          if (o.channel === "dine_in_qr") daysMap[dateKey].dineIn += tot;
          else if (o.channel === "takeaway_walk_in") daysMap[dateKey].takeaway += tot;
          else daysMap[dateKey].ojol += tot;
        }
      });

      const points = Object.values(daysMap);
      const maxVal = Math.max(...points.map((p) => p.total), 1000000);
      const peakDay = points.reduce((prev, curr) => (curr.total > prev.total ? curr : prev), points[0]);

      return {
        points,
        maxVal,
        peakDay,
        dailyAverage: Math.round(points.reduce((sum, p) => sum + p.total, 0) / points.length),
        unitLabel: "hari",
      };
    }

    // CASE 3: BULANAN (6 INTERVAL TANGGAL DALAM BULAN INI)
    if (timeHorizon === "monthly") {
      const buckets = [
        { label: "Tgl 1-5", fullLabel: "Tanggal 1 - 5 Bulan Ini", start: 1, end: 5 },
        { label: "Tgl 6-10", fullLabel: "Tanggal 6 - 10 Bulan Ini", start: 6, end: 10 },
        { label: "Tgl 11-15", fullLabel: "Tanggal 11 - 15 Bulan Ini", start: 11, end: 15 },
        { label: "Tgl 16-20", fullLabel: "Tanggal 16 - 20 Bulan Ini", start: 16, end: 20 },
        { label: "Tgl 21-25", fullLabel: "Tanggal 21 - 25 Bulan Ini", start: 21, end: 25 },
        { label: "Tgl 26-31", fullLabel: "Tanggal 26 - 31 Bulan Ini", start: 26, end: 31 },
      ];

      const points = buckets.map((b) => ({
        dayKey: b.label,
        label: b.label,
        fullLabel: b.fullLabel,
        dateStr: b.label,
        dineIn: 0,
        takeaway: 0,
        ojol: 0,
        total: 0,
        orderCount: 0,
      }));

      list.forEach((o) => {
        if (!o.createdAt) return;
        const d = new Date(o.createdAt);
        const dayOfMonth = d.getDate();
        const bIdx = buckets.findIndex((b) => dayOfMonth >= b.start && dayOfMonth <= b.end);
        if (bIdx !== -1) {
          const tot = o.total || 0;
          points[bIdx].total += tot;
          points[bIdx].orderCount += 1;
          if (o.channel === "dine_in_qr") points[bIdx].dineIn += tot;
          else if (o.channel === "takeaway_walk_in") points[bIdx].takeaway += tot;
          else points[bIdx].ojol += tot;
        }
      });

      const maxVal = Math.max(...points.map((p) => p.total), 2000000);
      const peakDay = points.reduce((prev, curr) => (curr.total > prev.total ? curr : prev), points[0]);

      return {
        points,
        maxVal,
        peakDay,
        dailyAverage: Math.round(points.reduce((sum, p) => sum + p.total, 0) / points.length),
        unitLabel: "periode",
      };
    }

    // CASE 4: SEMUA (TREN BULANAN RIIL)
    if (timeHorizon === "all") {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
      const monthsMap: Record<string, any> = {};

      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
        monthsMap[key] = {
          dayKey: key,
          label: monthNames[d.getMonth()],
          fullLabel: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
          dateStr: d.getFullYear().toString(),
          dineIn: 0,
          takeaway: 0,
          ojol: 0,
          total: 0,
          orderCount: 0,
        };
      }

      list.forEach((o) => {
        if (!o.createdAt) return;
        const d = new Date(o.createdAt);
        const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
        if (monthsMap[key]) {
          const tot = o.total || 0;
          monthsMap[key].total += tot;
          monthsMap[key].orderCount += 1;
          if (o.channel === "dine_in_qr") monthsMap[key].dineIn += tot;
          else if (o.channel === "takeaway_walk_in") monthsMap[key].takeaway += tot;
          else monthsMap[key].ojol += tot;
        }
      });

      const points = Object.values(monthsMap);
      const maxVal = Math.max(...points.map((p) => p.total), 3000000);
      const peakDay = points.reduce((prev, curr) => (curr.total > prev.total ? curr : prev), points[0]);

      return {
        points,
        maxVal,
        peakDay,
        dailyAverage: Math.round(points.reduce((sum, p) => sum + p.total, 0) / points.length),
        unitLabel: "bulan",
      };
    }

    // CASE 5: KUSTOM (RENTANG TANGGAL TERPILIH)
    const start = new Date(customStartDate || Date.now());
    const end = new Date(customEndDate || Date.now());
    const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);

    const customDaysMap: Record<string, any> = {};
    const maxPoints = Math.min(diffDays, 14);
    const step = diffDays <= 14 ? 1 : Math.ceil(diffDays / 10);

    for (let i = 0; i < maxPoints; i++) {
      const d = new Date(start.getTime() + i * step * 24 * 60 * 60 * 1000);
      if (d > end) break;
      const key = d.toLocaleDateString("en-CA");
      customDaysMap[key] = {
        dayKey: key,
        label: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
        fullLabel: d.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        dateStr: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
        dineIn: 0,
        takeaway: 0,
        ojol: 0,
        total: 0,
        orderCount: 0,
      };
    }

    list.forEach((o) => {
      if (!o.createdAt) return;
      const key = new Date(o.createdAt).toLocaleDateString("en-CA");
      if (customDaysMap[key]) {
        const tot = o.total || 0;
        customDaysMap[key].total += tot;
        customDaysMap[key].orderCount += 1;
        if (o.channel === "dine_in_qr") customDaysMap[key].dineIn += tot;
        else if (o.channel === "takeaway_walk_in") customDaysMap[key].takeaway += tot;
        else customDaysMap[key].ojol += tot;
      }
    });

    const points = Object.values(customDaysMap);
    const maxVal = Math.max(...points.map((p) => p.total), 1000000);
    const peakDay = points.reduce(
      (prev, curr) => (curr.total > prev.total ? curr : prev),
      points[0] || { fullLabel: "-", total: 0 }
    );

    return {
      points: points.length > 0 ? points : [
        {
          dayKey: "empty",
          label: "Data",
          fullLabel: "Periode Dipilih",
          dateStr: "-",
          dineIn: 0,
          takeaway: 0,
          ojol: 0,
          total: 0,
          orderCount: 0,
        },
      ],
      maxVal,
      peakDay,
      dailyAverage: Math.round(points.reduce((sum, p) => sum + p.total, 0) / Math.max(1, points.length)),
      unitLabel: "hari",
    };
  }, [filteredOrders, orders, timeHorizon, customStartDate, customEndDate]);

  // 5. PEAK TIME & JAM SIBUK RESTORAN
  const peakTimeData = useMemo(() => {
    const list = filteredOrders.length > 0 ? filteredOrders : orders;

    // Jam operasional restoran: 09:00 s/d 22:00 (14 jam)
    const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

    const hourlyMap: Record<
      number,
      {
        hour: number;
        label: string;
        timeRange: string;
        orderCount: number;
        revenue: number;
        dineInCount: number;
        takeawayCount: number;
        ojolCount: number;
        rushType: "lunch" | "dinner" | null;
      }
    > = {};

    hours.forEach((h) => {
      const isLunch = h >= 11 && h <= 13;
      const isDinner = h >= 18 && h <= 20;
      hourlyMap[h] = {
        hour: h,
        label: `${h.toString().padStart(2, "0")}:00`,
        timeRange: `${h.toString().padStart(2, "0")}:00 - ${(h + 1).toString().padStart(2, "0")}:00`,
        orderCount: 0,
        revenue: 0,
        dineInCount: 0,
        takeawayCount: 0,
        ojolCount: 0,
        rushType: isLunch ? "lunch" : isDinner ? "dinner" : null,
      };
    });

    list.forEach((order) => {
      let h = 12;
      if (order.createdAt) {
        try {
          const d = new Date(order.createdAt);
          if (!isNaN(d.getTime())) h = d.getHours();
        } catch {}
      }
      const clampedH = Math.max(9, Math.min(22, h));
      if (hourlyMap[clampedH]) {
        hourlyMap[clampedH].orderCount += 1;
        hourlyMap[clampedH].revenue += order.total || 0;
        if (order.channel === "dine_in_qr") hourlyMap[clampedH].dineInCount += 1;
        else if (order.channel === "takeaway_walk_in") hourlyMap[clampedH].takeawayCount += 1;
        else hourlyMap[clampedH].ojolCount += 1;
      }
    });

    const hourlyList = Object.values(hourlyMap);
    const maxOrders = Math.max(...hourlyList.map((h) => h.orderCount), 1);
    const maxRevenue = Math.max(...hourlyList.map((h) => h.revenue), 100000);

    const peakHour = hourlyList.reduce(
      (max, curr) => (curr.orderCount > max.orderCount ? curr : max),
      hourlyList.find((h) => h.hour === 12) || hourlyList[0]
    );

    const lunchOrders = hourlyList
      .filter((h) => h.rushType === "lunch")
      .reduce((s, h) => s + h.orderCount, 0);
    const dinnerOrders = hourlyList
      .filter((h) => h.rushType === "dinner")
      .reduce((s, h) => s + h.orderCount, 0);

    return {
      hours: hourlyList,
      maxOrders,
      maxRevenue,
      peakHour,
      lunchOrders,
      dinnerOrders,
      totalOrders: list.length,
    };
  }, [filteredOrders, orders]);

  // 5. SPLINE SVG PATH GENERATOR
  const splinePaths = useMemo(() => {
    const points = chartData.points;
    if (points.length === 0) return { areaPath: "", strokePath: "", coords: [], svgWidth: 800, svgHeight: 240, baselineY: 200, paddingTop: 30 };

    const svgWidth = 800;
    const svgHeight = 240;
    const paddingX = 40;
    const paddingTop = 30;
    const paddingBottom = 40;
    const chartW = svgWidth - paddingX * 2;
    const chartH = svgHeight - paddingTop - paddingBottom;
    const maxVal = chartData.maxVal * 1.15; // 15% headroom for top spacing

    const coords = points.map((p, idx) => {
      const x = paddingX + (idx / Math.max(1, points.length - 1)) * chartW;
      const y = paddingTop + (1 - p.total / maxVal) * chartH;
      return { x, y, data: p };
    });

    // Build Cubic Spline (Catmull-Rom or Bezier smooth)
    let strokePath = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i === 0 ? i : i - 1];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2 < coords.length ? i + 2 : i + 1];

      // Smooth control points
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      strokePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    const baselineY = svgHeight - paddingBottom;
    const areaPath = `${strokePath} L ${coords[coords.length - 1].x} ${baselineY} L ${coords[0].x} ${baselineY} Z`;

    return {
      areaPath,
      strokePath,
      coords,
      svgWidth,
      svgHeight,
      baselineY,
      paddingTop,
    };
  }, [chartData]);

  // 6. LIVE TRANSACTIONS FILTERING
  const liveTransactions = useMemo(() => {
    let list = orders;

    if (liveChannelFilter === "dine_in") {
      list = list.filter((o) => o.channel === "dine_in_qr");
    } else if (liveChannelFilter === "takeaway") {
      list = list.filter((o) => o.channel === "takeaway_walk_in");
    } else if (liveChannelFilter === "ojol") {
      list = list.filter((o) => o.channel === "online_platform");
    } else if (liveChannelFilter === "unpaid") {
      list = list.filter((o) => o.paymentStatus !== "paid");
    } else if (liveChannelFilter === "paid") {
      list = list.filter((o) => o.paymentStatus === "paid");
    }

    if (liveSearchQuery.trim()) {
      const q = liveSearchQuery.toLowerCase();
      list = list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.tableOrGuest.toLowerCase().includes(q) ||
          (o.guestSubtext && o.guestSubtext.toLowerCase().includes(q)) ||
          o.items?.some((i) => i.name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [orders, liveChannelFilter, liveSearchQuery]);

  const displayedLiveTransactions = liveTransactions.slice(0, liveVisibleCount);

  // Time label description
  const timeHorizonDescription =
    timeHorizon === "today"
      ? "Hari Ini (Sesi Live)"
      : timeHorizon === "weekly"
      ? "7 Hari Terakhir (Siklus Mingguan)"
      : timeHorizon === "monthly"
      ? "Bulan Ini"
      : timeHorizon === "custom"
      ? `Rentang Tanggal: ${customStartDate} s/d ${customEndDate}`
      : "Semua Riwayat Database";

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 gap-6 animate-in fade-in duration-300">
      {/* ========================================================= */}
      {/* 1. TOP HEADER BANNER (THEMA POS & RESTORAN)               */}
      {/* ========================================================= */}
      <div className="bg-white p-5 rounded-2xl shadow-2xs border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#003629] text-white flex items-center justify-center shadow-xs shrink-0">
            <span className="material-symbols-outlined text-2xl">analytics</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Infografis &amp; Analitik Penjualan
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#003629] text-xs font-bold border border-emerald-200">
                {settings.restaurantName}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
                {settings.branchName}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>
                Data tersinkronisasi langsung dengan sistem POS Kasir, Kitchen KDS, dan Waiters •{" "}
                <strong className="text-slate-700">{timeHorizonDescription}</strong>
              </span>
            </p>
          </div>
        </div>

        {/* Time Horizon Filter Switcher & Custom Date Filter */}
        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <div className="p-1 bg-slate-100 rounded-xl border border-slate-200/80 flex items-center gap-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setTimeHorizon("today")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeHorizon === "today"
                  ? "bg-[#003629] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setTimeHorizon("weekly")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeHorizon === "weekly"
                  ? "bg-[#003629] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              Mingguan
            </button>
            <button
              type="button"
              onClick={() => setTimeHorizon("monthly")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeHorizon === "monthly"
                  ? "bg-[#003629] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              Bulanan
            </button>
            <button
              type="button"
              onClick={() => setTimeHorizon("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeHorizon === "all"
                  ? "bg-[#003629] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setTimeHorizon("custom")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                timeHorizon === "custom"
                  ? "bg-[#003629] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <span className="material-symbols-outlined text-sm">calendar_month</span>
              <span>Pilih Tanggal</span>
            </button>
          </div>

          {/* Inline Custom Date Range Inputs */}
          {timeHorizon === "custom" && (
            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl border border-slate-200/90 shadow-2xs text-xs animate-in fade-in slide-in-from-top-1">
              <span className="font-bold text-slate-500 text-[11px]">Dari:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 font-mono text-xs font-bold text-slate-800 focus:outline-none focus:border-[#003629]"
              />
              <span className="font-bold text-slate-500 text-[11px]">s/d:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 font-mono text-xs font-bold text-slate-800 focus:outline-none focus:border-[#003629]"
              />
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. 5 KPI CARDS (DIPEROLEH SECARA REAL DARI TRANSAKSI)      */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total Omset Realisasi */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              Total Omset Penjualan
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#003629] flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">monetization_on</span>
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-xl sm:text-2xl font-black text-[#003629] tracking-tight">
              {formatCurrency(summaryMetrics.realizedRevenue)}
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 mt-1">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>Lunas Terbayar</span>
              {summaryMetrics.pendingRevenue > 0 && (
                <span className="text-slate-400 font-normal">
                  • Pending: {formatCurrency(summaryMetrics.pendingRevenue)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Total Transaksi Selesai */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              Total Transaksi Selesai
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-[#904d00] flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">receipt_long</span>
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-xl sm:text-2xl font-black text-[#904d00] tracking-tight">
              {summaryMetrics.paidOrdersCount.toLocaleString("id-ID")}{" "}
              <span className="text-xs font-bold text-slate-500">Struk Lunas</span>
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 mt-1">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              <span>{summaryMetrics.totalOrdersCount} Total Transaksi</span>
            </div>
          </div>
        </div>

        {/* Card 3: Rata-Rata Order (AOV) */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              Rata-rata Order (AOV)
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">shopping_basket</span>
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {formatCurrency(summaryMetrics.aov)}
            </h3>
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 mt-1">
              <span className="material-symbols-outlined text-sm text-sky-600">pie_chart</span>
              <span>Nilai per struk transaksi</span>
            </div>
          </div>
        </div>

        {/* Card 4: Okupansi Meja Makan */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              Okupansi Meja Dine-in
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">table_restaurant</span>
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {summaryMetrics.occupancyRate}%
            </h3>
            <div className="flex items-center gap-1 text-[11px] font-bold text-teal-700 mt-1">
              <span>{summaryMetrics.activeTablesCount} Meja Aktif</span>
              <span className="text-slate-400 font-normal">• dari 20 Meja</span>
            </div>
          </div>
        </div>

        {/* Card 5: Metode Bayar Favorit */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between col-span-1 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              Metode Bayar Favorit
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">qr_code_scanner</span>
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-xl sm:text-2xl font-black text-[#003629] tracking-tight">
              {summaryMetrics.topMethodName} ({summaryMetrics.topMethodPct}%)
            </h3>
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 mt-1">
              <span>Dominan di meja kasir</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. MAIN ANALYTICS ROW: GRAFIK TREN & KATEGORI METODE BAYAR */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT (8 cols): MODERN SPLINE & STACKED BAR CHART */}
        <div className="lg:col-span-8 p-5 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg text-slate-900 font-black tracking-tight">
                  Grafik Tren Pendapatan Restoran
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[#003629] text-[10px] font-extrabold border border-emerald-200/80">
                  Data Transaksi Riil
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Pergerakan omset harian berdasarkan saluran Dine-in, Take Away, dan Delivery
              </p>
            </div>

            {/* Mode Switcher: Kurva Spline vs Stacked Bar */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="p-0.5 bg-slate-100 rounded-xl flex items-center border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setChartViewMode("spline")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    chartViewMode === "spline"
                      ? "bg-white text-[#003629] shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Tampilkan grafik kurva halus modern (Spline Glow)"
                >
                  <span className="material-symbols-outlined text-sm">show_chart</span>
                  <span>Kurva Area</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChartViewMode("bars")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    chartViewMode === "bars"
                      ? "bg-white text-[#003629] shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Tampilkan pilar perbandingan channel"
                >
                  <span className="material-symbols-outlined text-sm">bar_chart</span>
                  <span>Pilar Channel</span>
                </button>
              </div>
            </div>
          </div>

          {/* Channel Legend & Highlights */}
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-3.5">
              <span className="flex items-center gap-1.5 font-bold text-slate-700">
                <span className="w-3 h-3 rounded-md bg-[#003629] shadow-2xs" />
                <span>Dine-in (Meja)</span>
              </span>
              <span className="flex items-center gap-1.5 font-bold text-slate-700">
                <span className="w-3 h-3 rounded-md bg-[#904d00] shadow-2xs" />
                <span>Take Away</span>
              </span>
              <span className="flex items-center gap-1.5 font-bold text-slate-700">
                <span className="w-3 h-3 rounded-md bg-sky-600 shadow-2xs" />
                <span>Delivery</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500">
                Rata-rata:{" "}
                <strong className="text-slate-800">
                  {formatCurrency(chartData.dailyAverage)}/{chartData.unitLabel || "hari"}
                </strong>
              </span>
            </div>
          </div>

          {/* CHART VISUALIZER CONTAINER */}
          <div className="relative w-full h-64 sm:h-72 mt-2 select-none">
            {chartViewMode === "spline" ? (
              /* ================= MODERN CURVED SPLINE AREA CHART ================= */
              <div className="w-full h-full relative">
                {/* Horizontal reference grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 pt-4">
                  {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
                    <div key={ratio} className="w-full flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono w-14 text-right shrink-0">
                        {formatCurrency(Math.round(chartData.maxVal * ratio)).replace(",00", "")}
                      </span>
                      <div className="flex-1 border-b border-slate-100 border-dashed" />
                    </div>
                  ))}
                </div>

                {/* SVG Curve & Gradient */}
                <svg
                  viewBox={`0 0 ${splinePaths.svgWidth} ${splinePaths.svgHeight}`}
                  className="w-full h-full overflow-visible"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="pawonEmeraldGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#003629" stopOpacity="0.32" />
                      <stop offset="60%" stopColor="#003629" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="#003629" stopOpacity="0.0" />
                    </linearGradient>
                    <filter id="glowShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#003629" floodOpacity="0.25" />
                    </filter>
                  </defs>

                  {/* Filled Area */}
                  {splinePaths.areaPath && (
                    <path
                      d={splinePaths.areaPath}
                      fill="url(#pawonEmeraldGrad)"
                      className="transition-all duration-300"
                    />
                  )}

                  {/* Glowing Stroke Curve */}
                  {splinePaths.strokePath && (
                    <path
                      d={splinePaths.strokePath}
                      fill="none"
                      stroke="#003629"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      filter="url(#glowShadow)"
                      className="transition-all duration-300"
                    />
                  )}

                  {/* Interactive Nodes / Dots */}
                  {splinePaths.coords.map((pt, idx) => {
                    const isHovered = activeChartIndex === idx;
                    return (
                      <g key={pt.data.dayKey}>
                        {/* Hover Pulse Ring */}
                        {isHovered && (
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r="12"
                            fill="#003629"
                            fillOpacity="0.2"
                            className="animate-ping"
                          />
                        )}

                        {/* Point Core */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? "6" : "4.5"}
                          fill={isHovered ? "#904d00" : "#003629"}
                          stroke="#ffffff"
                          strokeWidth="2.5"
                          className="transition-all duration-200 cursor-pointer"
                        />

                        {/* Interactive Click/Hover Target */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="24"
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={() => setActiveChartIndex(idx)}
                          onMouseLeave={() => setActiveChartIndex(null)}
                        />
                      </g>
                    );
                  })}
                </svg>

                {/* X-Axis Date Labels */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between px-6 pt-2">
                  {chartData.points.map((p, idx) => {
                    const isHovered = activeChartIndex === idx;
                    return (
                      <div
                        key={p.dayKey}
                        onMouseEnter={() => setActiveChartIndex(idx)}
                        onMouseLeave={() => setActiveChartIndex(null)}
                        className="flex flex-col items-center cursor-pointer"
                      >
                        <span
                          className={`text-xs font-bold transition-colors ${
                            isHovered ? "text-[#003629] font-black" : "text-slate-500"
                          }`}
                        >
                          {p.label}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {p.dateStr}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Floating Interactive Tooltip Card */}
                {activeChartIndex !== null && splinePaths.coords[activeChartIndex] && (
                  <div
                    className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full bg-slate-900/95 backdrop-blur-md text-white rounded-xl p-3 shadow-xl border border-slate-700/60 min-w-[190px] animate-in fade-in zoom-in-95 duration-150"
                    style={{
                      left: `${(splinePaths.coords[activeChartIndex].x / splinePaths.svgWidth) * 100}%`,
                      top: `${(splinePaths.coords[activeChartIndex].y / splinePaths.svgHeight) * 100 - 4}%`,
                    }}
                  >
                    <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5 mb-2">
                      <span className="text-[11px] font-bold text-slate-300">
                        {splinePaths.coords[activeChartIndex].data.fullLabel}
                      </span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-black px-1.5 py-0.5 rounded">
                        {splinePaths.coords[activeChartIndex].data.orderCount} Struk
                      </span>
                    </div>

                    <div className="text-base font-black text-emerald-400 mb-2">
                      {formatCurrency(splinePaths.coords[activeChartIndex].data.total)}
                    </div>

                    <div className="space-y-1 text-[11px]">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Dine-in:</span>
                        </span>
                        <span className="font-bold text-white">
                          {formatCurrency(splinePaths.coords[activeChartIndex].data.dineIn)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>Take Away:</span>
                        </span>
                        <span className="font-bold text-white">
                          {formatCurrency(splinePaths.coords[activeChartIndex].data.takeaway)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-sky-400" />
                          <span>Delivery:</span>
                        </span>
                        <span className="font-bold text-white">
                          {formatCurrency(splinePaths.coords[activeChartIndex].data.ojol)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ================= STACKED CHANNEL BAR CHART ================= */
              <div className="w-full h-full flex items-end gap-2 sm:gap-4 pt-6 pb-2 px-2 relative">
                {chartData.points.map((d, idx) => {
                  const heightPct = Math.round((d.total / chartData.maxVal) * 100);
                  const isHovered = activeChartIndex === idx;

                  return (
                    <div
                      key={d.dayKey}
                      onMouseEnter={() => setActiveChartIndex(idx)}
                      onMouseLeave={() => setActiveChartIndex(null)}
                      className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
                    >
                      {/* Floating tooltip */}
                      {isHovered && (
                        <div className="absolute -top-12 bg-slate-900 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg shadow-xl pointer-events-none whitespace-nowrap z-20 animate-in fade-in zoom-in-95">
                          {d.fullLabel}: {formatCurrency(d.total)}
                        </div>
                      )}

                      {/* Stacked Pillars */}
                      <div
                        className="w-full max-w-[48px] flex flex-col justify-end rounded-t-xl overflow-hidden shadow-2xs transition-all duration-200 group-hover:scale-y-[1.02] group-hover:shadow-md bg-slate-100"
                        style={{ height: `${Math.max(8, heightPct)}%` }}
                      >
                        {d.total > 0 ? (
                          <>
                            <div
                              style={{ height: `${(d.ojol / d.total) * 100}%` }}
                              className="bg-sky-600 w-full"
                              title={`Delivery: ${formatCurrency(d.ojol)}`}
                            />
                            <div
                              style={{ height: `${(d.takeaway / d.total) * 100}%` }}
                              className="bg-[#904d00] w-full"
                              title={`Take Away: ${formatCurrency(d.takeaway)}`}
                            />
                            <div
                              style={{ height: `${(d.dineIn / d.total) * 100}%` }}
                              className="bg-[#003629] w-full"
                              title={`Dine-in: ${formatCurrency(d.dineIn)}`}
                            />
                          </>
                        ) : (
                          <div className="w-full h-1 bg-slate-300" />
                        )}
                      </div>

                      {/* Day Label */}
                      <span
                        className={`text-xs mt-2 font-bold transition-colors ${
                          isHovered ? "text-[#003629]" : "text-slate-500"
                        }`}
                      >
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom Peak & Performance Strip */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="material-symbols-outlined text-base text-amber-600">stars</span>
              <span>
                Puncak Tertinggi:{" "}
                <strong className="text-slate-900">{chartData.peakDay?.fullLabel || "-"}</strong> (
                {formatCurrency(chartData.peakDay?.total || 0)})
              </span>
            </span>
            <span className="font-bold text-[#003629]">
              Total Volume: {formatCurrency(summaryMetrics.realizedRevenue + summaryMetrics.pendingRevenue)}
            </span>
          </div>
        </div>

        {/* RIGHT (4 cols): PAYMENT METHOD BREAKDOWN (DONUT + REAL TOTALS) */}
        <div className="lg:col-span-4 p-5 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col gap-4">
          <div className="border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-800 text-xl">payments</span>
              <h2 className="text-base sm:text-lg text-slate-900 font-black tracking-tight">
                Kategori Metode Pembayaran
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Proporsi riil penerimaan kasir POS Restoran
            </p>
          </div>

          {/* Donut Chart Representation */}
          <div className="relative flex items-center justify-center py-3">
            <svg viewBox="0 0 100 100" className="w-44 h-44 -rotate-90">
              {/* Circumference = 2 * PI * 38 ≈ 238.76 */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="transparent"
                stroke={summaryMetrics.paymentBreakdown.qris.color}
                strokeWidth="15"
                strokeDasharray={`${(summaryMetrics.paymentBreakdown.qris.pct / 100) * 238.8} 238.8`}
                strokeDashoffset="0"
                className="transition-all duration-500"
              />
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="transparent"
                stroke={summaryMetrics.paymentBreakdown.cash.color}
                strokeWidth="15"
                strokeDasharray={`${(summaryMetrics.paymentBreakdown.cash.pct / 100) * 238.8} 238.8`}
                strokeDashoffset={`-${(summaryMetrics.paymentBreakdown.qris.pct / 100) * 238.8}`}
                className="transition-all duration-500"
              />
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="transparent"
                stroke={summaryMetrics.paymentBreakdown.transfer.color}
                strokeWidth="15"
                strokeDasharray={`${(summaryMetrics.paymentBreakdown.transfer.pct / 100) * 238.8} 238.8`}
                strokeDashoffset={`-${
                  ((summaryMetrics.paymentBreakdown.qris.pct + summaryMetrics.paymentBreakdown.cash.pct) / 100) * 238.8
                }`}
                className="transition-all duration-500"
              />
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="transparent"
                stroke={summaryMetrics.paymentBreakdown.ojol.color}
                strokeWidth="15"
                strokeDasharray={`${(summaryMetrics.paymentBreakdown.ojol.pct / 100) * 238.8} 238.8`}
                strokeDashoffset={`-${
                  ((summaryMetrics.paymentBreakdown.qris.pct +
                    summaryMetrics.paymentBreakdown.cash.pct +
                    summaryMetrics.paymentBreakdown.transfer.pct) /
                    100) *
                  238.8
                }`}
                className="transition-all duration-500"
              />
            </svg>

            {/* Inner Center Label */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">
                Total Realisasi
              </span>
              <span className="text-xl font-black text-slate-900 leading-tight">100%</span>
              <span className="text-[11px] text-[#003629] font-black">
                {formatCurrency(summaryMetrics.realizedRevenue)}
              </span>
            </div>
          </div>

          {/* Detailed Payment Breakdown Items */}
          <div className="flex flex-col gap-2 pt-1">
            {Object.values(summaryMetrics.paymentBreakdown).map((p) => (
              <div
                key={p.name}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs hover:bg-slate-100/70 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="font-bold text-slate-800">{p.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900">{formatCurrency(p.amount)}</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-extrabold text-[10px]">
                    {p.pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. ANALISIS PEAK TIME & JAM SIBUK RESTORAN               */}
      {/* ========================================================= */}
      <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col gap-5">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-600 text-xl">schedule</span>
              <h2 className="text-base sm:text-lg text-slate-900 font-black tracking-tight">
                Analisis Peak Time &amp; Jam Sibuk Restoran
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-800 text-[10px] font-extrabold border border-orange-200">
                Trafik Pengunjung
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Distribusi intensitas pesanan per jam operasional untuk optimasi jadwal chef dapur dan staf pelayanan
            </p>
          </div>

          {/* Rush Hour Indicator Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold">
              <span>☀️</span>
              <span>Makan Siang (11:00 - 14:00)</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-900 border border-indigo-200 text-xs font-bold">
              <span>🌙</span>
              <span>Makan Malam (18:00 - 21:00)</span>
            </div>
          </div>
        </div>

        {/* 4 Mini KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Jam Tersibuk */}
          <div className="p-3.5 rounded-xl bg-orange-50/70 border border-orange-200/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <span className="material-symbols-outlined text-xl">local_fire_department</span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block truncate">
                Jam Tersibuk (Peak)
              </span>
              <span className="text-sm font-black text-slate-900 truncate block">
                {peakTimeData.peakHour.timeRange}
              </span>
            </div>
          </div>

          {/* Volume di Jam Tersibuk */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#003629] text-white flex items-center justify-center shrink-0 shadow-2xs">
              <span className="material-symbols-outlined text-xl">receipt_long</span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block truncate">
                Pesanan di Jam Puncak
              </span>
              <span className="text-sm font-black text-[#003629] truncate block">
                {peakTimeData.peakHour.orderCount} Struk ({formatCurrency(peakTimeData.peakHour.revenue)})
              </span>
            </div>
          </div>

          {/* Lunch Rush Total */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <span className="material-symbols-outlined text-xl">wb_sunny</span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block truncate">
                Total Makan Siang (11-13)
              </span>
              <span className="text-sm font-black text-amber-900 truncate block">
                {peakTimeData.lunchOrders} Pesanan
              </span>
            </div>
          </div>

          {/* Dinner Rush Total */}
          <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <span className="material-symbols-outlined text-xl">dark_mode</span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block truncate">
                Total Makan Malam (18-20)
              </span>
              <span className="text-sm font-black text-indigo-950 truncate block">
                {peakTimeData.dinnerOrders} Pesanan
              </span>
            </div>
          </div>
        </div>

        {/* Hourly Distribution Bar Chart */}
        <div className="w-full h-56 sm:h-64 flex items-end gap-1.5 sm:gap-2.5 pt-6 pb-2 px-1 relative select-none">
          {peakTimeData.hours.map((h) => {
            const heightPct = Math.max(8, Math.round((h.orderCount / peakTimeData.maxOrders) * 100));
            const isTopPeak = h.hour === peakTimeData.peakHour.hour && h.orderCount > 0;
            const isRush = h.rushType !== null;

            return (
              <div
                key={h.hour}
                className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
              >
                {/* Floating Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-20 bg-slate-900/95 backdrop-blur-md text-white text-[11px] font-bold p-2.5 rounded-xl shadow-xl pointer-events-none whitespace-nowrap z-30">
                  <div className="font-extrabold text-amber-400 flex items-center gap-1">
                    <span>{h.timeRange}</span>
                    {isTopPeak && (
                      <span className="text-[9px] bg-orange-600 text-white px-1.5 py-0.2 rounded font-black uppercase">
                        Puncak
                      </span>
                    )}
                  </div>
                  <div className="text-white mt-0.5">
                    {h.orderCount} Pesanan • {formatCurrency(h.revenue)}
                  </div>
                  <div className="text-[10px] text-slate-300 mt-0.5">
                    Dine-in: {h.dineInCount} | Takeaway: {h.takeawayCount} | Delivery: {h.ojolCount}
                  </div>
                </div>

                {/* Vertical Bar */}
                <div
                  className={`w-full max-w-[44px] rounded-t-xl transition-all duration-300 group-hover:scale-y-105 group-hover:shadow-md flex flex-col justify-end items-center ${
                    isTopPeak
                      ? "bg-gradient-to-t from-orange-600 to-amber-500 shadow-xs"
                      : isRush
                      ? "bg-gradient-to-t from-[#003629] to-emerald-600 shadow-2xs"
                      : "bg-slate-200 hover:bg-slate-300"
                  }`}
                  style={{ height: `${heightPct}%` }}
                >
                  {h.orderCount > 0 && (
                    <span className="text-[10px] font-black text-white mb-1.5 drop-shadow-xs">
                      {h.orderCount}
                    </span>
                  )}
                </div>

                {/* Hour Label */}
                <span
                  className={`text-[10px] sm:text-xs mt-2 font-bold transition-colors ${
                    isTopPeak
                      ? "text-orange-700 font-black"
                      : isRush
                      ? "text-[#003629] font-extrabold"
                      : "text-slate-400"
                  }`}
                >
                  {h.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Operational Staffing Insights */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-amber-600">lightbulb</span>
            <span>
              <strong>Rekomendasi Operasional:</strong> Jam paling ramai berada pada pukul{" "}
              <strong className="text-slate-900">{peakTimeData.peakHour.timeRange}</strong>. Pastikan seluruh
              posisi kasir dan juru masak dapur dalam kondisi siap optimal sebelum jam makan siang &amp; makan malam.
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. REAL-TIME LIVE TRANSACTION FEED (TRANSAKSI LIVE)        */}
      {/* ========================================================= */}
      <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3.5 w-3.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-600" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg text-slate-900 font-black tracking-tight">
                  Aliran Transaksi Real-Time (Live Feed)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#003629] text-[10px] font-black">
                  {liveTransactions.length} Pesanan Tercatat
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Pantau pesanan masuk, status operasional dapur, dan kasir secara langsung
              </p>
            </div>
          </div>

          {/* Search & Quick Channel Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Cari no. order, meja, pelanggan..."
                value={liveSearchQuery}
                onChange={(e) => setLiveSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#003629] focus:bg-white"
              />
              <span className="material-symbols-outlined text-sm text-slate-400 absolute left-2.5 top-2">
                search
              </span>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setLiveChannelFilter("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  liveChannelFilter === "all"
                    ? "bg-[#003629] text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setLiveChannelFilter("dine_in")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  liveChannelFilter === "dine_in"
                    ? "bg-[#003629] text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                🍽️ Dine-in
              </button>
              <button
                type="button"
                onClick={() => setLiveChannelFilter("takeaway")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  liveChannelFilter === "takeaway"
                    ? "bg-[#904d00] text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                🛍️ Take Away
              </button>
              <button
                type="button"
                onClick={() => setLiveChannelFilter("ojol")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  liveChannelFilter === "ojol"
                    ? "bg-sky-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                🛵 Delivery
              </button>
              <button
                type="button"
                onClick={() => setLiveChannelFilter("unpaid")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  liveChannelFilter === "unpaid"
                    ? "bg-rose-600 text-white shadow-2xs"
                    : "bg-slate-100 text-rose-700 hover:bg-rose-50"
                }`}
              >
                ⚠️ Belum Bayar
              </button>
            </div>
          </div>
        </div>

        {/* Live Transaction Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider bg-slate-50/70">
                <th className="py-2.5 px-3">No. Order &amp; Waktu</th>
                <th className="py-2.5 px-3">Saluran &amp; Pelanggan</th>
                <th className="py-2.5 px-3">Ringkasan Pesanan</th>
                <th className="py-2.5 px-3 text-center">Status Dapur</th>
                <th className="py-2.5 px-3 text-center">Status Pembayaran</th>
                <th className="py-2.5 px-3 text-right">Total Tagihan</th>
                <th className="py-2.5 px-3 text-center">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedLiveTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Tidak ada transaksi yang cocok dengan filter saat ini.
                  </td>
                </tr>
              ) : (
                displayedLiveTransactions.map((order) => {
                  const isPaid = order.paymentStatus === "paid";
                  const itemCount = order.items?.reduce((s, i) => s + (i.qty || 1), 0) || 0;
                  const itemSummary =
                    order.items?.map((i) => `${i.name} (${i.qty}x)`).join(", ") || "Tidak ada item";

                  return (
                    <tr
                      key={order.id || order.orderNumber}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Order Number & Timestamp */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="font-extrabold text-slate-900 font-mono text-sm">
                            {order.orderNumber}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {order.orderTime || "Waktu --"} •{" "}
                            <span className="font-bold text-slate-600">{order.timeAgo}</span>
                          </span>
                        </div>
                      </td>

                      {/* Channel & Customer */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                order.channel === "dine_in_qr"
                                  ? "bg-emerald-100 text-[#003629]"
                                  : order.channel === "takeaway_walk_in"
                                  ? "bg-amber-100 text-[#904d00]"
                                  : "bg-sky-100 text-sky-800"
                              }`}
                            >
                              {order.channel === "takeaway_walk_in" || order.channelLabel === "Bungkus"
                                ? "Take Away"
                                : order.channel === "online_platform" || order.channelLabel === "Ojol"
                                ? "Delivery"
                                : order.channelLabel || "Pesanan"}
                            </span>
                            <span className="font-bold text-slate-800 text-xs">
                              {order.tableOrGuest}
                            </span>
                          </div>
                          {order.guestSubtext && (
                            <span className="text-[10px] text-slate-500 mt-0.5">
                              {order.guestSubtext}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Items Ordered Summary */}
                      <td className="py-3 px-3 max-w-xs">
                        <div className="flex flex-col truncate" title={itemSummary}>
                          <span className="font-bold text-slate-700 text-xs truncate">
                            {itemSummary}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {itemCount} Porsi total
                          </span>
                        </div>
                      </td>

                      {/* Kitchen Status Badge */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-extrabold ${
                            order.kitchenStatus === "completed" || order.kitchenStatus === "served"
                              ? "bg-slate-100 text-slate-700"
                              : order.kitchenStatus === "ready"
                              ? "bg-emerald-100 text-emerald-800"
                              : order.kitchenStatus === "in_progress"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {order.kitchenStatus === "completed" ||
                          order.kitchenStatus === "served" ||
                          order.kitchenStatusLabel === "Sudah Diantarkan" ||
                          order.kitchenStatusLabel === "Selesai"
                            ? "Selesai Disajikan"
                            : order.kitchenStatusLabel || "Pesanan Baru"}
                        </span>
                      </td>

                      {/* Payment Status Badge */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-extrabold ${
                            isPaid
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {isPaid ? "✓ Lunas" : "Belum Bayar"}
                        </span>
                      </td>

                      {/* Total Amount */}
                      <td className="py-3 px-3 text-right">
                        <span className="font-black text-slate-900 font-mono text-sm">
                          {formatCurrency(order.total || 0)}
                        </span>
                      </td>

                      {/* Fast Action Buttons */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {!isPaid && onProcessPayment ? (
                            <button
                              type="button"
                              onClick={() => onProcessPayment(order)}
                              className="px-2.5 py-1 rounded-lg bg-[#003629] text-white hover:bg-emerald-950 font-bold text-[10px] shadow-2xs transition-colors cursor-pointer"
                              title="Proses bayar di kasir"
                            >
                              Bayar Kasir
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (onPrintTicket) onPrintTicket(order);
                                else if (onViewDetail) onViewDetail(order);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-[10px] border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                              title="Cetak struk pembayaran"
                            >
                              Struk
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Load More Pagination */}
        {liveTransactions.length > liveVisibleCount && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => setLiveVisibleCount((prev) => prev + 10)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200/80 transition-all cursor-pointer shadow-2xs"
            >
              Tampilkan Lebih Banyak ({liveTransactions.length - liveVisibleCount} pesanan tersisa)
            </button>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 5. TOP 10 MENU BEST SELLER & SALURAN PEMESANAN             */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* TOP 10 MENU JUARA (8 cols) */}
        <div className="lg:col-span-8 p-5 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-xl">military_tech</span>
                <h2 className="text-base sm:text-lg text-slate-900 font-black tracking-tight">
                  Top 10 Menu Favorit Terlaris (Best Seller)
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Daftar menu dengan frekuensi pesanan dan perolehan omset tertinggi secara riil
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-900 text-xs font-black border border-amber-200">
              Juara Menu
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider bg-slate-50/70">
                  <th className="py-2.5 px-3 w-12 text-center">Rank</th>
                  <th className="py-2.5 px-3">Nama Menu &amp; Kategori</th>
                  <th className="py-2.5 px-3 text-center">Porsi Terjual</th>
                  <th className="py-2.5 px-3">Kontribusi Penjualan</th>
                  <th className="py-2.5 px-3 text-right">Total Pendapatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {top10MenuItems.map((item) => {
                  return (
                    <tr key={item.name} className="hover:bg-slate-50/70 transition-colors">
                      {/* Rank Medal */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                            item.rank === 1
                              ? "bg-amber-500 text-white shadow-2xs"
                              : item.rank === 2
                              ? "bg-slate-400 text-white shadow-2xs"
                              : item.rank === 3
                              ? "bg-amber-800 text-white shadow-2xs"
                              : "bg-slate-100 text-slate-600 font-bold"
                          }`}
                        >
                          {item.rank}
                        </span>
                      </td>

                      {/* Name & Category */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {item.category}
                          </span>
                        </div>
                      </td>

                      {/* Quantity Sold */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="font-black text-[#003629] font-mono text-sm">
                          {item.qty.toLocaleString("id-ID")}
                        </span>
                        <span className="text-[11px] text-slate-400 ml-1">porsi</span>
                      </td>

                      {/* Percentage Bar */}
                      <td className="py-2.5 px-3 min-w-[140px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/50">
                            <div
                              className={`h-full rounded-full ${
                                item.rank <= 3 ? "bg-[#003629]" : "bg-[#904d00]"
                              }`}
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-slate-600 w-8 text-right">
                            {item.percentage}%
                          </span>
                        </div>
                      </td>

                      {/* Total Revenue */}
                      <td className="py-2.5 px-3 text-right">
                        <span className="font-black text-slate-900 font-mono">
                          {formatCurrency(item.revenue)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* SALURAN PEMESANAN & STATUS DAPUR (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Saluran Pemesanan Card */}
          <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col gap-3.5">
            <div className="border-b border-slate-100 pb-2.5">
              <h3 className="text-base text-slate-900 font-black tracking-tight">
                Saluran Pemesanan
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Porsi pesanan berdasarkan channel penjualan
              </p>
            </div>

            <div className="space-y-3">
              {/* Dine-in */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                  <div className="flex items-center gap-2 text-[#003629]">
                    <span className="material-symbols-outlined text-base">restaurant</span>
                    <span>Makan di Tempat (Dine-in)</span>
                  </div>
                  <span className="font-black">
                    {summaryMetrics.totalOrdersCount > 0
                      ? Math.round((summaryMetrics.dineInOrdersCount / summaryMetrics.totalOrdersCount) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className="w-full bg-slate-200/70 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-[#003629] rounded-full"
                    style={{
                      width: `${
                        summaryMetrics.totalOrdersCount > 0
                          ? (summaryMetrics.dineInOrdersCount / summaryMetrics.totalOrdersCount) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 font-semibold">
                  {summaryMetrics.dineInOrdersCount} transaksi terlaksana
                </span>
              </div>

              {/* Take Away */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                  <div className="flex items-center gap-2 text-[#904d00]">
                    <span className="material-symbols-outlined text-base">shopping_bag</span>
                    <span>Take Away</span>
                  </div>
                  <span className="font-black">
                    {summaryMetrics.totalOrdersCount > 0
                      ? Math.round((summaryMetrics.takeawayOrdersCount / summaryMetrics.totalOrdersCount) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className="w-full bg-slate-200/70 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-[#904d00] rounded-full"
                    style={{
                      width: `${
                        summaryMetrics.totalOrdersCount > 0
                          ? (summaryMetrics.takeawayOrdersCount / summaryMetrics.totalOrdersCount) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 font-semibold">
                  {summaryMetrics.takeawayOrdersCount} pesanan take away
                </span>
              </div>

              {/* Delivery */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                  <div className="flex items-center gap-2 text-sky-700">
                    <span className="material-symbols-outlined text-base">moped</span>
                    <span>Delivery (GoFood / Grab / Shopee)</span>
                  </div>
                  <span className="font-black">
                    {summaryMetrics.totalOrdersCount > 0
                      ? Math.round((summaryMetrics.ojolOrdersCount / summaryMetrics.totalOrdersCount) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className="w-full bg-slate-200/70 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-sky-600 rounded-full"
                    style={{
                      width: `${
                        summaryMetrics.totalOrdersCount > 0
                          ? (summaryMetrics.ojolOrdersCount / summaryMetrics.totalOrdersCount) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 font-semibold">
                  {summaryMetrics.ojolOrdersCount} pesanan delivery
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
