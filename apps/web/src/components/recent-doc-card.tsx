import { FileText } from "lucide-react";

export type RecentDocCardProps = {
  name: string;
  size: number;
  lastModified: number;
  onClick: () => void;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log2(bytes) / 10), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value)} ${units[i]}`;
}

function formatRelativeDate(timestamp: number): string {
  const diffMs = timestamp - Date.now();
  const diffSecs = Math.round(diffMs / 1000);
  const diffMins = Math.round(diffSecs / 60);
  const diffHours = Math.round(diffMins / 60);
  const diffDays = Math.round(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

  if (Math.abs(diffSecs) < 60) return rtf.format(diffSecs, "second");
  if (Math.abs(diffMins) < 60) return rtf.format(diffMins, "minute");
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");
  if (Math.abs(diffDays) < 30) return rtf.format(diffDays, "day");
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(timestamp));
}

export function RecentDocCard({ name, size, lastModified, onClick }: RecentDocCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="sb-pressable group flex w-full items-start gap-3 border border-[var(--sb-color-border)] bg-card p-4 text-left shadow-[4px_4px_0_var(--sb-color-shadow)] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <FileText className="mt-0.5 size-5 shrink-0 text-[var(--sb-color-logo)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="sb-mono truncate text-sm font-semibold leading-snug text-[var(--sb-color-text-strong)]">{name}</p>
        <p className="sb-mono mt-2 text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
          {formatBytes(size)} · {formatRelativeDate(lastModified)}
        </p>
      </div>
    </button>
  );
}
