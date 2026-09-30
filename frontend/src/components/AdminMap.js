import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { formatRupiah } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

const storeIcon = L.divIcon({ className: "", html: '<div class="store-marker">W</div>', iconSize: [30, 30], iconAnchor: [15, 15] });
const mk = (priority, done) => L.divIcon({ className: "", html: `<div class="home-marker" style="background:${done ? "#94a3b8" : priority ? "#dc2626" : "#2563eb"}"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] });

export const gmapsLink = (o, store) => `https://www.google.com/maps/dir/?api=1&origin=${store.lat},${store.lng}&destination=${o.lat},${o.lng}&travelmode=driving`;

function Fit({ points }) {
  const map = useMap();
  useEffect(() => { if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40] }); }, [points.length, map]);
  return null;
}

export default function AdminMap({ orders, store }) {
  const active = orders.filter((o) => o.lat && o.lng && !["cancelled"].includes(o.status));
  const points = [[store.lat, store.lng], ...active.map((o) => [o.lat, o.lng])];
  return (
    <div className="rounded-2xl overflow-hidden border border-emerald-900/10 h-[520px]" data-testid="admin-map">
      <MapContainer center={[store.lat, store.lng]} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[store.lat, store.lng]} icon={storeIcon}><Popup><b>{store.name}</b><br />{store.lat}, {store.lng}</Popup></Marker>
        {active.map((o) => (
          <Marker key={o.order_id} position={[o.lat, o.lng]} icon={mk(o.is_priority, o.status === "completed")}>
            <Popup>
              <div className="text-xs space-y-1 min-w-[200px]">
                <p className="font-mono font-bold text-emerald-800">{o.order_id}</p>
                {o.is_priority && <Badge className="bg-red-600 text-[10px]">⚡ DIDAHULUKAN</Badge>}
                <p><b>{o.customer_name}</b> • {o.recipient_phone}</p>
                <p className="text-slate-600">{o.verified_address || o.address}</p>
                <p className="font-mono">{o.lat.toFixed(6)}, {o.lng.toFixed(6)}</p>
                <p><b>{o.distance_km} km</b> • {formatRupiah(o.total)} • {o.status}</p>
                <a data-testid={`gmaps-${o.order_id}`} href={gmapsLink(o, store)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-700 font-bold underline"><ExternalLink className="w-3 h-3" />Buka Rute di Google Maps</a>
              </div>
            </Popup>
          </Marker>
        ))}
        <Fit points={points} />
      </MapContainer>
    </div>
  );
}
