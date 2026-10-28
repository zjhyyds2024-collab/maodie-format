import clsx from "clsx";

interface ProgressBarProps {
  value: number;
  className?: string;
  variant?: "default" | "success" | "error";
}

export default function ProgressBar({
  value,
  className,
  variant = "default",
}: ProgressBarProps) {
  return (
    <div
      className={clsx(
        "h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--border))]",
        className,
      )}
    >
      <div
        className={clsx(
          "h-full rounded-full transition-all duration-300",
          variant === "default" && "bg-brand-500",
          variant === "success" && "bg-green-500",
          variant === "error" && "bg-red-500",
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
