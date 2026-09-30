import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { api, formatRupiah } from "@/lib/api";
import { fmtQty, lineTotal } from "@/lib/qty";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { MapPin, Truck, Award, CheckCircle, ShieldCheck, Search, Route, Ticket } from "lucide-react";
import { useNavigate } from "react-router-dom";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function FitRoute({ route }) {
  const map = useMap();
  useEffect(() => { if (route?.length > 1) map.fitBounds(L.latLngBounds(route), { padding: [30, 30] }); }, [route, map]);
  return null;
}

export default function Checkout() {
  const { cart, subtotal, user, clearCart } = useApp();
  const nav = useNavigate();
  const [store, setStore] = useState(null);
  const [addr, setAddr] = useState({ address: "", recipient_name: user?.name || "", recipient_phone: user?.phone || "", notes: "" });
  const [geo, setGeo] = useState(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [qrisOpen, setQrisOpen] = useState(false);
  const [order, setOrder] = useState(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucher, setVoucher] = useState(null);

  const applyVoucher = async () => {
    if (!voucherCode.trim()) return;
    try {
      const r = await api.post("/vouchers/validate", { code: voucherCode, subtotal, distance_km: geo?.distance_km || 0 });
      setVoucher(r.data); toast.success(`Voucher ${r.data.code} diterapkan`);
    } catch (e) { setVoucher(null); toast.error(e?.response?.data?.detail || "Voucher tidak valid"); }
  };

  useEffect(() => {
    if (cart.length === 0 && !order) { nav("/"); return; }
    api.get("/store/info").then((r) => setStore(r.data));
  }, [cart.length, nav, order]);

  useEffect(() => {
    if (!geo) return;
    const t = setTimeout(async () => {
      try { const r = await api.post("/shipping/quote", { subtotal, distance_km: geo.distance_km }); setGeo((g) => g ? { ...g, ...r.data } : g); } catch {}
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  const discount = voucher ? (voucher.type === "free_shipping" ? (geo?.fee || 0) : Math.min(voucher.discount, subtotal)) : 0;
  const total = useMemo(() => Math.max(0, subtotal + (geo?.fee || 0) - discount), [subtotal, geo, discount]);

  const verifyAddress = async () => {
    if (addr.address.trim().length < 8) { toast.error("Tulis alamat lengkap: jalan, nomor, kelurahan, kecamatan, kota"); return; }
    setChecking(true); setGeo(null);
    try {
      const r = await api.post("/geo/resolve", { address: addr.address, subtotal });
      setGeo(r.data);
      toast.success(`Alamat terverifikasi • ${r.data.distance_km} km dari toko`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Alamat tidak ditemukan");
    } finally { setChecking(false); }
  };

  const launchSnap = async (orderId) => {
    const tokRes = await api.post("/payments/midtrans/token", { order_id: orderId, origin: window.location.origin });
    if (tokRes.data.mock) { setQrisOpen(true); return; }
    const scriptUrl = tokRes.data.is_production ? "https://app.midtrans.com/snap/snap.js" : "https://app.sandbox.midtrans.com/snap/snap.js";
    if (!window.snap) {
      const s = document.createElement("script"); s.src = scriptUrl; s.setAttribute("data-client-key", tokRes.data.client_key); document.body.appendChild(s);
      await new Promise((res) => { s.onload = res; });
    }
    window.snap.pay(tokRes.data.token, {
      onSuccess: () => { clearCart(); nav(`/payment/success?order_id=${orderId}`); },
      onPending: () => { clearCart(); nav(`/payment/pending?order_id=${orderId}`); },
      onError: () => nav(`/payment/failed?order_id=${orderId}`),
      onClose: () => { clearCart(); nav(`/payment/pending?order_id=${orderId}`); },
    });
  };

  const placeOrder = async () => {
    if (!geo) { toast.error("Verifikasi alamat terlebih dahulu"); return; }
    if (!addr.recipient_name || !addr.recipient_phone) { toast.error("Lengkapi nama & nomor HP penerima"); return; }
    setBusy(true);
    try {
      const items = cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity }));
      const r = await api.post("/orders", { items, ...addr, voucher_code: voucher?.code || null });
      setOrder(r.data);
      await launchSnap(r.data.order_id);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal membuat pesanan");
    } finally { setBusy(false); }
  };

  const mockPay = async () => {
    if (!order) return;
    try {
      await api.post(`/payments/midtrans/mock-pay/${order.order_id}`);
      clearCart(); setQrisOpen(false);
      nav(`/payment/success?order_id=${order.order_id}`);
    } catch { toast.error("Gagal simulasi bayar"); }
  };

  if (!store) return <div className="p-10 text-center text-slate-500">Memuat…</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-extrabold text-emerald-950 tracking-tight">Checkout</h1>
      <p className="mt-1 text-slate-600">Tulis alamat lengkap — kami verifikasi lokasi & hitung jarak rute otomatis.</p>

      {user?.is_pelanggan_setia && (
        <div data-testid="loyalty-checkout" className="mt-4 flex items-center gap-2 p-3 rounded-xl loyal-shimmer text-amber-950">
          <Award className="w-5 h-5" /> <span className="font-bold">Pelanggan Setia</span> — pesanan Anda akan <b>DIDAHULUKAN</b>.
        </div>
      )}

      <div className="mt-6 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl bg-white border border-emerald-900/10 p-5 space-y-4">
            <div className="flex items-center gap-2 text-emerald-950 font-bold"><MapPin className="w-5 h-5" /> Alamat Pengantaran</div>
            <div>
              <Label>Alamat Lengkap (Jalan, No. Rumah, Kelurahan, Kecamatan, Kota, Kode Pos)</Label>
              <Textarea data-testid="input-address" placeholder="Jl. Senopati No. 10, Selong, Kebayoran Baru, Jakarta Selatan, 12110" value={addr.address} onChange={(e) => { setAddr({ ...addr, address: e.target.value }); setGeo(null); }} />
            </div>
            <Button data-testid="verify-address-btn" onClick={verifyAddress} disabled={checking} variant="outline" className="border-emerald-300 text-emerald-800 gap-2">
              <Search className="w-4 h-4" /> {checking ? "Mencari lokasi…" : "Verifikasi Alamat & Hitung Jarak"}
            </Button>

            {geo && (
              <div data-testid="geo-result" className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
                <p className="text-xs font-bold text-emerald-800 inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Lokasi terverifikasi {geo.precision === "approximate" && <span className="text-amber-700">(perkiraan area)</span>}</p>
                <p data-testid="geo-display-name" className="text-sm text-slate-700">{geo.display_name}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className="border-emerald-300 font-mono">{geo.lat.toFixed(6)}, {geo.lng.toFixed(6)}</Badge>
                  <Badge className="bg-emerald-600" data-testid="distance-badge"><Route className="w-3 h-3 mr-1" />Rute {geo.distance_km} km • ±{geo.duration_min} mnt</Badge>
                </div>
                <div className="h-56 rounded-xl overflow-hidden" data-testid="checkout-map">
                  <MapContainer center={[geo.lat, geo.lng]} zoom={13} style={{ height: "100%", width: "100%" }} dragging={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false}>
                    <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[store.lat, store.lng]} />
                    <Marker position={[geo.lat, geo.lng]} />
                    {geo.route && <Polyline positions={geo.route} pathOptions={{ color: "#047857", weight: 4 }} />}
                    <FitRoute route={geo.route} />
                  </MapContainer>
                </div>
                <p className="text-[11px] text-slate-500">Pin ditentukan otomatis dari alamat (tidak bisa digeser) untuk menjaga keadilan ongkir.</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white border border-emerald-900/10 p-5 space-y-4">
            <div className="font-bold text-emerald-950">Penerima</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nama Penerima</Label><Input data-testid="input-recipient" value={addr.recipient_name} onChange={(e) => setAddr({ ...addr, recipient_name: e.target.value })} /></div>
              <div><Label>No. HP Penerima</Label><Input data-testid="input-recipient-phone" value={addr.recipient_phone} onChange={(e) => setAddr({ ...addr, recipient_phone: e.target.value })} /></div>
            </div>
            <div><Label>Catatan (opsional)</Label><Textarea data-testid="input-notes" placeholder="Contoh: letakkan di pos satpam" value={addr.notes} onChange={(e) => setAddr({ ...addr, notes: e.target.value })} /></div>
          </div>
        </div>

        <div className="space-y-4">
          {geo && !geo.free && geo.upgrade && (
            <div data-testid="upgrade-bar" className="rounded-2xl p-4 bg-gradient-to-r from-amber-100 to-amber-50 border border-amber-300/40">
              <p className="text-sm text-amber-950 font-semibold">Tambah {formatRupiah(geo.upgrade.gap)} lagi untuk GRATIS ONGKIR!</p>
            </div>
          )}
          {geo?.free && <div data-testid="free-bar" className="rounded-2xl p-4 bg-emerald-100 border border-emerald-300/40 text-sm font-semibold text-emerald-900">{geo.reason}</div>}
          <div className="rounded-2xl bg-white border border-emerald-900/10 p-5 space-y-3">
            <div className="font-bold text-emerald-950">Ringkasan Pesanan</div>
            <div className="max-h-56 overflow-y-auto space-y-2">
              {cart.map((i) => (
                <div key={i.product_id} className="flex justify-between text-sm gap-2">
                  <span className="truncate flex-1">{i.name} <span className="text-slate-500">× {fmtQty(i.quantity, i.unit)}</span></span>
                  <span className="font-mono">{formatRupiah(lineTotal(i.price, i.quantity))}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-3">
              <Label className="text-xs">Kode Voucher</Label>
              <div className="flex gap-2 mt-1">
                <Input data-testid="voucher-input" value={voucherCode} onChange={(e) => setVoucherCode(e.target.value.toUpperCase())} placeholder="cth: WWK-ABC123" className="h-9 font-mono" />
                <Button data-testid="voucher-apply" variant="outline" size="sm" onClick={applyVoucher} className="h-9 border-emerald-300 text-emerald-800"><Ticket className="w-4 h-4 mr-1" />Pakai</Button>
              </div>
              {voucher && <p data-testid="voucher-applied" className="text-xs text-emerald-700 mt-1 flex items-center justify-between">✓ {voucher.code} {voucher.description && `— ${voucher.description}`}<button onClick={() => { setVoucher(null); setVoucherCode(""); }} className="underline text-slate-500">hapus</button></p>}
            </div>
            <div className="border-t pt-3 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span data-testid="summary-subtotal" className="font-mono">{formatRupiah(subtotal)}</span></div>
              <div className="flex justify-between"><span>Jarak rute</span><span data-testid="summary-distance" className="font-mono">{geo?.distance_km ?? "—"} km</span></div>
              <div className="flex justify-between"><span>Ongkos Kirim</span><span data-testid="summary-shipping" className="font-mono">{!geo ? "—" : geo.free ? <span className="text-emerald-600 font-bold">GRATIS</span> : formatRupiah(geo.fee)}</span></div>
              {discount > 0 && <div className="flex justify-between text-emerald-700"><span>Diskon voucher</span><span data-testid="summary-discount" className="font-mono">− {formatRupiah(discount)}</span></div>}
              <div className="flex justify-between text-base font-extrabold text-emerald-950 pt-2 border-t"><span>Total</span><span data-testid="summary-total" className="font-mono">{formatRupiah(total)}</span></div>
            </div>
            <Button data-testid="place-order-btn" disabled={busy || !geo} onClick={placeOrder} className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-base font-semibold">
              <Truck className="w-4 h-4 mr-2" /> {busy ? "Memproses…" : "Bayar Sekarang"}
            </Button>
            {!geo && <p className="text-xs text-center text-slate-500">Verifikasi alamat untuk melanjutkan.</p>}
          </div>
        </div>
      </div>

      <Dialog open={qrisOpen} onOpenChange={setQrisOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-emerald-950">Pembayaran QRIS (Simulasi)</DialogTitle><DialogDescription>Midtrans belum dikonfigurasi — pembayaran disimulasikan.</DialogDescription></DialogHeader>
          <div className="text-center space-y-4">
            <p className="text-sm text-slate-600">Order ID: <span className="font-mono font-bold text-emerald-800">{order?.order_id}</span></p>
            <p className="text-sm text-slate-600">Total: <span className="font-mono font-bold">{formatRupiah(order?.total || 0)}</span></p>
            <Button data-testid="mock-pay-btn" onClick={mockPay} className="w-full bg-emerald-600 hover:bg-emerald-700"><CheckCircle className="w-4 h-4 mr-2" /> Simulasi Bayar Berhasil</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
