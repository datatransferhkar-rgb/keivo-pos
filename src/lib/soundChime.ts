// Utility Web Audio Synthesizer for POS Sound Notifications
// Zero-dependency, offline-ready chime generator using HTML5 Web Audio API

let audioCtx: AudioContext | null = null;
const SOUND_STORAGE_KEY = "keivo_pos_sound_enabled";

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  } catch (e) {
    console.warn("AudioContext initialization warning:", e);
  }
  return audioCtx;
}

/**
 * Resumes / unlocks AudioContext on first touch / click gesture
 * (Satisfies mobile Safari & Chrome autoplay policy)
 */
export function unlockAudioContext(): void {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  } catch (e) {
    // ignore
  }
}

/**
 * Checks whether sound notifications are enabled in POS
 * Defaults to true for optimal restaurant operation awareness
 */
export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const val = localStorage.getItem(SOUND_STORAGE_KEY);
  if (val === null) return true;
  return val === "true";
}

/**
 * Saves sound notification preference
 */
export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SOUND_STORAGE_KEY, enabled ? "true" : "false");
}

/**
 * Plays a pleasant restaurant POS chime for incoming orders
 * Dual-tone chime: D5 (587.33 Hz) -> A5 (880.00 Hz) with warm decay & subtle overtone
 */
export function playOrderChime(): void {
  if (!isSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Tone 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.3, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.45);

    // Tone 2: 880.00 Hz (A5) - slightly delayed "ding-dong"
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880.0, now + 0.16);
    gain2.gain.setValueAtTime(0.001, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.35, now + 0.19);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.16);
    osc2.stop(now + 0.9);

    // Subtle harmonic overtone: 1760 Hz
    const overtone = ctx.createOscillator();
    const overtoneGain = ctx.createGain();
    overtone.type = "triangle";
    overtone.frequency.setValueAtTime(1760.0, now + 0.16);
    overtoneGain.gain.setValueAtTime(0.001, now + 0.16);
    overtoneGain.gain.exponentialRampToValueAtTime(0.08, now + 0.19);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    overtone.connect(overtoneGain);
    overtoneGain.connect(ctx.destination);
    overtone.start(now + 0.16);
    overtone.stop(now + 0.6);
  } catch (err) {
    console.warn("Could not play order chime:", err);
  }
}

/**
 * Plays a short, soft confirmation tone (for table move, payment, or settings)
 */
export function playSuccessChime(): void {
  if (!isSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch (err) {
    console.warn("Could not play success chime:", err);
  }
}

