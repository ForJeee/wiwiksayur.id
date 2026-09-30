import React, { useEffect, useRef, useState } from "react";
import { api, formatRupiah } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bell, Package, TrendingUp, Boxes, Plus, Trash2, Pencil, Phone, MapPin, Volume2, VolumeX, Map as MapIcon, Zap, ExternalLink, Ticket } from "lucide-react";
import { toast } from "sonner";
import AdminMap, { gmapsLink } from "@/components/AdminMap";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import NewOrderAlert from "@/components/NewOrderAlert";
import BulkPriceDialog from "@/components/BulkPriceDialog";
import ShippingSettings from "@/components/ShippingSettings";
import VoucherManager from "@/components/VoucherManager";

const STATUS_ORDER = ["pending", "paid", "processing", "out_for_delivery", "completed"];
const STATUS_ID = { pending: "Menunggu bayar", paid: "Dibayar", processing: "Disiapkan", out_for_delivery: "Diantar", completed: "Selesai", cancelled: "Batal" };

function useAudioAlert() {
  const ctxRef = useRef(null);
  const [enabled, setEnabled] = useState(() => localStorage.getItem("ws_sound") === "1");
  const getCtx = () => {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return ctxRef.current;
  };
  const beep = (force = false) => {
    if (!force && !enabled) return;
    try {
      const ctx = getCtx();
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      [880, 1320, 880, 1320].forEach((freq, i) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = "sine"; o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, now + i * 0.18);
        g.gain.exponentialRampToValueAtTime(0.2, now + i * 0.18 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.35);
        o.connect(g); g.connect(ctx.destination);
        o.start(now + i * 0.18); o.stop(now + i * 0.18 + 0.4);
      });
    } catch {}
  };
  const enable = async () => {
    try { await getCtx().resume(); setEnabled(true); localStorage.setItem("ws_sound", "1"); beep(true); toast.success("Notifikasi suara aktif"); }
    catch { toast.error("Browser memblokir audio"); }
  };
  const disable = () => { setEnabled(false); localStorage.setItem("ws_sound", "0"); };
  return { beep, enabled, enable, disable };
}

