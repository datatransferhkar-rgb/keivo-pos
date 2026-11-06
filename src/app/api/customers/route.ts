import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const DEFAULT_CUSTOMERS = [
  {
    name: "Bpk. Hendra Wijaya",
    phone: "0812-8899-7711",
    email: "hendra.wijaya@gmail.com",
    tier: "vip",
    points: 350,
    totalVisits: 18,
    totalSpent: 2450000,
    notes: "Meja favorit Meja 01 (Indoor), suka Gurame Bakar pedas manis, tanpa MSG",
    isActive: true,
  },
  {
    name: "Ibu Maya Anggraini",
    phone: "0813-2233-4455",
    email: "maya.anggraini@yahoo.com",
    tier: "gold",
    points: 210,
    totalVisits: 12,
    totalSpent: 1620000,
    notes: "Alergi kacang tanah, suka Es Kelapa Muda Batok sirup gula aren terpisah",
    isActive: true,
  },
  {
    name: "Bpk. Denny Pratama",
    phone: "0856-7788-9900",
    email: "denny.pratama@corp.id",
    tier: "silver",
    points: 95,
    totalVisits: 7,
    totalSpent: 890000,
    notes: "Sering pesan Take Away saat istirahat kantor",
    isActive: true,
  },
  {
    name: "dr. Joko Santoso",
    phone: "0811-9988-1234",
    email: "joko.santoso@medika.org",
    tier: "gold",
    points: 175,
    totalVisits: 9,
    totalSpent: 1350000,
    notes: "Langganan arisan keluarga besar, sambal selalu minta dipisah",
    isActive: true,
  },
  {
    name: "Ibu Rina Sasmita",
    phone: "0818-4455-6677",
    email: "rina.sasmita@gmail.com",
    tier: "regular",
    points: 30,
    totalVisits: 2,
    totalSpent: 275000,
    notes: "Preferensi area luar (Outdoor)",
    isActive: true,
  },
  {
    name: "Bpk. Aris Munandar",
    phone: "0821-3344-5566",
    email: "aris.m@gmail.com",
    tier: "regular",
    points: 15,
    totalVisits: 1,
    totalSpent: 145000,
    notes: "Suka masakan pedas",
    isActive: true,
  },
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase().trim();
    const tier = searchParams.get("tier");
    const activeOnly = searchParams.get("active") === "true";

    let count = await db.customer.count();
    if (count === 0) {
      for (const item of DEFAULT_CUSTOMERS) {
        await db.customer.create({
          data: item,
        });
      }
    }

    const where: any = {};
    if (activeOnly) {
      where.isActive = true;
    }
    if (tier && tier !== "all") {
      where.tier = tier;
    }

    const customers = await db.customer.findMany({
      where,
      orderBy: [
        { totalSpent: "desc" },
        { totalVisits: "desc" },
      ],
    });

    let filtered = customers;
    if (search) {
      filtered = customers.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.phone.toLowerCase().includes(search) ||
          (c.email && c.email.toLowerCase().includes(search)) ||
          (c.notes && c.notes.toLowerCase().includes(search))
      );
    }

    return NextResponse.json(filtered);
  } catch (error) {
    console.error("GET /api/customers error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data pelanggan" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, email, tier, notes, points, totalSpent, totalVisits, isActive } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Nama pelanggan wajib diisi" }, { status: 400 });
    }

    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: "Nomor telepon / WhatsApp wajib diisi" }, { status: 400 });
    }

    const cleanPhone = phone.trim();

    // Check duplicate phone
    const existing = await db.customer.findUnique({
      where: { phone: cleanPhone },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Nomor telepon ${cleanPhone} sudah terdaftar atas nama ${existing.name}` },
        { status: 409 }
      );
    }

    const newCustomer = await db.customer.create({
      data: {
        name: name.trim(),
        phone: cleanPhone,
        email: email?.trim() || null,
        tier: tier || "regular",
        notes: notes?.trim() || null,
        points: typeof points === "number" ? Math.max(0, points) : 0,
        totalVisits: typeof totalVisits === "number" ? Math.max(0, totalVisits) : 0,
        totalSpent: typeof totalSpent === "number" ? Math.max(0, totalSpent) : 0,
        isActive: isActive !== false,
      },
    });

    return NextResponse.json(newCustomer, { status: 201 });
  } catch (error) {
    console.error("POST /api/customers error:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan data pelanggan baru" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, phone, email, tier, notes, points, totalSpent, totalVisits, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "Customer ID diperlukan" }, { status: 400 });
    }

    const dataToUpdate: any = {};
    if (name !== undefined) dataToUpdate.name = name.trim();
    if (phone !== undefined) {
      const cleanPhone = phone.trim();
      // Check duplicate
      const duplicate = await db.customer.findFirst({
        where: { phone: cleanPhone, id: { not: id } },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: `Nomor telepon ${cleanPhone} sudah digunakan oleh pelanggan lain (${duplicate.name})` },
          { status: 409 }
        );
      }
      dataToUpdate.phone = cleanPhone;
    }
    if (email !== undefined) dataToUpdate.email = email ? email.trim() : null;
    if (tier !== undefined) dataToUpdate.tier = tier;
    if (notes !== undefined) dataToUpdate.notes = notes ? notes.trim() : null;
    if (points !== undefined) dataToUpdate.points = Math.max(0, points);
    if (totalSpent !== undefined) dataToUpdate.totalSpent = Math.max(0, totalSpent);
    if (totalVisits !== undefined) dataToUpdate.totalVisits = Math.max(0, totalVisits);
    if (isActive !== undefined) dataToUpdate.isActive = Boolean(isActive);

    const updated = await db.customer.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/customers error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui data pelanggan" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Customer ID diperlukan" }, { status: 400 });
    }

    await db.customer.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Pelanggan berhasil dihapus" });
  } catch (error) {
    console.error("DELETE /api/customers error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus data pelanggan" },
      { status: 500 }
    );
  }
}

