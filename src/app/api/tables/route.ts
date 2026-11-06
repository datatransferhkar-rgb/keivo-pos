import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// GET /api/tables - List all tables from SQLite database
export async function GET() {
  try {
    const rawTables = await db.diningTable.findMany({
      orderBy: { tableNumber: "asc" },
      include: {
        sessions: {
          where: { status: "active" },
          include: {
            orders: {
              where: {
                status: {
                  not: "completed",
                },
              },
              include: {
                items: true,
              },
            },
          },
        },
      },
    });

    const tables = rawTables.map((t) => {
      const activeSession = t.sessions?.[0];
      const activeOrder = activeSession?.orders?.[0];

      let foodStatus = t.foodStatus || "none";
      let foodStatusLabel = t.foodStatusLabel || null;
      let isProcessing = t.isProcessing;

      let tableStatus = (t.status as "tersedia" | "terisi" | "reservasi") || "tersedia";
      let tableStatusLabel = t.statusLabel || (t.status === "terisi" ? "Terisi" : t.status === "reservasi" ? "Reservasi" : "Tersedia");

      if (activeOrder && activeOrder.paymentStatus !== "paid") {
        tableStatus = "terisi";
        tableStatusLabel = "Terisi";
        if (activeOrder.status === "ready") {
          foodStatus = "ready";
          foodStatusLabel = "🔔 SIAP SAJI - Siap Diantar!";
          isProcessing = false;
        } else if (activeOrder.status === "in_progress") {
          foodStatus = "in_progress";
          foodStatusLabel = "Sedang Dimasak di Dapur";
          isProcessing = true;
        } else if (activeOrder.status === "new") {
          foodStatus = "in_progress";
          foodStatusLabel = "Pesanan Baru Masuk ke Dapur";
          isProcessing = true;
        } else if (activeOrder.status === "completed" || activeOrder.status === "served") {
          foodStatus = "served";
          foodStatusLabel = "Semua Makanan Sudah Disajikan";
          isProcessing = false;
        }
      } else if (activeSession && foodStatus === "ready") {
        tableStatus = "terisi";
        tableStatusLabel = "Terisi";
      }

      if (tableStatus === "tersedia") {
        foodStatus = "none";
        foodStatusLabel = null;
        isProcessing = false;
      }

      return {
        id: t.id,
        tableNumber: t.tableNumber,
        displayName: t.displayName,
        qrToken: t.qrToken,
        area: (t.area as "indoor" | "outdoor") || "indoor",
        areaLabel: t.areaLabel || (t.area === "outdoor" ? "Outdoor Garden" : "Area Indoor AC"),
        capacity: t.capacity || 4,
        status: tableStatus,
        statusLabel: tableStatusLabel,
        customerName: tableStatus !== "tersedia" ? (activeOrder?.customerName || t.customerName || activeSession?.customerName || undefined) : undefined,
        reservationTime: tableStatus === "reservasi" ? (t.reservationTime || undefined) : undefined,
        reservationNotes: tableStatus === "reservasi" ? (t.reservationNotes || undefined) : undefined,
        orderNumber: tableStatus === "terisi" ? (activeOrder?.orderNumber || t.orderNumber || undefined) : undefined,
        amount: tableStatus === "terisi" ? (activeOrder?.totalAmount || t.amount || undefined) : undefined,
        timeElapsed: tableStatus === "terisi" ? (t.timeElapsed || undefined) : undefined,
        isProcessing: tableStatus === "terisi" ? isProcessing : false,
        foodStatus: tableStatus !== "tersedia" ? foodStatus : "none",
        foodStatusLabel: tableStatus !== "tersedia" ? foodStatusLabel : null,
      };
    });

    return NextResponse.json(tables, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Error fetching tables:", error);
    return NextResponse.json(
      { error: "Failed to fetch tables" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        },
      }
    );
  }
}

