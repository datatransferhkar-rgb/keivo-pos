import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/menu-items - List all menu items/products from SQLite
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryFilter = searchParams.get("category");
    const search = searchParams.get("search");

    const rawItems = await db.menuItem.findMany({
      include: {
        category: true,
      },
      orderBy: [
        { category: { sortOrder: "asc" } },
        { sortOrder: "asc" },
        { name: "asc" },
      ],
    });

    const formatted = rawItems.map((m, idx) => {
      const code = m.id.startsWith("m-")
        ? `PRD-${m.id.replace("m-", "").toUpperCase().slice(0, 6)}`
        : `PRD-${(idx + 1).toString().padStart(3, "0")}`;

      return {
        id: m.id,
        code,
        name: m.name,
        category: m.category?.name || "Makanan Utama",
        categoryId: m.categoryId,
        price: m.price,
        description: m.description || "",
        isAvailable: m.isAvailable,
        imageUrl:
          m.imageUrl ||
          "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop&q=80",
        image: m.imageUrl,
        sortOrder: m.sortOrder,
        addons: m.addons ? (typeof m.addons === "string" ? JSON.parse(m.addons) : m.addons) : [],
      };
    });

    let filtered = formatted;
    if (categoryFilter && categoryFilter !== "all") {
      filtered = filtered.filter(
        (i) => i.category.toLowerCase() === categoryFilter.toLowerCase()
      );
    }
    if (search && search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.code.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q)
      );
    }

    return NextResponse.json(filtered);
  } catch (error: any) {
    console.error("Error fetching menu items:", error);
    return NextResponse.json(
      { error: "Failed to fetch menu items", details: error?.message },
      { status: 500 }
    );
  }
}

// POST /api/menu-items - Create new menu item or batch import
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Check if batch import
    if (Array.isArray(body.items)) {
      const createdItems = [];
      for (const item of body.items) {
        if (!item.name || !item.price) continue;

        // Find or create category
        const catName = item.category?.trim() || "Makanan Utama";
        let category = await db.category.findFirst({
          where: { name: catName },
        });
        if (!category) {
          category = await db.category.create({
            data: {
              name: catName,
              sortOrder: 10,
            },
          });
        }

        const id = item.id || `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const created = await db.menuItem.create({
          data: {
            id,
            name: item.name.trim(),
            categoryId: category.id,
            price: Number(item.price) || 0,
            description: item.description?.trim() || null,
            imageUrl: item.imageUrl || item.image || null,
            isAvailable: item.isAvailable !== false,
          },
          include: { category: true },
        });
        createdItems.push(created);
      }
      return NextResponse.json({ success: true, count: createdItems.length, items: createdItems });
    }

    // Single item creation
    const { name, category: catNameInput, price, description, isAvailable = true, imageUrl, image, addons } = body;
    if (!name?.trim()) {
      return NextResponse.json({ error: "Nama produk/menu wajib diisi!" }, { status: 400 });
    }

    const catName = catNameInput?.trim() || "Makanan Utama";
    let category = await db.category.findFirst({
      where: { name: catName },
    });
    if (!category) {
      category = await db.category.create({
        data: {
          name: catName,
          sortOrder: 10,
        },
      });
    }

    const addonsJson = addons
      ? typeof addons === "string"
        ? addons
        : JSON.stringify(addons)
      : null;

    const id = body.id || `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const created = await db.menuItem.create({
      data: {
        id,
        name: name.trim(),
        categoryId: category.id,
        price: Number(price) || 0,
        description: description?.trim() || null,
        imageUrl: imageUrl || image || null,
        isAvailable: Boolean(isAvailable),
        addons: addonsJson,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json(
      {
        id: created.id,
        code: `PRD-${created.id.replace("m-", "").toUpperCase().slice(0, 6)}`,
        name: created.name,
        category: created.category.name,
        categoryId: created.categoryId,
        price: created.price,
        description: created.description || "",
        isAvailable: created.isAvailable,
        imageUrl: created.imageUrl,
        addons: created.addons ? JSON.parse(created.addons) : [],
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating menu item:", error);
    return NextResponse.json(
      { error: "Failed to create menu item", details: error?.message },
      { status: 500 }
    );
  }
}

// PUT /api/menu-items - Update existing menu item
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, category: catNameInput, price, description, isAvailable, imageUrl, image, addons } = body;

    if (!id) {
      return NextResponse.json({ error: "ID produk wajib disertakan!" }, { status: 400 });
    }

    let categoryId: string | undefined;
    if (catNameInput) {
      const catName = catNameInput.trim();
      let category = await db.category.findFirst({
        where: { name: catName },
      });
      if (!category) {
        category = await db.category.create({
          data: {
            name: catName,
            sortOrder: 10,
          },
        });
      }
      categoryId = category.id;
    }

    const addonsJson = addons !== undefined
      ? (addons ? (typeof addons === "string" ? addons : JSON.stringify(addons)) : null)
      : undefined;

    const updated = await db.menuItem.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(categoryId && { categoryId }),
        ...(price !== undefined && { price: Number(price) }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(isAvailable !== undefined && { isAvailable: Boolean(isAvailable) }),
        ...(imageUrl !== undefined || image !== undefined ? { imageUrl: imageUrl || image || null } : {}),
        ...(addonsJson !== undefined && { addons: addonsJson }),
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json({
      id: updated.id,
      code: `PRD-${updated.id.replace("m-", "").toUpperCase().slice(0, 6)}`,
      name: updated.name,
      category: updated.category.name,
      categoryId: updated.categoryId,
      price: updated.price,
      description: updated.description || "",
      isAvailable: updated.isAvailable,
      imageUrl: updated.imageUrl,
      addons: updated.addons ? JSON.parse(updated.addons) : [],
    });
  } catch (error: any) {
    console.error("Error updating menu item:", error);
    return NextResponse.json(
      { error: "Failed to update menu item", details: error?.message },
      { status: 500 }
    );
  }
}

// PATCH /api/menu-items - Quick toggle product availability (Stok Habis / Tersedia)
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, isAvailable } = body;

    if (!id) {
      return NextResponse.json({ error: "ID produk wajib disertakan!" }, { status: 400 });
    }

    const updated = await db.menuItem.update({
      where: { id },
      data: {
        ...(isAvailable !== undefined && { isAvailable: Boolean(isAvailable) }),
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json({
      success: true,
      id: updated.id,
      code: `PRD-${updated.id.replace("m-", "").toUpperCase().slice(0, 6)}`,
      name: updated.name,
      category: updated.category?.name || "Makanan Utama",
      price: updated.price,
      isAvailable: updated.isAvailable,
      message: `Status menu ${updated.name} berhasil diubah menjadi ${updated.isAvailable ? "Tersedia" : "Stok Habis"}`,
    });
  } catch (error: any) {
    console.error("Error patching menu item:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui status ketersediaan menu", details: error?.message },
      { status: 500 }
    );
  }
}

// DELETE /api/menu-items - Delete menu item
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id");
    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json({ error: "ID produk wajib disertakan!" }, { status: 400 });
    }

    await db.menuItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: `Menu item ${id} deleted` });
  } catch (error: any) {
    console.error("Error deleting menu item:", error);
    return NextResponse.json(
      { error: "Failed to delete menu item", details: error?.message },
      { status: 500 }
    );
  }
}
