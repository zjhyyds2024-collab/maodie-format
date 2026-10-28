import { ChevronDown } from "lucide-react";
import type { FileCategory } from "../converters/types";
import { getOutputFormats, getSourceFormats } from "../converters/formats";

interface FormatDropdownProps {
  category: FileCategory;
  value: string;
  onChange: (format: string) => void;
  disabled?: boolean;
  extension?: string;
  allowedFormats?: string[];
}

export default function FormatDropdown({
  category,
  value,
  onChange,
  disabled,
  extension,
  allowedFormats,
}: FormatDropdownProps) {
  const formats = (extension ? getSourceFormats(extension, category) : getOutputFormats(category)).filter(f => !allowedFormats || allowedFormats.includes(f.ext));

  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="appearance-none rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] py-1.5 pl-3 pr-8 text-sm font-medium text-[rgb(var(--fg))] transition-colors hover:border-brand-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {formats.map((f) => (
          <option key={f.ext} value={f.ext}>
            {f.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 text-[rgb(var(--muted))]"
      />
    </div>
  );
}
