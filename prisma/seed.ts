import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Keivo POS database...");

  // 1. Restaurant Settings
  await prisma.restaurantSetting.upsert({
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

  // 2. Users
  const userAdmin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      name: "Bambang Wijaya",
      username: "admin",
      passwordHash: "admin123",
      role: "admin",
    },
  });

  const userCashier1 = await prisma.user.upsert({
    where: { username: "siti" },
    update: {},
    create: {
      name: "Siti Rahmawati",
      username: "siti",
      passwordHash: "1234",
      role: "cashier",
    },
  });

  const userCashier2 = await prisma.user.upsert({
    where: { username: "budi" },
    update: {},
    create: {
      name: "Budi Santoso",
      username: "budi",
      passwordHash: "1234",
      role: "cashier",
    },
  });

  const userKitchen = await prisma.user.upsert({
    where: { username: "kitchen" },
    update: {},
    create: {
      name: "Chef Jaka",
      username: "kitchen",
      passwordHash: "dapur123",
      role: "kitchen",
    },
  });

  // 3. Dining Tables (Meja 01 s/d Meja 20)
  const initialTablesSeed = [
    { tableNumber: "Meja 01", displayName: "Meja 01", qrToken: "tbl-token-01-xyz", area: "indoor", areaLabel: "Area Indoor AC", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
    { tableNumber: "Meja 02", displayName: "Meja 02", qrToken: "tbl-token-02-xyz", area: "indoor", areaLabel: "Area Indoor AC", capacity: 2, status: "tersedia", statusLabel: "Tersedia" },
    { tableNumber: "Meja 03", displayName: "Meja 03", qrToken: "tbl-token-03-xyz", area: "indoor", areaLabel: "Area Indoor AC", capacity: 4, status: "terisi", statusLabel: "Terisi", isProcessing: true, orderNumber: "#PN-1045", customerName: "4 Tamu", amount: 198000, timeElapsed: "15 mnt" },
    { tableNumber: "Meja 04", displayName: "Meja 04", qrToken: "tbl-token-04-xyz", area: "indoor", areaLabel: "Area Indoor AC", capacity: 2, status: "terisi", statusLabel: "Terisi", orderNumber: "#PN-1039", customerName: "2 Tamu", amount: 135000, timeElapsed: "42 mnt" },
    { tableNumber: "Meja 05", displayName: "Meja 05", qrToken: "tbl-token-05-xyz", area: "indoor", areaLabel: "Booth Sofa Utama", capacity: 6, status: "tersedia", statusLabel: "Tersedia" },
    { tableNumber: "Meja 06", displayName: "Meja 06", qrToken: "tbl-token-06-xyz", area: "indoor", areaLabel: "Area Indoor AC", capacity: 3, status: "terisi", statusLabel: "Terisi", orderNumber: "#PN-1040", customerName: "Kel. Santoso", amount: 172000, timeElapsed: "25 mnt" },
    { tableNumber: "Meja 07", displayName: "Meja 07", qrToken: "tbl-token-07-xyz", area: "indoor", areaLabel: "Area Indoor AC", capacity: 5, status: "tersedia", statusLabel: "Tersedia" }, // Standby / default tersedia di SQLite
    { tableNumber: "Meja 08", displayName: "Meja 08", qrToken: "tbl-token-08-xyz", area: "indoor", areaLabel: "Area Indoor AC", capacity: 4, status: "terisi", statusLabel: "Terisi", isProcessing: true, orderNumber: "#PN-1042", customerName: "Bpk. Hendra", amount: 261000, timeElapsed: "38 mnt" },
    { tableNumber: "Meja 09", displayName: "Meja 09", qrToken: "tbl-token-09-xyz", area: "indoor", areaLabel: "Area Indoor AC", capacity: 4, status: "terisi", statusLabel: "Terisi", orderNumber: "#PN-1036", customerName: "Kel. Bpk Ardi", amount: 310000, timeElapsed: "50 mnt" },
    { tableNumber: "Meja 10", displayName: "Meja 10", qrToken: "tbl-token-10-xyz", area: "outdoor", areaLabel: "Outdoor Garden", capacity: 2, status: "terisi", statusLabel: "Terisi", orderNumber: "#PN-1048", customerName: "Outdoor Santai", amount: 89000, timeElapsed: "18 mnt" },
    { tableNumber: "Meja 11", displayName: "Meja 11", qrToken: "tbl-token-11-xyz", area: "outdoor", areaLabel: "Outdoor Smoking Garden", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
    { tableNumber: "Meja 12", displayName: "Meja 12", qrToken: "tbl-token-12-xyz", area: "indoor", areaLabel: "Indoor VIP Lounge", capacity: 6, status: "terisi", statusLabel: "Terisi", orderNumber: "#PN-1031", customerName: "Ibu Ratna & Rekan", amount: 412000, timeElapsed: "1j 10m" },
    { tableNumber: "Meja 13", displayName: "Meja 13", qrToken: "tbl-token-13-xyz", area: "outdoor", areaLabel: "Outdoor Smoking Garden", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
    { tableNumber: "Meja 14", displayName: "Meja 14", qrToken: "tbl-token-14-xyz", area: "outdoor", areaLabel: "Outdoor Garden", capacity: 4, status: "terisi", statusLabel: "Terisi", isProcessing: true, orderNumber: "#PN-1049", customerName: "Bpk. Dodi", amount: 154000, timeElapsed: "12 mnt" },
    { tableNumber: "Meja 15", displayName: "Meja 15", qrToken: "tbl-token-15-xyz", area: "outdoor", areaLabel: "Outdoor Garden", capacity: 2, status: "tersedia", statusLabel: "Tersedia" },
    { tableNumber: "Meja 16", displayName: "Meja 16", qrToken: "tbl-token-16-xyz", area: "outdoor", areaLabel: "Outdoor Gazebo", capacity: 6, status: "terisi", statusLabel: "Terisi", orderNumber: "#PN-1047", customerName: "Gazebo 6 Tamu", amount: 275000, timeElapsed: "30 mnt" },
    { tableNumber: "Meja 17", displayName: "Meja 17", qrToken: "tbl-token-17-xyz", area: "indoor", areaLabel: "Area Indoor AC", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
    { tableNumber: "Meja 18", displayName: "Meja 18", qrToken: "tbl-token-18-xyz", area: "indoor", areaLabel: "Area Indoor AC", capacity: 2, status: "tersedia", statusLabel: "Tersedia" },
    { tableNumber: "Meja 19", displayName: "Meja 19", qrToken: "tbl-token-19-xyz", area: "outdoor", areaLabel: "Outdoor Garden", capacity: 4, status: "tersedia", statusLabel: "Tersedia" },
    { tableNumber: "Meja 20", displayName: "Meja 20", qrToken: "tbl-token-20-xyz", area: "outdoor", areaLabel: "Outdoor VIP Gazebo", capacity: 6, status: "tersedia", statusLabel: "Tersedia" },
  ];

  for (const t of initialTablesSeed) {
    await prisma.diningTable.upsert({
      where: { tableNumber: t.tableNumber },
      update: {
        area: t.area,
        areaLabel: t.areaLabel,
        capacity: t.capacity,
        status: t.status,
        statusLabel: t.statusLabel,
        isProcessing: (t as any).isProcessing || false,
        orderNumber: (t as any).orderNumber || null,
        customerName: (t as any).customerName || null,
        amount: (t as any).amount || null,
        timeElapsed: (t as any).timeElapsed || null,
      },
      create: {
        tableNumber: t.tableNumber,
        displayName: t.displayName,
        qrToken: t.qrToken,
        area: t.area,
        areaLabel: t.areaLabel,
        capacity: t.capacity,
        status: t.status,
        statusLabel: t.statusLabel,
        isProcessing: (t as any).isProcessing || false,
        orderNumber: (t as any).orderNumber || null,
        customerName: (t as any).customerName || null,
        amount: (t as any).amount || null,
        timeElapsed: (t as any).timeElapsed || null,
        isActive: true,
      },
    });
  }

  // 4. Online Platforms
  const gf = await prisma.onlinePlatform.upsert({
    where: { name: "GoFood" },
    update: {},
    create: { name: "GoFood" },
  });
  const grf = await prisma.onlinePlatform.upsert({
    where: { name: "GrabFood" },
    update: {},
    create: { name: "GrabFood" },
  });
  const sf = await prisma.onlinePlatform.upsert({
    where: { name: "ShopeeFood" },
    update: {},
    create: { name: "ShopeeFood" },
  });

  // 5. Categories & Menu Items
  const catUtama = await prisma.category.upsert({
    where: { id: "cat-utama" },
    update: {},
    create: {
      id: "cat-utama",
      name: "Makanan Utama",
      sortOrder: 1,
    },
  });

  const catAyamIkan = await prisma.category.upsert({
    where: { id: "cat-ayam-ikan" },
    update: {},
    create: {
      id: "cat-ayam-ikan",
      name: "Hidangan Ayam & Ikan",
      sortOrder: 2,
    },
  });

  const catSayur = await prisma.category.upsert({
    where: { id: "cat-sayur" },
    update: {},
    create: {
      id: "cat-sayur",
      name: "Sayuran & Pelengkap",
      sortOrder: 3,
    },
  });

  const catMinuman = await prisma.category.upsert({
    where: { id: "cat-minuman" },
    update: {},
    create: {
      id: "cat-minuman",
      name: "Minuman Segar",
      sortOrder: 4,
    },
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
      id: "m-geprek",
      categoryId: catAyamIkan.id,
      name: "Ayam Geprek Sambal Bawang",
      description: "Ayam crispy digeprek dengan cabai rawit pedas segar dan bawang putih harum.",
      price: 28000,
      imageUrl: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&auto=format&fit=crop&q=80",
    },
    {
      id: "m-nasgor",
      categoryId: catUtama.id,
      name: "Nasi Goreng Kampung",
      description: "Nasi goreng bumbu terasi tradisional dengan suwiran ayam, telur mata sapi, dan kerupuk udang.",
      price: 32000,
      imageUrl: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&auto=format&fit=crop&q=80",
    },
    {
      id: "m-tahu-telur",
      categoryId: catSayur.id,
      name: "Tahu Telur Petis",
      description: "Tahu goreng telur renyah disiram saus petis udang gurih manis dan tauge segar.",
      price: 22000,
      imageUrl: "https://images.unsplash.com/photo-1546069901-d5bfd2cbfb1f?w=600&auto=format&fit=crop&q=80",
    },
    {
      id: "m-sup-buntut",
      categoryId: catUtama.id,
      name: "Sup Buntut Spesial",
      description: "Potongan buntut sapi empuk berkuah kaldu bening kaya rempah pala dan cengkeh.",
      price: 85000,
      imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuCwZZtiwH8Gt6Oak-1rRqM5H1gdN5jEruzAaxigbv3H-Tre5hdLPjTQvSl4MFAxU27g35TcYPLOVvTK3VAOgAL231GLkTacQbpt2nSuYXHlFNuEwr7wvpBXm9LYTOCHgjdtzCSv3nQiLYFfl9jCtPILQ1mNvxs4c1YxnnJzxjhw6yKA7ohTsygeEsOWi6sKsPVVt8WpCA93muF6xm4y6OOrMXHgpE58_JfV05yGWDaqp3Gw0nZdRydv",
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
      id: "m-miegor",
      categoryId: catUtama.id,
      name: "Mie Goreng Jawa",
      description: "Mie telur kenyal dimasak kuah nyemek bumbu kemiri dengan kekian dan sayuran kol.",
      price: 28000,
      imageUrl: "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=600&auto=format&fit=crop&q=80",
    },
    {
      id: "m-jimbaran",
      categoryId: catAyamIkan.id,
      name: "Ikan Bakar Jimbaran",
      description: "Fillet ikan laut bakar bumbu merah Jimbaran manis pedas gurih.",
      price: 80000,
      imageUrl: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&auto=format&fit=crop&q=80",
    },
    {
      id: "m-kangkung",
      categoryId: catSayur.id,
      name: "Cah Kangkung Belacan",
      description: "Kangkung muda ditumis api besar dengan bumbu terasi udang dan irisan cabai merah.",
      price: 22000,
      imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDryV8NsgdrBwoWd4bo_kCntYJjsNCGCdVPhn0N0b7SJUV2HPO_P6KwjUIBhkOekn-ddAuxl6_B5p6667dLKElHi0dNpEifNKyE2TsDCVQoOAHhIFQkn85ydGYquCuVqJZj_G8VvMd-k9Fvl46F_8EQ0ce8kXyoRqjNeIXzMya-_m5N-onV_4cbJqY9dSSNrR_Q3XMqrC2TCz-HiHksfGjKJdia3j0X63aLryzokgQ1kkLFRHwr0-ot",
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
      id: "m-cendol",
      categoryId: catMinuman.id,
      name: "Es Cendol Durian",
      description: "Cendol pandan suji berpadu santan gurih, gula kelapa lumer, dan daging durian legit.",
      price: 25000,
      imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80",
    },
    {
      id: "m-es-teh",
      categoryId: catMinuman.id,
      name: "Es Teh Manis",
      description: "Seduhan teh wangi melati segar dengan gula pasir asli.",
      price: 6000,
      imageUrl: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop&q=80",
    },
    {
      id: "m-es-jeruk",
      categoryId: catMinuman.id,
      name: "Es Jeruk Murni",
      description: "Perasan jeruk manis asli segar dingin pelepas dahaga.",
      price: 12000,
      imageUrl: "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600&auto=format&fit=crop&q=80",
    },
    {
      id: "m-nasi-putih",
      categoryId: catUtama.id,
      name: "Nasi Putih Pandan Wangi",
      description: "Nasi putih pulen hangat harum pandan alami.",
      price: 8000,
      imageUrl: "https://images.unsplash.com/photo-1516684732162-798a0062be99?w=600&auto=format&fit=crop&q=80",
    },
  ];

  for (const item of menuItemsData) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
        categoryId: item.categoryId,
        isAvailable: item.id !== "m-sup-buntut", // m-sup-buntut as sample Habis/stok habis
      },
      create: {
        id: item.id,
        categoryId: item.categoryId,
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
        isAvailable: item.id !== "m-sup-buntut",
      },
    });
  }

  // 6. Active Cashier Session (Shift Pagi #042)
  const shift = await prisma.cashierSession.upsert({
    where: { sessionNumber: "Shift Pagi #042" },
    update: {},
    create: {
      sessionNumber: "Shift Pagi #042",
      cashierId: userCashier1.id,
      cashierName: "Siti Rahmawati",
      openingCashAmount: 500000,
      status: "open",
    },
  });

  // Cash movement: Kas keluar
  await prisma.cashMovement.create({
    data: {
      cashierSessionId: shift.id,
      movementType: "cash_out",
      amount: 45000,
      reason: "Kas Keluar (Es Batu & Parkir)",
      createdBy: "Siti Rahmawati",
    },
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
