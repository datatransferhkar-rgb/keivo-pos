import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const DEFAULT_CATEGORIES = [
  { name: "Makanan Utama", sortOrder: 1 },
  { name: "Hidangan Ayam & Ikan", sortOrder: 2 },
  { name: "Sayuran & Pelengkap", sortOrder: 3 },
  { name: "Minuman Segar", sortOrder: 4 },
  { name: "Seafood", sortOrder: 5 },
  { name: "Sup & Sayur", sortOrder: 6 },
  { name: "Camilan", sortOrder: 7 },
  { name: "Paket Hemat", sortOrder: 8 },
];

// GET /api/categories - List all categories with product count
export async function GET() {
  try {
    let categories = await db.category.findMany({
      include: {
        _count: {
          select: { menuItems: true },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    // Ensure all standard system categories exist in the database
    const existingNames = new Set(categories.map((c) => c.name.toLowerCase()));
    let hasInserted = false;
    for (const cat of DEFAULT_CATEGORIES) {
      if (!existingNames.has(cat.name.toLowerCase())) {
        await db.category.create({
          data: {
            name: cat.name,
            sortOrder: cat.sortOrder,
            isActive: true,
          },
        });
        hasInserted = true;
      }
    }

    if (hasInserted) {
      categories = await db.category.findMany({
        include: {
          _count: {
            select: { menuItems: true },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    }

    const formatted = categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      productCount: c._count?.menuItems || 0,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error("GET /api/categories error:", error);
    return NextResponse.json(
      { error: "Gagal memuat kategori produk", details: error?.message },
      { status: 500 }
    );
  }
}

// POST /api/categories - Create new product category
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, sortOrder } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Nama kategori wajib diisi!" },
        { status: 400 }
      );
    }

    const cleanName = name.trim();

    // Check duplicate category name (case-insensitive)
    const existing = await db.category.findFirst({
      where: {
        name: {
          equals: cleanName,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Kategori "${cleanName}" sudah ada!` },
        { status: 400 }
      );
    }

    // Determine sort order
    let finalSortOrder = sortOrder;
    if (finalSortOrder === undefined || finalSortOrder === null) {
      const lastCat = await db.category.findFirst({
        orderBy: { sortOrder: "desc" },
      });
      finalSortOrder = (lastCat?.sortOrder ?? 0) + 1;
    }

    const created = await db.category.create({
      data: {
        name: cleanName,
        description: description?.trim() || null,
        sortOrder: Number(finalSortOrder) || 0,
        isActive: true,
      },
      include: {
        _count: {
          select: { menuItems: true },
        },
      },
    });

    return NextResponse.json(
      {
        id: created.id,
        name: created.name,
        description: created.description,
        sortOrder: created.sortOrder,
        isActive: created.isActive,
        productCount: created._count?.menuItems || 0,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/categories error:", error);
    return NextResponse.json(
      { error: "Gagal membuat kategori baru", details: error?.message },
      { status: 500 }
    );
  }
}

// PUT /api/categories - Update category
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, description, sortOrder, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID kategori wajib disertakan!" },
        { status: 400 }
      );
    }

    const existing = await db.category.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Kategori tidak ditemukan!" },
        { status: 404 }
      );
    }

    // If name is updated, check duplicate
    if (name && name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await db.category.findFirst({
        where: {
          id: { not: id },
          name: { equals: name.trim() },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: `Kategori dengan nama "${name.trim()}" sudah ada!` },
          { status: 400 }
        );
      }
    }

    const updated = await db.category.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
      include: {
        _count: {
          select: { menuItems: true },
        },
      },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      sortOrder: updated.sortOrder,
      isActive: updated.isActive,
      productCount: updated._count?.menuItems || 0,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error("PUT /api/categories error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui kategori", details: error?.message },
      { status: 500 }
    );
  }
}

// DELETE /api/categories - Delete category safely
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id");
    let fallbackId = searchParams.get("fallbackId");

    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = body.id;
      fallbackId = body.fallbackId;
    }

    if (!id) {
      return NextResponse.json(
        { error: "ID kategori wajib disertakan!" },
        { status: 400 }
      );
    }

    const categoryToDelete = await db.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { menuItems: true },
        },
      },
    });

    if (!categoryToDelete) {
      return NextResponse.json(
        { error: "Kategori tidak ditemukan!" },
        { status: 404 }
      );
    }

    const menuItemsCount = categoryToDelete._count?.menuItems || 0;

    // If there are menu items attached, safely reassign them to a fallback category
    if (menuItemsCount > 0) {
      let targetFallback = fallbackId
        ? await db.category.findUnique({ where: { id: fallbackId } })
        : null;

      if (!targetFallback) {
        // Find any other category
        targetFallback = await db.category.findFirst({
          where: { id: { not: id } },
          orderBy: { sortOrder: "asc" },
        });
      }

      if (!targetFallback) {
        // If this is literally the only category, create a default "Makanan Utama"
        targetFallback = await db.category.create({
          data: {
            name: "Makanan Utama",
            sortOrder: 1,
            isActive: true,
          },
        });
      }

      // Reassign products to the fallback category so no menu items are orphaned or deleted
      await db.menuItem.updateMany({
        where: { categoryId: id },
        data: { categoryId: targetFallback.id },
      });
    }

    // Now delete the category
    await db.category.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Kategori "${categoryToDelete.name}" berhasil dihapus.${
        menuItemsCount > 0 ? ` ${menuItemsCount} menu otomatis dialihkan ke kategori lain.` : ""
      }`,
      deletedId: id,
      reassignedCount: menuItemsCount,
    });
  } catch (error: any) {
    console.error("DELETE /api/categories error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus kategori", details: error?.message },
      { status: 500 }
    );
  }
}

