import React, { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Percent } from "lucide-react";
import { toast } from "sonner";

export default function BulkPriceDialog({ products, categories, onSaved }) {
  const [open, setOpen] = useState(false);
  const [percent, setPercent] = useState("");
  const [category, setCategory] = useState("all");
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const updates = Object.entries(edits).filter(([, v]) => v !== "" && !isNaN(parseInt(v))).map(([product_id, v]) => ({ product_id, price: parseInt(v) }));
      const body = { updates };
      if (percent !== "" && !isNaN(parseFloat(percent))) { body.percent = parseFloat(percent); if (category !== "all") body.category = category; }
      const r = await api.put("/admin/products/bulk-price", body);
      toast.success(`${r.data.changed} harga diperbarui`);
      setOpen(false); setEdits({}); setPercent(""); onSaved?.();
    } catch { toast.error("Gagal update harga"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button data-testid="bulk-price-btn" variant="outline" className="border-emerald-300 text-emerald-800"><Percent className="w-4 h-4 mr-1" />Update Harga Massal</Button></DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Update Harga Massal</DialogTitle><DialogDescription>Naikkan/turunkan harga per persen, atau isi harga baru per produk.</DialogDescription></DialogHeader>
        <div className="rounded-xl bg-emerald-50 p-3 grid sm:grid-cols-3 gap-2 items-end">
          <div><Label className="text-xs">Persentase (+/−)</Label><Input data-testid="bulk-percent" type="number" placeholder="cth: 10 atau -5" value={percent} onChange={(e) => setPercent(e.target.value)} /></div>
          <div><Label className="text-xs">Kategori</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="bulk-category"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Semua kategori</SelectItem>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <p className="text-xs text-slate-600">Dibulatkan ke Rp 100 terdekat.</p>
        </div>
        <div className="mt-3 max-h-80 overflow-y-auto divide-y">
          {products.map((p) => (
            <div key={p.product_id} className="flex items-center gap-3 py-2 text-sm">
              <span className="flex-1 truncate">{p.name} <span className="text-slate-400 text-xs">/{p.unit}</span></span>
              <span className="font-mono text-slate-500 w-24 text-right">{p.price.toLocaleString("id-ID")}</span>
              <Input data-testid={`bulk-price-${p.product_id}`} type="number" placeholder="Harga baru" className="w-32 h-8" value={edits[p.product_id] ?? ""} onChange={(e) => setEdits({ ...edits, [p.product_id]: e.target.value })} />
            </div>
          ))}
        </div>
        <Button data-testid="bulk-save" disabled={busy} onClick={save} className="w-full bg-emerald-600 hover:bg-emerald-700">{busy ? "Menyimpan…" : "Simpan Perubahan"}</Button>
      </DialogContent>
    </Dialog>
  );
}
