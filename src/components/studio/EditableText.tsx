import { useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A run of text on the document that can be typed on directly.
 *
 * The value is only read back on blur, so React never re-renders the node while
 * someone is mid-word. That is what keeps the caret where they put it.
 */
export function EditableText({
  value,
  onCommit,
  label,
  className,
  as: Tag = "span",
  multiline,
  placeholder,
  fieldId,
  onLive,
}: {
  value: string;
  onCommit: (next: string) => void;
  label: string;
  className?: string;
  as?: "span" | "p" | "li" | "h2" | "div";
  multiline?: boolean;
  /** Shown in place of nothing, so a blank line is still something you can click. */
  placeholder?: string;
  /** Lets other panels find this line and jump to it. */
  fieldId?: string;
  /** Called with the text as it is typed, and with null once the line is committed. Scoring reads it live. */
  onLive?: (text: string | null) => void;
}) {
  const ref = useRef<HTMLElement>(null);

  const commit = () => {
    const next = (ref.current?.textContent ?? "").replace(/\s+/g, " ").trim();
    if (next !== value) onCommit(next);
    onLive?.(null);
  };

  return (
    <Tag
      ref={ref as never}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      aria-multiline={multiline ? true : undefined}
      tabIndex={0}
      spellCheck
      data-placeholder={placeholder}
      data-field={fieldId}
      onInput={() => onLive?.((ref.current?.textContent ?? "").replace(/\s+/g, " ").trim())}
      onBlur={commit}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
          if (ref.current) ref.current.textContent = value;
          (e.target as HTMLElement).blur();
        }
        // Enter finishes the line rather than starting a new paragraph inside it.
        if (e.key === "Enter" && !multiline) {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
      }}
      className={cn(
        "cursor-text rounded-[3px] outline-none transition-colors",
        "hover:bg-primary/[0.07] focus:bg-primary/[0.07] focus:ring-2 focus:ring-primary/40",
        // The node stays genuinely empty, so typing starts on a clean line.
        placeholder && "empty:before:cursor-text empty:before:italic empty:before:text-neutral-400 empty:before:content-[attr(data-placeholder)]",
        className,
      )}
    >
      {value}
    </Tag>
  );
}
