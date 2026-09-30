"""Wiwik Sayur backend spec tests (iteration 3 rewrite).
Covers: products (52), store info, geo/resolve, orders (server geocode),
Midtrans token (real sandbox), payment status, admin status flow, bulk-price, analytics.
"""
import os
import time
import math
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL must be set (from frontend/.env)"
API = f"{BASE}/api"

ADMIN = ("bagussatrioaje@gmail.com", "Admin@123")
REGULAR = ("reguler@wiwiksayur.co.id", "Reguler@123")
LOYAL = ("setia@wiwiksayur.co.id", "Setia@123")


def _login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["session_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def admin_tok():
    return _login(*ADMIN)


@pytest.fixture(scope="session")
def cust_tok():
    return _login(*REGULAR)


# ---------- Public / catalog ----------
def test_products_52_items_and_units():
    r = requests.get(f"{API}/products", timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 52, f"expected 52 products got {len(data)}"
    units = {p["unit"] for p in data}
    assert "kg" in units and "pcs" in units
    # Spot check specific prices
    by_name = {p["name"]: p for p in data}
    assert by_name["Cabe Kriting Merah"]["price"] == 60000
    assert by_name["Cabe Kriting Merah"]["unit"] == "kg"
    assert by_name["Jagung Manis"]["price"] == 6000
    assert by_name["Jagung Manis"]["unit"] == "pcs"


def test_store_info_coords():
    r = requests.get(f"{API}/store/info", timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert abs(d["lat"] - (-6.208365)) < 1e-6
    assert abs(d["lng"] - 106.796367) < 1e-6
    assert d["support_whatsapp"].endswith("85814420843")


# ---------- Geocoding + shipping quote ----------
def test_geo_resolve_senopati_low_subtotal():
    payload = {"address": "Jl. Senopati No. 10, Selong, Kebayoran Baru, Jakarta Selatan", "subtotal": 100000}
    r = requests.post(f"{API}/geo/resolve", json=payload, timeout=40)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "lat" in d and "lng" in d
    assert isinstance(d.get("route"), list) and len(d["route"]) >= 2
    dk = d["distance_km"]
    assert 3.0 < dk < 9.0, f"distance {dk} out of expected range"
    expected_fee = 8000 if dk <= 2 else 8000 + math.ceil(dk - 2) * 2500
    assert d["fee"] == expected_fee
    assert d.get("free") is False


def test_geo_resolve_free_shipping_high_subtotal():
    time.sleep(1.2)  # respect nominatim rate limit
    payload = {"address": "Jl. Senopati No. 10, Selong, Kebayoran Baru, Jakarta Selatan", "subtotal": 1000000}
    r = requests.post(f"{API}/geo/resolve", json=payload, timeout=40)
    assert r.status_code == 200
    d = r.json()
    if d["distance_km"] <= 7:
        assert d["free"] is True
        assert d["fee"] == 0


def test_geo_resolve_bad_address_404():
    time.sleep(1.2)
    r = requests.post(f"{API}/geo/resolve", json={"address": "xxxxxx qqqqqqq zzzzzzz", "subtotal": 0}, timeout=40)
    assert r.status_code == 404


# ---------- Orders: server-side geocode ----------
def _find_pid(name):
    r = requests.get(f"{API}/products", timeout=20)
    for p in r.json():
        if p["name"] == name:
            return p
    raise AssertionError(name)


def test_create_order_kg_line_total_and_labels(cust_tok):
    time.sleep(1.2)
    prod = _find_pid("Cabe Kriting Merah")
    body = {
        "items": [{"product_id": prod["product_id"], "quantity": 0.2}],
        "address": "Jl. Senopati No. 10, Selong, Kebayoran Baru, Jakarta Selatan",
        "recipient_name": "Test Recipient",
        "recipient_phone": "+628111111111",
        "notes": "TEST",
    }
    r = requests.post(f"{API}/orders", json=body, headers=_h(cust_tok), timeout=40)
    assert r.status_code == 200, r.text
    o = r.json()
    assert o["items"][0]["line_total"] == 12000
    assert o["items"][0]["quantity_label"] == "200 g"
    assert "lat" in o and "lng" in o and "verified_address" in o
    assert "distance_km" in o and isinstance(o["route"], list)
    return o["order_id"]


def test_create_order_pcs_works(cust_tok):
    time.sleep(1.2)
    prod = _find_pid("Jagung Manis")
    body = {
        "items": [{"product_id": prod["product_id"], "quantity": 2}],
        "address": "Jl. Senopati No. 10, Selong, Kebayoran Baru, Jakarta Selatan",
        "recipient_name": "T", "recipient_phone": "+628111111111",
    }
    r = requests.post(f"{API}/orders", json=body, headers=_h(cust_tok), timeout=40)
    assert r.status_code == 200
    o = r.json()
    assert o["items"][0]["line_total"] == 12000
    assert o["items"][0]["quantity_label"] == "2 pcs"


def test_create_order_kg_min_reject(cust_tok):
    time.sleep(1.2)
    prod = _find_pid("Cabe Kriting Merah")
    body = {
        "items": [{"product_id": prod["product_id"], "quantity": 0.05}],
        "address": "Jl. Senopati No. 10, Selong, Kebayoran Baru, Jakarta Selatan",
        "recipient_name": "T", "recipient_phone": "+628111111111",
    }
    r = requests.post(f"{API}/orders", json=body, headers=_h(cust_tok), timeout=40)
    assert r.status_code == 400


# ---------- Midtrans ----------
def test_midtrans_token_real_sandbox(cust_tok):
    time.sleep(1.2)
    prod = _find_pid("Cabe Kriting Merah")
    body = {
        "items": [{"product_id": prod["product_id"], "quantity": 0.5}],
        "address": "Jl. Senopati No. 10, Selong, Kebayoran Baru, Jakarta Selatan",
        "recipient_name": "T", "recipient_phone": "+628111111111",
    }
    r = requests.post(f"{API}/orders", json=body, headers=_h(cust_tok), timeout=40)
    assert r.status_code == 200
    oid = r.json()["order_id"]
    r = requests.post(f"{API}/payments/midtrans/token", json={"order_id": oid}, headers=_h(cust_tok), timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["mock"] is False
    assert d["token"] and not d["token"].startswith("MOCK-")
    tok1 = d["token"]
    # second call returns same token (persisted)
    r2 = requests.post(f"{API}/payments/midtrans/token", json={"order_id": oid}, headers=_h(cust_tok), timeout=30)
    assert r2.json()["token"] == tok1
    # payment status still pending
    r3 = requests.get(f"{API}/payments/status/{oid}", headers=_h(cust_tok), timeout=30)
    assert r3.status_code == 200
    assert r3.json()["payment_status"] in ("unpaid", "pending")
    return oid


def test_mock_pay_disabled(cust_tok):
    time.sleep(1.2)
    prod = _find_pid("Jagung Manis")
    body = {
        "items": [{"product_id": prod["product_id"], "quantity": 1}],
        "address": "Jl. Senopati No. 10, Selong, Kebayoran Baru, Jakarta Selatan",
        "recipient_name": "T", "recipient_phone": "+628111111111",
    }
    r = requests.post(f"{API}/orders", json=body, headers=_h(cust_tok), timeout=40)
    oid = r.json()["order_id"]
    r2 = requests.post(f"{API}/payments/midtrans/mock-pay/{oid}", headers=_h(cust_tok), timeout=20)
    assert r2.status_code == 400


# ---------- Admin: status + counters + order detail ----------
def test_admin_status_flow(admin_tok, cust_tok):
    time.sleep(1.2)
    prod = _find_pid("Jagung Manis")
    body = {
        "items": [{"product_id": prod["product_id"], "quantity": 1}],
        "address": "Jl. Senopati No. 10, Selong, Kebayoran Baru, Jakarta Selatan",
        "recipient_name": "T", "recipient_phone": "+628111111111",
    }
    oid = requests.post(f"{API}/orders", json=body, headers=_h(cust_tok), timeout=40).json()["order_id"]

    # Get baseline completed_count for reguler
    me = requests.get(f"{API}/auth/me", headers=_h(cust_tok), timeout=20).json()
    baseline = me["completed_order_count"]

    for st in ["paid", "processing", "out_for_delivery", "completed"]:
        r = requests.put(f"{API}/admin/orders/{oid}/status", json={"status": st}, headers=_h(admin_tok), timeout=20)
        assert r.status_code == 200, f"{st}: {r.text}"

    o = requests.get(f"{API}/orders/{oid}", headers=_h(admin_tok), timeout=20).json()
    assert o["status"] == "completed"
    assert o.get("dispatched_at")
    assert o.get("delivered_at")
    assert "route" in o and isinstance(o["route"], list)
    assert "store" in o and o["store"]["lat"]

    me2 = requests.get(f"{API}/auth/me", headers=_h(cust_tok), timeout=20).json()
    assert me2["completed_order_count"] == baseline + 1


# ---------- Bulk price + admin guard ----------
def test_bulk_price_percent_category_admin_only(admin_tok, cust_tok):
    # customer forbidden
    r = requests.put(f"{API}/admin/products/bulk-price", json={"percent": 10, "category": "Bawang"}, headers=_h(cust_tok), timeout=20)
    assert r.status_code == 403

    before = {p["product_id"]: p["price"] for p in requests.get(f"{API}/products", timeout=20).json()}
    r = requests.put(f"{API}/admin/products/bulk-price", json={"percent": 10, "category": "Bawang"}, headers=_h(admin_tok), timeout=20)
    assert r.status_code == 200
    after_list = requests.get(f"{API}/products", timeout=20).json()
    for p in after_list:
        if p["category"] == "Bawang":
            expected = int(round(before[p["product_id"]] * 1.10 / 100.0) * 100)
            assert p["price"] == max(100, expected), f"{p['name']} price {p['price']} != {expected}"
        else:
            assert p["price"] == before[p["product_id"]], f"non-Bawang {p['name']} changed"

    # Restore prices via updates payload
    updates = [{"product_id": pid, "price": before[pid]} for pid in before]
    r = requests.put(f"{API}/admin/products/bulk-price", json={"updates": updates}, headers=_h(admin_tok), timeout=30)
    assert r.status_code == 200


# ---------- Analytics ----------
def test_admin_analytics_schema(admin_tok):
    r = requests.get(f"{API}/admin/analytics", headers=_h(admin_tok), timeout=30)
    assert r.status_code == 200
    d = r.json()
    for k in ["daily", "weekly", "monthly", "popular_items", "customer_growth", "total_customers", "total_revenue", "total_orders"]:
        assert k in d, f"missing {k}"
    assert isinstance(d["daily"], list)
    assert isinstance(d["popular_items"], list)
    assert isinstance(d["customer_growth"], list)


# ---------- Loyal user priority ----------
def test_loyal_user_priority_order():
    time.sleep(1.2)
    tok = _login(*LOYAL)
    prod = _find_pid("Jagung Manis")
    body = {
        "items": [{"product_id": prod["product_id"], "quantity": 1}],
        "address": "Jl. Senopati No. 10, Selong, Kebayoran Baru, Jakarta Selatan",
        "recipient_name": "T", "recipient_phone": "+628111111111",
    }
    r = requests.post(f"{API}/orders", json=body, headers=_h(tok), timeout=40)
    assert r.status_code == 200
    assert r.json()["is_priority"] is True
