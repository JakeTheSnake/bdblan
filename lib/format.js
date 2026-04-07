// Small formatting helpers shared by view components.

export function formatDuration(sec) {
  if (sec == null) return '-';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatLongDuration(sec) {
  if (sec == null) return '-';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export function formatPct(x) {
  return `${(x * 100).toFixed(1)}%`;
}

export function formatMatchDate(unixSec) {
  if (!unixSec) return '-';
  return new Date(unixSec * 1000).toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Format a MySQL DATE (which mysql2 returns as a Date object in local time)
// as "Mon DD". Accepts Date, ISO string, or "YYYY-MM-DD".
function formatShortDate(d) {
  if (d == null) return '-';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('sv-SE');
}

export function formatLanDateRange(start, end) {
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}
