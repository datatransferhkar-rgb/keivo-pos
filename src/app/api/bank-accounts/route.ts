import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const DEFAULT_BANK_ACCOUNTS = [
  {
    id: "bank-bca-01",
    bankName: "BCA",
    accountNumber: "8830-1234-56",
    accountName: "Pawon Nusantara Resto",
    isDefault: true,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: "bank-mandiri-02",
    bankName: "Bank Mandiri",
    accountNumber: "1370-0198-2345",
    accountName: "PT Pawon Nusantara Boga",
    isDefault: false,
    isActive: true,
    sortOrder: 2,
  },
];

export async function GET() {
  try {
    let accounts = await db.bankAccount.findMany({
      orderBy: [
        { isDefault: "desc" },
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ],
    });

    if (accounts.length === 0) {
      // Seed default accounts
      for (const acc of DEFAULT_BANK_ACCOUNTS) {
        await db.bankAccount.create({
          data: {
            id: acc.id,
            bankName: acc.bankName,
            accountNumber: acc.accountNumber,
            accountName: acc.accountName,
            isDefault: acc.isDefault,
            isActive: acc.isActive,
            sortOrder: acc.sortOrder,
          },
        });
      }
      accounts = await db.bankAccount.findMany({
        orderBy: [
          { isDefault: "desc" },
          { sortOrder: "asc" },
          { createdAt: "asc" },
        ],
      });
    }

    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Error fetching bank accounts:", error);
    return NextResponse.json(DEFAULT_BANK_ACCOUNTS, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bankName, accountNumber, accountName, isDefault, isActive } = body;

    if (!bankName || !accountNumber || !accountName) {
      return NextResponse.json(
        { error: "Nama bank, nomor rekening, dan nama pemilik rekening wajib diisi." },
        { status: 400 }
      );
    }

    // If marked default, unset others
    if (isDefault) {
      await db.bankAccount.updateMany({
        data: { isDefault: false },
      });
    }

    const newAccount = await db.bankAccount.create({
      data: {
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
        isDefault: Boolean(isDefault),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    return NextResponse.json(newAccount, { status: 201 });
  } catch (error) {
    console.error("Error creating bank account:", error);
    return NextResponse.json(
      { error: "Gagal menambahkan rekening bank." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, bankName, accountNumber, accountName, isDefault, isActive, sortOrder } = body;

    if (!id) {
      return NextResponse.json({ error: "ID rekening wajib disertakan." }, { status: 400 });
    }

    if (isDefault) {
      await db.bankAccount.updateMany({
        where: { id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await db.bankAccount.update({
      where: { id },
      data: {
        bankName: bankName !== undefined ? bankName.trim() : undefined,
        accountNumber: accountNumber !== undefined ? accountNumber.trim() : undefined,
        accountName: accountName !== undefined ? accountName.trim() : undefined,
        isDefault: isDefault !== undefined ? Boolean(isDefault) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating bank account:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui rekening bank." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID rekening diperlukan." }, { status: 400 });
    }

    await db.bankAccount.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Rekening berhasil dihapus." });
  } catch (error) {
    console.error("Error deleting bank account:", error);
    return NextResponse.json(
      { error: "Gagal menghapus rekening bank." },
      { status: 500 }
    );
  }
}

