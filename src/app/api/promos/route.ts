import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const DEFAULT_PROMOS = [
  {
    code: "HEMAT10",
    name: "Diskon Member 10%",
    description: "Potongan 10% khusus pelanggan setia / member resto terdaftar",
    discountType: "percentage",
    discountValue: 10,
    minOrderAmount: 50000,
    maxDiscount: 25000,
    scope: "all",
    customerScope: "member",
    isActive: true,
    usageCount: 14,
  },
  {
    code: "VIPHEMAT20",
    name: "Voucher Eksklusif VIP 20%",
    description: "Apresiasi spesial diskon 20% khusus pelanggan VIP",
    discountType: "percentage",
    discountValue: 20,
    minOrderAmount: 100000,
    maxDiscount: 50000,
    scope: "all",
    customerScope: "vip",
    isActive: true,
    usageCount: 7,
  },
  {
    code: "GOLDHEMAT15",
    name: "Promo Spesial Gold & VIP 15%",
    description: "Diskon 15% khusus member tier Gold dan VIP",
    discountType: "percentage",
    discountValue: 15,
    minOrderAmount: 75000,
    maxDiscount: 35000,
    scope: "all",
    customerScope: "gold",
    isActive: true,
    usageCount: 11,
  },
  {
    code: "DISKON20K",
    name: "Potongan Belanja Rp20.000",
    description: "Potongan langsung Rp20.000 dengan minimal order Rp100.000",
    discountType: "fixed",
    discountValue: 20000,
    minOrderAmount: 100000,
    maxDiscount: null,
    scope: "all",
    customerScope: "all",
    isActive: true,
    usageCount: 8,
  },
  {
    code: "TAKEAWAY5",
    name: "Diskon Take Away 5%",
    description: "Potongan 5% khusus pemesanan bawa pulang (Bungkus)",
    discountType: "percentage",
    discountValue: 5,
    minOrderAmount: 40000,
    maxDiscount: 15000,
    scope: "takeaway",
    customerScope: "all",
    isActive: true,
    usageCount: 12,
  },
];

// GET /api/promos
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("active") === "true";
    const customerScope = searchParams.get("customerScope");

    const where: any = {};
    if (activeOnly) where.isActive = true;
    if (customerScope && customerScope !== "all") {
      where.customerScope = customerScope;
    }

    let rawPromos = await db.promoDiscount.findMany({
      where,
      include: {
        assignedCustomer: true,
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });

    // Seed defaults if empty
    if (rawPromos.length === 0) {
      for (const item of DEFAULT_PROMOS) {
        await db.promoDiscount.create({
          data: item,
        });
      }
      rawPromos = await db.promoDiscount.findMany({
        where,
        include: {
          assignedCustomer: true,
        },
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      });
    }

    const formatted = rawPromos.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      discountType: p.discountType,
      discountValue: p.discountValue,
      minOrderAmount: p.minOrderAmount,
      maxDiscount: p.maxDiscount,
      scope: p.scope,
      customerScope: p.customerScope || "all",
      assignedCustomerId: p.assignedCustomerId || null,
      assignedCustomerName: p.assignedCustomer?.name || null,
      isActive: p.isActive,
      usageCount: p.usageCount,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));

    return NextResponse.json(formatted);
  } catch (err: any) {
    console.error("GET /api/promos error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/promos - Create Promo
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
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
    } = body;

    if (!code || !name) {
      return NextResponse.json(
        { error: "Kode promo dan nama promo wajib diisi" },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toUpperCase();

    // Check duplicate code
    const existing = await db.promoDiscount.findUnique({
      where: { code: cleanCode },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Kode promo "${cleanCode}" sudah terdaftar!` },
        { status: 400 }
      );
    }

    const created = await db.promoDiscount.create({
      data: {
        code: cleanCode,
        name: name.trim(),
        description: description?.trim() || null,
        discountType: discountType === "fixed" ? "fixed" : "percentage",
        discountValue: Number(discountValue) || 0,
        minOrderAmount: Number(minOrderAmount) || 0,
        maxDiscount: maxDiscount ? Number(maxDiscount) : null,
        scope: scope || "all",
        customerScope: customerScope || "all",
        assignedCustomerId: assignedCustomerId || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
      include: {
        assignedCustomer: true,
      },
    });

    return NextResponse.json(
      {
        ...created,
        assignedCustomerName: created.assignedCustomer?.name || null,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("POST /api/promos error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/promos - Update Promo
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "ID Promo wajib diisi" }, { status: 400 });
    }

    if (data.code) {
      data.code = data.code.trim().toUpperCase();
      // Check duplicate code on other promo
      const duplicate = await db.promoDiscount.findFirst({
        where: {
          code: data.code,
          id: { not: id },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: `Kode promo "${data.code}" sudah digunakan oleh promo lain!` },
          { status: 400 }
        );
      }
    }

    if (data.discountValue !== undefined) data.discountValue = Number(data.discountValue);
    if (data.minOrderAmount !== undefined) data.minOrderAmount = Number(data.minOrderAmount);
    if (data.maxDiscount !== undefined) {
      data.maxDiscount = data.maxDiscount ? Number(data.maxDiscount) : null;
    }
    if (data.isActive !== undefined) data.isActive = Boolean(data.isActive);
    if (data.usageCount !== undefined) data.usageCount = Number(data.usageCount);
    if (data.customerScope !== undefined) data.customerScope = data.customerScope;
    if (data.assignedCustomerId !== undefined) data.assignedCustomerId = data.assignedCustomerId || null;

    const updated = await db.promoDiscount.update({
      where: { id },
      data,
      include: {
        assignedCustomer: true,
      },
    });

    return NextResponse.json({
      ...updated,
      assignedCustomerName: updated.assignedCustomer?.name || null,
    });
  } catch (err: any) {
    console.error("PUT /api/promos error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/promos - Delete Promo
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID Promo wajib disertakan" }, { status: 400 });
    }

    await db.promoDiscount.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("DELETE /api/promos error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

