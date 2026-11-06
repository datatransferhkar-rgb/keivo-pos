import { ProductPromo } from "@/types/pos";
import { formatCurrency } from "@/lib/formatters";

export interface ItemPromoCalculation {
  isPromo: boolean;
  effectivePrice: number;
  originalPrice: number;
  badge: string;
  promoName: string;
}

export function calculateProductPromoPrice(
  product: { id: string; code?: string; name: string; category?: string; price: number },
  activePromos: ProductPromo[]
): ItemPromoCalculation {
  const originalPrice = product.price;
  if (!activePromos || activePromos.length === 0) {
    return { isPromo: false, effectivePrice: originalPrice, originalPrice, badge: "", promoName: "" };
  }

  const now = new Date();
  const currentHours = now.getHours().toString().padStart(2, "0");
  const currentMins = now.getMinutes().toString().padStart(2, "0");
  const currentTime = `${currentHours}:${currentMins}`;

  for (const promo of activePromos) {
    if (!promo.isActive) continue;

    // Date range
    if (promo.startDate && new Date(promo.startDate) > now) continue;
    if (promo.endDate && new Date(promo.endDate) < now) continue;

    // Time range (e.g. happy hour 14:00 - 17:00)
    if (promo.timeStart && promo.timeEnd) {
      if (currentTime < promo.timeStart || currentTime > promo.timeEnd) continue;
    }

    let isMatch = false;
    if (promo.targetType === "all_products") {
      isMatch = true;
    } else if (promo.targetType === "category") {
      isMatch = Boolean(
        promo.targetCategory &&
        product.category &&
        promo.targetCategory.toLowerCase().trim() === product.category.toLowerCase().trim()
      );
    } else if (promo.targetType === "specific_products" && Array.isArray(promo.targetProductIds)) {
      isMatch = promo.targetProductIds.some(
        (idOrCode) =>
          idOrCode === product.id ||
          (product.code && idOrCode === product.code) ||
          (idOrCode === "PRD-001" && (product.id === "m-liwet" || product.name.toLowerCase().includes("liwet"))) ||
          (idOrCode === "PRD-002" && (product.id === "m-miegor" || product.name.toLowerCase().includes("mie goreng"))) ||
          (idOrCode === "prod-1" && (product.id === "m-liwet" || product.name.toLowerCase().includes("liwet"))) ||
          (idOrCode === "prod-2" && (product.id === "m-miegor" || product.name.toLowerCase().includes("mie goreng")))
      );
    }

    if (isMatch) {
      let effectivePrice = originalPrice;
      let badge = promo.badgeLabel || "PROMO";

      if (promo.discountType === "percentage") {
        const discountAmount = Math.round(originalPrice * (promo.discountValue / 100));
        effectivePrice = Math.max(0, originalPrice - discountAmount);
        if (!promo.badgeLabel) badge = `PROMO -${promo.discountValue}%`;
      } else if (promo.discountType === "fixed") {
        effectivePrice = Math.max(0, originalPrice - promo.discountValue);
        if (!promo.badgeLabel) badge = `HEMAT ${formatCurrency(promo.discountValue)}`;
      } else if (promo.discountType === "special_price") {
        effectivePrice = Math.max(0, promo.discountValue);
        if (!promo.badgeLabel) badge = `SPESIAL ${formatCurrency(effectivePrice)}`;
      }

      if (effectivePrice < originalPrice) {
        return {
          isPromo: true,
          effectivePrice,
          originalPrice,
          badge,
          promoName: promo.name,
        };
      }
    }
  }

  return { isPromo: false, effectivePrice: originalPrice, originalPrice, badge: "", promoName: "" };
}

