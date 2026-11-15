import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Helper to generate a unique sessionNumber for each shift
async function generateNextShiftNumber(): Promise<string> {
  try {
    const count = await db.cashierSession.count();
    const candidate = `SHIFT-${String(count + 1).padStart(3, "0")}`;
    const exists = await db.cashierSession.findUnique({ where: { sessionNumber: candidate } });
    if (!exists) return candidate;
  } catch (e) {
    // fallback
  }
  return `SHIFT-${Date.now().toString().slice(-6)}`;
}

// Helper to get active open shift or safely create one if none is open
async function getOrCreateActiveSession(cashierId?: string, cashierName?: string) {
  let session = await db.cashierSession.findFirst({
    where: { status: "open" },
    include: {
      cashMovements: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!session) {
    const sessionNumber = await generateNextShiftNumber();
    session = await db.cashierSession.create({
      data: {
        sessionNumber,
        cashierId: cashierId || "usr-kasir-1",
        cashierName: cashierName || "Siti Rahmawati",
        openingCashAmount: 500000,
        status: "open",
      },
      include: {
        cashMovements: true,
      },
    });
  }

  return session;
}

// GET /api/shifts - Get active shift data
export async function GET() {
  try {
    const session = await getOrCreateActiveSession();

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

    const shiftDisplayNumber = session.sessionNumber.replace("SHIFT-", "").trim();

    return NextResponse.json(
      {
        sessionId: session.id,
        sessionNumber: `Shift #${shiftDisplayNumber}`,
        cashierName: session.cashierName,
        openedAt: session.startedAt,
        openingCash: session.openingCashAmount,
        totalOmset: totalOmset > 0 ? totalOmset : 0,
        cashOutTotal,
        cashMovements: sortedMovements,
        drawerEstimate: session.openingCashAmount - cashOutTotal,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          Pragma: "no-cache",
        },
      }
    );
  } catch (error: any) {
    console.error("Error fetching shift:", error);
    return NextResponse.json(
      { error: "Failed to fetch shift", details: error?.message || String(error) },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        },
      }
    );
  }
}

// POST /api/shifts - Close shift or record cash movement
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, physicalCashAmount, discrepancyNotes, movementType, amount, reason } = body;

    if (action === "cash_movement") {
      const activeSession = await getOrCreateActiveSession(
        body.cashierId,
        body.createdBy || body.cashierName
      );

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
    } else if (action === "close_shift") {
      let activeSession = await db.cashierSession.findFirst({
        where: { status: "open" },
        include: { cashMovements: true },
        orderBy: { createdAt: "desc" },
      });

      if (!activeSession) {
        activeSession = await getOrCreateActiveSession();
      }

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
  } catch (error: any) {
    console.error("Error updating shift:", error);
    return NextResponse.json(
      { error: "Gagal memproses data shift", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
