import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get("all") === "true";

    const categories = await db.category.findMany({
      include: {
        menuItems: {
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    // Format for client
    const formatted = categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      items: c.menuItems.map((m) => ({
        id: m.id,
        name: m.name,
        price: m.price,
        description: m.description,
        imageUrl: m.imageUrl,
        isAvailable: m.isAvailable,
        category: c.name,
        addons: m.addons ? (typeof m.addons === "string" ? JSON.parse(m.addons) : m.addons) : [],
      })),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Error fetching menu:", error);
    return NextResponse.json({ error: "Failed to fetch menu items" }, { status: 500 });
  }
}
