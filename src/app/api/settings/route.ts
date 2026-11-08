import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    let settings = await db.restaurantSetting.findUnique({
      where: { id: "default" },
    });

    if (!settings) {
      settings = await db.restaurantSetting.create({
        data: {
          id: "default",
          restaurantName: "Pawon Nusantara",
          branchName: "Cabang Senopati",
          posTerminal: "POS REG-01",
          logoUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuBZ38yzMys7rDMMvVwNdnO6Qn2uICUNbqSa-5UoGm10fLVYf6WDkRMOCPeRdtoxJkv8OUADMdxDXPsQzjLKJTHKblLIZvPbTlXyJC3xkOCsKw_cNbNO52ydpmNiSpokMBP8HbWAok_cF18e76XVNvX2CMcM1ZOJ5jFrBg7FzXMvJVJrdNurVe1rUQovs3FiEhVmPwbcngnw5cj9prjV2eg9F67BhB-Yd0e9AGcUPrn8t-DkCnmjVVTI",
          address: "Jl. Senopati No. 45, Kebayoran Baru, Jakarta Selatan",
          phone: "0812-3456-7890",
          receiptFooter:
            "Terima kasih atas kunjungan Anda di Pawon Nusantara! Silakan datang kembali.",
          staticQrLabel: "QRIS Pawon Nusantara (BCA)",
          bankTransferInstructions: "BCA 8830-1234-56 a/n Pawon Nusantara Resto",
          taxEnabled: true,
          taxRate: 10,
          serviceChargeEnabled: true,
          serviceChargeRate: 5,
          instagram: "@pawon.nusantara",
          showInstagram: true,
          facebook: "Pawon Nusantara Resto",
          showFacebook: true,
          tiktok: "@pawon.nusantara",
          showTiktok: true,
          loyaltyProgramEnabled: true,
          loyaltySpendPerPoint: 10000,
          loyaltyPointValue: 100,
          loyaltyMinRedeemPoints: 10,
          loyaltyMaxRedeemPercent: 100,
          loyaltyTierRules: JSON.stringify([
            { tierCode: "regular", tierName: "Regular", minSpend: 0, pointMultiplier: 1.0 },
            { tierCode: "silver", tierName: "Silver Member", minSpend: 1000000, pointMultiplier: 1.2 },
            { tierCode: "gold", tierName: "Gold Member", minSpend: 3000000, pointMultiplier: 1.5 },
            { tierCode: "vip", tierName: "VIP Member", minSpend: 7000000, pointMultiplier: 2.0 },
          ]),
        },
      });
    }

    return NextResponse.json({
      ...settings,
      loyaltyTierRules: typeof settings.loyaltyTierRules === "string" && settings.loyaltyTierRules.startsWith("[")
        ? JSON.parse(settings.loyaltyTierRules)
        : settings.loyaltyTierRules,
    });
  } catch (error) {
    console.error("Error fetching restaurant settings:", error);
    return NextResponse.json(
      {
        restaurantName: "Pawon Nusantara",
        branchName: "Cabang Senopati",
        posTerminal: "POS REG-01",
        logoUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuBZ38yzMys7rDMMvVwNdnO6Qn2uICUNbqSa-5UoGm10fLVYf6WDkRMOCPeRdtoxJkv8OUADMdxDXPsQzjLKJTHKblLIZvPbTlXyJC3xkOCsKw_cNbNO52ydpmNiSpokMBP8HbWAok_cF18e76XVNvX2CMcM1ZOJ5jFrBg7FzXMvJVJrdNurVe1rUQovs3FiEhVmPwbcngnw5cj9prjV2eg9F67BhB-Yd0e9AGcUPrn8t-DkCnmjVVTI",
        address: "Jl. Senopati No. 45, Kebayoran Baru, Jakarta Selatan",
        phone: "0812-3456-7890",
        receiptFooter:
          "Terima kasih atas kunjungan Anda di Pawon Nusantara! Silakan datang kembali.",
        staticQrLabel: "QRIS Pawon Nusantara (BCA)",
        bankTransferInstructions: "BCA 8830-1234-56 a/n Pawon Nusantara Resto",
        taxEnabled: true,
        taxRate: 10,
        serviceChargeEnabled: true,
        serviceChargeRate: 5,
        instagram: "@pawon.nusantara",
        showInstagram: true,
        facebook: "Pawon Nusantara Resto",
        showFacebook: true,
        tiktok: "@pawon.nusantara",
        showTiktok: true,
        loyaltyProgramEnabled: true,
        loyaltySpendPerPoint: 10000,
        loyaltyPointValue: 100,
        loyaltyMinRedeemPoints: 10,
        loyaltyMaxRedeemPercent: 100,
        loyaltyTierRules: [
          { tierCode: "regular", tierName: "Regular", minSpend: 0, pointMultiplier: 1.0 },
          { tierCode: "silver", tierName: "Silver Member", minSpend: 1000000, pointMultiplier: 1.2 },
          { tierCode: "gold", tierName: "Gold Member", minSpend: 3000000, pointMultiplier: 1.5 },
          { tierCode: "vip", tierName: "VIP Member", minSpend: 7000000, pointMultiplier: 2.0 },
        ],
      },
      { status: 200 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const updated = await db.restaurantSetting.upsert({
      where: { id: "default" },
      update: {
        restaurantName: body.restaurantName,
        branchName: body.branchName,
        posTerminal: body.posTerminal,
        logoUrl: body.logoUrl,
        address: body.address,
        phone: body.phone,
        receiptFooter: body.receiptFooter,
        staticQrImageUrl: body.staticQrImageUrl !== undefined ? body.staticQrImageUrl : undefined,
        staticQrLabel: body.staticQrLabel,
        staticQrInstructions: body.staticQrInstructions !== undefined ? body.staticQrInstructions : undefined,
        bankTransferInstructions: body.bankTransferInstructions,
        bankAccounts: body.bankAccounts !== undefined ? (typeof body.bankAccounts === "string" ? body.bankAccounts : JSON.stringify(body.bankAccounts)) : undefined,
        taxEnabled: body.taxEnabled !== undefined ? Boolean(body.taxEnabled) : undefined,
        taxRate: body.taxRate !== undefined ? Number(body.taxRate) : undefined,
        serviceChargeEnabled: body.serviceChargeEnabled !== undefined ? Boolean(body.serviceChargeEnabled) : undefined,
        serviceChargeRate: body.serviceChargeRate !== undefined ? Number(body.serviceChargeRate) : undefined,
        instagram: body.instagram !== undefined ? body.instagram : undefined,
        showInstagram: body.showInstagram !== undefined ? Boolean(body.showInstagram) : undefined,
        facebook: body.facebook !== undefined ? body.facebook : undefined,
        showFacebook: body.showFacebook !== undefined ? Boolean(body.showFacebook) : undefined,
        tiktok: body.tiktok !== undefined ? body.tiktok : undefined,
        showTiktok: body.showTiktok !== undefined ? Boolean(body.showTiktok) : undefined,
        loyaltyProgramEnabled: body.loyaltyProgramEnabled !== undefined ? Boolean(body.loyaltyProgramEnabled) : undefined,
        loyaltySpendPerPoint: body.loyaltySpendPerPoint !== undefined ? Number(body.loyaltySpendPerPoint) : undefined,
        loyaltyPointValue: body.loyaltyPointValue !== undefined ? Number(body.loyaltyPointValue) : undefined,
        loyaltyMinRedeemPoints: body.loyaltyMinRedeemPoints !== undefined ? Number(body.loyaltyMinRedeemPoints) : undefined,
        loyaltyMaxRedeemPercent: body.loyaltyMaxRedeemPercent !== undefined ? Number(body.loyaltyMaxRedeemPercent) : undefined,
        loyaltyTierRules: body.loyaltyTierRules !== undefined ? (typeof body.loyaltyTierRules === "string" ? body.loyaltyTierRules : JSON.stringify(body.loyaltyTierRules)) : undefined,
      },
      create: {
        id: "default",
        restaurantName: body.restaurantName || "Pawon Nusantara",
        branchName: body.branchName || "Cabang Senopati",
        posTerminal: body.posTerminal || "POS REG-01",
        logoUrl: body.logoUrl || null,
        address: body.address || null,
        phone: body.phone || null,
        receiptFooter: body.receiptFooter || null,
        staticQrImageUrl: body.staticQrImageUrl || null,
        staticQrLabel: body.staticQrLabel || null,
        staticQrInstructions: body.staticQrInstructions || null,
        bankTransferInstructions: body.bankTransferInstructions || null,
        bankAccounts: body.bankAccounts !== undefined ? (typeof body.bankAccounts === "string" ? body.bankAccounts : JSON.stringify(body.bankAccounts)) : "[]",
        taxEnabled: body.taxEnabled !== undefined ? Boolean(body.taxEnabled) : false,
        taxRate: body.taxRate !== undefined ? Number(body.taxRate) : 0,
        serviceChargeEnabled: body.serviceChargeEnabled !== undefined ? Boolean(body.serviceChargeEnabled) : false,
        serviceChargeRate: body.serviceChargeRate !== undefined ? Number(body.serviceChargeRate) : 0,
        instagram: body.instagram || "@pawon.nusantara",
        showInstagram: body.showInstagram !== undefined ? Boolean(body.showInstagram) : true,
        facebook: body.facebook || "Pawon Nusantara Resto",
        showFacebook: body.showFacebook !== undefined ? Boolean(body.showFacebook) : true,
        tiktok: body.tiktok || "@pawon.nusantara",
        showTiktok: body.showTiktok !== undefined ? Boolean(body.showTiktok) : true,
        loyaltyProgramEnabled: body.loyaltyProgramEnabled !== undefined ? Boolean(body.loyaltyProgramEnabled) : true,
        loyaltySpendPerPoint: body.loyaltySpendPerPoint !== undefined ? Number(body.loyaltySpendPerPoint) : 10000,
        loyaltyPointValue: body.loyaltyPointValue !== undefined ? Number(body.loyaltyPointValue) : 100,
        loyaltyMinRedeemPoints: body.loyaltyMinRedeemPoints !== undefined ? Number(body.loyaltyMinRedeemPoints) : 10,
        loyaltyMaxRedeemPercent: body.loyaltyMaxRedeemPercent !== undefined ? Number(body.loyaltyMaxRedeemPercent) : 100,
        loyaltyTierRules: body.loyaltyTierRules !== undefined ? (typeof body.loyaltyTierRules === "string" ? body.loyaltyTierRules : JSON.stringify(body.loyaltyTierRules)) : "[]",
      },
    });

    return NextResponse.json({
      ...updated,
      loyaltyTierRules: typeof updated.loyaltyTierRules === "string" && updated.loyaltyTierRules.startsWith("[")
        ? JSON.parse(updated.loyaltyTierRules)
        : updated.loyaltyTierRules,
    });
  } catch (error) {
    console.error("Error updating restaurant settings:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui pengaturan restoran." },
      { status: 500 }
    );
  }
}
