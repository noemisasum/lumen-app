export function formatDashboardDate(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

export function isoDateFromLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayIsoDate() {
  return isoDateFromLocalDate(new Date());
}

export function daysBeforeIsoDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() - days);
  return isoDateFromLocalDate(date);
}

export function previousMonthEndIsoDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(1);
  date.setDate(0);
  return isoDateFromLocalDate(date);
}
