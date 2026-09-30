import React, { useState } from "react";
import { formatRupiah } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, AreaChart, Area } from "recharts";

const short = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}jt` : n >= 1e3 ? `${Math.round(n / 1e3)}rb` : n);

function Card({ title, children, testId }) {
  return <div data-testid={testId} className="rounded-2xl bg-white border border-emerald-900/10 p-5"><p className="font-bold text-emerald-950 mb-3">{title}</p>{children}</div>;
}

export default function AnalyticsCharts({ a }) {
  const [period, setPeriod] = useState("daily");
  const key = { daily: "date", weekly: "week", monthly: "month" }[period];
  const data = (a[period] || []).map((d) => ({ ...d, label: d[key].slice(period === "daily" ? 5 : 0) }));
  return (
    <div className="mt-6 grid lg:grid-cols-2 gap-4">
      <Card title="Pendapatan" testId="chart-revenue">
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList className="h-8">
            <TabsTrigger data-testid="period-daily" value="daily" className="text-xs">Harian</TabsTrigger>
            <TabsTrigger data-testid="period-weekly" value="weekly" className="text-xs">Mingguan</TabsTrigger>
            <TabsTrigger data-testid="period-monthly" value="monthly" className="text-xs">Bulanan</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="h-56 mt-3">
          {data.length === 0 ? <p className="text-sm text-slate-500">Belum ada data.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={short} tick={{ fontSize: 11 }} width={44} />
                <Tooltip formatter={(v, n) => n === "revenue" ? formatRupiah(v) : v} />
                <Bar dataKey="revenue" name="revenue" fill="#059669" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
      <Card title="Jumlah Pesanan" testId="chart-orders">
        <div className="h-[268px]">
          {data.length === 0 ? <p className="text-sm text-slate-500">Belum ada data.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                <Tooltip />
                <Line type="monotone" dataKey="orders" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
      <Card title="Produk Terpopuler" testId="chart-popular">
        <div className="space-y-2">
          {a.popular_items.length === 0 && <p className="text-sm text-slate-500">Belum ada data.</p>}
          {a.popular_items.map((p, i) => {
            const max = a.popular_items[0].revenue || 1;
            return (
              <div key={p.product_id} className="text-sm">
                <div className="flex justify-between"><span><b className="text-emerald-800">#{i + 1}</b> {p.name} <span className="text-slate-500 text-xs">({p.unit === "kg" ? `${p.quantity.toFixed(2)} kg` : `${p.quantity} ${p.unit}`}, {p.orders} order)</span></span><span className="font-mono font-bold">{formatRupiah(p.revenue)}</span></div>
                <div className="h-1.5 bg-emerald-100 rounded-full mt-1"><div className="h-full bg-emerald-600 rounded-full" style={{ width: `${(p.revenue / max) * 100}%` }} /></div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card title="Pertumbuhan Pelanggan" testId="chart-growth">
        <div className="h-56">
          {a.customer_growth.length === 0 ? <p className="text-sm text-slate-500">Belum ada data.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={a.customer_growth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                <Tooltip />
                <Area type="monotone" dataKey="total" name="Total pelanggan" stroke="#0369a1" fill="#bae6fd" strokeWidth={2} />
                <Area type="monotone" dataKey="new" name="Baru" stroke="#059669" fill="#a7f3d0" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-2">Total pelanggan terdaftar: <b>{a.total_customers}</b></p>
      </Card>
      <Card title="Top Pelanggan" testId="top-customers">
        <div className="space-y-2">
          {a.top_customers.map((c, i) => (
            <div key={c.email} className="flex items-center justify-between text-sm p-2 rounded-lg bg-emerald-50/50">
              <div><span className="font-bold text-emerald-800">#{i + 1}</span> <span className="ml-2">{c.name}</span><p className="text-xs text-slate-500">{c.email}</p></div>
              <div className="text-right"><p className="font-mono font-bold text-emerald-800">{formatRupiah(c.revenue)}</p><p className="text-xs text-slate-500">{c.orders} pesanan</p></div>
            </div>
          ))}
          {a.top_customers.length === 0 && <p className="text-slate-500 text-sm">Belum ada data.</p>}
        </div>
      </Card>
    </div>
  );
}
