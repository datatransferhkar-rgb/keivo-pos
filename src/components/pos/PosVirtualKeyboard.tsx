"use client";

import React, { useState, useEffect } from "react";

export interface VirtualKeyboardTarget {
  id: string;
  label: string;
  value: string;
  type?: "text" | "number";
  quickChips?: string[];
  onChange: (value: string) => void;
  onDone?: () => void;
}

interface PosVirtualKeyboardProps {
  target: VirtualKeyboardTarget;
  onClose: () => void;
  soundEnabled?: boolean;
  playClickSound?: () => void;
}

export function PosVirtualKeyboard({
  target,
  onClose,
  soundEnabled = false,
  playClickSound,
}: PosVirtualKeyboardProps) {
  // Local state initialized with target.value to guarantee zero stale closure issues
  const [text, setText] = useState<string>(target.value || "");
  const [isCaps, setIsCaps] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<"qwerty" | "symbols" | "numpad">(
    target.type === "number" ? "numpad" : "qwerty"
  );

  // Sync internal text when target ID changes (user switches inputs)
  useEffect(() => {
    setText(target.value || "");
    if (target.type === "number") {
      setViewMode("numpad");
    }
  }, [target.id]);

  const handleKeyPress = (char: string) => {
    if (soundEnabled && playClickSound) playClickSound();
    const formattedChar = isCaps && viewMode === "qwerty" ? char.toUpperCase() : char.toLowerCase();
    setText((prev) => {
      const next = prev + formattedChar;
      target.onChange(next);
      return next;
    });
  };

  const handleBackspace = () => {
    if (soundEnabled && playClickSound) playClickSound();
    setText((prev) => {
      const next = prev.length > 0 ? prev.slice(0, -1) : "";
      target.onChange(next);
      return next;
    });
  };

  const handleClear = () => {
    if (soundEnabled && playClickSound) playClickSound();
    setText("");
    target.onChange("");
  };

  const handleSpace = () => {
    if (soundEnabled && playClickSound) playClickSound();
    setText((prev) => {
      const next = prev + " ";
      target.onChange(next);
      return next;
    });
  };

  const handleChipClick = (chip: string) => {
    if (soundEnabled && playClickSound) playClickSound();
    setText((prev) => {
      let next = "";
      if (!prev.trim()) {
        next = chip;
      } else {
        const sep = prev.endsWith(" ") || prev.endsWith(",") ? "" : ", ";
        next = prev + sep + chip;
      }
      target.onChange(next);
      return next;
    });
  };

  const handleDone = () => {
    if (soundEnabled && playClickSound) playClickSound();
    target.onDone?.();
    onClose();
  };

  // Keyboard Rows
  const numberRow = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  const qwertyRow1 = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
  const qwertyRow2 = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
  const qwertyRow3 = ["z", "x", "c", "v", "b", "n", "m"];

  const symbolsRow1 = ["+", "-", "*", "/", "=", "%", "#", "@", "&", "$"];
  const symbolsRow2 = ["(", ")", "<", ">", "[", "]", "{", "}", "\\", "|"];
  const symbolsRow3 = ["!", "?", ":", ";", "\"", "'", "_", "~"];

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-40 h-[40%] max-h-[40vh] bg-slate-100/98 backdrop-blur-md border-t-2 border-[#003629] p-2 sm:p-2.5 shadow-2xl flex flex-col justify-between animate-in slide-in-from-bottom-5 duration-200 select-none overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Bar: Target Indicator, Quick Chips & Action Controls (Shrink-0) */}
      <div className="flex items-center justify-between gap-2 px-1 pb-1 border-b border-slate-200/90 shrink-0">
        {/* Left: Input Target Label & Active Live Text */}
        <div className="flex items-center gap-2 min-w-0 flex-shrink-0 max-w-[45%]">
          <span className="w-6 h-6 rounded-lg bg-[#003629] text-white flex items-center justify-center text-xs shrink-0 font-bold shadow-2xs">
            ⌨
          </span>
          <div className="flex flex-col min-w-0 leading-tight">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate">
              {target.label}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200 truncate max-w-[160px] sm:max-w-[220px] shadow-2xs">
                {text ? `"${text}"` : <span className="text-slate-400 italic">Ketik di sini...</span>}
              </span>
            </div>
          </div>
        </div>

        {/* Middle: Quick Chips / Suggestions */}
        {target.quickChips && target.quickChips.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 flex-1 min-w-0">
            {target.quickChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleChipClick(chip)}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-200 text-[#003629] text-xs font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0 shadow-2xs active:scale-95"
              >
                +{chip}
              </button>
            ))}
          </div>
        )}

        {/* Right: Reset & Minimize / Close */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {text.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-600 hover:text-rose-600 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
              title="Bersihkan seluruh teks"
            >
              <span className="material-symbols-outlined text-[14px]">backspace</span>
              <span>Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 border border-slate-200 text-slate-500 hover:text-slate-800 transition-all active:scale-95 cursor-pointer flex items-center justify-center shadow-2xs"
            title="Sembunyikan keyboard"
          >
            <span className="material-symbols-outlined text-base">keyboard_arrow_down</span>
          </button>
        </div>
      </div>

      {/* Keyboard Keys Layout: Full Width & Full Height (Memenuhi 40% area tanpa ruang kosong) */}
      {viewMode === "numpad" ? (
        /* ================= NUMPAD MODE ================= */
        <div className="flex-1 min-h-0 w-full grid grid-cols-4 gap-1.5 sm:gap-2 pt-1.5 pb-0.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "000"].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="h-full rounded-xl bg-white hover:bg-slate-50 active:bg-emerald-100 active:scale-95 text-slate-900 font-extrabold text-lg sm:text-xl transition-all flex items-center justify-center border border-slate-200 shadow-2xs cursor-pointer"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleBackspace}
            className="h-full rounded-xl bg-amber-50 hover:bg-amber-100 active:bg-amber-200 active:scale-95 text-amber-900 font-bold text-sm transition-all flex items-center justify-center border border-amber-200 shadow-2xs cursor-pointer"
            title="Hapus 1 karakter"
          >
            <span className="material-symbols-outlined text-xl">backspace</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("qwerty")}
            className="h-full rounded-xl bg-slate-200/90 hover:bg-slate-300 active:scale-95 text-slate-800 font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center border border-slate-300 shadow-2xs cursor-pointer"
          >
            ABC
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="h-full rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 font-bold text-xs sm:text-sm transition-all flex items-center justify-center border border-rose-200 shadow-2xs cursor-pointer"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleDone}
            className="col-span-2 h-full rounded-xl bg-[#003629] hover:bg-[#004d3b] active:scale-95 text-white font-black text-sm sm:text-base transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer border border-[#00261d]"
          >
            <span className="material-symbols-outlined text-lg">check_circle</span>
            <span>Selesai</span>
          </button>
        </div>
      ) : (
        /* ================= QWERTY & SYMBOLS MODE (MEMENUHI PENUH) ================= */
        <div className="flex-1 min-h-0 w-full flex flex-col gap-1 sm:gap-1.5 pt-1.5 pb-0.5">
          {/* Row 1: Numbers (1 - 0) */}
          <div className="flex-1 min-h-0 flex gap-1 sm:gap-1.5 w-full">
            {numberRow.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleKeyPress(n)}
                className="flex-1 h-full rounded-xl bg-slate-200/70 hover:bg-slate-300 active:bg-emerald-100 active:scale-95 text-slate-800 font-bold text-sm sm:text-base transition-all flex items-center justify-center border border-slate-300/80 shadow-2xs cursor-pointer"
              >
                {n}
              </button>
            ))}
          </div>

          {/* Row 2: Q W E R T Y U I O P */}
          <div className="flex-1 min-h-0 flex gap-1 sm:gap-1.5 w-full">
            {(viewMode === "qwerty" ? qwertyRow1 : symbolsRow1).map((char) => (
              <button
                key={char}
                type="button"
                onClick={() => handleKeyPress(char)}
                className="flex-1 h-full rounded-xl bg-white hover:bg-slate-50 active:bg-emerald-100 active:scale-95 text-slate-900 font-extrabold text-sm sm:text-base transition-all flex items-center justify-center border border-slate-200 shadow-2xs cursor-pointer"
              >
                {isCaps && viewMode === "qwerty" ? char.toUpperCase() : char}
              </button>
            ))}
          </div>

          {/* Row 3: A S D F G H J K L */}
          <div className="flex-1 min-h-0 flex gap-1 sm:gap-1.5 w-full px-2 sm:px-3">
            {(viewMode === "qwerty" ? qwertyRow2 : symbolsRow2).map((char) => (
              <button
                key={char}
                type="button"
                onClick={() => handleKeyPress(char)}
                className="flex-1 h-full rounded-xl bg-white hover:bg-slate-50 active:bg-emerald-100 active:scale-95 text-slate-900 font-extrabold text-sm sm:text-base transition-all flex items-center justify-center border border-slate-200 shadow-2xs cursor-pointer"
              >
                {isCaps && viewMode === "qwerty" ? char.toUpperCase() : char}
              </button>
            ))}
          </div>

          {/* Row 4: Caps + Z X C V B N M + Backspace */}
          <div className="flex-1 min-h-0 flex gap-1 sm:gap-1.5 w-full">
            {viewMode === "qwerty" ? (
              <button
                type="button"
                onClick={() => setIsCaps(!isCaps)}
                className={`flex-[1.3] h-full rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1 border cursor-pointer active:scale-95 shadow-2xs ${
                  isCaps
                    ? "bg-[#003629] text-white border-[#00261d]"
                    : "bg-slate-200 hover:bg-slate-300 text-slate-700 border-slate-300"
                }`}
                title={isCaps ? "Huruf Besar Aktif" : "Huruf Kecil Aktif"}
              >
                <span className="material-symbols-outlined text-base">keyboard_capslock</span>
                <span className="hidden sm:inline">Caps</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setViewMode("qwerty")}
                className="flex-[1.3] h-full rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-black text-xs sm:text-sm transition-all flex items-center justify-center border border-slate-300 cursor-pointer shadow-2xs active:scale-95"
              >
                ABC
              </button>
            )}

            {(viewMode === "qwerty" ? qwertyRow3 : symbolsRow3).map((char) => (
              <button
                key={char}
                type="button"
                onClick={() => handleKeyPress(char)}
                className="flex-1 h-full rounded-xl bg-white hover:bg-slate-50 active:bg-emerald-100 active:scale-95 text-slate-900 font-extrabold text-sm sm:text-base transition-all flex items-center justify-center border border-slate-200 shadow-2xs cursor-pointer"
              >
                {isCaps && viewMode === "qwerty" ? char.toUpperCase() : char}
              </button>
            ))}

            <button
              type="button"
              onClick={handleBackspace}
              className="flex-[1.4] h-full rounded-xl bg-amber-50 hover:bg-amber-100 active:bg-amber-200 active:scale-95 text-amber-900 font-bold transition-all flex items-center justify-center gap-1 border border-amber-200 shadow-2xs cursor-pointer"
              title="Hapus 1 karakter"
            >
              <span className="material-symbols-outlined text-base sm:text-lg">backspace</span>
            </button>
          </div>

          {/* Row 5: Switch Mode, Numpad, Spasi, Selesai (Satu-satunya Tombol Selesai) */}
          <div className="flex-1 min-h-0 flex gap-1 sm:gap-1.5 w-full">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === "qwerty" ? "symbols" : "qwerty")}
              className="flex-[1.2] h-full rounded-xl bg-slate-200/90 hover:bg-slate-300 active:scale-95 text-slate-800 font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center border border-slate-300 shadow-2xs cursor-pointer"
            >
              {viewMode === "qwerty" ? "?123" : "ABC"}
            </button>

            <button
              type="button"
              onClick={() => setViewMode("numpad")}
              className="flex-[1] h-full rounded-xl bg-slate-200/90 hover:bg-slate-300 active:scale-95 text-slate-800 font-extrabold text-xs transition-all flex items-center justify-center gap-0.5 border border-slate-300 shadow-2xs cursor-pointer"
              title="Buka Mode Numpad Angka Besar"
            >
              <span className="material-symbols-outlined text-base">dialpad</span>
              <span className="hidden sm:inline">123</span>
            </button>

            <button
              type="button"
              onClick={() => handleKeyPress("-")}
              className="flex-[0.8] h-full rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-extrabold text-sm flex items-center justify-center border border-slate-200 shadow-2xs cursor-pointer active:scale-95"
            >
              -
            </button>

            {/* Space Bar (Lebar & Terpusat) */}
            <button
              type="button"
              onClick={handleSpace}
              className="flex-[4] h-full rounded-xl bg-white hover:bg-slate-50 active:bg-emerald-100 active:scale-95 text-slate-500 font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center border border-slate-200 shadow-2xs cursor-pointer"
            >
              Spasi
            </button>

            <button
              type="button"
              onClick={() => handleKeyPress(".")}
              className="flex-[0.8] h-full rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-extrabold text-sm flex items-center justify-center border border-slate-200 shadow-2xs cursor-pointer active:scale-95"
            >
              .
            </button>

            {/* SATU-SATUNYA TOMBOL SELESAI */}
            <button
              type="button"
              onClick={handleDone}
              className="flex-[2] h-full rounded-xl bg-[#003629] hover:bg-[#004d3b] active:scale-95 text-white font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer border border-[#00261d]"
            >
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>Selesai</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
