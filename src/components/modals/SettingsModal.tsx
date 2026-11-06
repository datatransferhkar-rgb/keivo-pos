"use client";

import React, { useState, useEffect } from "react";
import { RestaurantSettings } from "@/types/pos";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RestaurantSettings;
  onSave: (newSettings: RestaurantSettings) => void;
}

const PRESET_LOGOS = [
  {
    name: "Pawon Tradisional",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuBZ38yzMys7rDMMvVwNdnO6Qn2uICUNbqSa-5UoGm10fLVYf6WDkRMOCPeRdtoxJkv8OUADMdxDXPsQzjLKJTHKblLIZvPbTlXyJC3xkOCsKw_cNbNO52ydpmNiSpokMBP8HbWAok_cF18e76XVNvX2CMcM1ZOJ5jFrBg7FzXMvJVJrdNurVe1rUQovs3FiEhVmPwbcngnw5cj9prjV2eg9F67BhB-Yd0e9AGcUPrn8t-DkCnmjVVTI",
  },
  {
    name: "Golden Dine",
    url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=128&auto=format&fit=crop&q=80",
  },
  {
    name: "Bistro Modern",
    url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=128&auto=format&fit=crop&q=80",
  },
];

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
}: SettingsModalProps) {
  const [formData, setFormData] = useState<RestaurantSettings>(settings);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(settings);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setFormData((prev) => ({ ...prev, logoUrl: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(formData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl bg-surface-container-lowest p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary-container text-on-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">storefront</span>
            </div>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                Identitas Restoran &amp; Pengaturan Sistem
              </h2>
              <p className="text-xs text-on-surface-variant">
                Sesuaikan nama restoran, logo brand, dan informasi kasir
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-container text-outline transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 font-body-sm text-body-sm">
          {/* Info Banner */}
          <div className="p-3 bg-secondary-container/20 border border-secondary-container rounded-xl flex items-start gap-2.5">
            <span className="material-symbols-outlined text-secondary text-lg mt-0.5">info</span>
            <span className="text-xs text-on-surface-variant leading-relaxed">
              Nama dan logo yang disimpan akan langsung diterapkan pada seluruh halaman: <strong>Kasir POS</strong>, <strong>Kitchen Display System (KDS)</strong>, <strong>Katalog Digital QR Meja Pelanggan</strong>, dan <strong>Kwitansi Struk</strong>.
            </span>
          </div>

          {/* Restaurant Name & Branch */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="font-label-sm text-label-sm text-on-surface font-semibold block mb-1">
                Nama Restoran <span className="text-error">*</span>:
              </label>
              <input
                type="text"
                required
                value={formData.restaurantName}
                onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 border border-outline-variant"
                placeholder="Contoh: Pawon Nusantara"
              />
            </div>

            <div>
              <label className="font-label-sm text-label-sm text-on-surface font-semibold block mb-1">
                Nama Cabang / Outlet:
              </label>
              <input
                type="text"
                required
                value={formData.branchName}
                onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 border border-outline-variant"
                placeholder="Contoh: Cabang Senopati"
              />
            </div>
          </div>

          {/* Logo Management */}
          <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/40 flex flex-col gap-3">
            <label className="font-label-sm text-label-sm text-on-surface font-semibold block">
              Logo Restoran:
            </label>

            <div className="flex items-center gap-4">
              {/* Logo Preview */}
              <div className="w-16 h-16 rounded-xl bg-white border border-outline-variant flex items-center justify-center p-1.5 shrink-0 shadow-xs overflow-hidden">
                {formData.logoUrl ? (
                  <img
                    src={formData.logoUrl}
                    alt="Logo Preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="material-symbols-outlined text-outline text-3xl">restaurant</span>
                )}
              </div>

              <div className="flex-1 flex flex-col gap-2">
                <input
                  type="text"
                  value={formData.logoUrl}
                  onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                  className="w-full px-3 py-1.5 bg-surface-container-lowest rounded-lg text-on-surface text-xs focus:outline-none border border-outline-variant"
                  placeholder="Ketik atau tempel URL gambar logo..."
                />
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer px-2.5 py-1 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold rounded-md flex items-center gap-1 transition-colors">
                    <span className="material-symbols-outlined text-sm">upload_file</span>
                    <span>Upload File Gambar</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  {formData.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, logoUrl: "" })}
                      className="text-xs text-error hover:underline"
                    >
                      Hapus Logo
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Logo Presets */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-outline">Pilihan Preset:</span>
              <div className="flex gap-2">
                {PRESET_LOGOS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setFormData({ ...formData, logoUrl: p.url })}
                    className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors ${
                      formData.logoUrl === p.url
                        ? "bg-primary text-on-primary border-primary font-bold"
                        : "bg-surface-container-lowest text-on-surface border-outline-variant hover:bg-surface-container"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* POS Terminal & Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-label-sm text-label-sm text-on-surface font-semibold block mb-1">
                Kode Terminal POS:
              </label>
              <input
                type="text"
                value={formData.posTerminal}
                onChange={(e) => setFormData({ ...formData, posTerminal: e.target.value })}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 border border-outline-variant"
                placeholder="POS REG-01"
              />
            </div>
            <div>
              <label className="font-label-sm text-label-sm text-on-surface font-semibold block mb-1">
                No. Telepon / WhatsApp:
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 border border-outline-variant"
                placeholder="0812-3456-7890"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="font-label-sm text-label-sm text-on-surface font-semibold block mb-1">
              Alamat Restoran (Dicetak pada Struk Kwitansi):
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 border border-outline-variant"
              placeholder="Jl. Senopati No. 45, Kebayoran Baru, Jakarta Selatan"
            />
          </div>

          {/* Receipt Footer Message */}
          <div>
            <label className="font-label-sm text-label-sm text-on-surface font-semibold block mb-1">
              Pesan Footer Struk:
            </label>
            <textarea
              rows={2}
              value={formData.receiptFooter}
              onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
              className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 border border-outline-variant resize-none"
              placeholder="Pesan terima kasih di bagian bawah kwitansi..."
            />
          </div>

          {/* Bank & QRIS Labels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="font-label-sm text-label-sm text-on-surface font-semibold block mb-1">
                Label QRIS Statis Kasir:
              </label>
              <input
                type="text"
                value={formData.staticQrLabel}
                onChange={(e) => setFormData({ ...formData, staticQrLabel: e.target.value })}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none border border-outline-variant text-xs"
                placeholder="QRIS Resto (BCA)"
              />
            </div>
            <div>
              <label className="font-label-sm text-label-sm text-on-surface font-semibold block mb-1">
                Instruksi Transfer Bank:
              </label>
              <input
                type="text"
                value={formData.bankTransferInstructions}
                onChange={(e) =>
                  setFormData({ ...formData, bankTransferInstructions: e.target.value })
                }
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none border border-outline-variant text-xs"
                placeholder="BCA 8830-xxxx-xx a/n Resto"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-surface-container-high">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary/90 font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <span>Menyimpan...</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  <span>Simpan Perubahan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
