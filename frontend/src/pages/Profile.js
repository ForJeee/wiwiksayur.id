import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatRupiah } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Award, Package, MapPin, Truck, CreditCard } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABEL = {
  pending: { label: "Menunggu Pembayaran", color: "bg-slate-100 text-slate-700" },
  paid: { label: "Dibayar", color: "bg-blue-100 text-blue-800" },
  processing: { label: "Disiapkan", color: "bg-amber-100 text-amber-800" },
  out_for_delivery: { label: "Sedang Diantar", color: "bg-orange-100 text-orange-800" },
  completed: { label: "Selesai", color: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Dibatalkan", color: "bg-red-100 text-red-700" },
};

export default function Profile() {
  const { user } = useApp();
  const nav = useNavigate();
  const [orders, setOrders] = useState([]);

  useEffect(() => { if (user) api.get("/orders/mine").then((r) => setOrders(r.data)).catch(() => {}); }, [user]);

  const payNow = async (orderId) => {
    try {
      const tokRes = await api.post("/payments/midtrans/token", { order_id: orderId, origin: window.location.origin });
      if (tokRes.data.mock) { await api.post(`/payments/midtrans/mock-pay/${orderId}`); nav(`/payment/success?order_id=${orderId}`); return; }
      const scriptUrl = tokRes.data.is_production ? "https://app.midtrans.com/snap/snap.js" : "https://app.sandbox.midtrans.com/snap/snap.js";
      if (!window.snap) {
        const s = document.createElement("script"); s.src = scriptUrl; s.setAttribute("data-client-key", tokRes.data.client_key); document.body.appendChild(s);
        await new Promise((res) => { s.onload = res; });
      }
      window.snap.pay(tokRes.data.token, {
        onSuccess: () => nav(`/payment/success?order_id=${orderId}`),
        onPending: () => nav(`/payment/pending?order_id=${orderId}`),
        onError: () => nav(`/payment/failed?order_id=${orderId}`),
      });
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal membuka pembayaran"); }
  };

  if (!user) return <div className="p-10 text-center text-slate-500">Silakan masuk terlebih dahulu.</div>;

  const progress = Math.min(100, (user.completed_order_count / 10) * 100);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-950 p-6 sm:p-8 text-white overflow-hidden relative">
        <div className="relative z-10 flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur grid place-items-center text-2xl font-bold">{user.name?.[0]?.toUpperCase() || "W"}</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold">{user.name || user.email}</h1>
            <p className="text-white/70 text-sm">{user.email} • {user.phone || "—"}</p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {user.is_pelanggan_setia ? (
                <Badge data-testid="profile-loyal-badge" className="loyal-shimmer text-amber-950 border-0 gap-1"><Award className="w-3.5 h-3.5" />PELANGGAN SETIA</Badge>
              ) : <Badge className="bg-white/15 border-0">Pelanggan Regular</Badge>}
              <span data-testid="order-count" className="text-white/70 text-sm">Pesanan selesai: <b>{user.completed_order_count}</b> / 10</span>
            </div>
            {!user.is_pelanggan_setia && (
              <div className="mt-3 w-full max-w-sm">
                <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-gradient-to-r from-amber-400 to-yellow-300" style={{ width: `${progress}%` }} /></div>
                <p className="text-xs text-white/60 mt-1">{10 - user.completed_order_count} pesanan lagi untuk badge Pelanggan Setia + Prioritas Kirim.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <h2 className="mt-8 text-xl font-bold text-emerald-950 flex items-center gap-2"><Package className="w-5 h-5" /> Pesanan Saya</h2>
      <div className="mt-4 space-y-3">
        {orders.length === 0 && <p className="text-center text-slate-500 py-10">Belum ada pesanan.</p>}
        {orders.map((o) => (
          <div key={o.order_id} data-testid={`order-${o.order_id}`} className="rounded-2xl bg-white border border-emerald-900/10 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-mono text-sm font-bold text-emerald-800">{o.order_id}</p>
                <p className="text-xs text-slate-500">{new Date(o.created_at).toLocaleString("id-ID")}</p>
              </div>
              <div className="flex items-center gap-2">
                {o.is_priority && <Badge className="bg-red-600 pulse-priority">PRIORITY</Badge>}
                <Badge className={STATUS_LABEL[o.status]?.color}>{STATUS_LABEL[o.status]?.label || o.status}</Badge>
              </div>
            </div>
            <div className="mt-3 text-sm text-slate-700">{o.items.map((i) => `${i.name} ${i.quantity_label}`).join(", ")}</div>
            <div className="mt-3 grid sm:grid-cols-3 gap-3 text-sm">
              <div><p className="text-slate-500 text-xs">Jarak / Ongkir</p><p className="font-mono">{o.distance_km} km • {o.free_shipping ? "GRATIS" : formatRupiah(o.delivery_fee)}</p></div>
              <div><p className="text-slate-500 text-xs">Total</p><p className="font-mono font-bold text-emerald-800">{formatRupiah(o.total)}</p></div>
              <div className="flex gap-2 sm:justify-end items-start">
                {o.status === "pending" && <Button size="sm" data-testid={`pay-${o.order_id}`} onClick={() => payNow(o.order_id)} className="bg-emerald-600 hover:bg-emerald-700"><CreditCard className="w-3.5 h-3.5 mr-1" />Bayar</Button>}
                {o.status !== "cancelled" && <Button size="sm" variant="outline" asChild data-testid={`track-${o.order_id}`}><Link to={`/track/${o.order_id}`}><Truck className="w-3.5 h-3.5 mr-1" />Lacak</Link></Button>}
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500 flex items-start gap-1"><MapPin className="w-3.5 h-3.5 mt-0.5" />{o.verified_address || o.address}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
