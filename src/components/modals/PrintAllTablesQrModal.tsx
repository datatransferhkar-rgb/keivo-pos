"use client";

import React, { useState, useEffect, useMemo } from "react";
import QRCode from "qrcode";
import { MasterTable } from "@/types/pos";

interface PrintAllTablesQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: MasterTable[];
  restaurantName?: string;
  branchName?: string;
  logoUrl?: string;
  socials?: {
    instagram?: string;
    showInstagram?: boolean;
    facebook?: string;
    showFacebook?: boolean;
    tiktok?: string;
    showTiktok?: boolean;
  };
}

export function PrintAllTablesQrModal({
  isOpen,
  onClose,
  tables,
  restaurantName = "Pawon Nusantara",
  branchName = "Cabang Senopati",
  logoUrl,
  socials,
}: PrintAllTablesQrModalProps) {
  const [customBaseUrl, setCustomBaseUrl] = useState<string>("");
  const [isEditingUrl, setIsEditingUrl] = useState<boolean>(false);
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [cardLayout, setCardLayout] = useState<"tent" | "compact">("tent");
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  // Initialize base URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      setCustomBaseUrl(window.location.origin);
    }
  }, []);

  // Filtered tables by area
  const filteredTables = useMemo(() => {
    if (selectedArea === "all") return tables;
    return tables.filter((t) => t.area === selectedArea);
  }, [tables, selectedArea]);

  // Batch generate QR codes for all tables
  useEffect(() => {
    if (!isOpen || !customBaseUrl || filteredTables.length === 0) return;

    let isCancelled = false;
    setIsGenerating(true);
    setProgress(0);

    const generateAll = async () => {
      const newMap: Record<string, string> = {};
      const total = filteredTables.length;

      for (let i = 0; i < total; i++) {
        if (isCancelled) return;
        const t = filteredTables[i];
        const token =
          t.qrToken || `tbl-token-${t.tableNumber.toLowerCase().replace(/\s+/g, "-")}-xyz`;
        const url = `${customBaseUrl}/menu/${token}`;

        try {
          const dataUrl = await QRCode.toDataURL(url, {
            width: cardLayout === "tent" ? 400 : 300,
            margin: 1,
            color: {
              dark: "#003629",
              light: "#FFFFFF",
            },
            errorCorrectionLevel: "H",
          });
          newMap[t.id] = dataUrl;
        } catch (err) {
          console.error(`Gagal membuat QR untuk ${t.tableNumber}:`, err);
        }

        setProgress(Math.round(((i + 1) / total) * 100));
      }

      if (!isCancelled) {
        setQrMap(newMap);
        setIsGenerating(false);
      }
    };

    generateAll();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, customBaseUrl, filteredTables, cardLayout]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* ========================================================
          MODAL SCREEN PREVIEW (Hidden during window.print())
         ======================================================== */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs no-print overflow-y-auto">
        <div className="w-full max-w-4xl rounded-3xl bg-surface-container-lowest shadow-2xl flex flex-col border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-150 my-6 max-h-[92vh] overflow-hidden">
          {/* Header Modal */}
          <div className="flex items-center justify-between px-6 py-4 bg-[#003629] text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                <span className="material-symbols-outlined text-2xl text-amber-300">print</span>
              </div>
              <div>
                <h2 className="font-bold text-base leading-snug">
                  Cetak Semua QR Code Meja ({filteredTables.length} Meja)
                </h2>
                <p className="text-[11px] text-emerald-200">
                  Pratinjau cetak massal standing akrilik &amp; stiker meja Pawon Nusantara
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          {/* Options & Filters Toolbar */}
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            {/* Area Filter */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">Filter Area:</span>
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                {[
                  { id: "all", label: "Semua Meja" },
                  { id: "indoor", label: "Indoor AC" },
                  { id: "outdoor", label: "Outdoor" },
                  { id: "vip", label: "VIP" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedArea(opt.id)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                      selectedArea === opt.id
                        ? "bg-[#003629] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Layout Mode */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">Format Cetak:</span>
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setCardLayout("tent")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    cardLayout === "tent"
                      ? "bg-[#003629] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                  title="Kartu berdiri 10x15cm (2 per lembar A4)"
                >
                  <span className="material-symbols-outlined text-xs">picture_in_picture</span>
                  <span>Tent Card Akrilik</span>
                </button>
                <button
                  onClick={() => setCardLayout("compact")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    cardLayout === "compact"
                      ? "bg-[#003629] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                  title="Stiker kompak meja (4 per lembar A4)"
                >
                  <span className="material-symbols-outlined text-xs">grid_view</span>
                  <span>Stiker Sudut Meja</span>
                </button>
              </div>
            </div>

            {/* Host IP toggle */}
            <button
              onClick={() => setIsEditingUrl(!isEditingUrl)}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-primary font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-xs">settings</span>
              <span>{isEditingUrl ? "Tutup Pengaturan IP" : "Atur Host IP / Domain"}</span>
            </button>
          </div>

          {/* Host IP Configuration Input (If expanded) */}
          {isEditingUrl && (
            <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center gap-3 text-xs shrink-0">
              <span className="font-bold text-amber-950 shrink-0">Base URL Resto:</span>
              <input
                type="text"
                value={customBaseUrl}
                onChange={(e) => setCustomBaseUrl(e.target.value)}
                placeholder="http://192.168.1.100:3000"
                className="flex-1 px-3 py-1 rounded-lg border border-amber-300 bg-white font-mono text-xs focus:outline-none focus:border-amber-600"
              />
              <button
                onClick={() => {
                  if (typeof window !== "undefined") {
                    setCustomBaseUrl(window.location.origin);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold text-[10px]"
              >
                Gunakan Origin Browser
              </button>
            </div>
          )}

          {/* Generating progress indicator */}
          {isGenerating && (
            <div className="px-6 py-2 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between text-xs font-bold text-[#003629] shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                <span>Membuat QR Code: {progress}%</span>
              </div>
              <div className="w-36 h-2 bg-emerald-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#003629] transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Preview Scrollable Grid of All Tables */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
            <div
              className={`grid gap-5 ${
                cardLayout === "tent"
                  ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
                  : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
              }`}
            >
              {filteredTables.map((t) => {
                const qrUrl = qrMap[t.id];

                return (
                  <div
                    key={t.id}
                    className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-4 flex flex-col items-center text-center relative overflow-hidden"
                  >
                    {/* Top Accent */}
                    <div className="absolute top-0 inset-x-0 h-1.5 bg-[#003629]" />

                    {/* Branding */}
                    <div className="flex items-center gap-1.5 mt-0.5 mb-1.5">
                      {logoUrl && (
                        <img
                          src={logoUrl}
                          alt={restaurantName}
                          className="w-4 h-4 rounded object-cover"
                        />
                      )}
                      <span className="font-black text-[10px] text-[#003629] tracking-wider uppercase truncate">
                        {restaurantName}
                      </span>
                    </div>

                    {/* Table Pill */}
                    <div className="my-1 px-4 py-1 rounded-full bg-[#003629] text-white flex items-center justify-center">
                      <span className="font-black text-xs uppercase tracking-wide">
                        {t.displayName || t.tableNumber}
                      </span>
                    </div>

                    {/* QR Code */}
                    <div className="my-2 p-2 bg-white rounded-xl border border-slate-200 shadow-inner flex items-center justify-center">
                      {qrUrl ? (
                        <img
                          src={qrUrl}
                          alt={`QR ${t.tableNumber}`}
                          className={cardLayout === "tent" ? "w-36 h-36" : "w-28 h-28"}
                        />
                      ) : (
                        <div className="w-28 h-28 flex items-center justify-center text-slate-300">
                          <span className="material-symbols-outlined text-2xl animate-spin">
                            progress_activity
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Instructions */}
                    <span className="font-black text-[10px] text-slate-900 uppercase">
                      Scan Untuk Pesan
                    </span>

                    {/* Social Media Badges */}
                    {((socials?.showInstagram && socials?.instagram) ||
                      (socials?.showFacebook && socials?.facebook) ||
                      (socials?.showTiktok && socials?.tiktok)) && (
                      <div className="mt-2 pt-1.5 border-t border-slate-100 w-full flex flex-wrap items-center justify-center gap-1 text-[8px] font-bold text-slate-700">
                        {socials?.showInstagram && socials?.instagram && (
                          <span className="bg-pink-50 text-pink-700 px-1.5 py-0.2 rounded border border-pink-200">
                            IG: {socials.instagram}
                          </span>
                        )}
                        {socials?.showFacebook && socials?.facebook && (
                          <span className="bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded border border-blue-200">
                            FB: {socials.facebook}
                          </span>
                        )}
                        {socials?.showTiktok && socials?.tiktok && (
                          <span className="bg-slate-100 text-slate-900 px-1.5 py-0.2 rounded border border-slate-300">
                            TikTok: {socials.tiktok}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-slate-200 gap-3 shrink-0">
            <div className="text-xs text-slate-600">
              Total Siap Cetak: <strong className="text-slate-900">{filteredTables.length} Meja</strong>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handlePrint}
                disabled={isGenerating}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#003629] hover:bg-[#1a4a3e] active:scale-95 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">print</span>
                <span>Cetak Sekarang ({filteredTables.length} Meja)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          PRINT-ONLY AREA (#table-qr-print-area)
          Hanya tampak saat proses cetak window.print()
         ======================================================== */}
      <div id="table-qr-print-area" className="hidden">
        <div
          className={`grid gap-6 ${
            cardLayout === "tent" ? "grid-cols-2" : "grid-cols-3"
          }`}
          style={{ width: "100%" }}
        >
          {filteredTables.map((t) => {
            const qrUrl = qrMap[t.id];

            return (
              <div
                key={t.id}
                className="p-5 bg-white border-2 border-dashed border-slate-400 rounded-2xl flex flex-col items-center text-center page-break-inside-avoid"
                style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
              >
                {/* Header Kartu */}
                <div className="flex items-center gap-2 pb-1.5 mb-2 border-b-2 border-[#003629] w-full justify-center">
                  {logoUrl && (
                    <img
                      src={logoUrl}
                      alt={restaurantName}
                      className="w-5 h-5 rounded object-cover"
                    />
                  )}
                  <div>
                    <h1 className="font-black text-xs text-[#003629] tracking-wider uppercase">
                      {restaurantName}
                    </h1>
                    <p className="text-[8px] text-gray-600 font-bold">{branchName}</p>
                  </div>
                </div>

                {/* Nomor Meja */}
                <div className="my-1.5 px-4 py-1.5 rounded-xl bg-[#003629] text-white flex items-center justify-center w-full">
                  <span className="font-black text-sm tracking-wider uppercase">
                    {t.displayName || t.tableNumber}
                  </span>
                </div>

                {/* QR Code */}
                <div className="my-2 p-2 bg-white border-2 border-black rounded-xl">
                  {qrUrl && (
                    <img
                      src={qrUrl}
                      alt={`QR Code ${t.tableNumber}`}
                      className={cardLayout === "tent" ? "w-44 h-44 object-contain" : "w-32 h-32 object-contain"}
                    />
                  )}
                </div>

                {/* Instruksi */}
                <h2 className="font-black text-xs text-black tracking-wide uppercase mt-0.5">
                  SCAN UNTUK MELIHAT MENU &amp; PESAN
                </h2>
                <p className="text-[9px] text-gray-600 mt-0.5 max-w-[220px]">
                  Pindai QR ini dengan kamera HP untuk memilih menu dan memesan langsung dari meja.
                </p>

                {/* Social Media Handles for Print */}
                {((socials?.showInstagram && socials?.instagram) ||
                  (socials?.showFacebook && socials?.facebook) ||
                  (socials?.showTiktok && socials?.tiktok)) && (
                  <div className="mt-2 pt-1.5 border-t border-gray-300 w-full flex flex-col items-center gap-0.5">
                    <span className="text-[8px] font-bold text-gray-600 tracking-wider uppercase">
                      Media Sosial:
                    </span>
                    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[9px] font-bold text-black">
                      {socials?.showInstagram && socials?.instagram && (
                        <span>IG: {socials.instagram}</span>
                      )}
                      {socials?.showFacebook && socials?.facebook && (
                        <span>FB: {socials.facebook}</span>
                      )}
                      {socials?.showTiktok && socials?.tiktok && (
                        <span>TikTok: {socials.tiktok}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

