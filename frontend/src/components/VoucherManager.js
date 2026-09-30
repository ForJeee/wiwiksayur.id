import React, { useEffect, useState } from "react";
import { api, formatRupiah } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ticket, Plus, Trash2, Copy, Power } from "lucide-react";
import { toast } from "sonner";

const TYPE_LABEL = { percent: "Diskon %", fixed: "Potongan Rp", free_shipping: "Gratis Ongkir" };
const EMPTY = { code: "", type: "percent", value: 10, min_spend: 0, max_discount: "", quota: "", expires_at: "", once_per_user: false, is_active: true, description: "", count: 1, prefix: "WWK" };

export default function VoucherManager() {
  const [list, setList] = useState([]);
  const load = () => api.get("/admin/vouchers").then((r) => setList(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const toggle = async (v) => {
    const body = { ...v, is_active: !v.is_active }; delete body.voucher_id; delete body.used_count; delete body.created_at;
    await api.put(`/admin/vouchers/${v.voucher_id}`, body); load();
  };
  const remove = async (v) => { if (window.confirm(`Hapus voucher ${v.code}?`)) { await api.delete(`/admin/vouchers/${v.voucher_id}`); load(); } };
  const copy = (code) => { navigator.clipboard?.writeText(code); toast.success(`${code} disalin`); };

  const valueLabel = (v) => v.type === "percent" ? `${v.value}%${v.max_discount ? ` (maks ${formatRupiah(v.max_discount)})` : ""}` : v.type === "fixed" ? formatRupiah(v.value) : "Ongkir gratis";

  return (
    <div data-testid="voucher-manager" className="rounded-2xl bg-white border border-emerald-900/10 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 font-bold text-emerald-950"><Ticket className="w-5 h-5" /> Voucher Promo <Badge variant="outline">{list.length}</Badge></div>
        <VoucherDialog onSaved={load} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 uppercase"><tr className="text-left border-b"><th className="py-2">Kode</th><th>Jenis</th><th>Nilai</th><th>Min. belanja</th><th>Terpakai</th><th>Berlaku s/d</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {list.map((v) => (
              <tr key={v.voucher_id} data-testid={`voucher-row-${v.code}`} className="border-b last:border-0">
                <td className="py-2"><button onClick={() => copy(v.code)} className="font-mono font-bold text-emerald-800 inline-flex items-center gap-1 hover:underline">{v.code}<Copy className="w-3 h-3 text-slate-400" /></button>{v.description && <p className="text-xs text-slate-500">{v.description}</p>}</td>
                <td>{TYPE_LABEL[v.type]}</td>
                <td className="font-mono">{valueLabel(v)}</td>
                <td className="font-mono">{v.min_spend ? formatRupiah(v.min_spend) : "—"}</td>
                <td className="font-mono">{v.used_count}{v.quota ? ` / ${v.quota}` : ""}</td>
                <td className="text-xs">{v.expires_at ? new Date(v.expires_at).toLocaleDateString("id-ID") : "—"}</td>
                <td><Badge className={v.is_active ? "bg-emerald-600" : "bg-slate-400"}>{v.is_active ? "Aktif" : "Nonaktif"}</Badge></td>
                <td className="text-right whitespace-nowrap">
                  <Button data-testid={`voucher-toggle-${v.code}`} size="sm" variant="ghost" onClick={() => toggle(v)} title="Aktif/nonaktif"><Power className="w-4 h-4" /></Button>
                  <Button data-testid={`voucher-delete-${v.code}`} size="sm" variant="ghost" onClick={() => remove(v)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-slate-500">Belum ada voucher. Buat voucher pertama Anda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VoucherDialog({ onSaved }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setBusy(true);
    try {
      const body = {
        type: f.type, value: parseFloat(f.value || 0), min_spend: parseInt(f.min_spend || 0),
        max_discount: f.max_discount ? parseInt(f.max_discount) : null, quota: f.quota ? parseInt(f.quota) : null,
        expires_at: f.expires_at ? new Date(f.expires_at + "T23:59:59").toISOString() : null,
        once_per_user: f.once_per_user, is_active: f.is_active, description: f.description,
      };
      const count = parseInt(f.count || 1);
      if (count > 1 || !f.code) {
        const r = await api.post("/admin/vouchers/generate", { ...body, count, prefix: f.prefix || "WWK" });
        toast.success(`${r.data.length} kode dibuat: ${r.data.slice(0, 3).map((v) => v.code).join(", ")}${r.data.length > 3 ? "…" : ""}`);
      } else {
        const r = await api.post("/admin/vouchers", { ...body, code: f.code });
        toast.success(`Voucher ${r.data.code} dibuat`);
      }
      setOpen(false); setF(EMPTY); onSaved?.();
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal membuat voucher"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button data-testid="voucher-create-btn" className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4 mr-1" />Buat Voucher</Button></DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Buat Voucher Promo</DialogTitle><DialogDescription>Kosongkan kode untuk digenerate otomatis. Isi jumlah &gt; 1 untuk membuat banyak kode unik sekaligus.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Label className="text-xs">Kode (opsional)</Label><Input data-testid="vf-code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="cth: HEMAT10" className="font-mono" /></div>
            <div><Label className="text-xs">Jumlah kode</Label><Input data-testid="vf-count" type="number" min="1" max="200" value={f.count} onChange={set("count")} /></div>
          </div>
          {(parseInt(f.count) > 1 || !f.code) && <div><Label className="text-xs">Prefix kode otomatis</Label><Input data-testid="vf-prefix" value={f.prefix} onChange={(e) => setF({ ...f, prefix: e.target.value.toUpperCase() })} className="font-mono" /></div>}
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Jenis</Label>
              <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}>
                <SelectTrigger data-testid="vf-type"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TYPE_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {f.type !== "free_shipping" && <div><Label className="text-xs">{f.type === "percent" ? "Persen (%)" : "Potongan (Rp)"}</Label><Input data-testid="vf-value" type="number" value={f.value} onChange={set("value")} /></div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Minimal belanja (Rp)</Label><Input data-testid="vf-min-spend" type="number" value={f.min_spend} onChange={set("min_spend")} /></div>
            {f.type === "percent" && <div><Label className="text-xs">Maks. diskon (Rp, opsional)</Label><Input data-testid="vf-max-discount" type="number" value={f.max_discount} onChange={set("max_discount")} /></div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Kuota pemakaian (opsional)</Label><Input data-testid="vf-quota" type="number" value={f.quota} onChange={set("quota")} placeholder="tanpa batas" /></div>
            <div><Label className="text-xs">Berlaku sampai (opsional)</Label><Input data-testid="vf-expires" type="date" value={f.expires_at} onChange={set("expires_at")} /></div>
          </div>
          <div><Label className="text-xs">Deskripsi (tampil ke pelanggan)</Label><Textarea data-testid="vf-desc" rows={2} value={f.description} onChange={set("description")} placeholder="cth: Promo pelanggan baru" /></div>
          <label className="flex items-center gap-2 text-sm"><input data-testid="vf-once" type="checkbox" checked={f.once_per_user} onChange={(e) => setF({ ...f, once_per_user: e.target.checked })} /> Hanya 1× per pelanggan</label>
          <Button data-testid="vf-save" disabled={busy} onClick={save} className="w-full bg-emerald-600 hover:bg-emerald-700">{busy ? "Membuat…" : "Buat Voucher"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
