/**
 * Web Audio API notification chime generator
 * Strictly complies with browser autoplay policy:
 * Only plays after at least one user click/touch/keydown interaction; otherwise fails gracefully silently.
 */

let audioCtx: AudioContext | null = null;
let hasUserInteracted = false;

// Global interaction listener
if (typeof window !== 'undefined') {
  const markInteracted = () => {
    hasUserInteracted = true;
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  };
  window.addEventListener('click', markInteracted, { capture: true, passive: true });
  window.addEventListener('keydown', markInteracted, { capture: true, passive: true });
  window.addEventListener('touchstart', markInteracted, { capture: true, passive: true });
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

/**
 * Play a delicate, modern notification sound
 * type: 'message' | 'visitor' | 'prompt'
 */
export function playNotificationSound(type: 'message' | 'visitor' | 'prompt' = 'message'): void {
  if (!hasUserInteracted) {
    // Silent degradation before any user interaction
    return;
  }

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    gainNode.connect(ctx.destination);
    osc1.connect(gainNode);
    osc2.connect(gainNode);

    if (type === 'message') {
      // Gentle two-tone ping
      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

      osc2.frequency.setValueAtTime(659.25, now); // E5
      osc2.frequency.exponentialRampToValueAtTime(1046.5, now + 0.14); // C6

      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.15, now + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.3);
      osc2.stop(now + 0.3);
    } else if (type === 'visitor') {
      // Soft chime for new visitor incoming
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, now);
      osc1.frequency.exponentialRampToValueAtTime(660, now + 0.15);

      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.12, now + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc1.start(now);
      osc1.stop(now + 0.36);
    }
  } catch (e) {
    // Fail silently without breaking UI
    console.debug('Audio play skipped or not allowed', e);
  }
}

let currentVoiceStopFn: (() => void) | null = null;

/**
 * Play realistic WeChat-like speech voice audio simulation
 * durationSeconds: number of seconds to play
 * onEnded: callback invoked when finished
 * returns a stop() function
 */
export function playVoiceSimulation(durationSeconds = 3, onEnded?: () => void): () => void {
  // If an audio is already playing, stop it first
  if (currentVoiceStopFn) {
    currentVoiceStopFn();
    currentVoiceStopFn = null;
  }

  try {
    const ctx = getAudioContext();
    if (!ctx) {
      const timer = setTimeout(() => onEnded?.(), durationSeconds * 1000);
      const stop = () => {
        clearTimeout(timer);
        onEnded?.();
      };
      currentVoiceStopFn = stop;
      return stop;
    }

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gainNode = ctx.createGain();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);

    // Modulate pitch gently to simulate human speech intonation
    const duration = Math.min(Math.max(durationSeconds, 1), 60);
    const stepCount = Math.floor(duration * 4);
    for (let i = 0; i < stepCount; i++) {
      const t = now + (i * duration) / stepCount;
      const f = 190 + Math.sin(i * 1.3) * 45 + (i % 2 === 0 ? 15 : -15);
      osc.frequency.linearRampToValueAtTime(f, t);
    }

    gainNode.gain.setValueAtTime(0.01, now);
    gainNode.gain.linearRampToValueAtTime(0.08, now + 0.1);
    gainNode.gain.setValueAtTime(0.08, now + duration - 0.15);
    gainNode.gain.linearRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);

    let isStopped = false;
    const timer = setTimeout(() => {
      if (!isStopped) {
        isStopped = true;
        currentVoiceStopFn = null;
        onEnded?.();
      }
    }, duration * 1000);

    const stop = () => {
      if (!isStopped) {
        isStopped = true;
        clearTimeout(timer);
        try {
          osc.stop();
        } catch (_) {}
        currentVoiceStopFn = null;
        onEnded?.();
      }
    };

    currentVoiceStopFn = stop;
    return stop;
  } catch (err) {
    console.debug('Failed to play voice simulation:', err);
    const timer = setTimeout(() => onEnded?.(), durationSeconds * 1000);
    return () => clearTimeout(timer);
  }
}

