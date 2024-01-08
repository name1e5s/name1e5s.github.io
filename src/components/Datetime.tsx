import { TIME_LOCALE } from "@config";

export interface Props {
  datetime: string | Date;
  size?: "sm" | "lg";
  className?: string;
  readingTime?: string;
}

export default function Datetime({
  datetime,
  readingTime,
  size = "sm",
  className,
}: Props) {
  const myDatetime = new Date(datetime);

  const date = myDatetime.toLocaleDateString(TIME_LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return (
    <div className={`flex items-center space-x-2 opacity-80 ${className}`}>
      <span className={`${size === "sm" ? "text-sm" : "text-base"}`}>
        {date} {readingTime && <span>| {readingTime}</span>}
      </span>
    </div>
  );
}
