import { useState, useEffect } from 'react';

export type DeadlineStatus = 'expired' | 'soon' | 'ok' | 'none';

export interface CountdownResult {
  status: DeadlineStatus;
  formattedTime: string;
  tooltipDate: string;
}

function compute(dueAt: string | null | undefined, lang: string): CountdownResult {
  if (!dueAt) return { status: 'none', formattedTime: '', tooltipDate: '' };
  const date = new Date(dueAt);
  if (isNaN(date.getTime())) return { status: 'none', formattedTime: '', tooltipDate: '' };

  const locale = lang === 'en' ? 'en-US' : 'it-IT';
  const tooltipDate =
    date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }) +
    ', ' +
    date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff <= 0) {
    return { status: 'expired', formattedTime: '', tooltipDate };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let formattedTime: string;
  if (days > 0) {
    formattedTime = `${days}g ${hours}h`;
  } else if (hours > 0) {
    formattedTime = `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    formattedTime = `${minutes}m`;
  } else {
    formattedTime = `${seconds}s`;
  }

  const status: DeadlineStatus = diff < 24 * 60 * 60 * 1000 ? 'soon' : 'ok';
  return { status, formattedTime, tooltipDate };
}

export function useCountdown(dueAt: string | null | undefined, lang: string): CountdownResult {
  const [result, setResult] = useState<CountdownResult>(() => compute(dueAt, lang));

  useEffect(() => {
    setResult(compute(dueAt, lang));
    if (!dueAt) return;
    const interval = setInterval(() => setResult(compute(dueAt, lang)), 30_000);
    return () => clearInterval(interval);
  }, [dueAt, lang]);

  return result;
}
