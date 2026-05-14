import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Compact a hex address to "0x1234…cdef". */
export function shortAddr(a: string | undefined | null, chars = 4): string {
  if (!a) return '';
  if (a.length < 2 + chars * 2) return a;
  return `${a.slice(0, 2 + chars)}…${a.slice(-chars)}`;
}

/** Format a hashrate (hashes/sec) to a human string. */
export function formatHashrate(hps: number): string {
  if (!Number.isFinite(hps) || hps <= 0) return '0 H/s';
  const units = ['H/s', 'kH/s', 'MH/s', 'GH/s', 'TH/s'];
  let i = 0;
  while (hps >= 1000 && i < units.length - 1) {
    hps /= 1000;
    i++;
  }
  return `${hps.toFixed(hps < 10 ? 2 : hps < 100 ? 1 : 0)} ${units[i]}`;
}

/** Format big int (POSCI in 18 decimals) to a short display string. */
export function formatTokens(value: bigint, decimals = 18, fractionDigits = 4): string {
  const negative = value < 0n;
  const v = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const fracRaw = v - whole * base;
  // Pad to `decimals` then trim to `fractionDigits`
  const fracStr = fracRaw.toString().padStart(decimals, '0').slice(0, fractionDigits);
  // Group thousands in whole part
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const trimmedFrac = fracStr.replace(/0+$/, '');
  const out = trimmedFrac.length > 0 ? `${wholeStr}.${trimmedFrac}` : wholeStr;
  return negative ? `-${out}` : out;
}
