import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const DEFAULT_TIERS = [
  {
    code: "regular",
    name: "Regular",
    description: "Pelanggan umum atau member yang baru bergabung",
    badgeColor: "emerald",
    sortOrder: 1,
  },
  {
    code: "silver",
    name: "Silver Member",
    description: "Member loyal tingkat perak dengan reward poin standar",
    badgeColor: "slate",
    sortOrder: 2,
  },
  {
    code: "gold",
    name: "Gold Member",
    description: "Member setia prioritas tingkat emas dengan penawaran khusus",
    badgeColor: "amber",
    sortOrder: 3,
  },
  {
    code: "vip",
    name: "VIP Member",
    description: "Member kehormatan tertinggi restoran Pawon Nusantara",
    badgeColor: "purple",
    sortOrder: 4,
  },
];

function generateCode(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// GET /api/customer-tiers - List all member tiers with customer counts
export async function GET() {
  try {
    let tiers = await db.customerTierCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    // Seed default tiers if missing
    const existingCodes = new Set(tiers.map((t) => t.code.toLowerCase()));
    let hasInserted = false;
    for (const def of DEFAULT_TIERS) {
      if (!existingCodes.has(def.code.toLowerCase())) {
        await db.customerTierCategory.create({
          data: {
            code: def.code,
            name: def.name,
            description: def.description,
            badgeColor: def.badgeColor,
            sortOrder: def.sortOrder,
            isActive: true,
          },
        });
        hasInserted = true;
      }
    }

    if (hasInserted) {
      tiers = await db.customerTierCategory.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    }

    // Count customers per tier
    const customers = await db.customer.findMany({
      select: { tier: true },
    });

    const counts: Record<string, number> = {};
    customers.forEach((c) => {
      const t = (c.tier || "regular").toLowerCase();
      counts[t] = (counts[t] || 0) + 1;
    });

    const formatted = tiers.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      description: t.description,
      badgeColor: t.badgeColor || "emerald",
      sortOrder: t.sortOrder,
      isActive: t.isActive,
      customerCount: counts[t.code.toLowerCase()] || 0,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error("GET /api/customer-tiers error:", error);
    return NextResponse.json(
      { error: "Gagal memuat kategori member", details: error?.message },
      { status: 500 }
    );
  }
}

// POST /api/customer-tiers - Create new tier
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, code, badgeColor, sortOrder } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Nama kategori member wajib diisi!" }, { status: 400 });
    }

    const cleanName = name.trim();
    const cleanCode = (code && typeof code === "string" && code.trim())
      ? generateCode(code)
      : generateCode(cleanName);

    // Check duplicate code or name
    const existing = await db.customerTierCategory.findFirst({
      where: {
        OR: [
          { code: cleanCode },
          { name: { equals: cleanName } },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Kategori member dengan nama "${cleanName}" atau kode "${cleanCode}" sudah ada!` },
        { status: 400 }
      );
    }

    const count = await db.customerTierCategory.count();
    const newTier = await db.customerTierCategory.create({
      data: {
        code: cleanCode,
        name: cleanName,
        description: description?.trim() || null,
        badgeColor: badgeColor || "emerald",
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : count + 1,
        isActive: true,
      },
    });

    return NextResponse.json({
      id: newTier.id,
      code: newTier.code,
      name: newTier.name,
      description: newTier.description,
      badgeColor: newTier.badgeColor,
      sortOrder: newTier.sortOrder,
      isActive: newTier.isActive,
      customerCount: 0,
      createdAt: newTier.createdAt.toISOString(),
      updatedAt: newTier.updatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error("POST /api/customer-tiers error:", error);
    return NextResponse.json(
      { error: "Gagal membuat kategori member", details: error?.message },
      { status: 500 }
    );
  }
}

// PUT /api/customer-tiers - Update tier
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, description, badgeColor, sortOrder, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "ID kategori member wajib disertakan!" }, { status: 400 });
    }

    const existing = await db.customerTierCategory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Kategori member tidak ditemukan!" }, { status: 404 });
    }

    if (name && name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await db.customerTierCategory.findFirst({
        where: {
          id: { not: id },
          name: { equals: name.trim() },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: `Kategori member dengan nama "${name.trim()}" sudah ada!` },
          { status: 400 }
        );
      }
    }

    const updated = await db.customerTierCategory.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(badgeColor !== undefined && { badgeColor }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });

    const customerCount = await db.customer.count({
      where: { tier: updated.code },
    });

    return NextResponse.json({
      id: updated.id,
      code: updated.code,
      name: updated.name,
      description: updated.description,
      badgeColor: updated.badgeColor,
      sortOrder: updated.sortOrder,
      isActive: updated.isActive,
      customerCount,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error("PUT /api/customer-tiers error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui kategori member", details: error?.message },
      { status: 500 }
    );
  }
}

// DELETE /api/customer-tiers - Delete tier safely with customer reassignment
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id");
    let fallbackCode = searchParams.get("fallbackCode");

    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = body.id;
      fallbackCode = body.fallbackCode;
    }

    if (!id) {
      return NextResponse.json({ error: "ID kategori member wajib disertakan!" }, { status: 400 });
    }

    const totalTiers = await db.customerTierCategory.count();
    if (totalTiers <= 1) {
      return NextResponse.json(
        { error: "Minimal harus ada 1 kategori member di restoran!" },
        { status: 400 }
      );
    }

    const tierToDelete = await db.customerTierCategory.findUnique({ where: { id } });
    if (!tierToDelete) {
      return NextResponse.json({ error: "Kategori member tidak ditemukan!" }, { status: 404 });
    }

    // Check customers with this tier
    const customersInTier = await db.customer.findMany({
      where: { tier: tierToDelete.code },
    });

    if (customersInTier.length > 0) {
      // Find fallback tier
      let targetFallback = fallbackCode
        ? await db.customerTierCategory.findUnique({ where: { code: fallbackCode } })
        : null;

      if (!targetFallback) {
        targetFallback = await db.customerTierCategory.findFirst({
          where: { id: { not: id } },
          orderBy: { sortOrder: "asc" },
        });
      }

      if (targetFallback) {
        await db.customer.updateMany({
          where: { tier: tierToDelete.code },
          data: { tier: targetFallback.code },
        });
      }
    }

    await db.customerTierCategory.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: `Kategori member "${tierToDelete.name}" berhasil dihapus.${
        customersInTier.length > 0 ? ` ${customersInTier.length} pelanggan dialihkan ke kategori member lain secara aman.` : ""
      }`,
      deletedId: id,
      reassignedCount: customersInTier.length,
    });
  } catch (error: any) {
    console.error("DELETE /api/customer-tiers error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus kategori member", details: error?.message },
      { status: 500 }
    );
  }
}

