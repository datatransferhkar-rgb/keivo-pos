import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const DEFAULT_AREAS = [
  {
    code: "indoor",
    name: "Indoor AC",
    description: "Area ber-AC di dalam ruangan yang nyaman & sejuk",
    sortOrder: 1,
  },
  {
    code: "outdoor",
    name: "Outdoor Garden",
    description: "Area terbuka di taman dengan nuansa alam asri",
    sortOrder: 2,
  },
  {
    code: "vip",
    name: "Gazebo VIP",
    description: "Ruang gazebo privat untuk keluarga & tamu khusus",
    sortOrder: 3,
  },
  {
    code: "smoking",
    name: "Smoking Area",
    description: "Area khusus bebas merokok yang terpisah",
    sortOrder: 4,
  },
];

// Helper: auto-generate slug/code
function generateCode(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// GET /api/table-areas - List all table areas with table counts
export async function GET() {
  try {
    let areas = await db.tableArea.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    // Seed default areas if missing
    const existingCodes = new Set(areas.map((a) => a.code.toLowerCase()));
    let hasInserted = false;
    for (const def of DEFAULT_AREAS) {
      if (!existingCodes.has(def.code.toLowerCase())) {
        await db.tableArea.create({
          data: {
            code: def.code,
            name: def.name,
            description: def.description,
            sortOrder: def.sortOrder,
            isActive: true,
          },
        });
        hasInserted = true;
      }
    }

    if (hasInserted) {
      areas = await db.tableArea.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    }

    // Count tables per area
    const tables = await db.diningTable.findMany({
      select: { area: true },
    });

    const counts: Record<string, number> = {};
    tables.forEach((t) => {
      const a = (t.area || "indoor").toLowerCase();
      counts[a] = (counts[a] || 0) + 1;
    });

    const formatted = areas.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      description: a.description,
      sortOrder: a.sortOrder,
      isActive: a.isActive,
      tableCount: counts[a.code.toLowerCase()] || 0,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error("GET /api/table-areas error:", error);
    return NextResponse.json(
      { error: "Gagal memuat kategori area meja", details: error?.message },
      { status: 500 }
    );
  }
}

// POST /api/table-areas - Create new area
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, code, sortOrder } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Nama area/zona wajib diisi!" }, { status: 400 });
    }

    const cleanName = name.trim();
    const cleanCode = (code && typeof code === "string" && code.trim())
      ? generateCode(code)
      : generateCode(cleanName);

    // Check duplicate code or name
    const existing = await db.tableArea.findFirst({
      where: {
        OR: [
          { code: cleanCode },
          { name: { equals: cleanName } },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Area dengan nama "${cleanName}" atau kode "${cleanCode}" sudah ada!` },
        { status: 400 }
      );
    }

    const count = await db.tableArea.count();
    const newArea = await db.tableArea.create({
      data: {
        code: cleanCode,
        name: cleanName,
        description: description?.trim() || null,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : count + 1,
        isActive: true,
      },
    });

    return NextResponse.json({
      id: newArea.id,
      code: newArea.code,
      name: newArea.name,
      description: newArea.description,
      sortOrder: newArea.sortOrder,
      isActive: newArea.isActive,
      tableCount: 0,
      createdAt: newArea.createdAt.toISOString(),
      updatedAt: newArea.updatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error("POST /api/table-areas error:", error);
    return NextResponse.json(
      { error: "Gagal membuat kategori area", details: error?.message },
      { status: 500 }
    );
  }
}

// PUT /api/table-areas - Update area
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, description, sortOrder, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "ID area wajib disertakan!" }, { status: 400 });
    }

    const existing = await db.tableArea.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Kategori area tidak ditemukan!" }, { status: 404 });
    }

    if (name && name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await db.tableArea.findFirst({
        where: {
          id: { not: id },
          name: { equals: name.trim() },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: `Area dengan nama "${name.trim()}" sudah ada!` },
          { status: 400 }
        );
      }
    }

    const updated = await db.tableArea.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });

    const tableCount = await db.diningTable.count({
      where: { area: updated.code },
    });

    return NextResponse.json({
      id: updated.id,
      code: updated.code,
      name: updated.name,
      description: updated.description,
      sortOrder: updated.sortOrder,
      isActive: updated.isActive,
      tableCount,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error("PUT /api/table-areas error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui kategori area", details: error?.message },
      { status: 500 }
    );
  }
}

// DELETE /api/table-areas - Delete area safely with table reassignment
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
      return NextResponse.json({ error: "ID area wajib disertakan!" }, { status: 400 });
    }

    const totalAreas = await db.tableArea.count();
    if (totalAreas <= 1) {
      return NextResponse.json(
        { error: "Minimal harus ada 1 kategori area di restoran!" },
        { status: 400 }
      );
    }

    const areaToDelete = await db.tableArea.findUnique({ where: { id } });
    if (!areaToDelete) {
      return NextResponse.json({ error: "Kategori area tidak ditemukan!" }, { status: 404 });
    }

    // Check tables in this area
    const tablesInArea = await db.diningTable.findMany({
      where: { area: areaToDelete.code },
    });

    if (tablesInArea.length > 0) {
      // Find target fallback area
      let targetFallback = fallbackCode
        ? await db.tableArea.findUnique({ where: { code: fallbackCode } })
        : null;

      if (!targetFallback) {
        targetFallback = await db.tableArea.findFirst({
          where: { id: { not: id } },
          orderBy: { sortOrder: "asc" },
        });
      }

      if (targetFallback) {
        await db.diningTable.updateMany({
          where: { area: areaToDelete.code },
          data: {
            area: targetFallback.code,
            areaLabel: targetFallback.name,
          },
        });
      }
    }

    await db.tableArea.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: `Area "${areaToDelete.name}" berhasil dihapus.${
        tablesInArea.length > 0 ? ` ${tablesInArea.length} meja dialihkan ke area lain secara aman.` : ""
      }`,
      deletedId: id,
      reassignedCount: tablesInArea.length,
    });
  } catch (error: any) {
    console.error("DELETE /api/table-areas error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus kategori area", details: error?.message },
      { status: 500 }
    );
  }
}

