"use client";

import React, { useState, useMemo } from "react";
import { formatCurrency } from "@/lib/formatters";
import type { TableCardInfo } from "@/components/pos/PosWorkspace";

interface PindahMejaModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTable: TableCardInfo | null;
  tables: TableCardInfo[];
  onConfirmMove: (sourceTableNumber: string, targetTableNumber: string, notes?: string) => Promise<boolean>;
}

const PRESET_REASONS = [
  "Pindah ke Meja Lebih Besar",
  "Ingin Dekat AC / Lebih Dingin",
  "Pindah ke Area Outdoor / Merokok",
  "Permintaan Langsung Tamu",
  "Meja Asal Dekat Pintu / Berisik",
];

export function PindahMejaModal({
  isOpen,
  onClose,
  sourceTable,
  tables,
  onConfirmMove,
}: PindahMejaModalProps) {
  const [selectedTarget, setSelectedTarget] = useState<TableCardInfo | null>(null);
  const [areaFilter, setAreaFilter] = useState<"all" | "indoor" | "outdoor">("all");
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [customNote, setCustomNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Filter candidate tables that are available (tersedia) and not the source table itself
  const availableTables = useMemo(() => {
    return tables.filter((t) => {
      if (t.status !== "tersedia") return false;
      if (sourceTable && t.tableNumber === sourceTable.tableNumber) return false;
      if (areaFilter !== "all" && t.area !== areaFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = t.tableNumber.toLowerCase().includes(q);
        const matchDisp = t.displayName.toLowerCase().includes(q);
        const matchCap = t.capacity.toString().includes(q);
        if (!matchNum && !matchDisp && !matchCap) return false;
      }
      return true;
    });
  }, [tables, sourceTable, areaFilter, searchQuery]);

  if (!isOpen || !sourceTable) return null;

  const finalReason = [selectedReason, customNote.trim()].filter(Boolean).join(" • ");

  const handleConfirm = async () => {
    if (!selectedTarget) return;
    setIsSubmitting(true);
    try {
      const ok = await onConfirmMove(
        sourceTable.tableNumber,
        selectedTarget.tableNumber,
        finalReason || "Pindah Meja"
      );
      if (ok) {
        setSelectedTarget(null);
        setSelectedReason("");
        setCustomNote("");
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="modal-pindah-meja-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-900 to-[#003629] text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white backdrop-blur-xs border border-white/20">
              <span className="material-symbols-outlined text-2xl">sync_alt</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h3 className="font-headline-sm font-black text-base sm:text-lg text-white leading-tight">
                  Pindah Meja Tamu (Transfer Table)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-emerald-950 text-[10px] font-black uppercase tracking-wide">
                  Operasional
                </span>
              </div>
              <p className="text-xs text-white/80 leading-tight mt-0.5">
                Pindahkan sesi aktif, pesanan makanan, dan tagihan ke meja tujuan yang tersedia
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-4">

          {/* Transfer Visual Flow Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
            {/* Meja Asal (Source) */}
            <div className="flex-1 w-full bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Meja Asal (Sekarang)
              </span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-headline-sm font-black text-lg text-slate-900">
                  {sourceTable.displayName || sourceTable.tableNumber}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 text-xs font-bold">
                  {sourceTable.statusLabel || "Terisi"}
                </span>
              </div>
              <div className="text-xs text-slate-600 mt-1 flex flex-col gap-0.5">
                <div className="flex items-center gap-1 font-semibold text-slate-800">
                  <span className="material-symbols-outlined text-xs text-slate-500">person</span>
                  <span>{sourceTable.customerName || "Tamu Restoran"}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{sourceTable.areaLabel} ({sourceTable.capacity} Kursi)</span>
                  {sourceTable.amount && sourceTable.amount > 0 ? (
                    <span className="font-bold text-[#006e33]">
                      {formatCurrency(sourceTable.amount)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Transfer Arrow Icon */}
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-[#003629] flex items-center justify-center shrink-0 border border-emerald-300 shadow-xs">
              <span className="material-symbols-outlined text-xl">arrow_forward</span>
            </div>

            {/* Meja Tujuan (Target) */}
            <div className={`flex-1 w-full p-3 rounded-xl border shadow-2xs flex flex-col transition-all ${
              selectedTarget
                ? "bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20"
                : "bg-white border-dashed border-slate-300"
            }`}>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Meja Tujuan (Baru)
              </span>
              {selectedTarget ? (
                <>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-headline-sm font-black text-lg text-emerald-950">
                      {selectedTarget.displayName || selectedTarget.tableNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#e8f7ee] text-[#006e33] text-xs font-bold border border-[#a6e6b8]">
                      Tersedia
                    </span>
                  </div>
                  <div className="text-xs text-emerald-900 mt-1 flex flex-col gap-0.5">
                    <span className="font-semibold">{selectedTarget.areaLabel}</span>
                    <span className="text-[11px] text-emerald-700">Kapasitas {selectedTarget.capacity} Tamu</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-2 text-center text-slate-400">
                  <span className="material-symbols-outlined text-2xl text-slate-300">touch_app</span>
                  <span className="text-xs font-bold mt-1">Pilih meja tersedia di bawah</span>
                </div>
              )}
            </div>
          </div>

          {/* Target Table Selector Header & Filters */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Pilih Meja Tujuan:
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                  {availableTables.length} Meja Tersedia
                </span>
              </div>

              {/* Area Filters */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setAreaFilter("all")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    areaFilter === "all"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setAreaFilter("indoor")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    areaFilter === "indoor"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Indoor AC
                </button>
                <button
                  type="button"
                  onClick={() => setAreaFilter("outdoor")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    areaFilter === "outdoor"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Outdoor
                </button>
              </div>
            </div>

            {/* Available Tables Grid (Touch-friendly 48px+ Cards) */}
            {availableTables.length === 0 ? (
              <div className="py-8 px-4 rounded-2xl bg-slate-50 border border-slate-200 text-center flex flex-col items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-slate-400 mb-1">table_bar</span>
                <p className="text-sm font-bold text-slate-700">Tidak ada meja yang tersedia</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Semua meja lain di restoran saat ini sedang terisi atau reservasi.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1 scrollbar-thin">
                {availableTables.map((t) => {
                  const isChosen = selectedTarget?.tableNumber === t.tableNumber;
                  return (
                    <button
                      key={t.id || t.tableNumber}
                      type="button"
                      onClick={() => setSelectedTarget(t)}
                      className={`relative p-3 rounded-2xl border text-left flex flex-col justify-between min-h-[76px] transition-all cursor-pointer active:scale-95 ${
                        isChosen
                          ? "bg-emerald-50 border-[#006e33] ring-2 ring-[#006e33]/25 shadow-sm"
                          : "bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {isChosen && (
                        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#006e33] text-white flex items-center justify-center text-xs font-black shadow-xs">
                          ✓
                        </span>
                      )}
                      <div>
                        <span className="font-headline-sm font-black text-base text-slate-900 block leading-tight">
                          {t.displayName || t.tableNumber}
                        </span>
                        <span className="text-[11px] text-slate-500 mt-0.5 block truncate">
                          {t.areaLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
                        <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-slate-400">group</span>
                          <span>{t.capacity} Tamu</span>
                        </span>
                        <span className="text-[10px] font-black text-[#006e33] uppercase">
                          Tersedia
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Alasan / Catatan Pindah Meja */}
          <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span>Alasan Pindah Meja (Opsional):</span>
              <span className="text-[10px] text-slate-400 font-normal">Tercatat di riwayat</span>
            </label>

            {/* Reason Presets */}
            <div className="flex flex-wrap gap-1.5">
              {PRESET_REASONS.map((r) => {
                const isActive = selectedReason === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedReason(isActive ? "" : r)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#003629] text-white font-bold shadow-2xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>

            {/* Custom Notes Input */}
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Catatan tambahan (contoh: minta tambahan 2 kursi, dekat stopkontak)..."
              className="w-full px-3 py-2 bg-slate-50 focus:bg-white rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-primary transition-all"
            />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="py-3 px-4 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs sm:text-sm cursor-pointer transition-all active:scale-95"
          >
            Batal
          </button>

          <button
            type="button"
            id="btn-confirm-pindah-meja"
            onClick={handleConfirm}
            disabled={!selectedTarget || isSubmitting}
            className="flex-1 py-3 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer bg-[#003629] hover:bg-[#00261d] active:scale-[0.99] text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                <span>Memproses Pindah Meja...</span>
              </>
            ) : selectedTarget ? (
              <>
                <span className="material-symbols-outlined text-base">sync_alt</span>
                <span>
                  Konfirmasi: Pindah dari {sourceTable.tableNumber} ke {selectedTarget.tableNumber}
                </span>
              </>
            ) : (
              <span>Pilih Meja Tujuan Terlebih Dahulu</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}

