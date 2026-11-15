"use client";

import React, { useState } from "react";

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
  const [isCaps, setIsCaps] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<"qwerty" | "symbols" | "numpad">(
    target.type === "number" ? "numpad" : "qwerty"
  );

  const handleKeyPress = (char: string) => {
    if (soundEnabled && playClickSound) playClickSound();
    target.onChange(target.value + (isCaps ? char.toUpperCase() : char.toLowerCase()));
  };

  const handleBackspace = () => {
    if (soundEnabled && playClickSound) playClickSound();
    if (target.value.length > 0) {
      target.onChange(target.value.slice(0, -1));
    }
  };

  const handleClear = () => {
    if (soundEnabled && playClickSound) playClickSound();
    target.onChange("");
  };

  const handleSpace = () => {
    if (soundEnabled && playClickSound) playClickSound();
    target.onChange(target.value + " ");
  };

  const handleChipClick = (chip: string) => {
    if (soundEnabled && playClickSound) playClickSound();
    if (!target.value.trim()) {
      target.onChange(chip);
    } else {
      const sep = target.value.endsWith(" ") || target.value.endsWith(",") ? "" : ", ";
      target.onChange(target.value + sep + chip);
    }
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
      className="absolute bottom-0 left-0 right-0 z-40 bg-slate-900/98 backdrop-blur-md border-t-2 border-[#003629] p-2 sm:p-2.5 shadow-2xl flex flex-col gap-1.5 animate-in slide-in-from-bottom-5 duration-200 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Bar: Target Indicator, Quick Chips & Action Controls */}
      <div className="flex items-center justify-between gap-2 px-1 pb-1 border-b border-slate-800">
        {/* Left: Input Label & Active Preview */}
        <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0 max-w-[45%]">
          <span className="w-6 h-6 rounded-lg bg-[#003629] text-emerald-400 flex items-center justify-center text-xs shrink-0 font-bold">
            ⌨
          </span>
          <div className="flex flex-col min-w-0 leading-tight">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">
              {target.label}
            </span>
            <span className="text-xs font-semibold text-white truncate max-w-[150px] sm:max-w-[200px]">
              {target.value ? `"${target.value}"` : <span className="text-slate-500 italic">Ketik di sini...</span>}
            </span>
          </div>
        </div>

        {/* Middle: Quick Chips / Suggestions (if provided) */}
        {target.quickChips && target.quickChips.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5 flex-1 min-w-0">
            {target.quickChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleChipClick(chip)}
                className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 active:bg-[#003629] border border-slate-700 text-slate-200 text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0"
              >
                +{chip}
              </button>
            ))}
          </div>
        )}

        {/* Right: Clear & Done buttons */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {target.value.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[11px] font-bold transition-all cursor-pointer flex items-center gap-0.5"
              title="Bersihkan seluruh teks"
            >
              <span className="material-symbols-outlined text-[13px]">backspace</span>
              <span className="hidden sm:inline">Hapus</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDone}
            className="px-3 py-1 rounded-lg bg-[#003629] hover:bg-[#004d3b] text-white text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">check_circle</span>
            <span>Selesai</span>
          </button>
        </div>
      </div>

      {/* Keyboard Keys Layout */}
      {viewMode === "numpad" ? (
        /* ================= NUMPAD MODE ================= */
        <div className="grid grid-cols-4 gap-1.5 max-w-md mx-auto w-full py-1">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "000"].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="h-10 sm:h-11 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-black text-base sm:text-lg transition-transform flex items-center justify-center border border-slate-700/80 shadow-2xs cursor-pointer"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleBackspace}
            className="h-10 sm:h-11 rounded-xl bg-amber-950/60 hover:bg-amber-900/80 active:scale-95 text-amber-300 font-bold text-sm transition-transform flex items-center justify-center border border-amber-800/80 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">backspace</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("qwerty")}
            className="h-10 sm:h-11 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-bold text-xs transition-transform flex items-center justify-center border border-slate-700 cursor-pointer"
          >
            Abc
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="h-10 sm:h-11 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 active:scale-95 text-rose-300 font-bold text-xs transition-transform flex items-center justify-center border border-rose-800/80 cursor-pointer"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleDone}
            className="col-span-2 h-10 sm:h-11 rounded-xl bg-[#003629] hover:bg-[#004d3b] active:scale-95 text-white font-black text-xs sm:text-sm transition-transform flex items-center justify-center gap-1 shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">check</span>
            <span>Selesai</span>
          </button>
        </div>
      ) : (
        /* ================= QWERTY & SYMBOLS MODE ================= */
        <div className="flex flex-col gap-1 w-full max-w-2xl mx-auto py-0.5">
          {/* Numbers Row */}
          <div className="flex gap-1 justify-center w-full">
            {numberRow.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleKeyPress(n)}
                className="flex-1 h-8 sm:h-9 max-w-[55px] rounded-lg bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs sm:text-sm transition-all flex items-center justify-center border border-slate-700/60 shadow-2xs cursor-pointer"
              >
                {n}
              </button>
            ))}
          </div>

          {/* Row 1 */}
          <div className="flex gap-1 justify-center w-full">
            {(viewMode === "qwerty" ? qwertyRow1 : symbolsRow1).map((char) => (
              <button
                key={char}
                type="button"
                onClick={() => handleKeyPress(char)}
                className="flex-1 h-9 sm:h-10 max-w-[55px] rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-black text-xs sm:text-sm transition-all flex items-center justify-center border border-slate-700/80 shadow-2xs cursor-pointer"
              >
                {isCaps && viewMode === "qwerty" ? char.toUpperCase() : char}
              </button>
            ))}
          </div>

          {/* Row 2 */}
          <div className="flex gap-1 justify-center w-full px-2">
            {(viewMode === "qwerty" ? qwertyRow2 : symbolsRow2).map((char) => (
              <button
                key={char}
                type="button"
                onClick={() => handleKeyPress(char)}
                className="flex-1 h-9 sm:h-10 max-w-[55px] rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-black text-xs sm:text-sm transition-all flex items-center justify-center border border-slate-700/80 shadow-2xs cursor-pointer"
              >
                {isCaps && viewMode === "qwerty" ? char.toUpperCase() : char}
              </button>
            ))}
          </div>

          {/* Row 3 (with Caps Lock & Backspace) */}
          <div className="flex gap-1 justify-center w-full">
            {viewMode === "qwerty" && (
              <button
                type="button"
                onClick={() => setIsCaps(!isCaps)}
                className={`w-10 sm:w-12 h-9 sm:h-10 rounded-lg text-xs font-black transition-all flex items-center justify-center border cursor-pointer ${
                  isCaps
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-2xs"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
                title={isCaps ? "Huruf Besar Aktif" : "Huruf Kecil Aktif"}
              >
                <span className="material-symbols-outlined text-sm">keyboard_capslock</span>
              </button>
            )}

            {(viewMode === "qwerty" ? qwertyRow3 : symbolsRow3).map((char) => (
              <button
                key={char}
                type="button"
                onClick={() => handleKeyPress(char)}
                className="flex-1 h-9 sm:h-10 max-w-[55px] rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-black text-xs sm:text-sm transition-all flex items-center justify-center border border-slate-700/80 shadow-2xs cursor-pointer"
              >
                {isCaps && viewMode === "qwerty" ? char.toUpperCase() : char}
              </button>
            ))}

            <button
              type="button"
              onClick={handleBackspace}
              className="w-10 sm:w-12 h-9 sm:h-10 rounded-lg bg-amber-950/70 hover:bg-amber-900 active:scale-95 text-amber-300 font-bold transition-all flex items-center justify-center border border-amber-800/80 shadow-2xs cursor-pointer"
              title="Hapus 1 karakter"
            >
              <span className="material-symbols-outlined text-base">backspace</span>
            </button>
          </div>

          {/* Row 4 (Space, Switch Mode, Enter) */}
          <div className="flex gap-1 justify-center w-full pt-0.5">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === "qwerty" ? "symbols" : "qwerty")}
              className="w-14 sm:w-16 h-9 sm:h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-bold text-xs transition-all flex items-center justify-center border border-slate-700 cursor-pointer"
            >
              {viewMode === "qwerty" ? "?123" : "ABC"}
            </button>

            <button
              type="button"
              onClick={() => setViewMode("numpad")}
              className="w-10 sm:w-12 h-9 sm:h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-bold text-xs transition-all flex items-center justify-center border border-slate-700 cursor-pointer"
              title="Buka Mode Numpad Angka Besar"
            >
              <span className="material-symbols-outlined text-sm">dialpad</span>
            </button>

            <button
              type="button"
              onClick={() => handleKeyPress("-")}
              className="w-8 sm:w-9 h-9 sm:h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center border border-slate-700 cursor-pointer"
            >
              -
            </button>

            {/* Space Bar */}
            <button
              type="button"
              onClick={handleSpace}
              className="flex-1 max-w-[280px] h-9 sm:h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-400 font-bold text-[11px] uppercase tracking-wider transition-all flex items-center justify-center border border-slate-700 shadow-2xs cursor-pointer"
            >
              Spasi
            </button>

            <button
              type="button"
              onClick={() => handleKeyPress(".")}
              className="w-8 sm:w-9 h-9 sm:h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center border border-slate-700 cursor-pointer"
            >
              .
            </button>

            <button
              type="button"
              onClick={handleDone}
              className="w-20 sm:w-24 h-9 sm:h-10 rounded-lg bg-[#003629] hover:bg-[#004d3b] active:scale-95 text-white font-black text-xs transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">check</span>
              <span>Selesai</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
