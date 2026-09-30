import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { api, formatRupiah } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Package, Bike, Home, Phone, Award } from "lucide-react";

const STEPS = [
  { key: "paid", label: "Pesanan Diterima", sub: "Pembayaran terverifikasi", icon: CheckCircle2 },
  { key: "processing", label: "Menyiapkan Sayur Segar", sub: "Ditimbang & dikemas", icon: Package },
  { key: "out_for_delivery", label: "Dalam Perjalanan", sub: "Kurir menuju lokasi Anda", icon: Bike },
  { key: "completed", label: "Pesanan Sampai", sub: "Selamat menikmati!", icon: Home },
];
const RANK = { pending: -1, paid: 0, processing: 1, out_for_delivery: 2, completed: 3, cancelled: -1 };

const courierIcon = L.divIcon({
  className: "",
  html: '<div class="courier-marker"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg></div>',
  iconSize: [36, 36], iconAnchor: [18, 18],
});
const storeIcon = L.divIcon({ className: "", html: '<div class="store-marker">W</div>', iconSize: [30, 30], iconAnchor: [15, 15] });
const homeIcon = L.divIcon({ className: "", html: '<div class="home-marker"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });

function Fit({ route }) {
  const map = useMap();
  useEffect(() => { if (route?.length > 1) map.fitBounds(L.latLngBounds(route), { padding: [40, 40] }); }, [route, map]);
  return null;
}

function pointAlong(route, t) {
  if (!route?.length) return null;
  if (t <= 0) return route[0];
  if (t >= 1) return route[route.length - 1];
  const segs = [];
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    const d = Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
    segs.push(d); total += d;
  }
  let target = t * total;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i]) {
      const f = segs[i] === 0 ? 0 : target / segs[i];
      return [route[i][0] + (route[i + 1][0] - route[i][0]) * f, route[i][1] + (route[i + 1][1] - route[i][1]) * f];
    }
    target -= segs[i];
  }
  return route[route.length - 1];
}

