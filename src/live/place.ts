import type { Place } from "@/components/PlacePicker";
import { setHomePoint } from "./mapJob";
import { supabase } from "./supabase";

/**
 * Saves a place the person has confirmed, with the coordinates we found for exactly that text.
 * Anything measured from home (matches, distance, the search itself) reads these.
 */
export async function saveConfirmedPlace(p: Place): Promise<boolean> {
  if (!supabase) return false;
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return false;
  const { error } = await supabase
    .from("profiles")
    // The saved list of places is cleared, so the next search measures from this one.
    .update({ location: p.label, home_lat: p.lat, home_lng: p.lng, home_geocoded_for: p.label, anchors: [] })
    .eq("id", uid);
  if (error) return false;
  setHomePoint({ lat: p.lat, lng: p.lng });
  return true;
}
