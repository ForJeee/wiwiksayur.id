import React, { useEffect, useState } from "react";
import { api, formatRupiah } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import QtyPicker from "@/components/QtyPicker";
import { Truck, ShieldCheck, Flame, Phone, Search, Scale } from "lucide-react";
import { toast } from "sonner";

export default function Home() {
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [activeCat, setActiveCat] = useState("Semua");
  const [q, setQ] = useState("");
  const { addToCart } = useApp();

  useEffect(() => {
    api.get("/products").then((r) => setProducts(r.data)).catch(() => toast.error("Gagal memuat produk"));
    api.get("/products/categories").then((r) => setCats(r.data));
  }, []);

  const filtered = products
    .filter((p) => activeCat === "Semua" || p.category === activeCat)
    .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <section className="grid grid-cols-12 gap-4 sm:gap-6">
        <div data-testid="hero-banner" className="col-span-12 lg:col-span-8 relative rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-950 min-h-[300px] sm:min-h-[380px] p-8 sm:p-12 text-white">
          <img src="https://images.unsplash.com/photo-1591586116988-62fe65164f8d?w=1200&auto=format" alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
          <div className="relative z-10 max-w-md">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-amber-950 text-xs font-bold tracking-wider uppercase">
              <Flame className="w-3.5 h-3.5" /> Harga Pasar Hari Ini
            </span>
            <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
              Sayur Segar<br/>beli per gram,<br/><span className="text-amber-300">bayar sesuai timbangan.</span>
            </h1>
            <p className="mt-4 text-white/80 text-sm sm:text-base">Pesan 200 g, 500 g, atau 2 kg — harga dihitung otomatis. Gratis ongkir mulai belanja Rp 200.000.</p>
            <Button data-testid="hero-cta" onClick={() => document.getElementById("produk-grid")?.scrollIntoView({ behavior: "smooth" })} className="mt-6 bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold">Belanja Sekarang</Button>
          </div>
        </div>
        <div className="col-span-12 lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-4">
          <div className="rounded-2xl p-5 bg-white border border-emerald-900/10 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 grid place-items-center text-emerald-700 mb-3"><Truck className="w-5 h-5" /></div>
            <p className="text-sm font-bold text-emerald-950">Ongkir Jarak Nyata</p>
            <p className="text-xs text-slate-600 mt-1">Rp 8.000 untuk 2 km pertama, +Rp 2.500/km berikutnya. Alamat diverifikasi otomatis.</p>
          </div>
          <div className="rounded-2xl p-5 bg-gradient-to-br from-amber-100 to-amber-50 border border-amber-300/40 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-amber-400 grid place-items-center text-amber-950 mb-3"><ShieldCheck className="w-5 h-5" /></div>
            <p className="text-sm font-bold text-amber-950">Pelanggan Setia</p>
            <p className="text-xs text-amber-900/80 mt-1">10+ pesanan? Dapat prioritas kirim & badge emas.</p>
          </div>
        </div>
      </section>

      <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-3">
        <h2 className="text-2xl sm:text-3xl font-bold text-emerald-950 tracking-tight flex-1">Katalog Wiwik Sayur</h2>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input data-testid="product-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari sayur, cabe, bawang…" className="pl-9 rounded-full bg-white" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
        {["Semua", ...cats].map((c) => (
          <button
            key={c}
            data-testid={`filter-${c.replace(/[\s&]+/g, "-").toLowerCase()}`}
            onClick={() => setActiveCat(c)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${activeCat === c ? "bg-emerald-700 text-white" : "bg-white border border-emerald-900/10 text-slate-700 hover:bg-emerald-50"}`}
          >{c}</button>
        ))}
      </div>

      <section id="produk-grid" className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
        {filtered.map((p) => (
          <div key={p.product_id} data-testid={`product-card-${p.product_id}`} className="group rounded-2xl bg-white border border-emerald-900/10 overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
            <div className="relative aspect-[4/3] overflow-hidden bg-emerald-50">
              <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              {p.unit === "kg" && <span className="absolute top-2 right-2 px-2 py-0.5 bg-white/90 text-emerald-800 text-[10px] font-bold rounded-full inline-flex items-center gap-1"><Scale className="w-3 h-3" />TIMBANG</span>}
              {p.stock <= 0 && <span className="absolute top-2 left-2 px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded-full">HABIS</span>}
            </div>
            <div className="p-3 flex-1 flex flex-col">
              <p className="text-[11px] text-emerald-700 font-semibold uppercase tracking-wider">{p.category}</p>
              <p className="mt-0.5 text-sm font-bold text-slate-900">{p.name}</p>
              <p className="mt-1 font-mono font-extrabold text-emerald-700">{formatRupiah(p.price)}<span className="text-slate-500 font-normal text-xs">/{p.unit}</span></p>
              <div className="mt-auto"><QtyPicker product={p} onAdd={addToCart} testId={`qp-${p.product_id}`} /></div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="col-span-full text-center text-slate-500 py-10">Produk tidak ditemukan.</p>}
      </section>

      <section className="mt-16 rounded-3xl bg-white border border-emerald-900/10 p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-4 justify-between">
        <div>
          <h3 className="text-xl font-bold text-emerald-950">Butuh bantuan atau ada keluhan?</h3>
          <p className="text-slate-600 text-sm mt-1">Tim Wiwik Sayur siap membantu via WhatsApp.</p>
        </div>
        <a href="https://wa.me/6285814420843" target="_blank" rel="noreferrer" data-testid="support-whatsapp" className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
          <Phone className="w-4 h-4" /> +62 858-1442-0843
        </a>
      </section>
    </div>
  );
}
