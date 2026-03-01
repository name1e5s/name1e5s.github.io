const FULL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const MEDIUM_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(
  value: Date | string,
  style: "YYYY" | "full" | "long" | "medium" = "medium",
): string {
  const date = toDate(value);
  if (style === "YYYY") {
    return String(date.getUTCFullYear());
  }
  if (style === "full" || style === "long") {
    return FULL_FORMATTER.format(date);
  }
  return MEDIUM_FORMATTER.format(date);
}

export function formatDateOnly(value: Date | string): string {
  const date = toDate(value);
  const day = date.getUTCDate();
  const remainder10 = day % 10;
  const remainder100 = day % 100;

  let suffix = "th";
  if (remainder10 === 1 && remainder100 !== 11) suffix = "st";
  else if (remainder10 === 2 && remainder100 !== 12) suffix = "nd";
  else if (remainder10 === 3 && remainder100 !== 13) suffix = "rd";

  const month = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(date);
  return `${month} ${day}${suffix}`;
}
