import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/lib/api";
import { KG_PRESETS, lineTotal, fmtQty } from "@/lib/qty";
import { Scale } from "lucide-react";

export default function QtyPicker({ product, onAdd, testId }) {
  const isKg = product.unit === "kg";
  const [kg, setKg] = useState(0.5);
  const [custom, setCustom] = useState("");
  const [mode, setMode] = useState("g");
  const [pcs, setPcs] = useState(1);

  const applyCustom = (v, m) => {
    setCustom(v);
    const n = parseFloat(String(v).replace(",", "."));
    if (!isNaN(n) && n > 0) setKg(m === "g" ? n / 1000 : n);
  };

  if (!isKg) {
    return (
      <div className="mt-3 flex items-center gap-2">
        <div className="flex items-center rounded-full border border-emerald-200 overflow-hidden">
          <button data-testid={`${testId}-dec`} onClick={() => setPcs(Math.max(1, pcs - 1))} className="w-8 h-9 hover:bg-emerald-50">−</button>
          <span data-testid={`${testId}-pcs`} className="w-8 text-center font-mono text-sm">{pcs}</span>
          <button data-testid={`${testId}-inc`} onClick={() => setPcs(pcs + 1)} className="w-8 h-9 hover:bg-emerald-50">+</button>
        </div>
        <Button data-testid={`${testId}-add`} disabled={product.stock <= 0} onClick={() => onAdd(product, pcs)} className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 text-sm">+ Tambah</Button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {KG_PRESETS.map((p) => (
          <button
            key={p.kg}
            data-testid={`${testId}-preset-${p.kg}`}
            onClick={() => { setKg(p.kg); setCustom(""); }}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${kg === p.kg && !custom ? "bg-emerald-700 text-white border-emerald-700" : "bg-white border-emerald-200 text-emerald-800 hover:bg-emerald-50"}`}
          >{p.label}</button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <Scale className="w-3.5 h-3.5 text-slate-400" />
        <Input data-testid={`${testId}-custom`} value={custom} onChange={(e) => applyCustom(e.target.value, mode)} placeholder={mode === "g" ? "cth: 750" : "cth: 1.5"} className="h-8 text-xs" inputMode="decimal" />
        <div className="flex rounded-full border border-emerald-200 overflow-hidden text-xs font-bold">
          {["g", "kg"].map((m) => (
            <button key={m} data-testid={`${testId}-unit-${m}`} onClick={() => { setMode(m); if (custom) applyCustom(custom, m); }} className={`px-2.5 h-8 ${mode === m ? "bg-emerald-700 text-white" : "text-emerald-800"}`}>{m}</button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">{fmtQty(kg, "kg")}</span>
        <span data-testid={`${testId}-line`} className="font-mono font-bold text-emerald-800">{formatRupiah(lineTotal(product.price, kg))}</span>
      </div>
      <Button data-testid={`${testId}-add`} disabled={product.stock <= 0 || kg < 0.1} onClick={() => onAdd(product, kg)} className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-sm">+ Tambah {fmtQty(kg, "kg")}</Button>
    </div>
  );
}
