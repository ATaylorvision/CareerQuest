import { useEffect, useRef, useState } from "react";
import { Check, LayoutTemplate, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface PickerItem {
  id: string;
  name: string;
  blurb: string;
  bestFor: string;
  /** A complete HTML document, rendered small inside an iframe. */
  html: string;
}

/**
 * Picks a page layout. Each thumbnail is the real template rendered with the
 * person's own content and scaled down, because a generic preview picture
 * would not show what their resume actually looks like.
 */
export function TemplatePicker({
  items,
  value,
  onChange,
  label = "Template",
}: {
  items: PickerItem[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const [zoom, setZoom] = useState<PickerItem | null>(null);
  const current = items.find((i) => i.id === value) ?? items[0];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <LayoutTemplate className="h-4 w-4 text-primary" />
          {label}
        </div>
        <span className="text-xs text-muted-foreground">{current?.name}</span>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((t) => {
          const on = t.id === value;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onChange(t.id)}
                aria-pressed={on}
                className={cn(
                  "group relative w-full overflow-hidden rounded-lg border-2 bg-white text-left transition-all",
                  on ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40",
                )}
              >
                <Thumb html={t.html} />
                {on && (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
              </button>
              <div className="mt-1.5 flex items-center justify-between gap-1">
                <span className={cn("truncate text-xs font-medium", on && "text-primary")}>{t.name}</span>
                <button
                  type="button"
                  onClick={() => setZoom(t)}
                  className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={`Preview the ${t.name} layout full size`}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {current && (
        <p className="mt-3 text-sm text-muted-foreground">
          <b className="text-foreground">{current.name}.</b> {current.blurb} <span className="text-muted-foreground/80">{current.bestFor}</span>
        </p>
      )}

      <Dialog open={!!zoom} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{zoom?.name}</DialogTitle>
          </DialogHeader>
          {zoom && (
            <>
              <p className="text-sm text-muted-foreground">
                {zoom.blurb} {zoom.bestFor}
              </p>
              {/* Rendered at real page width and scaled, so the preview shows the
                  columns that will actually print rather than reflowing to the dialog. */}
              <div className="max-h-[65vh] overflow-auto rounded-lg border bg-white">
                <Page html={zoom.html} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setZoom(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    onChange(zoom.id);
                    setZoom(null);
                  }}
                >
                  Use {zoom.name}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Roughly a page at 96dpi, which is what the template CSS is set for. */
const PAGE_W = 794;
const PAGE_H = 1028;

/**
 * A page at its real width, scaled to fit whatever box it is given. Used for
 * both the thumbnails and the large preview so neither one reflows.
 */
export function Page({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = width ? Math.min(1, width / PAGE_W) : 1;
  return (
    <div ref={ref} className="relative w-full overflow-hidden" style={{ height: PAGE_H * scale }}>
      <iframe
        title="Layout preview"
        srcDoc={html}
        sandbox=""
        className="absolute left-0 top-0 border-0 bg-white"
        style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})`, transformOrigin: "top left" }}
      />
    </div>
  );
}

/** A page shrunk to thumbnail size. Sandboxed, so nothing in the markup can run. */
function Thumb({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  // The tile is two columns wide on a phone and five on a desktop, so the
  // shrink factor has to follow the box rather than be guessed once.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = width ? width / PAGE_W : 0.19;
  return (
    <div ref={ref} className="pointer-events-none relative w-full overflow-hidden bg-white" style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}` }}>
      <iframe
        title="Layout preview"
        srcDoc={html}
        sandbox=""
        scrolling="no"
        className="absolute left-0 top-0 border-0 bg-white"
        style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})`, transformOrigin: "top left" }}
      />
    </div>
  );
}