// PATCH /api/tables - Update table status in SQLite (cancel reservation, set available, etc.)
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const {
      tableNumber,
      status,
      statusLabel,
      customerName,
      reservationTime,
      reservationNotes,
      orderNumber,
      amount,
      timeElapsed,
      isProcessing,
      foodStatus,
      foodStatusLabel,
    } = body;

    if (!tableNumber) {
      return NextResponse.json({ error: "tableNumber is required" }, { status: 400 });
    }

    const table = await db.diningTable.findUnique({
      where: { tableNumber },
    });

    if (!table) {
      return NextResponse.json({ error: `Meja ${tableNumber} tidak ditemukan` }, { status: 404 });
    }

    const targetStatus = status !== undefined ? status : table.status;
    const isTersedia = targetStatus === "tersedia";

    const updated = await db.diningTable.update({
      where: { tableNumber },
      data: {
        status: targetStatus,
        statusLabel: statusLabel !== undefined ? statusLabel : (isTersedia ? "Tersedia" : targetStatus === "terisi" ? "Terisi" : "Reservasi"),
        customerName: isTersedia ? null : (customerName !== undefined ? customerName : table.customerName),
        reservationTime: isTersedia ? null : (reservationTime !== undefined ? reservationTime : table.reservationTime),
        reservationNotes: isTersedia ? null : (reservationNotes !== undefined ? reservationNotes : table.reservationNotes),
        orderNumber: isTersedia ? null : (orderNumber !== undefined ? orderNumber : table.orderNumber),
        amount: isTersedia ? null : (amount !== undefined ? amount : table.amount),
        timeElapsed: isTersedia ? null : (timeElapsed !== undefined ? timeElapsed : table.timeElapsed),
        isProcessing: isTersedia ? false : (isProcessing !== undefined ? isProcessing : table.isProcessing),
        foodStatus: isTersedia ? "none" : (foodStatus !== undefined ? foodStatus : table.foodStatus),
        foodStatusLabel: isTersedia ? null : (foodStatusLabel !== undefined ? foodStatusLabel : table.foodStatusLabel),
      },
    });

    // If foodStatus was marked served, also mark any active orders for this table as completed
    if (foodStatus === "served") {
      await db.order.updateMany({
        where: {
          tableSession: {
            tableId: table.id,
          },
          status: { in: ["ready", "in_progress", "new"] },
        },
        data: {
          status: "completed",
        },
      }).catch((err) => console.log("Active order completion note:", err));
    }

    return NextResponse.json({
      success: true,
      table: {
        id: updated.id,
        tableNumber: updated.tableNumber,
        displayName: updated.displayName,
        area: updated.area,
        areaLabel: updated.areaLabel,
        capacity: updated.capacity,
        status: updated.status,
        statusLabel: updated.statusLabel,
        customerName: updated.customerName || undefined,
        reservationTime: updated.reservationTime || undefined,
        orderNumber: updated.orderNumber || undefined,
        amount: updated.amount || undefined,
        timeElapsed: updated.timeElapsed || undefined,
        isProcessing: updated.isProcessing,
        foodStatus: updated.foodStatus,
        foodStatusLabel: updated.foodStatusLabel,
      },
    });
  } catch (error: any) {
    console.error("Error updating table in SQLite:", error);
    return NextResponse.json({ error: "Failed to update table status", details: error?.message || String(error) }, { status: 500 });
  }
}