export default function Track() {
  const { orderId } = useParams();
  const [o, setO] = useState(null);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const load = () => api.get(`/orders/${orderId}`).then((r) => setO(r.data)).catch((e) => setErr(e?.response?.data?.detail || "Pesanan tidak ditemukan"));
    load();
    const t = setInterval(load, 5000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(t); clearInterval(tick); };
  }, [orderId]);

  const progress = useMemo(() => {
    if (!o) return 0;
    if (o.status === "completed") return 1;
    if (o.status !== "out_for_delivery" || !o.dispatched_at) return 0;
    const durMs = Math.max(3, (o.duration_min || o.distance_km * 4) * 1.5) * 60 * 1000;
    return Math.min(0.97, (now - new Date(o.dispatched_at).getTime()) / durMs);
  }, [o, now]);

  if (err) return <div className="p-10 text-center text-slate-500">{err}</div>;
  if (!o) return <div className="p-10 text-center text-slate-500">Memuat…</div>;

  const rank = RANK[o.status] ?? -1;
  const route = o.route?.length > 1 ? o.route : [[o.store.lat, o.store.lng], [o.lat, o.lng]];
  const courier = pointAlong(route, progress);
  const etaMin = o.status === "out_for_delivery" ? Math.max(1, Math.round((1 - progress) * Math.max(3, (o.duration_min || 10) * 1.5))) : null;

  const message = o.status === "cancelled" ? "Pesanan dibatalkan." :
    o.status === "pending" ? "Menunggu pembayaran Anda." :
    o.status === "paid" ? "Pesanan diterima! Tim Wiwik Sayur segera menyiapkan." :
    o.status === "processing" ? "Sayur segar sedang ditimbang & dikemas." :
    o.status === "out_for_delivery" ? `Pak Wiwik Express sedang mengantar sayur segar Anda! ETA ±${etaMin} menit.` :
    "Pesanan telah sampai. Terima kasih sudah belanja di Wiwik Sayur!";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Lacak Pesanan</p>
          <h1 data-testid="track-order-id" className="text-2xl sm:text-3xl font-extrabold text-emerald-950 font-mono">{o.order_id}</h1>
        </div>
        <div className="flex items-center gap-2">
          {o.is_priority && <Badge className="loyal-shimmer text-amber-950 border-0 gap-1"><Award className="w-3 h-3" />PELANGGAN SETIA</Badge>}
          <Badge className={o.payment_status === "paid" ? "bg-blue-600" : "bg-slate-400"}>{o.payment_status === "paid" ? "LUNAS" : "BELUM BAYAR"}</Badge>
        </div>
      </div>

      <div data-testid="track-message" className={`mt-4 rounded-2xl p-4 text-sm font-semibold ${o.status === "out_for_delivery" ? "bg-emerald-700 text-white" : "bg-white border border-emerald-900/10 text-emerald-950"}`}>
        {o.status === "out_for_delivery" && <Bike className="inline w-4 h-4 mr-2 animate-bounce" />}{message}
      </div>

      <div className="mt-6 grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 rounded-2xl overflow-hidden border border-emerald-900/10 h-[380px]" data-testid="track-map">
          <MapContainer center={[o.lat, o.lng]} zoom={13} style={{ height: "100%", width: "100%" }}>
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Polyline positions={route} pathOptions={{ color: "#065f46", weight: 5, opacity: 0.35 }} />
            {progress > 0 && <Polyline positions={route.slice(0, Math.max(1, Math.floor(progress * (route.length - 1)) + 1)).concat([courier])} pathOptions={{ color: "#f59e0b", weight: 5 }} />}
            <Marker position={[o.store.lat, o.store.lng]} icon={storeIcon} />
            <Marker position={[o.lat, o.lng]} icon={homeIcon} />
            {rank >= 2 && courier && <Marker position={courier} icon={courierIcon} />}
            <Fit route={route} />
          </MapContainer>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl bg-white border border-emerald-900/10 p-5">
            <ol className="relative space-y-5" data-testid="status-stepper">
              {STEPS.map((s, i) => {
                const done = rank >= i; const active = rank === i; const Icon = s.icon;
                return (
                  <li key={s.key} data-testid={`step-${s.key}`} data-state={done ? (active ? "active" : "done") : "todo"} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-9 h-9 rounded-full grid place-items-center ${done ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"} ${active ? "ring-4 ring-emerald-200 animate-pulse" : ""}`}><Icon className="w-4 h-4" /></div>
                      {i < STEPS.length - 1 && <div className={`w-0.5 flex-1 mt-1 ${rank > i ? "bg-emerald-600" : "bg-slate-200"}`} style={{ minHeight: 20 }} />}
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${done ? "text-emerald-950" : "text-slate-400"}`}>{s.label}</p>
                      <p className="text-xs text-slate-500">{s.sub}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="rounded-2xl bg-white border border-emerald-900/10 p-5 text-sm space-y-2">
            <p className="font-bold text-emerald-950">Rincian</p>
            {o.items.map((it) => (
              <div key={it.product_id} className="flex justify-between"><span>{it.name} <span className="text-slate-500">× {it.quantity_label}</span></span><span className="font-mono">{formatRupiah(it.line_total)}</span></div>
            ))}
            <div className="border-t pt-2 flex justify-between"><span>Ongkir ({o.distance_km} km)</span><span className="font-mono">{o.free_shipping ? "GRATIS" : formatRupiah(o.delivery_fee)}</span></div>
            {o.discount > 0 && <div className="flex justify-between text-emerald-700"><span>Diskon {o.voucher_code}</span><span className="font-mono">− {formatRupiah(o.discount)}</span></div>}
            <div className="flex justify-between font-extrabold text-emerald-950"><span>Total</span><span className="font-mono">{formatRupiah(o.total)}</span></div>
            <p className="text-xs text-slate-500 pt-2">{o.verified_address || o.address}</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="flex-1"><a href="https://wa.me/6285814420843" target="_blank" rel="noreferrer" data-testid="track-wa"><Phone className="w-4 h-4 mr-2" />Hubungi Toko</a></Button>
            <Button asChild variant="outline" className="flex-1"><Link to="/profile">Semua Pesanan</Link></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
