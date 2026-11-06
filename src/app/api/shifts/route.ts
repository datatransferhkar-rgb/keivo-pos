import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/shifts - Get active shift data
export async function GET() {
  try {
    let session = await db.cashierSession.findFirst({
      where: { status: "open" },
      include: {
        cashMovements: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!session) {
      session = await db.cashierSession.create({
        data: {
          sessionNumber: "SHIFT-042",
          cashierId: "siti",
          cashierName: "Siti Rahmawati",
          openingCashAmount: 500000,
          status: "open",
        },
        include: {
          cashMovements: true,
        },
      });
    }

    // Calculate total omset from paid orders
    const paidOrders = await db.order.findMany({
      where: { paymentStatus: "paid" },
    });

    const totalOmset = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    // Cash movement calculations
    const sortedMovements = (session.cashMovements || []).sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const cashOutTotal = sortedMovements
      .filter((m: { movementType: string }) => m.movementType === "cash_out")
      .reduce((sum: number, m: { amount: number }) => sum + m.amount, 0);

    return NextResponse.json({
      sessionId: session.id,
      sessionNumber: `Shift Pagi #${session.sessionNumber.replace("SHIFT-", "")}`,
      cashierName: session.cashierName,
      openedAt: session.startedAt,
      openingCash: session.openingCashAmount,
      totalOmset: totalOmset > 0 ? totalOmset : 0,
      cashOutTotal,
      cashMovements: sortedMovements,
      drawerEstimate: session.openingCashAmount - cashOutTotal,
    });
  } catch (error) {
    console.error("Error fetching shift:", error);
    return NextResponse.json({ error: "Failed to fetch shift" }, { status: 500 });
  }
}

// POST /api/shifts - Close shift or record cash movement
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, physicalCashAmount, discrepancyNotes, movementType, amount, reason } = body;

    const activeSession = await db.cashierSession.findFirst({
      where: { status: "open" },
      include: { cashMovements: true },
      orderBy: { createdAt: "desc" },
    });

    if (!activeSession) {
      return NextResponse.json({ error: "Tidak ada shift aktif yang ditemukan." }, { status: 400 });
    }

    if (action === "close_shift") {
      const closingPhysical = Number(physicalCashAmount) || 0;
      const cashOutTotal = (activeSession.cashMovements || [])
        .filter((m: { movementType: string }) => m.movementType === "cash_out")
        .reduce((sum: number, m: { amount: number }) => sum + m.amount, 0);

      const expected = activeSession.openingCashAmount - cashOutTotal;
      const discrepancy = closingPhysical - expected;

      const closed = await db.cashierSession.update({
        where: { id: activeSession.id },
        data: {
          countedClosingCashAmount: closingPhysical,
          expectedClosingCashAmount: expected,
          cashDifferenceAmount: discrepancy,
          closingNotes: discrepancyNotes || null,
          status: "closed",
          endedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        closed,
        discrepancy,
      });
    } else if (action === "cash_movement") {
      const movement = await db.cashMovement.create({
        data: {
          cashierSessionId: activeSession.id,
          movementType: movementType || "cash_out",
          amount: Number(amount) || 0,
          reason: reason || "Kas Keluar Operasional",
          createdBy: body.createdBy || activeSession.cashierName,
        },
      });

      return NextResponse.json(movement, { status: 201 });
    } else if (action === "delete_cash_movement") {
      if (!body.id) {
        return NextResponse.json({ error: "ID pengeluaran kas wajib disertakan" }, { status: 400 });
      }
      await db.cashMovement.delete({
        where: { id: body.id },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating shift:", error);
    return NextResponse.json({ error: "Gagal memproses data shift" }, { status: 500 });
  }
}
