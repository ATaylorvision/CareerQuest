import { useEffect, useRef, useState } from "react";
import { Check, Crosshair, Loader2, MapPin, Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/live/api";
import { cn } from "@/lib/utils";

export interface Place {
  /** How it is written down and searched from: "Farmingdale, NY". */
  label: string;
  detail: string;
  lat: number;
  lng: number;
}

interface Props {
  /** What is saved now. */
  value: string;
  /** True once the person has confirmed exactly this place. */
  confirmed: boolean;
  onConfirm: (p: Place) => void | Promise<void>;
  label?: string;
  /** Larger and more explanatory, for the first time someone is asked. */
  prominent?: boolean;
}

/**
 * Where someone lives has to be right, because every search starts from it. So it is never taken as typed:
 * we look the text up, show what we found, and the person confirms it. It also works from a ZIP code, or from
 * the device's own location.
 */
export function PlacePicker({ value, confirmed, onConfirm, label = "Where do you live?", prominent }: Props) {
  const [editing, setEditing] = useState(!confirmed);
  const [text, setText] = useState(value);
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [msg, setMsg] = useState("");
  const seq = useRef(0);

  useEffect(() => {
    if (confirmed) setEditing(false);
  }, [confirmed]);

  const look = async (q: string) => {
    const id = ++seq.current;
    setBusy(true);
    setMsg("");
    try {
      const out = await api<{ places: Place[] }>("jobs/search", { action: "place", q });
      if (id !== seq.current) return;
      setResults(out.places);
      if (out.places.length === 0) setMsg("We could not find that place. Check the spelling, or try your ZIP code.");
    } catch (e) {
      if (id === seq.current) setMsg(e instanceof ApiError ? e.message : "We could not check that just now. Please try again.");
    } finally {
      if (id === seq.current) setBusy(false);
    }
  };

  // Looks as they type, after a pause, so a misspelling shows up before they press anything.
  useEffect(() => {
    if (!editing && confirmed) return;
    const q = text.trim();
    if (q.length < 3) {
      setResults(null);
      return;
    }
    const t = window.setTimeout(() => void look(q), 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, editing, confirmed]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return setMsg("This device cannot share its location. Type your city or ZIP code instead.");
    setLocating(true);
    setMsg("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const out = await api<{ place: Place | null }>("jobs/search", { action: "placeAt", lat: pos.coords.latitude, lng: pos.coords.longitude });
          if (out.place) {
            setResults([out.place]);
            setText(out.place.label);
          } else setMsg("We could not turn that into a US city. Type your city or ZIP code instead.");
        } catch {
          setMsg("We could not check that just now. Type your city or ZIP code instead.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setMsg("We were not allowed to see your location. That is fine: type your city or ZIP code instead.");
      },
      { timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const pick = async (p: Place) => {
    await onConfirm(p);
    setEditing(false);
    setResults(null);
  };

  if (!editing && confirmed) {
    return (
      <div className={cn("flex flex-wrap items-center gap-3 rounded-xl border border-success-border bg-success-soft p-3.5", prominent && "p-4")}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-white">
          <Check className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Home base confirmed</div>
          <div className="font-semibold">{value}</div>
        </div>
        <Button size="sm" variant="outline" onClick={() => { setText(""); setEditing(true); }}>
          <Pencil /> Change
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="place-q" className="mb-1.5 block text-sm font-medium">
          {label}
        </label>
        {prominent && <p className="mb-2 text-sm text-muted-foreground">Everything we show you is measured from here, so we check it with you. Type your city or ZIP code.</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input id="place-q" value={text} onChange={(e) => setText(e.target.value)} placeholder="City, State or ZIP code" className="pl-9" autoComplete="off" />
          </div>
          <Button type="button" variant="outline" onClick={useMyLocation} disabled={locating}>
            {locating ? <Loader2 className="animate-spin" /> : <Crosshair />} Use my location
          </Button>
        </div>
      </div>

      <div aria-live="polite" className="space-y-2">
        {busy && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking that place
          </p>
        )}
        {msg && <p className="text-sm text-warning">{msg}</p>}
        {results && results.length > 0 && (
          <>
            <p className="text-sm font-medium">Is this where you live?</p>
            <ul className="space-y-1.5">
              {results.map((p) => (
                <li key={`${p.label}-${p.lat}`}>
                  <button type="button" onClick={() => void pick(p)} className="flex w-full items-center gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40">
                    <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{p.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{p.detail}</span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-primary">Yes, this one</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
