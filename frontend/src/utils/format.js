/** "2026-11-03" -> "Tue, 3 Nov 2026" (parsed as a local date, so it never shifts a day). */
export function formatDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return date || '';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** "17:05" -> "5:05 PM" */
export function formatTime(time) {
  const match = /^(\d{2}):(\d{2})$/.exec(time || '');
  if (!match) return time || '';
  const h = Number(match[1]);
  return `${h % 12 || 12}:${match[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

export function formatMoney(amount) {
  const value = Number(amount) || 0;
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** Price per person; falls back to totalCost / seats for rides created before per-person pricing. */
export function pricePerSeatOf(ride) {
  if (typeof ride?.pricePerSeat === 'number') return ride.pricePerSeat;
  return ride?.seats ? Math.round((Number(ride.totalCost) || 0) / ride.seats) : 0;
}

/** Today's date in IST as YYYY-MM-DD (for <input type="date" min>). */
export function todayIST() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
