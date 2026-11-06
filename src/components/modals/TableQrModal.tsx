"use client";

import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { MasterTable } from "@/types/pos";

interface TableQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: MasterTable | null;
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

export function TableQrModal({
  isOpen,
  onClose,
  table,
  restaurantName = "Pawon Nusantara",
  branchName = "Cabang Senopati",
  logoUrl,
  socials,
}: TableQrModalProps) {
  const [customBaseUrl, setCustomBaseUrl] = useState<string>("");
  const [isEditingUrl, setIsEditingUrl] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Initialize base URL from window.location.origin
  useEffect(() => {
    if (typeof window !== "undefined") {
      setCustomBaseUrl(window.location.origin);
    }
  }, []);

  // Compute table token & full order URL
  const tableToken =
    table?.qrToken ||
    (table ? `tbl-token-${table.tableNumber.toLowerCase().replace(/\s+/g, "-")}-xyz` : "");
  const orderUrl = customBaseUrl ? `${customBaseUrl}/menu/${tableToken}` : "";

  // Generate QR Code data URL
  useEffect(() => {
    if (!isOpen || !orderUrl) return;

    let isMounted = true;
    setIsGenerating(true);

    QRCode.toDataURL(orderUrl, {
      width: 450,
      margin: 1,
      color: {
        dark: "#003629", // Pawon Nusantara Signature Emerald
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "H",
    })
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        console.error("Gagal membuat QR Code:", err);
        if (isMounted) setIsGenerating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, orderUrl]);

  if (!isOpen || !table) return null;

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(orderUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `QR_${table.tableNumber.replace(/\s+/g, "_")}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* ========================================================
          MODAL DIALOG (On-Screen View)
         ======================================================== */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs no-print overflow-y-auto">
        <div className="w-full max-w-lg rounded-3xl bg-surface-container-lowest shadow-2xl flex flex-col border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-150 my-6 overflow-hidden">
          {/* Header Modal */}
          <div className="flex items-center justify-between px-6 py-4 bg-[#003629] text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                <span className="material-symbols-outlined text-2xl text-amber-300">qr_code_2</span>
              </div>
              <div>
                <h2 className="font-bold text-base leading-snug">
                  QR Code Meja • {table.displayName || table.tableNumber}
                </h2>
                <p className="text-[11px] text-emerald-200">
                  Pindai QR ini langsung mengarah ke pemesanan {table.tableNumber}
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

          {/* Modal Body */}
          <div className="p-6 flex flex-col items-center gap-5 max-h-[75vh] overflow-y-auto">
            {/* Kartu Desain Akrilik / Tent Card Meja Preview */}
            <div className="w-full max-w-sm rounded-2xl border-2 border-[#003629]/20 bg-white shadow-md p-5 flex flex-col items-center text-center relative overflow-hidden">
              {/* Top Accent Bar */}
              <div className="absolute top-0 inset-x-0 h-2 bg-[#003629]" />

              {/* Resto Branding */}
              <div className="flex items-center gap-2 mt-1 mb-2">
                {logoUrl ? (
                  <img src={logoUrl} alt={restaurantName} className="w-6 h-6 rounded-md object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-xl text-[#003629]">restaurant</span>
                )}
                <div className="text-left">
                  <h3 className="font-black text-xs text-[#003629] tracking-wide uppercase">
                    {restaurantName}
                  </h3>
                  <p className="text-[9px] text-slate-500 font-medium">{branchName}</p>
                </div>
              </div>

              {/* Table Number Pill */}
              <div className="my-2 px-5 py-1.5 rounded-full bg-[#003629] text-white flex items-center gap-2 shadow-xs">
                <span className="material-symbols-outlined text-sm text-amber-300">table_restaurant</span>
                <span className="font-black text-sm tracking-wider uppercase">
                  {table.displayName || table.tableNumber}
                </span>
                <span className="text-[10px] text-emerald-200 font-semibold border-l border-white/30 pl-2">
                  {table.area === "indoor"
                    ? "Indoor AC"
                    : table.area === "outdoor"
                      ? "Outdoor"
                      : table.area === "vip"
                        ? "VIP"
                        : "Smoking"}
                </span>
              </div>

              {/* QR Image Box */}
              <div className="relative my-3 p-3 bg-white rounded-2xl border-2 border-slate-200 shadow-inner flex items-center justify-center">
                {isGenerating || !qrDataUrl ? (
                  <div className="w-56 h-56 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <span className="material-symbols-outlined text-3xl animate-spin text-[#003629]">
                      progress_activity
                    </span>
                    <span className="text-xs font-semibold">Membuat QR Code...</span>
                  </div>
                ) : (
                  <img
                    src={qrDataUrl}
                    alt={`QR Code ${table.tableNumber}`}
                    className="w-56 h-56 object-contain rounded-lg"
                  />
                )}
              </div>

              {/* Scanning Instructions */}
              <div className="flex flex-col gap-1 items-center">
                <h4 className="font-black text-xs text-slate-900 uppercase tracking-wide">
                  Pindai QR Untuk Memesan
                </h4>
                <p className="text-[10px] text-slate-500 max-w-[240px] leading-relaxed">
                  Arahkan kamera smartphone ke QR Code untuk membuka menu &amp; pesan makanan langsung dari meja Anda.
                </p>
              </div>

              {/* 3 Step Icons */}
              <div className="grid grid-cols-3 gap-2 w-full pt-3 mt-3 border-t border-slate-100 text-[9px] font-bold text-slate-600">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="material-symbols-outlined text-sm text-[#003629]">photo_camera</span>
                  <span>1. Buka Kamera</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="material-symbols-outlined text-sm text-[#003629]">qr_code_scanner</span>
                  <span>2. Scan QR</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="material-symbols-outlined text-sm text-[#003629]">restaurant_menu</span>
                  <span>3. Pesan Menu</span>
                </div>
              </div>

              {/* Social Media Badges (Jika Diaktifkan) */}
              {((socials?.showInstagram && socials?.instagram) ||
                (socials?.showFacebook && socials?.facebook) ||
                (socials?.showTiktok && socials?.tiktok)) && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 w-full flex flex-col items-center gap-1.5">
                    <span className="text-[9px] font-black tracking-wider text-slate-500 uppercase">
                      Ikuti Media Sosial Kami:
                    </span>
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      {socials?.showInstagram && socials?.instagram && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 font-bold text-[9px] border border-pink-200">
                          <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                          </svg>
                          <span>{socials.instagram}</span>
                        </span>
                      )}
                      {socials?.showFacebook && socials?.facebook && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[9px] border border-blue-200">
                          <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                          </svg>
                          <span>{socials.facebook}</span>
                        </span>
                      )}
                      {socials?.showTiktok && socials?.tiktok && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-900 font-bold text-[9px] border border-slate-300">
                          <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                          </svg>
                          <span>{socials.tiktok}</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
            </div>

            {/* URL & Network Settings Box */}
            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-primary">link</span>
                  <span>Tautan Langsung Pemesanan Meja:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingUrl(!isEditingUrl)}
                  className="text-[10px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-0.5"
                >
                  <span className="material-symbols-outlined text-xs">tune</span>
                  <span>{isEditingUrl ? "Selesai" : "Ubah IP / Host"}</span>
                </button>
              </div>

              {isEditingUrl ? (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-500 font-medium">
                    Host / Alamat IP Restoran (contoh: http://192.168.1.50:3000 jika via WiFi lokal)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={customBaseUrl}
                      onChange={(e) => setCustomBaseUrl(e.target.value)}
                      placeholder="http://192.168.1.100:3000"
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-mono text-slate-800 focus:outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          setCustomBaseUrl(window.location.origin);
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 text-xs">
                  <span className="font-mono text-slate-700 text-[11px] truncate select-all">
                    {orderUrl}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all"
                      title="Salin tautan ke clipboard"
                    >
                      <span className="material-symbols-outlined text-xs">
                        {copied ? "check" : "content_copy"}
                      </span>
                      <span>{copied ? "Tersalin!" : "Salin"}</span>
                    </button>
                    <a
                      href={orderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#003629] font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all border border-emerald-200"
                      title="Buka halaman menu pemesanan meja ini di tab baru untuk mencoba pemesanan"
                    >
                      <span className="material-symbols-outlined text-xs">open_in_new</span>
                      <span>Buka Menu</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              Tutup
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={!qrDataUrl}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold border border-slate-300 transition-all cursor-pointer disabled:opacity-50"
                title="Unduh gambar QR dalam format PNG"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                <span>Unduh PNG</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                disabled={!qrDataUrl}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#003629] hover:bg-[#1a4a3e] active:scale-95 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                <span>Cetak QR Meja</span>
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
        <div className="max-w-[400px] mx-auto p-6 bg-white border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center text-center">
          {/* Header Kartu */}
          <div className="flex items-center gap-2 pb-2 mb-2 border-b-2 border-[#003629] w-full justify-center">
            {logoUrl && <img src={logoUrl} alt={restaurantName} className="w-8 h-8 rounded object-cover" />}
            <div>
              <h1 className="font-black text-base text-[#003629] tracking-wider uppercase">
                {restaurantName}
              </h1>
              <p className="text-[10px] text-gray-600 font-bold">{branchName}</p>
            </div>
          </div>

          {/* Nomor Meja Stand-out */}
          <div className="my-2 px-6 py-2 rounded-xl bg-[#003629] text-white flex items-center justify-center gap-2 w-full">
            <span className="font-black text-xl tracking-wider uppercase">
              {table.displayName || table.tableNumber}
            </span>
            <span className="text-xs text-amber-200 font-bold border-l border-white/30 pl-2">
              {table.area === "indoor"
                ? "Indoor AC"
                : table.area === "outdoor"
                  ? "Outdoor"
                  : table.area === "vip"
                    ? "Gazebo VIP"
                    : "Smoking Area"}
            </span>
          </div>

          {/* QR Code Cetak */}
          <div className="my-3 p-3 bg-white border-2 border-black rounded-xl">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt={`QR Code ${table.tableNumber}`}
                className="w-64 h-64 object-contain"
              />
            )}
          </div>

          {/* Instruksi */}
          <h2 className="font-black text-sm text-black tracking-wide uppercase mt-1">
            SCAN UNTUK MELIHAT MENU &amp; MEMESAN
          </h2>
          <p className="text-[11px] text-gray-700 mt-1 max-w-[280px]">
            Arahkan kamera HP Anda ke QR Code untuk memilih menu dan mengirim pesanan langsung ke kasir &amp; dapur.
          </p>

          {/* Social Media Handles for Print */}
          {((socials?.showInstagram && socials?.instagram) ||
            (socials?.showFacebook && socials?.facebook) ||
            (socials?.showTiktok && socials?.tiktok)) && (
              <div className="mt-3 pt-2 border-t border-gray-300 w-full flex flex-col items-center gap-0.5">
                <span className="text-[9px] font-bold text-gray-600 tracking-wider uppercase">
                  Ikuti Media Sosial Kami:
                </span>
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[10px] font-bold text-black">
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
      </div>
    </>
  );
}

