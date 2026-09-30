# wiwiksayur.com — Product Requirements Document

## Original problem statement (verbatim)
Build a modern, clean, and responsive login page, customer storefront, and checkout experience for an online fresh produce website named "wiwiksayur.com" inspired by Sayurbox — with Auth (email+password & Google OAuth), Loyalty Badge "Pelanggan Setia" (10+ completed orders), Store origin & auto distance calculator (Haversine, store coords from https://share.google/1Q45hqInVPmE9UKjs — fallback Jakarta South -6.2297, 106.8074), dynamic delivery fee, Midtrans QRIS payment, Admin Dashboard with realtime audio+visual order alerts, inventory management, analytics, support WhatsApp `+6285814420843`.

## Architecture
- **Backend**: FastAPI (`/app/backend/server.py`) + MongoDB (motor). Auth via bcrypt + custom session_token (7d) stored in `user_sessions` collection. Emergent Google OAuth session bridge. Midtrans Snap for QRIS.
- **Frontend**: React 19 + React Router 7 + shadcn/ui + Tailwind + Leaflet (react-leaflet + OpenStreetMap tiles). Plus Jakarta Sans + JetBrains Mono fonts.
- **Design system**: emerald/amber palette from `/app/design_guidelines.json`.

## User personas
- Household buyer (regular customer)
- Business/HORECA buyer (same portal, benefits from Pelanggan Setia after 10 orders)
- Admin/owner (bagussatrioaje@gmail.com) — inventory, orders, analytics

## Core requirements
- Login + Register (email/password) + Google OAuth
- Storefront with categories, product cards, cart drawer
- Checkout: Leaflet map pin, Haversine distance, dynamic delivery fee (Free at Rp200k/1km, Rp300k/2km, Rp400k/4km, Rp1M/7km; else Rp8k base + Rp2.5k/km beyond 2km), smart "Add Rp X more" bar
- Midtrans QRIS payment + notification webhook
- Real-time order status (Pending, Paid, Processing, Out for Delivery, Completed)
- Pelanggan Setia loyalty badge auto-assigned after 10 completed orders → PRIORITY DELIVERY tag in admin
- Admin: realtime order alerts (audio + visual pulse), inventory CRUD, analytics (revenue, order counts, top customers), WhatsApp support link (`+6285814420843`)

## What's implemented (Feb 2026)
- Auth: register/login/logout, /me, Google OAuth callback
- Products CRUD (admin) + public list & seed
- Cart (client-side context)
- Checkout: Leaflet map, Haversine distance, delivery fee tiers, order create
- Midtrans Snap token creation + notification webhook + signature verify
- Order status flow endpoints
- Pelanggan Setia badge auto-derived from `completed_order_count`
- Admin dashboard: live order feed (poll), audio+visual alert on new pending order, inventory CRUD tab, analytics tab
- Seed admin + sample customers + 12 fresh produce products

## Backlog / next actions
- P1: Real driving-distance via OSRM (optional upgrade)
- P1: Push order status updates to admin via WebSocket instead of polling
- P2: Product search + filters
- P2: Photo upload for inventory (currently uses image URL field)
- P2: Coupon codes

## Update (Juni 2026) — Iterasi 2
- Fixed: email user seed `.test` (ditolak validator) → `setia@wiwiksayur.co.id`, `reguler@wiwiksayur.co.id`. Admin tetap `bagussatrioaje@gmail.com`.
- Testing agent iteration_2: backend 7/7 & frontend 100% lulus — loyalty flag, PRIORITY DELIVERY badge di admin, peta Leaflet + ongkir dinamis, mock Midtrans QRIS, inventori & analitik admin, admin guard 403.
- Ditambahkan DialogDescription (a11y) di Checkout & Admin dialog.
- Backlog: Midtrans production keys (menunggu user), gating audio alert admin di balik toggle, retry pembayaran dari Profile untuk order pending, pertanyaan hosting (Hostinger) — user akan bertanya berikutnya.

## Update — Midtrans Sandbox aktif
- Kunci Midtrans user dipasang di backend/.env (MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY, MIDTRANS_IS_PRODUCTION=false). Kunci terverifikasi = sandbox (ditolak endpoint production).
- Snap popup asli tampil di checkout (merchant "Ajelly Store"). Webhook: /api/payments/midtrans/notification.
- Mock QRIS tidak lagi terpakai selama kunci terisi.
- Untuk production nanti: ganti kunci Mid-server/Mid-client production + MIDTRANS_IS_PRODUCTION=true.

## Update — Toggle Notifikasi Suara Admin
- Tombol "Aktifkan Notifikasi Suara" (data-testid sound-toggle-btn) di header admin; AudioContext di-resume lewat klik user, preferensi tersimpan di localStorage (ws_sound). Beep hanya bunyi jika aktif; alert visual tetap berjalan.

## Update — Spesifikasi Baru (Iterasi 3, lulus 100%)
- Toko: -6.208365, 106.796367 ("Wiwik Sayur Store"). Anti-fraud: tanpa geser pin; alamat teks → Nominatim (fallback bertahap, cache db.geocache) → jarak rute OSRM (fallback haversine×1.3). Order geocode ulang di server (lat/lng klien diabaikan).
- Ongkir: tier gratis (200k/1km, 300k/2km, 400k/4km, 1jt/7km); Rp8.000 ≤2 km + Rp2.500/km (ceil). POST /api/shipping/quote {subtotal, distance_km} untuk re-quote murah.
- Katalog 52 produk daftar harga Wiwik (unit kg/pcs), migrasi satu kali `meta.catalog_v2` (hapus produk & pesanan lama). Qty float (kg) / int (pcs); minimal 100 g; QtyPicker (preset 250g/500g/1kg/2kg + input g/kg).
- Midtrans sandbox nyata: callbacks finish/error/pending → /payment/success|failed|pending?order_id=; GET /api/payments/status/{id} sinkron status ke Midtrans; mock-pay dinonaktifkan saat kunci ada.
- Tracking /track/:orderId: stepper 4 langkah, kurir animasi di rute OSRM (dispatched_at, durasi = duration_min×1.5), polling 5 dtk.
- Admin: tab Peta (pin toko/pelanggan + link Google Maps Directions), modal alert pesanan baru saat payment_status → paid (+suara jika toggle aktif), badge "PRIORITY DISPATCH / DIDAHULUKAN", bulk harga (persen per kategori / per produk), analitik recharts (harian/mingguan/bulanan, popular items, pertumbuhan pelanggan), CRUD unit kg/pcs/pack.
- Tes: /app/backend/tests/test_wiwik_spec.py (14 lulus), report iteration_3.json.
- Backlog: auto-cancel pesanan unpaid + kembalikan stok; gambar produk spesifik per item; ganti kata sandi.
