import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Helper to format order number
function generateOrderNumber(): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `#PN-${rand}`;
}

// GET /api/orders - List all orders
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get("channel");
    const kitchenStatus = searchParams.get("kitchenStatus");
    const paymentStatus = searchParams.get("paymentStatus");

    const where: any = {};
    if (channel && channel !== "all") {
      where.sourceChannel = channel;
    }
    if (kitchenStatus && kitchenStatus !== "all") {
      where.status = kitchenStatus;
    }
    if (paymentStatus && paymentStatus !== "all") {
      where.paymentStatus = paymentStatus;
    }

    const orders = await db.order.findMany({
      where,
      include: {
        items: true,
        customer: true,
        externalPlatform: true,
        payments: {
          orderBy: { createdAt: "desc" },
        },
        tableSession: {
          include: {
            table: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Filter out any dummy orders (e.g. Sesi Meja Dibuka)
    const validDbOrders = orders.filter((o) => {
      if (!o.items || o.items.length === 0) return false;
      const realItems = o.items.filter(
        (i) =>
          !i.itemNameSnapshot.toLowerCase().includes("sesi meja") &&
          !i.itemNameSnapshot.toLowerCase().includes("menunggu pesanan")
      );
      return realItems.length > 0;
    });

    // Format for frontend
    const formatted = validDbOrders.map((o) => {
      let channelLabel = "Dine-in";
      let tableOrGuest = o.tableSession?.table.displayName || "Meja --";
      let guestSubtext = o.customerName || undefined;

      if (o.sourceChannel === "takeaway_walk_in") {
        channelLabel = "Take Away";
        tableOrGuest = o.customerName || "Pelanggan Take Away";
        guestSubtext = `Antrian #${o.orderNumber.replace("#PN-", "TK-")}`;
      } else if (o.sourceChannel === "online_platform") {
        channelLabel = o.externalPlatform?.name || "Delivery";
        tableOrGuest = o.externalOrderId || o.orderNumber;
        guestSubtext = o.customerName ? `Pemesan: ${o.customerName}` : undefined;
      }

      let kitchenStatusLabel = "Pesanan Baru";
      if (o.status === "in_progress") kitchenStatusLabel = "Dimasak";
      else if (o.status === "plating" || o.status === "ready_check") kitchenStatusLabel = "Pengecekan Menu";
      else if (o.status === "ready") kitchenStatusLabel = "Siap Diantar";
      else if (o.status === "served" || o.status === "completed") kitchenStatusLabel = "Selesai Disajikan";

      let paymentStatusLabel = o.paymentStatus === "paid" ? "Lunas" : "Belum Bayar";

      // Time formatting
      const createdDate = new Date(o.createdAt);
      const orderTime = createdDate.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }) + " WIB";

      const diffMinutes = Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60)));
      const timeAgo = diffMinutes === 0 ? "Baru saja" : `${diffMinutes}m lalu`;

      let customerComment: string | undefined = undefined;
      let specialNoteClean: string | undefined = o.notes || undefined;

      if (o.notes && o.notes.includes("[Komentar Tamu]:")) {
        const match = o.notes.match(/\[Komentar Tamu\]:\s*(.*)$/i);
        if (match) {
          customerComment = match[1]?.trim();
          const clean = o.notes.replace(/\s*\|?\s*\[Komentar Tamu\]:.*$/i, "").trim();
          specialNoteClean = clean || undefined;
        }
      }

      const latestPayment = o.payments && o.payments.length > 0 ? o.payments[0] : null;
      let paymentMethod: string | undefined = latestPayment?.method;
      if (!paymentMethod) {
        if (o.sourceChannel === "online_platform") {
          paymentMethod = "online_channel";
        } else if (o.paymentStatus === "paid") {
          paymentMethod = "cash";
        }
      }

      let cashierId = latestPayment?.cashierId || "usr-kasir-1";
      let cashierName = cashierId === "usr-kasir-2" ? "Rian Pratama" : "Siti Rahmawati";

      let paymentNote: string | undefined = undefined;
      if (latestPayment?.changeAmount && latestPayment.changeAmount > 0) {
        paymentNote = `Kembali Rp${latestPayment.changeAmount.toLocaleString("id-ID")}`;
      } else if (paymentMethod === "cash" && o.paymentStatus === "paid") {
        paymentNote = "Uang Pas";
      }

      if (o.paymentStatus === "paid") {
        if (paymentMethod === "cash") {
          paymentStatusLabel = latestPayment?.changeAmount
            ? `Lunas (Kembali Rp${latestPayment.changeAmount.toLocaleString("id-ID")})`
            : "Lunas (Tunai)";
        } else if (paymentMethod === "static_qr") {
          paymentStatusLabel = "Lunas (QRIS)";
        } else if (paymentMethod === "bank_transfer") {
          paymentStatusLabel = "Lunas (Transfer)";
        } else if (o.sourceChannel === "online_platform") {
          paymentStatusLabel = `Lunas (${o.externalPlatform?.name || "Delivery"})`;
        } else {
          paymentStatusLabel = "Lunas";
        }
      }

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        channel: o.sourceChannel,
        channelLabel,
        tableOrGuest,
        guestSubtext,
        customerId: o.customerId || undefined,
        customerPhone: (o as any).customer?.phone || undefined,
        customerTier: (o as any).customer?.tier || undefined,
        orderTime,
        timeAgo,
        items: o.items.map((i) => {
          let selectedAddons = undefined;
          if ((i as any).selectedAddons) {
            try {
              selectedAddons = typeof (i as any).selectedAddons === "string"
                ? JSON.parse((i as any).selectedAddons)
                : (i as any).selectedAddons;
            } catch (e) {}
          }
          return {
            name: i.itemNameSnapshot,
            qty: i.quantity,
            price: i.unitPriceSnapshot,
            note: i.customerNote || undefined,
            selectedAddons,
          };
        }),
        specialNote: specialNoteClean,
        customerComment,
        subtotal: o.subtotal,
        discountAmount: o.discountAmount,
        discountName: o.discountName,
        promoCode: o.promoCode,
        taxAmount: o.taxAmount,
        serviceChargeAmount: Math.max(0, o.totalAmount - (o.subtotal - (o.discountAmount || 0) + o.taxAmount)),
        total: o.totalAmount,
        kitchenStatus: o.status,
        kitchenStatusLabel,
        paymentStatus: o.paymentStatus,
        paymentStatusLabel,
        paymentMethod: paymentMethod === "online_channel" ? "online_channel" : paymentMethod,
        paymentNote,
        cashierId,
        cashierName,
        createdAt: o.createdAt.toISOString(),
      };
    });

    return NextResponse.json(formatted, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        },
      }
    );
  }
}

