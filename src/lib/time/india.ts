export function indiaDateString(date = new Date()) {
  const values = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata" }).formatToParts(date);
  const part = (type: string) => values.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function indiaDayBounds(day: string) {
  const next = new Date(`${day}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const nextDay = next.toISOString().slice(0, 10);
  return {
    start: new Date(`${day}T00:00:00+05:30`).toISOString(),
    end: new Date(`${nextDay}T00:00:00+05:30`).toISOString(),
  };
}

export function indiaMonthStart(day = indiaDateString()) {
  return `${day.slice(0, 7)}-01`;
}

export function isDateString(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
