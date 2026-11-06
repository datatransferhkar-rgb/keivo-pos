import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const DEFAULT_PRODUCT_PROMOS = [
  {
    name: "Spesial Menu Favorit Resto",
    description: "Harga spesial untuk Nasi Liwet Komplit & Mie Goreng Jawa",
    discountType: "percentage",
    discountValue: 20, // 20% off
    targetType: "specific_products",
    targetCategory: null,
    targetProductIds: JSON.stringify(["PRD-001", "PRD-002", "prod-1", "prod-2"]),
    badgeLabel: "PROMO 20%",
    isActive: true,
  },
  {
    name: "Diskon Kategori Minuman Segar",
    description: "Potongan Rp5.000 untuk semua pilihan minuman segar",
    discountType: "fixed",
    discountValue: 5000, // Rp5.000 off
    targetType: "category",
    targetCategory: "Minuman Segar",
    targetProductIds: null,
    badgeLabel: "HEMAT Rp5.000",
    isActive: true,
  },
];

// GET /api/product-promos
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("active") === "true";

    const where: any = {};
    if (activeOnly) where.isActive = true;

    let promos = await db.productPromo.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });

    // Seed defaults if empty
    if (promos.length === 0) {
      for (const item of DEFAULT_PRODUCT_PROMOS) {
        await db.productPromo.create({
          data: item,
        });
      }
      promos = await db.productPromo.findMany({
        where,
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      });
    }

    const formatted = promos.map((p) => ({
      ...p,
      targetProductIds: p.targetProductIds ? JSON.parse(p.targetProductIds) : [],
    }));

    return NextResponse.json(formatted);
  } catch (err: any) {
    console.error("GET /api/product-promos error:", err);
    return NextResponse.json(
      { error: "Gagal memuat daftar promo produk", details: err?.message },
      { status: 500 }
    );
  }
}

// POST /api/product-promos
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      description,
      discountType,
      discountValue,
      targetType,
      targetCategory,
      targetProductIds,
      startDate,
      endDate,
      timeStart,
      timeEnd,
      badgeLabel,
      isActive,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Nama promo wajib diisi" }, { status: 400 });
    }

    if (!discountValue || Number(discountValue) <= 0) {
      return NextResponse.json({ error: "Nilai diskon harus lebih besar dari 0" }, { status: 400 });
    }

    const newPromo = await db.productPromo.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        discountType: discountType || "percentage",
        discountValue: Number(discountValue),
        targetType: targetType || "specific_products",
        targetCategory: targetCategory || null,
        targetProductIds: Array.isArray(targetProductIds) ? JSON.stringify(targetProductIds) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        timeStart: timeStart || null,
        timeEnd: timeEnd || null,
        badgeLabel: badgeLabel?.trim() || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    return NextResponse.json({
      ...newPromo,
      targetProductIds: newPromo.targetProductIds ? JSON.parse(newPromo.targetProductIds) : [],
    });
  } catch (err: any) {
    console.error("POST /api/product-promos error:", err);
    return NextResponse.json(
      { error: "Gagal membuat promo produk", details: err?.message },
      { status: 500 }
    );
  }
}

// PUT /api/product-promos
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      name,
      description,
      discountType,
      discountValue,
      targetType,
      targetCategory,
      targetProductIds,
      startDate,
      endDate,
      timeStart,
      timeEnd,
      badgeLabel,
      isActive,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "ID promo wajib diisi" }, { status: 400 });
    }

    const dataToUpdate: any = {};
    if (name !== undefined) dataToUpdate.name = name.trim();
    if (description !== undefined) dataToUpdate.description = description?.trim() || null;
    if (discountType !== undefined) dataToUpdate.discountType = discountType;
    if (discountValue !== undefined) dataToUpdate.discountValue = Number(discountValue);
    if (targetType !== undefined) dataToUpdate.targetType = targetType;
    if (targetCategory !== undefined) dataToUpdate.targetCategory = targetCategory || null;
    if (targetProductIds !== undefined) {
      dataToUpdate.targetProductIds = Array.isArray(targetProductIds)
        ? JSON.stringify(targetProductIds)
        : null;
    }
    if (startDate !== undefined) dataToUpdate.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) dataToUpdate.endDate = endDate ? new Date(endDate) : null;
    if (timeStart !== undefined) dataToUpdate.timeStart = timeStart || null;
    if (timeEnd !== undefined) dataToUpdate.timeEnd = timeEnd || null;
    if (badgeLabel !== undefined) dataToUpdate.badgeLabel = badgeLabel?.trim() || null;
    if (isActive !== undefined) dataToUpdate.isActive = Boolean(isActive);

    const updated = await db.productPromo.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({
      ...updated,
      targetProductIds: updated.targetProductIds ? JSON.parse(updated.targetProductIds) : [],
    });
  } catch (err: any) {
    console.error("PUT /api/product-promos error:", err);
    return NextResponse.json(
      { error: "Gagal memperbarui promo produk", details: err?.message },
      { status: 500 }
    );
  }
}

// DELETE /api/product-promos
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID promo diperlukan" }, { status: 400 });
    }

    await db.productPromo.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Promo produk berhasil dihapus" });
  } catch (err: any) {
    console.error("DELETE /api/product-promos error:", err);
    return NextResponse.json(
      { error: "Gagal menghapus promo produk", details: err?.message },
      { status: 500 }
    );
  }
}

