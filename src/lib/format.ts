// Dates are stored in UTC and always shown in Malaysia time.
export const TIMEZONE = "Asia/Kuala_Lumpur";

// The current time for a server-rendered page. Pages here render once per request,
// so reading the clock during render is intended.
export function requestTime() {
  return Date.now();
}

function parts(iso: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return {
    weekday: p.weekday,
    day: Number(p.day),
    month: p.month,
    year: Number(p.year),
    hour: Number(p.hour),
    minute: Number(p.minute),
  };
}

// "2026-10-22": groups slots by Malaysian calendar day.
export function dayKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date(iso));
}

// "Thursday, 22 October"
export function longDay(iso: string) {
  const p = parts(iso);
  return `${p.weekday}, ${p.day} ${p.month}`;
}

// "Thu 22 Oct"
export function shortDay(iso: string) {
  const p = parts(iso);
  return `${p.weekday.slice(0, 3)} ${p.day} ${p.month.slice(0, 3)}`;
}

function clock(iso: string, withMinutes: boolean) {
  const { hour, minute } = parts(iso);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const time = withMinutes || minute !== 0 ? `${h12}:${String(minute).padStart(2, "0")}` : `${h12}`;
  return { time, suffix: hour < 12 ? "am" : "pm" };
}

// "4–5pm"
export function shortTimeRange(startIso: string, endIso: string) {
  const a = clock(startIso, false);
  const b = clock(endIso, false);
  return a.suffix === b.suffix ? `${a.time}–${b.time}${b.suffix}` : `${a.time}${a.suffix}–${b.time}${b.suffix}`;
}

// "4:00 – 5:00pm"
export function timeRange(startIso: string, endIso: string) {
  const a = clock(startIso, true);
  const b = clock(endIso, true);
  return a.suffix === b.suffix ? `${a.time} – ${b.time}${b.suffix}` : `${a.time}${a.suffix} – ${b.time}${b.suffix}`;
}

// "3pm" or "2:30pm"
export function clockLabel(iso: string) {
  const c = clock(iso, false);
  return `${c.time}${c.suffix}`;
}

// "This week" / "Next week" relative to today in Malaysia (weeks start on Monday).
export function weekLabel(iso: string) {
  const toUtcDay = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const today = toUtcDay(dayKey(new Date().toISOString()));
  const monday = today - ((new Date(today).getUTCDay() + 6) % 7) * 86_400_000;
  const offset = Math.floor((toUtcDay(dayKey(iso)) - monday) / (7 * 86_400_000));
  return offset === 0 ? "This week" : offset === 1 ? "Next week" : "";
}

// "Monday 26 October at 9am"
export function openingLabel(iso: string) {
  const p = parts(iso);
  return `${p.weekday} ${p.day} ${p.month} at ${clockLabel(iso)}`;
}
