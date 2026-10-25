import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GemDef, GemResult } from "../types";

/** Pins for every incident and every place a Gem found, plus driving routes. OpenStreetMap tiles need no key. */
export function MapView({ results, gems, center }: { results: GemResult[]; gems: GemDef[]; center: { lat: number; lng: number } }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: false, attributionControl: true }).setView([center.lat, center.lng], 12);
    L.control.zoom({ position: "bottomright" }).addTo(map.current);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    const ro = new ResizeObserver(() => map.current?.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current,
      g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const pts: L.LatLngExpression[] = [];
    const colour = (id?: string) => gems.find((x) => x.id === id)?.color ?? "#6366f1";
    for (const r of results) {
      if (r.route?.polyline?.length) {
        L.polyline(r.route.polyline, { color: colour(r.gemId), weight: 5, opacity: 0.75, dashArray: "10 8" }).addTo(g);
      }
      for (const p of r.pins) {
        if (typeof p.lat !== "number") continue;
        const icon = L.divIcon({
          className: "",
          html: `<span class="pin pin-${p.kind}" style="--c:${colour(p.gemId)}"></span>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        L.marker([p.lat, p.lng], { icon }).bindTooltip(p.label, { direction: "top", offset: [0, -10] }).addTo(g);
        pts.push([p.lat, p.lng]);
      }
    }
    if (pts.length) m.fitBounds(L.latLngBounds(pts).pad(0.35), { maxZoom: 15, animate: true });
  }, [results, gems]);

  return <div className="map" ref={el} />;
}
