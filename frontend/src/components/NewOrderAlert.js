import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/api";
import { gmapsLink } from "@/components/AdminMap";
import { Bell, MapPin, ExternalLink, Zap } from "lucide-react";

export default function NewOrderAlert({ order, store, onClose }) {
  if (!order) return null;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent data-testid="new-order-alert" className="max-w-lg border-2 border-red-400">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700"><Bell className="w-5 h-5 animate-bounce" /> Pesanan Baru Masuk!</DialogTitle>
          <DialogDescription>Detail pesanan untuk segera diproses.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-bold text-emerald-800 text-base">{order.order_id}</span>
            {order.is_priority && <Badge className="bg-red-600 pulse-priority gap-1"><Zap className="w-3 h-3" />PRIORITY DISPATCH / DIDAHULUKAN</Badge>}
            <Badge className={order.payment_status === "paid" ? "bg-blue-600" : "bg-slate-400"}>Midtrans QRIS: {order.payment_status === "paid" ? "PAID" : "UNPAID"}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><p className="text-xs text-slate-500">Pelanggan</p><p className="font-semibold">{order.customer_name}</p><p className="text-xs">{order.recipient_phone}</p></div>
            <div><p className="text-xs text-slate-500">Total</p><p className="font-mono font-bold text-emerald-800 text-lg">{formatRupiah(order.total)}</p></div>
          </div>
          <div>
            <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" />Alamat terverifikasi</p>
            <p>{order.verified_address || order.address}</p>
            <p className="font-mono text-xs text-slate-500">{order.lat?.toFixed(6)}, {order.lng?.toFixed(6)} • {order.distance_km} km</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3 space-y-1">
            {order.items.map((it) => (
              <div key={it.product_id} className="flex justify-between"><span>{it.name} <b>{it.quantity_label}</b></span><span className="font-mono">{formatRupiah(it.line_total)}</span></div>
            ))}
          </div>
          {order.notes && <p className="text-xs italic text-slate-600">Catatan: {order.notes}</p>}
          {order.voucher_code && <p className="text-xs text-emerald-700">Voucher <b>{order.voucher_code}</b> — diskon {formatRupiah(order.discount)}</p>}
          <div className="flex gap-2">
            {store && <Button asChild variant="outline" className="flex-1"><a href={gmapsLink(order, store)} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4 mr-1" />Rute Google Maps</a></Button>}
            <Button data-testid="alert-dismiss" onClick={onClose} className="flex-1 bg-emerald-600 hover:bg-emerald-700">Oke, Proses</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
