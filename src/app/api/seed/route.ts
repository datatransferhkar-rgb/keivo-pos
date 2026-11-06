import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // 1. Restaurant Settings
    await db.restaurantSetting.upsert({
      where: { id: "default" },
      update: {},
      create: {
        id: "default",
        restaurantName: "Pawon Nusantara",
        branchName: "Cabang Senopati",
        posTerminal: "POS REG-01",
        logoUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuBZ38yzMys7rDMMvVwNdnO6Qn2uICUNbqSa-5UoGm10fLVYf6WDkRMOCPeRdtoxJkv8OUADMdxDXPsQzjLKJTHKblLIZvPbTlXyJC3xkOCsKw_cNbNO52ydpmNiSpokMBP8HbWAok_cF18e76XVNvX2CMcM1ZOJ5jFrBg7FzXMvJVJrdNurVe1rUQovs3FiEhVmPwbcngnw5cj9prjV2eg9F67BhB-Yd0e9AGcUPrn8t-DkCnmjVVTI",
        address: "Jl. Senopati No. 45, Kebayoran Baru, Jakarta Selatan",
        phone: "0812-3456-7890",
        receiptFooter:
          "Terima kasih atas kunjungan Anda di Pawon Nusantara! Silakan datang kembali.",
        staticQrLabel: "QRIS Pawon Nusantara (BCA)",
        bankTransferInstructions: "BCA 8830-1234-56 a/n Pawon Nusantara Resto",
        currency: "IDR",
        timezone: "Asia/Jakarta",
      },
    });

    // 2. Dining Tables (Meja 01 s/d Meja 20)
    const initialTablesSeed = [
      { tableNumber: "Meja 01", displayName: "Meja 01", qrToken: "tbl-token-01-xyz", area: "indoor", areaLabel: "Area Indoor AC", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
      { tableNumber: "Meja 02", displayName: "Meja 02", qrToken: "tbl-token-02-xyz", area: "indoor", areaLabel: "Area Indoor AC", capacity: 2, status: "tersedia", statusLabel: "Tersedia" },
      { tableNumber: "Meja 03", displayName: "Meja 03", qrToken: "tbl-token-03-xyz", area: "indoor", areaLabel: "Area Indoor AC", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
      { tableNumber: "Meja 04", displayName: "Meja 04", qrToken: "tbl-token-04-xyz", area: "indoor", areaLabel: "Area Indoor AC", capacity: 2, status: "tersedia", statusLabel: "Tersedia" },
      { tableNumber: "Meja 05", displayName: "Meja 05", qrToken: "tbl-token-05-xyz", area: "indoor", areaLabel: "Booth Sofa Utama", capacity: 6, status: "tersedia", statusLabel: "Tersedia" },
      { tableNumber: "Meja 06", displayName: "Meja 06", qrToken: "tbl-token-06-xyz", area: "indoor", areaLabel: "Area Indoor AC", capacity: 3, status: "tersedia", statusLabel: "Tersedia" },
      { tableNumber: "Meja 07", displayName: "Meja 07", qrToken: "tbl-token-07-xyz", area: "indoor", areaLabel: "Area Indoor AC", capacity: 5, status: "tersedia", statusLabel: "Tersedia" },
      { tableNumber: "Meja 08", displayName: "Meja 08", qrToken: "tbl-token-08-xyz", area: "indoor", areaLabel: "Area Indoor AC", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
      { tableNumber: "Meja 09", displayName: "Meja 09", qrToken: "tbl-token-09-xyz", area: "indoor", areaLabel: "Area Indoor AC", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
      { tableNumber: "Meja 10", displayName: "Meja 10", qrToken: "tbl-token-10-xyz", area: "outdoor", areaLabel: "Outdoor Garden", capacity: 2, status: "tersedia", statusLabel: "Tersedia" },
      { tableNumber: "Meja 11", displayName: "Meja 11", qrToken: "tbl-token-11-xyz", area: "outdoor", areaLabel: "Outdoor Smoking Garden", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
      { tableNumber: "Meja 12", displayName: "Meja 12", qrToken: "tbl-token-12-xyz", area: "indoor", areaLabel: "Indoor VIP Lounge", capacity: 6, status: "tersedia", statusLabel: "Tersedia" },
      { tableNumber: "Meja 13", displayName: "Meja 13", qrToken: "tbl-token-13-xyz", area: "outdoor", areaLabel: "Outdoor Smoking Garden", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
      { tableNumber: "Meja 14", displayName: "Meja 14", qrToken: "tbl-token-14-xyz", area: "outdoor", areaLabel: "Outdoor Garden", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
      { tableNumber: "Meja 15", displayName: "Meja 15", qrToken: "tbl-token-15-xyz", area: "outdoor", areaLabel: "Outdoor Garden", capacity: 2, status: "tersedia", statusLabel: "Tersedia" },
      { tableNumber: "Meja 16", displayName: "Meja 16", qrToken: "tbl-token-16-xyz", area: "outdoor", areaLabel: "Outdoor Gazebo", capacity: 6, status: "tersedia", statusLabel: "Tersedia" },
      { tableNumber: "Meja 17", displayName: "Meja 17", qrToken: "tbl-token-17-xyz", area: "indoor", areaLabel: "Area Indoor AC", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
      { tableNumber: "Meja 18", displayName: "Meja 18", qrToken: "tbl-token-18-xyz", area: "indoor", areaLabel: "Area Indoor AC", capacity: 2, status: "tersedia", statusLabel: "Tersedia" },
      { tableNumber: "Meja 19", displayName: "Meja 19", qrToken: "tbl-token-19-xyz", area: "outdoor", areaLabel: "Outdoor Garden", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
      { tableNumber: "Meja 20", displayName: "Meja 20", qrToken: "tbl-token-20-xyz", area: "outdoor", areaLabel: "Outdoor VIP Gazebo", capacity: 6, status: "tersedia", statusLabel: "Tersedia" },
    ];

    for (const t of initialTablesSeed) {
      await db.diningTable.upsert({
        where: { tableNumber: t.tableNumber },
        update: {},
        create: {
          tableNumber: t.tableNumber,
          displayName: t.displayName,
          qrToken: t.qrToken,
          area: t.area,
          areaLabel: t.areaLabel,
          capacity: t.capacity,
          status: t.status,
          statusLabel: t.statusLabel,
          isActive: true,
        },
      });
    }

    // 3. Categories & Menu Items
    const catUtama = await db.category.upsert({
      where: { id: "cat-utama" },
      update: {},
      create: { id: "cat-utama", name: "Makanan Utama", sortOrder: 1 },
    });

    const catAyamIkan = await db.category.upsert({
      where: { id: "cat-ayam-ikan" },
      update: {},
      create: { id: "cat-ayam-ikan", name: "Hidangan Ayam & Ikan", sortOrder: 2 },
    });

    const catSayur = await db.category.upsert({
      where: { id: "cat-sayur" },
      update: {},
      create: { id: "cat-sayur", name: "Sayuran & Pelengkap", sortOrder: 3 },
    });

    const catMinuman = await db.category.upsert({
      where: { id: "cat-minuman" },
      update: {},
      create: { id: "cat-minuman", name: "Minuman Segar", sortOrder: 4 },
    });

    const menuItemsData = [
      {
        id: "m-liwet",
        categoryId: catUtama.id,
        name: "Nasi Liwet Komplit",
        description: "Nasi liwet gurih wangi dengan ayam suwir, telur pindang, labu siam, dan areh santan.",
        price: 42000,
        imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDoq1vjwcvPAE9zl63bcszNXrgv8xm2nfrkskz41ckSo6sMFocF0mGTPfxZpuMbQB0gh_b3JJHsfw7BlQyCwuCea4vKzAGtXwL7p96H9t-6oiDQocHXSYdQIUtTE_pwr2gL8XHSA5Wpb6wuCX4AtB3PuJImRP3QeLAN8-czs8brfijM3pEm7nKZgq3ramXVIZ223vmO2TQc4TNT1tQi66eCHgK0xxGP5UyKV9EykFt6mBP1X3FADodV",
      },
      {
        id: "m-gurame",
        categoryId: catAyamIkan.id,
        name: "Gurame Bakar Cobek (800g)",
        description: "Ikan gurame segar dibakar bumbu rempah khas Sunda, disajikan di atas cobek batu panas.",
        price: 85000,
        imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDDVc7CdAQ8LigiRCcEMkQoU_QsK7nR8-IHljRGIIUI7AlQuyoVdgW4AOTPdFP2_lcOMU77nsZbL6qKffpfw9KnjIdSfufuSvJ91Obfbj8ETILKUcazt_UAbKcAE-KT1S86NTwCMEIiZauxG4bkhe7vwQLuK6bMEeRbxJVj6K2RQTn8jnqUXDDaGvzCHQmcSFMHRu14HQPpSq8KrxUyMYKRcDzQFewyO_ip3zGFsM3hZ7665D13YfIn",
      },
      {
        id: "m-bebek",
        categoryId: catAyamIkan.id,
        name: "Bebek Goreng Kremes",
        description: "Bebek ungkep bumbu kuning digoreng renyah dengan taburan kremesan gurih dan sambal korek.",
        price: 48000,
        imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBpvbcTloGC8TDoT2Y0QCiz38i519oW9pBcOHmAyzqs_6BPMKkvJdwTkyEX364ThCAaqEmGKBBb93SoHDM8vuba2uQQi-4_Br-iMR4njZIhIt3pLQlW2uCrMQ8ctfcZWLUXXvS9YB6gxkNUXh_KH3WBI0IUnerDoJdo5wSYkE6b6YvAzfu7VtUW9kKcmUQHFx5nXHP-qVE9_M7nCLU6gQxrUT8pxSXCjLcWKAXVZyfoUSR1kBsR6ziC",
      },
      {
        id: "m-sate",
        categoryId: catAyamIkan.id,
        name: "Sate Ayam Madura (10 tsk)",
        description: "10 tusuk sate ayam empuk dibalur bumbu kacang lembut kental dan kecap manis.",
        price: 35000,
        imageUrl: "https://images.unsplash.com/photo-1555126634-323283e090fa?w=600&auto=format&fit=crop&q=80",
      },
      {
        id: "m-es-kelapa",
        categoryId: catMinuman.id,
        name: "Es Kelapa Muda Batok",
        description: "Air kelapa murni dengan serutan daging kelapa muda dan sirup gula aren terpisah.",
        price: 18000,
        imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuAmSQf5_JMFpYu48FrwCmZqCgGH9g5o4YdJ2DNHPucoNkLAIizR_nWYGuPwRu5L_W9NoDaojSz47rXX367UTLCNkppOdGpHmij5V5nkBM4wFpBObPIU2XZKfpxkcl3bIQpXXi2oavFyhPKl-ElwNfg4fpcQvMw4ZCWHUDlrHsDnGqjXqrnINcIRN0C00EoFfrwn-UapBZ6IGgnALol4YAZuqVhLR-XwGd3J2gpLaoGqrZ5HDbqO2GcD",
      },
      {
        id: "m-es-teh",
        categoryId: catMinuman.id,
        name: "Es Teh Manis",
        description: "Seduhan teh wangi melati segar dengan gula pasir asli.",
        price: 6000,
        imageUrl: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop&q=80",
      },
    ];

    for (const item of menuItemsData) {
      await db.menuItem.upsert({
        where: { id: item.id },
        update: {},
        create: {
          id: item.id,
          categoryId: item.categoryId,
          name: item.name,
          description: item.description,
          price: item.price,
          imageUrl: item.imageUrl,
          isAvailable: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Database seeded successfully! Tables and menus created.",
    });
  } catch (error: any) {
    console.error("Seed error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