// POST /api/orders - Create new order
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      sourceChannel = "dine_in_qr",
      customerId,
      customerName,
      tableNumber,
      externalPlatformName,
      externalOrderId,
      items,
      notes,
      paymentStatus = "unpaid",
      paymentMethod = "cash",
      amountPaid = 0,
    } = body;

    // PRD Validation Rule 1: Customer Name is mandatory for QR and Takeaway
    if ((sourceChannel === "dine_in_qr" || sourceChannel === "takeaway_walk_in") && !customerName?.trim()) {
      return NextResponse.json(
        { error: "Nama pelanggan wajib diisi sebelum pesanan dapat diproses!" },
        { status: 400 }
      );
    }

    // Debounce & deduplication guard for Takeaway (prevent duplicate requests within 3 seconds)
    if (sourceChannel === "takeaway_walk_in" && customerName?.trim()) {
      const threeSecondsAgo = new Date(Date.now() - 3000);
      const recentDuplicate = await db.order.findFirst({
        where: {
          sourceChannel: "takeaway_walk_in",
          customerName: customerName.trim(),
          createdAt: { gte: threeSecondsAgo },
        },
        include: { items: true, externalPlatform: true },
      });
      if (recentDuplicate) {
        return NextResponse.json(recentDuplicate, { status: 200 });
      }
    }

    // PRD Validation Rule 2: Online platform must specify external platform and unique externalOrderId
    let platformId: string | undefined;
    if (sourceChannel === "online_platform") {
      if (!externalPlatformName || !externalOrderId?.trim()) {
        return NextResponse.json(
          { error: "Nama platform (GoFood/GrabFood/ShopeeFood) dan ID Pesanan Eksternal wajib diisi!" },
          { status: 400 }
        );
      }

      // Check duplicate externalOrderId
      const existing = await db.order.findFirst({
        where: { externalOrderId: externalOrderId.trim() },
      });
      if (existing) {
        return NextResponse.json(
          { error: `ID Pesanan ${externalOrderId} sudah pernah diinput sebelumnya! Mencegah duplikasi pesanan.` },
          { status: 409 }
        );
      }

      // Find or create platform
      let plat = await db.onlinePlatform.findFirst({
        where: { name: externalPlatformName },
      });
      if (!plat) {
        plat = await db.onlinePlatform.create({
          data: { name: externalPlatformName },
        });
      }
      platformId = plat.id;
    }

    // Table session handling for dine-in
    let tableSessionId: string | undefined;
    if (sourceChannel === "dine_in_qr" && tableNumber) {
      const table = await db.diningTable.findFirst({
        where: {
          OR: [{ tableNumber }, { displayName: tableNumber }],
        },
      });

      if (table) {
        let session = await db.tableSession.findFirst({
          where: { tableId: table.id, status: "active" },
        });

        if (!session) {
          session = await db.tableSession.create({
            data: {
              sessionNumber: `SES-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              tableId: table.id,
              customerName: customerName.trim(),
              status: "active",
            },
          });
        }
        tableSessionId = session.id;
      }
    }

    // Validate items (must be real food/drink items)
    const validItems = (items || []).filter(
      (it: any) =>
        it.name &&
        !it.name.toLowerCase().includes("sesi meja") &&
        !it.name.toLowerCase().includes("menunggu pesanan")
    );

    if (validItems.length === 0) {
      return NextResponse.json(
        { error: "Pesanan harus memiliki minimal 1 item menu makanan/minuman yang valid!" },
        { status: 400 }
      );
    }

    const calculatedSubtotal = validItems.reduce(
      (sum: number, it: any) =>
        sum + (it.price || it.unitPrice || 0) * (it.qty || it.quantity || 1),
      0
    );
    const subtotal = Number(body.subtotal) > 0 ? Number(body.subtotal) : calculatedSubtotal;
    const discountAmount = Number(body.discountAmount) || 0;
    const discountName = body.discountName ? String(body.discountName).trim() : null;
    const promoCode = body.promoCode ? String(body.promoCode).trim().toUpperCase() : null;
    const taxAmount = Number(body.taxAmount) || 0;
    const totalAmount = Number(body.totalAmount) > 0 ? Number(body.totalAmount) : Math.max(0, subtotal - discountAmount + taxAmount);

    // Create Order
    const orderNumber = generateOrderNumber();
    const createdOrder = await db.order.create({
      data: {
        orderNumber,
        sourceChannel,
        fulfillmentType:
          sourceChannel === "takeaway_walk_in"
            ? "takeaway"
            : sourceChannel === "online_platform"
            ? "delivery_platform"
            : "dine_in",
        tableSessionId: tableSessionId || null,
        externalPlatformId: platformId || null,
        externalOrderId: externalOrderId ? externalOrderId.trim() : null,
        customerId: customerId || null,
        customerName: customerName ? customerName.trim() : null,
        status: "new",
        paymentStatus,
        subtotal,
        discountAmount,
        discountName,
        promoCode,
        taxAmount,
        totalAmount,
        notes: notes || null,
        items: {
          create: validItems.map((it: any) => {
            const unitPrice = it.price || it.unitPrice || 0;
            const quantity = it.qty || it.quantity || 1;
            return {
              itemNameSnapshot: it.name,
              unitPriceSnapshot: unitPrice,
              quantity,
              lineTotal: unitPrice * quantity,
              customerNote: it.note || null,
              selectedAddons: it.selectedAddons
                ? typeof it.selectedAddons === "string"
                  ? it.selectedAddons
                  : JSON.stringify(it.selectedAddons)
                : null,
              kitchenStatus: "new",
            };
          }),
        },
      },
      include: {
        items: true,
        externalPlatform: true,
      },
    });

    if (sourceChannel === "dine_in_qr" && tableNumber) {
      try {
        await db.diningTable.updateMany({
          where: {
            OR: [{ tableNumber }, { displayName: tableNumber }],
          },
          data: {
            status: "terisi",
            statusLabel: "Terisi",
            customerName: customerName ? customerName.trim() : "Tamu Meja",
            orderNumber: createdOrder.orderNumber,
            amount: totalAmount,
            timeElapsed: "Baru saja",
            isProcessing: true,
            foodStatus: "in_progress",
            foodStatusLabel: "Sedang Dimasak di Dapur",
          },
        });
      } catch (tableErr) {
        console.error("Failed to update diningTable status on QR order:", tableErr);
      }
    }

    // Record Payment if order is already paid on creation
    if (paymentStatus === "paid") {
      try {
        const cleanMethod =
          sourceChannel === "online_platform"
            ? "online_channel"
            : paymentMethod === "static_qr"
            ? "static_qr"
            : paymentMethod === "bank_transfer"
            ? "bank_transfer"
            : "cash";

        const effAmountPaid = amountPaid && amountPaid > 0 ? Number(amountPaid) : totalAmount;
        const change = cleanMethod === "cash" ? Math.max(0, effAmountPaid - totalAmount) : 0;

        await db.payment.create({
          data: {
            paymentNumber: `PAY-${createdOrder.orderNumber.replace("#", "")}`,
            orderId: createdOrder.id,
            discountAmount,
            amountDue: totalAmount,
            amountPaid: effAmountPaid,
            changeAmount: change,
            method: cleanMethod,
            status: "paid",
            cashierId: body.cashierId || "usr-kasir-1",
            tableSessionId: tableSessionId || null,
          },
        });

        if (customerId) {
          try {
            const pointsEarned = Math.floor(totalAmount / 10000);
            await db.customer.update({
              where: { id: customerId },
              data: {
                totalVisits: { increment: 1 },
                totalSpent: { increment: totalAmount },
                points: { increment: pointsEarned },
              },
            });
          } catch (custErr) {
            console.error("Failed to update customer stats in POST:", custErr);
          }
        }
      } catch (payErr) {
        console.error("Failed to record payment in POST /api/orders:", payErr);
      }
    }

    if (promoCode) {
      try {
        await db.promoDiscount.update({
          where: { code: promoCode },
          data: { usageCount: { increment: 1 } },
        });
      } catch (promoErr) {}
    }

    return NextResponse.json(createdOrder, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json({ error: "Gagal menyimpan pesanan baru ke sistem." }, { status: 500 });
  }
}

// PATCH /api/orders - Update order status (kitchenStatus or paymentStatus)
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const {
      orderId,
      kitchenStatus,
      paymentStatus,
      tableNumber,
      items,
      total,
      customerName,
      customerComment,
    } = body;

    if (!orderId && !tableNumber) {
      return NextResponse.json({ error: "orderId or tableNumber is required" }, { status: 400 });
    }

    const updateData: any = {};
    if (kitchenStatus) {
      updateData.status = kitchenStatus;
    }
    if (paymentStatus) {
      updateData.paymentStatus = paymentStatus;
    }
    if (body.customerId !== undefined) {
      updateData.customerId = body.customerId || null;
    }
    if (body.discountAmount !== undefined) {
      updateData.discountAmount = Number(body.discountAmount);
    }
    if (body.discountName !== undefined) {
      updateData.discountName = body.discountName || null;
    }
    if (body.promoCode !== undefined) {
      updateData.promoCode = body.promoCode ? String(body.promoCode).trim().toUpperCase() : null;
    }
    if (body.subtotal !== undefined) {
      updateData.subtotal = Number(body.subtotal);
    }
    if (body.total !== undefined || body.totalAmount !== undefined) {
      updateData.totalAmount = Number(body.totalAmount ?? body.total);
    }

    // 1. Try to find existing order by ID or orderNumber or table
    let existing = orderId ? await db.order.findUnique({ where: { id: orderId } }) : null;
    if (!existing && orderId) {
      existing = await db.order.findFirst({
        where: {
          OR: [
            { orderNumber: orderId },
            ...(tableNumber ? [
              { tableSession: { table: { tableNumber } } },
              { tableSession: { table: { displayName: tableNumber } } },
            ] : []),
          ],
        },
      });
    }

    if (!existing && tableNumber) {
      existing = await db.order.findFirst({
        where: {
          tableSession: {
            table: {
              OR: [
                { tableNumber },
                { displayName: tableNumber },
              ],
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    if (existing) {
      if (customerComment !== undefined && customerComment !== null) {
        const cleanComment = customerComment.toString().trim();
        let baseNotes = existing.notes || "";
        baseNotes = baseNotes.replace(/\s*\|?\s*\[Komentar Tamu\]:.*$/i, "").trim();
        if (cleanComment) {
          updateData.notes = baseNotes ? `${baseNotes} | [Komentar Tamu]: ${cleanComment}` : `[Komentar Tamu]: ${cleanComment}`;
        } else {
          updateData.notes = baseNotes || null;
        }
      }
      const updated = await db.order.update({
        where: { id: existing.id },
        data: updateData,
        include: {
          items: true,
          tableSession: {
            include: {
              table: true,
            },
          },
        },
      });

      // Synchronize table foodStatus in SQLite if kitchenStatus was updated
      if (kitchenStatus) {
        // Also update items in order
        await db.orderItem.updateMany({
          where: { orderId: existing.id },
          data: { kitchenStatus },
        }).catch((err) => console.log("OrderItem status update note:", err));

        // Find table ID
        const targetTableId = updated.tableSession?.tableId || updated.tableSession?.table?.id;
        const targetTableNumber = tableNumber || updated.tableSession?.table?.tableNumber || updated.tableSession?.table?.displayName;

        let foodStatus = "none";
        let foodStatusLabel = "";
        let isProcessing = false;

        if (kitchenStatus === "in_progress") {
          foodStatus = "in_progress";
          foodStatusLabel = "Sedang Dimasak di Dapur";
          isProcessing = true;
        } else if (kitchenStatus === "plating" || kitchenStatus === "ready_check") {
          foodStatus = "in_progress";
          foodStatusLabel = "Pengecekan Menu di Dapur";
          isProcessing = true;
        } else if (kitchenStatus === "ready") {
          foodStatus = "ready";
          foodStatusLabel = "🔔 SIAP SAJI - Siap Diantar!";
          isProcessing = false;
        } else if (kitchenStatus === "completed" || kitchenStatus === "served") {
          foodStatus = "served";
          foodStatusLabel = "Semua Makanan Sudah Disajikan";
          isProcessing = false;
        }

        if (targetTableId || targetTableNumber) {
          const tableUpdateData: any = {
            foodStatus,
            foodStatusLabel,
            isProcessing,
          };

          if (
            kitchenStatus === "new" ||
            kitchenStatus === "in_progress" ||
            kitchenStatus === "plating" ||
            kitchenStatus === "ready_check" ||
            kitchenStatus === "ready"
          ) {
            tableUpdateData.status = "terisi";
            tableUpdateData.statusLabel = "Terisi";
            if (updated.customerName) tableUpdateData.customerName = updated.customerName;
            if (updated.orderNumber) tableUpdateData.orderNumber = updated.orderNumber;
            if (updated.totalAmount) tableUpdateData.amount = updated.totalAmount;
          }

          await db.diningTable.updateMany({
            where: {
              OR: [
                ...(targetTableId ? [{ id: targetTableId }] : []),
                ...(targetTableNumber ? [{ tableNumber: targetTableNumber }, { displayName: targetTableNumber }] : []),
              ],
            },
            data: tableUpdateData,
          }).catch((err) => console.log("DiningTable status update note:", err));
        }

        // When food is marked completed or served, mark ALL other active/ready orders for this table as completed!
        if (targetTableNumber && (kitchenStatus === "completed" || kitchenStatus === "served")) {
          const siblingOrders = await db.order.findMany({
            where: {
              tableSession: {
                table: {
                  OR: [
                    { tableNumber: targetTableNumber },
                    { displayName: targetTableNumber },
                  ],
                },
              },
              status: { in: ["new", "in_progress", "ready"] },
            },
          });

          for (const sOrd of siblingOrders) {
            await db.order.update({
              where: { id: sOrd.id },
              data: { status: "completed" },
            }).catch(() => {});

            await db.orderItem.updateMany({
              where: { orderId: sOrd.id },
              data: { kitchenStatus: "completed" },
            }).catch(() => {});
          }
        }
      }

      // If order is paid and belongs to a table session, close the session and reset table to tersedia
      if (paymentStatus === "paid") {
        try {
          const cleanMethod =
            body.paymentMethod === "static_qr"
              ? "static_qr"
              : body.paymentMethod === "bank_transfer"
              ? "bank_transfer"
              : "cash";

          const existingPayment = await db.payment.findFirst({
            where: { orderId: existing.id },
          });

          if (!existingPayment) {
            const effPaid = body.amountPaid ? Number(body.amountPaid) : existing.totalAmount;
            const effChange =
              body.changeAmount !== undefined
                ? Number(body.changeAmount)
                : cleanMethod === "cash"
                ? Math.max(0, effPaid - existing.totalAmount)
                : 0;

            await db.payment.create({
              data: {
                paymentNumber: `PAY-${existing.orderNumber.replace("#", "")}`,
                orderId: existing.id,
                amountDue: existing.totalAmount,
                amountPaid: effPaid,
                changeAmount: effChange,
                method: cleanMethod,
                status: "paid",
                cashierId: body.cashierId || "usr-kasir-1",
                tableSessionId: existing.tableSessionId || null,
              },
            });
          }

          const targetCustomerId = body.customerId || existing.customerId;
          if (targetCustomerId) {
            try {
              const finalTotal = updateData.totalAmount ?? existing.totalAmount;
              const pointsEarned = Math.floor(finalTotal / 10000);
              await db.customer.update({
                where: { id: targetCustomerId },
                data: {
                  totalVisits: { increment: 1 },
                  totalSpent: { increment: finalTotal },
                  points: { increment: pointsEarned },
                },
              });
            } catch (custErr) {
              console.error("Failed to update customer stats in PATCH:", custErr);
            }
          }
        } catch (payErr) {
          console.error("Failed to create Payment in PATCH /api/orders:", payErr);
        }

        if (updated.tableSessionId) {
          await db.tableSession.update({
            where: { id: updated.tableSessionId },
            data: {
              status: "paid",
              closedAt: new Date(),
            },
          }).catch((err) => console.log("Session close note:", err));
        }

        const tableId = updated.tableSession?.tableId;
        const targetTable = tableNumber || updated.tableSession?.table?.tableNumber || updated.tableSession?.table?.displayName;
        if (tableId || targetTable) {
          await db.diningTable.updateMany({
            where: {
              OR: [
                ...(tableId ? [{ id: tableId }] : []),
                ...(targetTable ? [{ tableNumber: targetTable }, { displayName: targetTable }] : []),
              ],
            },
            data: {
              status: "tersedia",
              statusLabel: "Tersedia",
              customerName: null,
              orderNumber: null,
              amount: null,
              timeElapsed: null,
              foodStatus: "none",
              foodStatusLabel: null,
              isProcessing: false,
            },
          }).catch((err) => console.log("Table reset note on order pay:", err));
        }
      }

      return NextResponse.json(updated);
    }

    // 1b. If existing order was not found, but tableNumber is provided and kitchenStatus is completed/served:
    if (tableNumber && (kitchenStatus === "completed" || kitchenStatus === "served")) {
      await db.diningTable.updateMany({
        where: {
          OR: [{ tableNumber }, { displayName: tableNumber }],
        },
        data: {
          foodStatus: "served",
          foodStatusLabel: "Semua Makanan Sudah Disajikan",
          isProcessing: false,
        },
      }).catch(() => {});

      const tableOrders = await db.order.findMany({
        where: {
          tableSession: {
            table: {
              OR: [{ tableNumber }, { displayName: tableNumber }],
            },
          },
          status: { in: ["new", "in_progress", "ready"] },
        },
      });

      for (const tOrd of tableOrders) {
        await db.order.update({
          where: { id: tOrd.id },
          data: { status: "completed" },
        }).catch(() => {});
        await db.orderItem.updateMany({
          where: { orderId: tOrd.id },
          data: { kitchenStatus: "completed" },
        }).catch(() => {});
      }

      return NextResponse.json({ success: true, message: `All orders for ${tableNumber} marked completed` });
    }

    // 2. If not found in SQLite (e.g. mock table order checked out from frontend), create it as paid in DB
    if (paymentStatus === "paid") {
      let tableRecord = null;
      if (tableNumber) {
        tableRecord = await db.diningTable.findFirst({
          where: {
            OR: [
              { tableNumber },
              { displayName: tableNumber },
            ],
          },
        });
      }

      let tableSessionId = null;
      if (tableRecord) {
        const session = await db.tableSession.create({
          data: {
            sessionNumber: `SES-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            tableId: tableRecord.id,
            customerName: customerName || "Pelanggan",
            status: "paid",
            closedAt: new Date(),
          },
        });
        tableSessionId = session.id;

        await db.diningTable.update({
          where: { id: tableRecord.id },
          data: {
            status: "tersedia",
            statusLabel: "Tersedia",
            customerName: null,
            orderNumber: null,
            amount: null,
            timeElapsed: null,
            foodStatus: "none",
            foodStatusLabel: null,
            isProcessing: false,
          },
        }).catch(() => {});
      }

      const generatedNum = orderId && orderId.startsWith("#PN-")
        ? orderId
        : generateOrderNumber();

      const created = await db.order.create({
        data: {
          orderNumber: generatedNum,
          sourceChannel: "dine_in_qr",
          fulfillmentType: "dine_in",
          tableSessionId,
          customerName: customerName || "Pelanggan",
          status: "completed",
          paymentStatus: "paid",
          subtotal: total || 100000,
          totalAmount: total || 100000,
          items: {
            create: (items || []).map((it: any) => ({
              itemNameSnapshot: it.name,
              unitPriceSnapshot: it.price,
              quantity: it.qty,
              lineTotal: (it.price || 0) * (it.qty || 1),
              customerNote: it.note || null,
              kitchenStatus: "ready",
            })),
          },
        },
        include: {
          items: true,
        },
      });

      return NextResponse.json(created, { status: 201 });
    }

    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
