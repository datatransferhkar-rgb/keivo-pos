"use client";

import React, { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/formatters";
import { MasterProduct, ProductAddon } from "@/types/pos";

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: MasterProduct | null;
  currentCartQty?: number;
  previewOnly?: boolean;
  onEdit?: (product: MasterProduct) => void;
  onAddToCart?: (
    product: MasterProduct,
    qtyToAdd?: number,
    selectedAddons?: ProductAddon[],
    note?: string
  ) => void;
}

export function ProductDetailModal({
  isOpen,
  onClose,
  product,
  currentCartQty = 0,
  previewOnly = false,
  onEdit,
  onAddToCart,
}: ProductDetailModalProps) {
  const [modalQty, setModalQty] = useState<number>(1);
  const [selectedAddonIds, setSelectedAddonIds] = useState<Record<string, boolean>>({});
  const [customNote, setCustomNote] = useState<string>("");

  useEffect(() => {
    setModalQty(1);
    setSelectedAddonIds({});
    setCustomNote("");
  }, [product?.id, isOpen]);

  if (!isOpen || !product) return null;

  const isOutOfStock = product.isAvailable === false;
  const isPromo = product.promoPrice !== undefined && product.promoPrice < product.price;
  const basePrice = (isPromo && typeof product.promoPrice === "number") ? product.promoPrice : (product.price || 0);
  const img = product.imageUrl || product.image;

  const availableAddons: ProductAddon[] = product.addons || [];
  const selectedAddonsList: ProductAddon[] = availableAddons.filter(
    (a) => !!selectedAddonIds[a.id]
  );
  const addonsTotalPerUnit = selectedAddonsList.reduce((sum, a) => sum + (a.price || 0), 0);
  const effectiveUnitPrice = basePrice + addonsTotalPerUnit;
  const lineTotal = effectiveUnitPrice * modalQty;

  const handleIncrement = () => {
    setModalQty((prev) => prev + 1);
  };

  const handleDecrement = () => {
    setModalQty((prev) => (prev > 1 ? prev - 1 : 1));
  };

  const handleConfirmAdd = () => {
    if (onAddToCart && !isOutOfStock) {
      onAddToCart(product, modalQty, selectedAddonsList, customNote.trim() || undefined);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col border border-slate-200/80 animate-in zoom-in-95 duration-200 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">restaurant_menu</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline-sm text-sm font-bold text-slate-900 leading-tight">
                  {previewOnly ? "Pratinjau Informasi Menu" : "Detail Informasi Menu"}
                </h3>
                {previewOnly && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#003629] text-[10px] font-bold border border-emerald-300 flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[12px]">visibility</span>
                    Preview
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Kode Produk: <span className="font-mono font-bold text-slate-700">{product.code || "PRD"}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer shadow-2xs border border-slate-200"
            title="Tutup (Esc)"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 scrollbar-thin scrollbar-thumb-slate-200">
          {/* Foto Menu Besar */}
          <div className="relative w-full aspect-16/9 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/70 shadow-2xs shrink-0">
            {img ? (
              <img
                src={img}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1.5">
                <span className="material-symbols-outlined text-5xl">restaurant</span>
                <span className="text-xs font-semibold">Foto menu belum tersedia</span>
              </div>
            )}

            {/* Badges Floating di Foto */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-xs text-white text-xs font-bold shadow-xs">
                {product.category}
              </span>
              {isPromo && (
                <span className="px-3 py-1 rounded-full bg-red-600 text-white text-xs font-black shadow-md flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">local_fire_department</span>
                  <span>{product.promoBadge || "PROMO PRODUK"}</span>
                </span>
              )}
            </div>

            <div className="absolute top-3 right-3">
              {isOutOfStock ? (
                <span className="px-3 py-1 rounded-full bg-rose-600 text-white text-xs font-black uppercase tracking-wider shadow-md flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">block</span>
                  <span>Stok Habis</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-[#003629] text-white text-xs font-black shadow-md flex items-center gap-1 border border-white/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Tersedia di Dapur</span>
                </span>
              )}
            </div>

            {/* Current Cart Quantity Pill */}
            {currentCartQty > 0 && (
              <div className="absolute bottom-3 left-3">
                <span className="px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-black shadow-md flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">shopping_bag</span>
                  <span>{currentCartQty} porsi di keranjang</span>
                </span>
              </div>
            )}
          </div>

          {/* Judul & Harga */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                {product.category}
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight leading-snug">
                {product.name}
              </h2>
              {isPromo && product.promoName && (
                <span className="text-xs font-bold text-red-600 mt-0.5 block flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">campaign</span>
                  <span>{product.promoName}</span>
                </span>
              )}
            </div>
            <div className="text-left sm:text-right shrink-0">
              <span className="text-[11px] text-slate-400 block font-medium">Harga per Porsi:</span>
              <div className="flex items-center gap-2 sm:justify-end flex-wrap">
                {isPromo && (
                  <span className="text-sm font-medium text-slate-400 line-through">
                    {formatCurrency(product.price)}
                  </span>
                )}
                <span className={`text-2xl font-black ${isOutOfStock ? "text-slate-400 line-through" : isPromo ? "text-red-600" : "text-[#003629]"}`}>
                  {formatCurrency(basePrice)}
                </span>
              </div>
            </div>
          </div>

          {/* Deskripsi & Komposisi Menu */}
          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-primary">description</span>
              <span>Deskripsi &amp; Cita Rasa</span>
            </h4>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 leading-relaxed font-medium">
              {product.description ||
                "Hidangan istimewa khas Pawon Nusantara, diolah menggunakan rempah-rempah pilihan dengan resep warisan tradisional nusantara untuk menjamin keaslian rasa dan kualitas terbaik."}
            </div>
          </div>

          {/* Pilihan Tambahan / Pelengkap Makanan */}
          {availableAddons.length > 0 && (
            <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-amber-50/40 border border-amber-200/80">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-amber-700">room_service</span>
                  <span>Pilihan Tambahan / Pelengkap</span>
                </span>
                {selectedAddonsList.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                    +{formatCurrency(addonsTotalPerUnit)} / porsi
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Pilih pelengkap tambahan untuk hidangan ini:
              </p>
              <div className="flex flex-col gap-1.5 mt-0.5">
                {availableAddons.map((addon) => {
                  const isChecked = !!selectedAddonIds[addon.id];
                  return (
                    <label
                      key={addon.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isChecked
                          ? "bg-amber-100/70 border-amber-400 text-amber-950 font-bold shadow-2xs"
                          : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            setSelectedAddonIds((prev) => ({
                              ...prev,
                              [addon.id]: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 rounded text-[#003629] focus:ring-[#003629] cursor-pointer"
                        />
                        <span className="text-xs">{addon.name}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-800">
                        +{formatCurrency(addon.price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Catatan Khusus untuk Dapur */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-primary">edit_note</span>
              <span>Catatan Khusus (Dapur / Bar)</span>
            </label>
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Contoh: Sambal pisah, sedikit es, bakar agak kering..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:bg-white focus:border-primary transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Footer Modal: Mode Preview vs Mode Kasir */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
          {previewOnly ? (
            <div className="flex items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                <span className="material-symbols-outlined text-base text-primary">visibility</span>
                <span className="font-medium">Pratinjau tampilan menu untuk pemesanan meja &amp; kasir</span>
              </div>
              {onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEdit(product);
                  }}
                  className="py-2.5 px-4 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                  <span>Edit Menu</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Stepper Jumlah Porsi */}
              {!isOutOfStock ? (
                <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={handleDecrement}
                    disabled={modalQty <= 1}
                    className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 flex items-center justify-center font-bold active:scale-90 transition-all cursor-pointer"
                    title="Kurangi 1 Porsi"
                  >
                    <span className="material-symbols-outlined text-base">remove</span>
                  </button>
                  <div className="px-2 min-w-[36px] text-center">
                    <span className="font-black text-sm text-slate-900">{modalQty}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleIncrement}
                    className="w-8 h-8 rounded-xl bg-[#003629] hover:bg-[#00261d] text-white flex items-center justify-center font-bold active:scale-90 transition-all cursor-pointer shadow-xs"
                    title="Tambah 1 Porsi"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-rose-700 font-bold text-xs">
                  <span className="material-symbols-outlined text-base">warning</span>
                  <span>Menu tidak dapat dipesan (Habis)</span>
                </div>
              )}

              {/* Tombol Aksi Tambah Pesanan */}
              {!isOutOfStock && onAddToCart && (
                <button
                  type="button"
                  onClick={handleConfirmAdd}
                  className="flex-1 sm:flex-initial py-2.5 px-6 rounded-2xl bg-[#003629] hover:bg-[#00261d] active:scale-95 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">add_shopping_cart</span>
                  <span>+ Tambah ke Pesanan</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