export default function Admin() {
  const { user } = useApp();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [store, setStore] = useState(null);
  const [tab, setTab] = useState("orders");
  const seen = useRef(null);
  const [alertFlash, setAlertFlash] = useState(false);
  const [alertOrder, setAlertOrder] = useState(null);
  const { beep, enabled: soundOn, enable: enableSound, disable: disableSound } = useAudioAlert();

  const load = async () => {
    try {
      const [o, p, a] = await Promise.all([api.get("/admin/orders"), api.get("/admin/products"), api.get("/admin/analytics")]);
      setOrders(o.data); setProducts(p.data); setAnalytics(a.data);
      const sig = new Map(o.data.map((x) => [x.order_id, x.payment_status]));
      if (seen.current) {
        const fresh = o.data.find((x) => (!seen.current.has(x.order_id) && x.payment_status === "paid") || (seen.current.get(x.order_id) === "unpaid" && x.payment_status === "paid"));
        if (fresh) {
          beep(); setAlertFlash(true); setTimeout(() => setAlertFlash(false), 5000);
          setAlertOrder(fresh);
          toast.info(`Pesanan baru ${fresh.order_id} sudah dibayar!`);
        }
      }
      seen.current = sig;
    } catch {}
  };

  useEffect(() => { api.get("/store/info").then((r) => setStore(r.data)); load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, []); // eslint-disable-line

  if (!user || user.role !== "admin") return <div className="p-10 text-center text-slate-500">Hanya admin.</div>;

  const updateStatus = async (id, status) => {
    try { await api.put(`/admin/orders/${id}/status`, { status }); toast.success("Status diperbarui"); load(); }
    catch { toast.error("Gagal update"); }
  };
  const categories = [...new Set(products.map((p) => p.category))];
  const sortedOrders = [...orders].sort((a, b) => (b.is_priority && !["completed", "cancelled"].includes(b.status)) - (a.is_priority && !["completed", "cancelled"].includes(a.status)));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <NewOrderAlert order={alertOrder} store={store} onClose={() => setAlertOrder(null)} />
      <div className={`flex flex-wrap items-center gap-3 rounded-2xl p-4 border transition-colors ${alertFlash ? "bg-red-50 border-red-300 pulse-priority" : "bg-white border-emerald-900/10"}`}>
        <Bell className={`w-5 h-5 ${alertFlash ? "text-red-600 animate-bounce" : "text-emerald-700"}`} />
        <div className="flex-1 min-w-[200px]">
          <p className="font-bold text-emerald-950">Admin Dashboard — {user.name}</p>
          <p className="text-xs text-slate-500">Auto-refresh 6 detik. Alarm {soundOn ? "suara + " : ""}visual saat pesanan baru dibayar.</p>
        </div>
        {soundOn ? (
          <Button data-testid="sound-toggle-btn" size="sm" variant="outline" onClick={disableSound} className="gap-1.5 text-emerald-700 border-emerald-300"><Volume2 className="w-4 h-4" /> Suara Aktif</Button>
        ) : (
          <Button data-testid="sound-toggle-btn" size="sm" onClick={enableSound} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><VolumeX className="w-4 h-4" /> Aktifkan Notifikasi Suara</Button>
        )}
        <a href="https://wa.me/6285814420843" target="_blank" rel="noreferrer" data-testid="admin-support-wa" className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"><Phone className="w-3.5 h-3.5" /> Keluhan: +6285814420843</a>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger data-testid="tab-orders" value="orders"><Package className="w-4 h-4 mr-1.5" />Pesanan</TabsTrigger>
          <TabsTrigger data-testid="tab-map" value="map"><MapIcon className="w-4 h-4 mr-1.5" />Peta Pengiriman</TabsTrigger>
          <TabsTrigger data-testid="tab-inventory" value="inventory"><Boxes className="w-4 h-4 mr-1.5" />Inventaris</TabsTrigger>
          <TabsTrigger data-testid="tab-analytics" value="analytics"><TrendingUp className="w-4 h-4 mr-1.5" />Analitik</TabsTrigger>
          <TabsTrigger data-testid="tab-promo" value="promo"><Ticket className="w-4 h-4 mr-1.5" />Promo & Ongkir</TabsTrigger>
        </TabsList>

        <TabsContent value="promo" className="mt-4 space-y-4">
          <VoucherManager />
          <ShippingSettings />
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <div className="grid md:grid-cols-4 gap-3 mb-4">
            <StatCard label="Menunggu" value={orders.filter((o) => o.status === "pending").length} color="bg-slate-100 text-slate-800" />
            <StatCard label="Diproses" value={orders.filter((o) => ["paid", "processing"].includes(o.status)).length} color="bg-amber-100 text-amber-800" />
            <StatCard label="Diantar" value={orders.filter((o) => o.status === "out_for_delivery").length} color="bg-orange-100 text-orange-800" />
            <StatCard label="Selesai" value={orders.filter((o) => o.status === "completed").length} color="bg-emerald-100 text-emerald-800" />
          </div>
          <div className="space-y-3">
            {sortedOrders.map((o) => (
              <div key={o.order_id} data-testid={`admin-order-${o.order_id}`} className={`rounded-2xl bg-white border p-4 ${o.is_priority ? "border-red-300" : "border-emerald-900/10"}`}>
                <div className="flex flex-wrap items-center gap-3 justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-bold text-emerald-800">{o.order_id}</p>
                    {o.is_priority ? (
                      <Badge data-testid={`priority-${o.order_id}`} className="bg-red-600 pulse-priority gap-1"><Zap className="w-3 h-3" />PRIORITY DISPATCH / DIDAHULUKAN</Badge>
                    ) : <Badge variant="outline">Regular</Badge>}
                    <Badge className={o.payment_status === "paid" ? "bg-blue-600" : "bg-slate-400"}>QRIS {o.payment_status === "paid" ? "PAID" : "UNPAID"}</Badge>
                  </div>
                  <Select value={o.status} onValueChange={(v) => updateStatus(o.order_id, v)}>
                    <SelectTrigger data-testid={`status-select-${o.order_id}`} className="w-44 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_ORDER.concat(["cancelled"]).map((s) => <SelectItem key={s} value={s}>{STATUS_ID[s]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="mt-3 grid sm:grid-cols-4 gap-3 text-sm">
                  <div><p className="text-xs text-slate-500">Pelanggan</p><p className="font-semibold">{o.customer_name}</p><p className="text-xs text-slate-500">{o.recipient_phone}</p></div>
                  <div className="sm:col-span-1"><p className="text-xs text-slate-500">Item</p><p className="text-xs">{o.items.map((i) => `${i.name} ${i.quantity_label}`).join(", ")}</p></div>
                  <div><p className="text-xs text-slate-500">Jarak / Ongkir</p><p className="font-mono">{o.distance_km} km • {o.free_shipping ? "GRATIS" : formatRupiah(o.delivery_fee)}</p></div>
                  <div><p className="text-xs text-slate-500">Total</p><p className="font-mono font-bold text-emerald-800">{formatRupiah(o.total)}</p></div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <MapPin className="w-3.5 h-3.5" /><span className="flex-1">{o.verified_address || o.address}</span>
                  <span className="font-mono">{o.lat?.toFixed(6)}, {o.lng?.toFixed(6)}</span>
                  {store && <a data-testid={`gmaps-link-${o.order_id}`} href={gmapsLink(o, store)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline"><ExternalLink className="w-3 h-3" />Google Maps</a>}
                </div>
              </div>
            ))}
            {orders.length === 0 && <p className="text-center text-slate-500 py-10">Belum ada pesanan.</p>}
          </div>
        </TabsContent>

        <TabsContent value="map" className="mt-4">
          {store && <AdminMap orders={orders} store={store} />}
          <p className="text-xs text-slate-500 mt-2">Hijau = toko, merah = pesanan prioritas, biru = reguler, abu = selesai. Klik pin untuk detail & rute.</p>
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          <div className="flex flex-wrap justify-end gap-2 mb-3">
            <BulkPriceDialog products={products} categories={categories} onSaved={load} />
            <ProductDialog onSaved={load} categories={categories} />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {products.map((p) => (
              <div key={p.product_id} data-testid={`inv-${p.product_id}`} className={`rounded-2xl bg-white border p-4 flex gap-3 ${p.is_active ? "border-emerald-900/10" : "border-slate-200 opacity-60"}`}>
                <img src={p.image_url} alt="" className="w-16 h-16 object-cover rounded-lg" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-emerald-700 font-bold uppercase">{p.category}</p>
                  <p className="text-sm font-bold text-slate-900">{p.name}</p>
                  <p className="font-mono text-sm text-emerald-700 font-extrabold">{formatRupiah(p.price)}<span className="text-slate-500 font-normal">/{p.unit}</span></p>
                  <p className="text-xs text-slate-500">Stok: <b className={p.stock < 5 ? "text-red-600" : ""}>{p.unit === "kg" ? `${Number(p.stock).toFixed(2)} kg` : `${p.stock} ${p.unit}`}</b></p>
                  <div className="mt-2 flex gap-2">
                    <ProductDialog initial={p} onSaved={load} categories={categories} trigger={<Button size="sm" variant="outline" data-testid={`edit-${p.product_id}`}><Pencil className="w-3 h-3" /></Button>} />
                    <Button size="sm" variant="outline" data-testid={`delete-${p.product_id}`} onClick={async () => { if (window.confirm("Hapus produk?")) { await api.delete(`/products/${p.product_id}`); load(); } }}><Trash2 className="w-3 h-3 text-red-600" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          {analytics && (
            <>
              <div className="grid sm:grid-cols-4 gap-3">
                <StatCard label="Total Pendapatan" value={formatRupiah(analytics.total_revenue)} color="bg-emerald-100 text-emerald-800" />
                <StatCard label="Pesanan Terbayar" value={analytics.total_orders} color="bg-blue-100 text-blue-800" />
                <StatCard label="Menunggu Bayar" value={analytics.pending_count} color="bg-amber-100 text-amber-800" />
                <StatCard label="Pelanggan" value={analytics.total_customers} color="bg-sky-100 text-sky-800" />
              </div>
              <AnalyticsCharts a={analytics} />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className={`rounded-2xl p-4 ${color}`}>
      <p className="text-xs font-semibold uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-extrabold mt-1 font-mono">{value}</p>
    </div>
  );
}

function ProductDialog({ initial, onSaved, trigger, categories }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial || { name: "", category: categories?.[0] || "Sayuran Daun", price: 0, unit: "kg", stock: 0, image_url: "", description: "", is_active: true });
  const set = (k) => (e) => setForm({ ...form, [k]: k === "price" ? parseInt(e.target.value || 0) : k === "stock" ? parseFloat(e.target.value || 0) : e.target.value });
  const save = async () => {
    try {
      const body = { ...form }; delete body.product_id; delete body.sort; delete body.created_at; delete body.updated_at;
      if (initial) await api.put(`/products/${initial.product_id}`, body);
      else await api.post(`/products`, body);
      toast.success("Produk tersimpan"); setOpen(false); onSaved?.();
    } catch (e) { toast.error(e?.response?.data?.detail?.[0]?.msg || "Gagal simpan"); }
  };
  const allCats = [...new Set([...(categories || []), form.category])];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || <Button data-testid="add-product-btn" className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4 mr-1" />Tambah Produk</Button>}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{initial ? "Edit" : "Tambah"} Produk</DialogTitle><DialogDescription>Harga per satuan (kg/pcs/pack). Harga sayur bisa diubah setiap hari.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nama</Label><Input data-testid="pf-name" value={form.name} onChange={set("name")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Kategori</Label><Input data-testid="pf-category" list="cat-list" value={form.category} onChange={set("category")} /><datalist id="cat-list">{allCats.map((c) => <option key={c} value={c} />)}</datalist></div>
            <div><Label>Satuan</Label>
              <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                <SelectTrigger data-testid="pf-unit"><SelectValue /></SelectTrigger>
                <SelectContent>{["kg", "pcs", "pack"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Harga (Rp / {form.unit})</Label><Input data-testid="pf-price" type="number" value={form.price} onChange={set("price")} /></div>
            <div><Label>Stok ({form.unit})</Label><Input data-testid="pf-stock" type="number" step={form.unit === "kg" ? "0.1" : "1"} value={form.stock} onChange={set("stock")} /></div>
          </div>
          <div><Label>URL Gambar</Label><Input data-testid="pf-image" value={form.image_url} onChange={set("image_url")} /></div>
          <div><Label>Deskripsi</Label><Textarea data-testid="pf-desc" value={form.description} onChange={set("description")} /></div>
          <label className="flex items-center gap-2 text-sm"><input data-testid="pf-active" type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Tampilkan di katalog</label>
          <Button data-testid="pf-save" onClick={save} className="w-full bg-emerald-600 hover:bg-emerald-700">Simpan</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