// POST /api/tables - Open new session, add reservation, or manage table CRUD
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, tableNumber, guestCount = 2, customerName, reservationTime, reservationNotes } = body;

    // Action: Batch Import Tables
    if (action === "import" && Array.isArray(body.tables)) {
      const createdTables = [];
      for (const t of body.tables) {
        if (!t.tableNumber) continue;
        const num = t.tableNumber.trim();
        const disp = t.displayName?.trim() || num;
        const area = (t.area as "indoor" | "outdoor") || "indoor";
        const cap = Number(t.capacity) || 4;
        const token = `tbl-token-${num.toLowerCase().replace(/\s+/g, "-")}-${Date.now().toString().slice(-4)}`;

        const existing = await db.diningTable.findFirst({
          where: { OR: [{ tableNumber: num }, { displayName: disp }] },
        });

        if (existing) {
          const upd = await db.diningTable.update({
            where: { id: existing.id },
            data: { capacity: cap, area, displayName: disp },
          });
          createdTables.push(upd);
        } else {
          const crt = await db.diningTable.create({
            data: {
              tableNumber: num,
              displayName: disp,
              qrToken: token,
              area,
              capacity: cap,
              status: "tersedia",
              statusLabel: "Tersedia",
            },
          });
          createdTables.push(crt);
        }
      }
      return NextResponse.json({ success: true, count: createdTables.length, tables: createdTables });
    }

    // Action: Create New Table from Master Data
    if (action === "create") {
      const num = tableNumber?.trim();
      if (!num) return NextResponse.json({ error: "Nomor meja wajib diisi!" }, { status: 400 });

      const disp = body.displayName?.trim() || num;
      const area = body.area || "indoor";
      const cap = Number(body.capacity) || 4;
      const token = `tbl-token-${num.toLowerCase().replace(/\s+/g, "-")}-${Date.now().toString().slice(-4)}`;

      const created = await db.diningTable.create({
        data: {
          tableNumber: num,
          displayName: disp,
          qrToken: token,
          area,
          capacity: cap,
          status: body.status || "tersedia",
          statusLabel: body.status === "terisi" ? "Terisi" : body.status === "reservasi" ? "Reservasi" : "Tersedia",
        },
      });
      return NextResponse.json(created, { status: 201 });
    }

    // Action: Update Table from Master Data
    if (action === "update" && body.id) {
      const updated = await db.diningTable.update({
        where: { id: body.id },
        data: {
          ...(body.tableNumber && { tableNumber: body.tableNumber.trim() }),
          ...(body.displayName && { displayName: body.displayName.trim() }),
          ...(body.area && { area: body.area }),
          ...(body.capacity !== undefined && { capacity: Number(body.capacity) }),
          ...(body.status && {
            status: body.status,
            statusLabel: body.status === "terisi" ? "Terisi" : body.status === "reservasi" ? "Reservasi" : "Tersedia",
          }),
        },
      });
      return NextResponse.json(updated);
    }

    // Action: Move / Transfer Table (Pindah Meja)
    if (action === "move") {
      const sourceNum = body.sourceTableNumber?.trim() || tableNumber?.trim();
      const targetNum = body.targetTableNumber?.trim();
      const moveNotes = body.notes?.trim() || "";

      if (!sourceNum || !targetNum) {
        return NextResponse.json(
          { error: "Nomor meja asal dan meja tujuan wajib ditentukan!" },
          { status: 400 }
        );
      }

      if (sourceNum.toLowerCase() === targetNum.toLowerCase()) {
        return NextResponse.json(
          { error: "Meja tujuan tidak boleh sama dengan meja asal!" },
          { status: 400 }
        );
      }

      const sourceTable = await db.diningTable.findFirst({
        where: {
          OR: [{ tableNumber: sourceNum }, { displayName: sourceNum }],
        },
        include: {
          sessions: {
            where: { status: "active" },
            include: {
              orders: {
                where: { status: { not: "cancelled" } },
                include: { items: true },
              },
            },
          },
        },
      });

      if (!sourceTable) {
        return NextResponse.json(
          { error: `Meja asal '${sourceNum}' tidak ditemukan!` },
          { status: 404 }
        );
      }

      const targetTable = await db.diningTable.findFirst({
        where: {
          OR: [{ tableNumber: targetNum }, { displayName: targetNum }],
        },
        include: {
          sessions: {
            where: { status: "active" },
          },
        },
      });

      if (!targetTable) {
        return NextResponse.json(
          { error: `Meja tujuan '${targetNum}' tidak ditemukan!` },
          { status: 404 }
        );
      }

      if (
        targetTable.status !== "tersedia" ||
        (targetTable.sessions && targetTable.sessions.length > 0)
      ) {
        return NextResponse.json(
          {
            error: `Meja tujuan ${targetTable.displayName || targetTable.tableNumber} saat ini tidak tersedia (${targetTable.statusLabel || targetTable.status})! Silakan pilih meja yang berstatus Tersedia.`,
          },
          { status: 400 }
        );
      }

      // 1. Move active TableSession to target table if present
      const activeSession = sourceTable.sessions?.[0];
      if (activeSession) {
        await db.tableSession.update({
          where: { id: activeSession.id },
          data: { tableId: targetTable.id },
        });
      }

      // 2. Transfer attributes to target table
      const isReservation = sourceTable.status === "reservasi";
      const updatedTarget = await db.diningTable.update({
        where: { id: targetTable.id },
        data: {
          status: sourceTable.status || "terisi",
          statusLabel: sourceTable.statusLabel || (isReservation ? "Reservasi" : "Terisi"),
          customerName: sourceTable.customerName || activeSession?.customerName || null,
          reservationTime: sourceTable.reservationTime || null,
          reservationNotes: sourceTable.reservationNotes
            ? moveNotes
              ? `${sourceTable.reservationNotes} (Pindah: ${moveNotes})`
              : sourceTable.reservationNotes
            : moveNotes || null,
          orderNumber: sourceTable.orderNumber || null,
          amount: sourceTable.amount || null,
          timeElapsed: sourceTable.timeElapsed || "Baru pindah",
          isProcessing: sourceTable.isProcessing ?? false,
          foodStatus: sourceTable.foodStatus || "none",
          foodStatusLabel: sourceTable.foodStatusLabel || null,
        },
      });

      // 3. Reset source table back to tersedia
      const updatedSource = await db.diningTable.update({
        where: { id: sourceTable.id },
        data: {
          status: "tersedia",
          statusLabel: "Tersedia",
          customerName: null,
          reservationTime: null,
          reservationNotes: null,
          orderNumber: null,
          amount: null,
          timeElapsed: null,
          isProcessing: false,
          foodStatus: "none",
          foodStatusLabel: null,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Berhasil memindahkan sesi dari ${sourceTable.displayName || sourceTable.tableNumber} ke ${targetTable.displayName || targetTable.tableNumber}`,
        sourceTable: updatedSource,
        targetTable: updatedTarget,
      });
    }

    // Action: Reservation or Open Session requires existing table lookup
    const table = await db.diningTable.findFirst({
      where: {
        OR: [{ tableNumber }, { displayName: tableNumber }],
      },
    });

    if (!table) {
      return NextResponse.json({ error: "Meja tidak ditemukan!" }, { status: 404 });
    }

    // Action: Reservation
    if (action === "reservation") {
      const updated = await db.diningTable.update({
        where: { id: table.id },
        data: {
          status: "reservasi",
          statusLabel: "Reservasi",
          customerName: customerName?.trim() || "Tamu Reservasi",
          reservationTime: reservationTime || "13:00 WIB",
          reservationNotes: reservationNotes || null,
        },
      });
      return NextResponse.json({ success: true, table: updated });
    }

    // Action: Open session (dine-in guest seated)
    const existing = await db.tableSession.findFirst({
      where: { tableId: table.id, status: "active" },
    });

    if (existing) {
      return NextResponse.json(
        { error: `${table.displayName} sudah dalam status terisi (aktif)!` },
        { status: 400 }
      );
    }

    const newSession = await db.tableSession.create({
      data: {
        sessionNumber: `SES-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        tableId: table.id,
        customerName: customerName ? customerName.trim() : "Tamu Restoran",
        status: "active",
      },
      include: {
        table: true,
      },
    });

    // Also update diningTable status
    await db.diningTable.update({
      where: { id: table.id },
      data: {
        status: "terisi",
        statusLabel: "Terisi",
        customerName: customerName ? customerName.trim() : "Tamu Restoran",
        timeElapsed: "Baru duduk",
      },
    });

    return NextResponse.json(newSession, { status: 201 });
  } catch (error: any) {
    console.error("Error handling table POST in SQLite:", error);
    return NextResponse.json({ error: "Gagal memproses meja di database", details: error?.message }, { status: 500 });
  }
}

// DELETE /api/tables - Delete table from SQLite
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id");
    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json({ error: "ID meja wajib disertakan!" }, { status: 400 });
    }

    await db.diningTable.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: `Table ${id} deleted` });
  } catch (error: any) {
    console.error("Error deleting table in SQLite:", error);
    return NextResponse.json({ error: "Gagal menghapus meja di database", details: error?.message }, { status: 500 });
  }
}

