import React, { useEffect, useState } from "react";
import { useSearchParams, Link, useLocation } from "react-router-dom";
import { api, formatRupiah } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, XCircle, Truck, RotateCcw } from "lucide-react";

const VIEW = {
  success: { icon: CheckCircle2, color: "text-emerald-600", bg: "from-emerald-50", title: "Pembayaran Berhasil!", desc: "Pesanan Anda sudah masuk ke dapur Wiwik Sayur dan segera disiapkan." },
  pending: { icon: Clock, color: "text-amber-600", bg: "from-amber-50", title: "Menunggu Pembayaran", desc: "Selesaikan pembayaran Anda. Status akan diperbarui otomatis." },
  failed: { icon: XCircle, color: "text-red-600", bg: "from-red-50", title: "Pembayaran Gagal", desc: "Transaksi tidak berhasil. Anda bisa mencoba membayar lagi dari halaman pesanan." },
};

export default function PaymentResult() {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const kind = pathname.split("/").pop();
  const orderId = params.get("order_id");
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!orderId) return;
    let stop = false;
    const poll = async () => {
      try { const r = await api.get(`/payments/status/${orderId}`); if (!stop) setStatus(r.data); } catch {}
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => { stop = true; clearInterval(t); };
  }, [orderId]);

  const effective = status?.payment_status === "paid" ? "success" : status?.status === "cancelled" ? "failed" : kind;
  const v = VIEW[effective] || VIEW.pending;
  const Icon = v.icon;

  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <div data-testid={`payment-${effective}`} className={`rounded-3xl bg-gradient-to-b ${v.bg} to-white border border-emerald-900/10 p-10`}>
        <Icon className={`w-20 h-20 mx-auto ${v.color}`} />
        <h1 className="mt-6 text-3xl font-extrabold text-emerald-950">{v.title}</h1>
        <p className="mt-2 text-slate-600">{v.desc}</p>
        {orderId && (
          <div className="mt-6 rounded-xl bg-white border p-4 text-sm text-left space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Order ID</span><span data-testid="result-order-id" className="font-mono font-bold text-emerald-800">{orderId}</span></div>
            {status && <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-mono font-bold">{formatRupiah(status.total)}</span></div>}
            {status && <div className="flex justify-between"><span className="text-slate-500">Status bayar</span><span data-testid="result-payment-status" className="font-bold uppercase">{status.payment_status}</span></div>}
          </div>
        )}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          {orderId && effective === "success" && (
            <Button asChild data-testid="track-order-btn" className="bg-emerald-600 hover:bg-emerald-700"><Link to={`/track/${orderId}`}><Truck className="w-4 h-4 mr-2" />Lacak Pesanan</Link></Button>
          )}
          {orderId && effective !== "success" && (
            <Button asChild data-testid="retry-pay-btn" className="bg-emerald-600 hover:bg-emerald-700"><Link to="/profile"><RotateCcw className="w-4 h-4 mr-2" />Bayar / Lihat Pesanan</Link></Button>
          )}
          <Button asChild variant="outline"><Link to="/">Belanja Lagi</Link></Button>
        </div>
      </div>
    </div>
  );
}
