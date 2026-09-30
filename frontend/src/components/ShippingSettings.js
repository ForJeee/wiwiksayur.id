import React, { useEffect, useState } from "react";
import { api, formatRupiah } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save, Truck } from "lucide-react";
import { toast } from "sonner";

export default function ShippingSettings({ onSaved }) {
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/settings/shipping").then((r) => setCfg(r.data)); }, []);

  if (!cfg) return null;
  const setTier = (i, k, v) => setCfg({ ...cfg, free_tiers: cfg.free_tiers.map((t, j) => j === i ? { ...t, [k]: v } : t) });
  const num = (v) => (v === "" ? 0 : parseFloat(v));

  const save = async () => {
    setBusy(true);
    try {
      const body = { ...cfg, free_tiers: cfg.free_tiers.filter((t) => t.min_spend > 0 && t.max_km > 0) };
      const r = await api.put("/admin/settings/shipping", body);
      setCfg(r.data); toast.success("Ketentuan ongkir disimpan"); onSaved?.();
    } catch (e) { toast.error(e?.response?.data?.detail?.[0]?.msg || "Gagal menyimpan"); }
    finally { setBusy(false); }
  };

  const example = (d, s) => {
    const t = cfg.free_tiers.find((t) => s >= t.min_spend && d <= t.max_km);
    if (t) return "GRATIS";
    return formatRupiah(d <= cfg.base_km ? cfg.base_fee : cfg.base_fee + Math.ceil(d - cfg.base_km) * cfg.per_km_fee);
  };

  return (
    <div data-testid="shipping-settings" className="rounded-2xl bg-white border border-emerald-900/10 p-5 space-y-5">
      <div className="flex items-center gap-2 font-bold text-emerald-950"><Truck className="w-5 h-5" /> Ketentuan Ongkos Kirim</div>

      <div className="grid sm:grid-cols-4 gap-3">
        <div><Label className="text-xs">Tarif dasar (Rp)</Label><Input data-testid="ship-base-fee" type="number" value={cfg.base_fee} onChange={(e) => setCfg({ ...cfg, base_fee: parseInt(e.target.value || 0) })} /></div>
        <div><Label className="text-xs">Berlaku untuk (km pertama)</Label><Input data-testid="ship-base-km" type="number" step="0.5" value={cfg.base_km} onChange={(e) => setCfg({ ...cfg, base_km: num(e.target.value) })} /></div>
        <div><Label className="text-xs">Tambahan per km (Rp)</Label><Input data-testid="ship-per-km" type="number" value={cfg.per_km_fee} onChange={(e) => setCfg({ ...cfg, per_km_fee: parseInt(e.target.value || 0) })} /></div>
        <div><Label className="text-xs">Jarak maks. layanan (km, 0 = tanpa batas)</Label><Input data-testid="ship-max-km" type="number" step="0.5" value={cfg.max_km || 0} onChange={(e) => setCfg({ ...cfg, max_km: num(e.target.value) })} /></div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-emerald-950">Tier Gratis Ongkir</p>
          <Button data-testid="ship-add-tier" size="sm" variant="outline" onClick={() => setCfg({ ...cfg, free_tiers: [...cfg.free_tiers, { min_spend: 0, max_km: 0 }] })}><Plus className="w-3.5 h-3.5 mr-1" />Tambah tier</Button>
        </div>
        <div className="space-y-2">
          {cfg.free_tiers.map((t, i) => (
            <div key={i} data-testid={`ship-tier-${i}`} className="flex flex-wrap items-center gap-2 text-sm rounded-xl bg-emerald-50/60 p-2">
              <span className="text-slate-600">Belanja ≥ Rp</span>
              <Input data-testid={`ship-tier-${i}-spend`} type="number" className="w-36 h-8" value={t.min_spend} onChange={(e) => setTier(i, "min_spend", parseInt(e.target.value || 0))} />
              <span className="text-slate-600">dan jarak ≤</span>
              <Input data-testid={`ship-tier-${i}-km`} type="number" step="0.5" className="w-24 h-8" value={t.max_km} onChange={(e) => setTier(i, "max_km", num(e.target.value))} />
              <span className="text-slate-600">km → <b className="text-emerald-700">GRATIS</b></span>
              <button data-testid={`ship-tier-${i}-remove`} onClick={() => setCfg({ ...cfg, free_tiers: cfg.free_tiers.filter((_, j) => j !== i) })} className="ml-auto text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-emerald-300 p-3 text-xs text-slate-600">
        <p className="font-semibold text-emerald-900 mb-1">Simulasi:</p>
        <p>Belanja Rp 100.000 • 1,5 km → <b data-testid="ship-sim-1">{example(1.5, 100000)}</b> &nbsp;|&nbsp; Rp 100.000 • 5 km → <b data-testid="ship-sim-2">{example(5, 100000)}</b> &nbsp;|&nbsp; Rp 350.000 • 1,8 km → <b data-testid="ship-sim-3">{example(1.8, 350000)}</b></p>
      </div>

      <Button data-testid="ship-save" disabled={busy} onClick={save} className="bg-emerald-600 hover:bg-emerald-700"><Save className="w-4 h-4 mr-1" />{busy ? "Menyimpan…" : "Simpan Ketentuan"}</Button>
    </div>
  );
}
