from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import asyncio
import logging
import math
import uuid
import base64
import hashlib
import hmac
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
import bcrypt
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

STORE_LAT = float(os.environ.get('STORE_LAT', '-6.208365'))
STORE_LNG = float(os.environ.get('STORE_LNG', '106.796367'))
STORE_NAME = os.environ.get('STORE_NAME', 'Wiwik Sayur Store')
STORE_ADDRESS = os.environ.get('STORE_ADDRESS', 'Jakarta Selatan, Indonesia')
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'bagussatrioaje@gmail.com').lower()
MIDTRANS_SERVER_KEY = os.environ.get('MIDTRANS_SERVER_KEY', '')
MIDTRANS_CLIENT_KEY = os.environ.get('MIDTRANS_CLIENT_KEY', '')
MIDTRANS_IS_PRODUCTION = os.environ.get('MIDTRANS_IS_PRODUCTION', 'false').lower() == 'true'
MIDTRANS_SNAP = (
    "https://app.midtrans.com/snap/v1/transactions" if MIDTRANS_IS_PRODUCTION
    else "https://app.sandbox.midtrans.com/snap/v1/transactions"
)
MIDTRANS_API = "https://api.midtrans.com/v2" if MIDTRANS_IS_PRODUCTION else "https://api.sandbox.midtrans.com/v2"
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_URL = "https://router.project-osrm.org/route/v1/driving"
GEO_UA = "wiwiksayur.com/1.0 (bagussatrioaje@gmail.com)"
SUPPORT_WA = "+6285814420843"

app = FastAPI()
api = APIRouter(prefix="/api")


# ============ Utility ============
def now_utc():
    return datetime.now(timezone.utc)


def haversine_km(lat1, lng1, lat2, lng2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


DEFAULT_SHIPPING = {
    "free_tiers": [{"min_spend": 200000, "max_km": 1}, {"min_spend": 300000, "max_km": 2}, {"min_spend": 400000, "max_km": 4}, {"min_spend": 1000000, "max_km": 7}],
    "base_fee": 8000, "base_km": 2, "per_km_fee": 2500, "max_km": 0,
}
_shipping_cfg = dict(DEFAULT_SHIPPING)


async def load_shipping_cfg():
    global _shipping_cfg
    doc = await db.settings.find_one({"key": "shipping"}, {"_id": 0, "key": 0})
    _shipping_cfg = {**DEFAULT_SHIPPING, **(doc or {})}
    return _shipping_cfg


def calculate_delivery_fee(subtotal: int, distance_km: float):
    cfg = _shipping_cfg
    tiers = sorted(cfg["free_tiers"], key=lambda t: t["min_spend"])
    if cfg.get("max_km") and distance_km > cfg["max_km"]:
        return {"fee": 0, "free": False, "out_of_range": True, "reason": f"Di luar jangkauan pengiriman (maks {cfg['max_km']} km)"}
    for t in tiers:
        if subtotal >= t["min_spend"] and distance_km <= t["max_km"]:
            return {"fee": 0, "free": True, "reason": f"GRATIS ONGKIR (belanja ≥ Rp{t['min_spend']:,} dalam {t['max_km']} km)"}
    fee = cfg["base_fee"] if distance_km <= cfg["base_km"] else cfg["base_fee"] + math.ceil(distance_km - cfg["base_km"]) * cfg["per_km_fee"]
    upgrade = None
    for t in tiers:
        if distance_km <= t["max_km"] and subtotal < t["min_spend"]:
            gap = t["min_spend"] - subtotal
            if upgrade is None or gap < upgrade["gap"]:
                upgrade = {"gap": gap, "min_spend": t["min_spend"], "max_dist": t["max_km"]}
    return {"fee": int(fee), "free": False, "upgrade": upgrade}


def apply_voucher(v: dict, subtotal: int, fee: int) -> int:
    if v["type"] == "percent":
        d = int(subtotal * v["value"] / 100)
        if v.get("max_discount"):
            d = min(d, v["max_discount"])
        return min(d, subtotal)
    if v["type"] == "fixed":
        return min(int(v["value"]), subtotal)
    if v["type"] == "free_shipping":
        return fee
    return 0


async def validate_voucher(code: str, subtotal: int, fee: int, user_id: Optional[str] = None) -> dict:
    v = await db.vouchers.find_one({"code": code.strip().upper()}, {"_id": 0})
    if not v or not v.get("is_active"):
        raise HTTPException(400, "Kode voucher tidak valid")
    if v.get("expires_at") and datetime.fromisoformat(v["expires_at"]) < now_utc():
        raise HTTPException(400, "Voucher sudah kedaluwarsa")
    if v.get("quota") and v.get("used_count", 0) >= v["quota"]:
        raise HTTPException(400, "Kuota voucher sudah habis")
    if subtotal < v.get("min_spend", 0):
        raise HTTPException(400, f"Minimal belanja Rp{v['min_spend']:,} untuk voucher ini")
    if user_id and v.get("once_per_user") and await db.orders.find_one({"user_id": user_id, "voucher_code": v["code"], "status": {"$ne": "cancelled"}}):
        raise HTTPException(400, "Voucher sudah pernah Anda gunakan")
    if v["type"] == "free_shipping" and fee == 0:
        raise HTTPException(400, "Ongkir sudah gratis, voucher tidak diperlukan")
    return {**v, "discount": apply_voucher(v, subtotal, fee)}


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


async def create_session(user_id: str) -> str:
    token = f"ws_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": (now_utc() + timedelta(days=7)).isoformat(),
        "created_at": now_utc().isoformat(),
    })
    return token


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(401, "Invalid session")
    expires_at = sess["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now_utc():
        raise HTTPException(401, "Session expired")
    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    if user["email"].lower() == ADMIN_EMAIL and user.get("role") != "admin":
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"role": "admin"}})
        user["role"] = "admin"
    user["is_pelanggan_setia"] = user.get("completed_order_count", 0) >= 10
    return user


async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user


def user_public(u: dict) -> dict:
    return {
        "user_id": u["user_id"],
        "email": u["email"],
        "name": u.get("name", ""),
        "phone": u.get("phone", ""),
        "role": u.get("role", "customer"),
        "completed_order_count": u.get("completed_order_count", 0),
        "is_pelanggan_setia": u.get("completed_order_count", 0) >= 10,
        "picture": u.get("picture"),
    }


# ============ Geocoding & routing ============
def _normalize_addr(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def _address_variants(address: str) -> List[str]:
    a = re.sub(r"\s+", " ", address.strip())
    variants = [a]
    stripped = re.sub(r"\b(no\.?|nomor)\s*\w+", "", a, flags=re.I)
    stripped = re.sub(r"\brt\.?\s*/?\s*\d+\s*/?\s*(rw\.?\s*\d+)?", "", stripped, flags=re.I)
    stripped = re.sub(r"\brw\.?\s*\d+", "", stripped, flags=re.I)
    stripped = re.sub(r"\b(blok|gang|gg\.?)\s*\w+", "", stripped, flags=re.I)
    stripped = re.sub(r"\s*,\s*", ", ", re.sub(r"\s+", " ", stripped)).strip(" ,")
    if stripped and stripped != a:
        variants.append(stripped)
    parts = [p.strip() for p in stripped.split(",") if p.strip()]
    for i in range(1, len(parts) - 1):
        variants.append(", ".join(parts[i:]))
    seen, out = set(), []
    for v in variants:
        k = v.lower()
        if k not in seen:
            seen.add(k)
            out.append(v)
    return out


async def geocode_address(address: str) -> dict:
    key = _normalize_addr(address)
    cached = await db.geocache.find_one({"key": key}, {"_id": 0})
    if cached:
        return cached
    async with httpx.AsyncClient(timeout=20, headers={"User-Agent": GEO_UA}) as hc:
        for idx, q in enumerate(_address_variants(address)[:5]):
            if idx:
                await asyncio.sleep(1.05)
            r = await hc.get(NOMINATIM_URL, params={"format": "json", "limit": 1, "countrycodes": "id", "addressdetails": 1, "q": q})
            if r.status_code != 200:
                continue
            res = r.json()
            if res:
                hit = res[0]
                doc = {
                    "key": key, "lat": float(hit["lat"]), "lng": float(hit["lon"]),
                    "display_name": hit.get("display_name", q), "matched_query": q,
                    "precision": "exact" if idx == 0 else "approximate",
                    "created_at": now_utc().isoformat(),
                }
                await db.geocache.update_one({"key": key}, {"$set": doc}, upsert=True)
                return doc
    raise HTTPException(404, "Alamat tidak ditemukan. Lengkapi nama jalan, kelurahan, kecamatan, dan kota.")


async def route_from_store(lat: float, lng: float) -> dict:
    straight = haversine_km(STORE_LAT, STORE_LNG, lat, lng)
    try:
        async with httpx.AsyncClient(timeout=15) as hc:
            r = await hc.get(f"{OSRM_URL}/{STORE_LNG},{STORE_LAT};{lng},{lat}", params={"overview": "full", "geometries": "geojson"})
        data = r.json()
        if data.get("code") == "Ok" and data.get("routes"):
            rt = data["routes"][0]
            coords = [[c[1], c[0]] for c in rt["geometry"]["coordinates"]]
            return {"distance_km": round(rt["distance"] / 1000, 2), "duration_min": round(rt["duration"] / 60), "route": coords, "method": "osrm"}
    except Exception as e:
        logging.warning(f"OSRM failed: {e}")
    return {"distance_km": round(straight * 1.3, 2), "duration_min": round(straight * 1.3 * 4), "route": [[STORE_LAT, STORE_LNG], [lat, lng]], "method": "haversine_x1.3"}


# ============ Models ============
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str = Field(min_length=6)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ShippingQuoteIn(BaseModel):
    subtotal: int
    distance_km: float = Field(ge=0)


class GoogleSessionIn(BaseModel):
    session_id: str


class ProductIn(BaseModel):
    name: str
    category: str
    price: int
    unit: Literal["kg", "pcs", "pack"] = "kg"
    stock: float = 0
    image_url: str = ""
    description: str = ""
    is_active: bool = True


class BulkPriceItem(BaseModel):
    product_id: str
    price: int


class BulkPriceIn(BaseModel):
    updates: List[BulkPriceItem] = []
    percent: Optional[float] = None
    category: Optional[str] = None


class GeoResolveIn(BaseModel):
    address: str = Field(min_length=8)
    subtotal: int = 0


class OrderItemIn(BaseModel):
    product_id: str
    quantity: float = Field(gt=0)


class CreateOrderIn(BaseModel):
    items: List[OrderItemIn]
    address: str = Field(min_length=8)
    recipient_name: str
    recipient_phone: str
    notes: str = ""
    voucher_code: Optional[str] = None


class FreeTier(BaseModel):
    min_spend: int = Field(ge=0)
    max_km: float = Field(ge=0)


class ShippingSettingsIn(BaseModel):
    free_tiers: List[FreeTier]
    base_fee: int = Field(ge=0)
    base_km: float = Field(ge=0)
    per_km_fee: int = Field(ge=0)
    max_km: float = Field(ge=0, default=0)


class VoucherIn(BaseModel):
    code: Optional[str] = None
    type: Literal["percent", "fixed", "free_shipping"]
    value: float = 0
    min_spend: int = 0
    max_discount: Optional[int] = None
    quota: Optional[int] = None
    expires_at: Optional[str] = None
    once_per_user: bool = False
    is_active: bool = True
    description: str = ""


class VoucherGenerateIn(VoucherIn):
    count: int = Field(ge=1, le=200, default=1)
    prefix: str = "WWK"


class VoucherValidateIn(BaseModel):
    code: str
    subtotal: int
    distance_km: float = 0


class UpdateOrderStatusIn(BaseModel):
    status: Literal["pending", "paid", "processing", "out_for_delivery", "completed", "cancelled"]


# ============ Auth endpoints ============
def _set_cookie(response: Response, token: str):
    response.set_cookie("session_token", token, max_age=7 * 24 * 3600, httponly=True, secure=True, samesite="none", path="/")


@api.post("/auth/register")
async def register(data: RegisterIn, response: Response):
    if await db.users.find_one({"email": data.email.lower()}):
        raise HTTPException(400, "Email sudah terdaftar")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": user_id, "email": data.email.lower(), "name": data.name, "phone": data.phone,
        "password_hash": hash_password(data.password),
        "role": "admin" if data.email.lower() == ADMIN_EMAIL else "customer",
        "completed_order_count": 0, "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(doc)
    token = await create_session(user_id)
    _set_cookie(response, token)
    return {"session_token": token, "user": user_public(doc)}


@api.post("/auth/login")
async def login(data: LoginIn, response: Response):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not user.get("password_hash") or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Email atau kata sandi salah")
    if user["email"].lower() == ADMIN_EMAIL and user.get("role") != "admin":
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"role": "admin"}})
        user["role"] = "admin"
    token = await create_session(user["user_id"])
    _set_cookie(response, token)
    return {"session_token": token, "user": user_public(user)}


@api.post("/auth/google/session")
async def google_session(data: GoogleSessionIn, response: Response):
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": data.session_id})
    if r.status_code != 200:
        raise HTTPException(401, "Google session invalid")
    payload = r.json()
    email = payload["email"].lower()
    user = await db.users.find_one({"email": email})
    if not user:
        user = {
            "user_id": f"user_{uuid.uuid4().hex[:12]}", "email": email, "name": payload.get("name", ""), "phone": "",
            "picture": payload.get("picture"), "role": "admin" if email == ADMIN_EMAIL else "customer",
            "completed_order_count": 0, "created_at": now_utc().isoformat(),
        }
        await db.users.insert_one(user)
    else:
        updates = {"picture": payload.get("picture")}
        if email == ADMIN_EMAIL and user.get("role") != "admin":
            updates["role"] = "admin"
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
        user.update(updates)
    token = payload.get("session_token") or f"ws_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "user_id": user["user_id"], "session_token": token,
        "expires_at": (now_utc() + timedelta(days=7)).isoformat(), "created_at": now_utc().isoformat(),
    })
    _set_cookie(response, token)
    return {"session_token": token, "user": user_public(user)}


@api.get("/auth/me")
async def me(request: Request):
    return user_public(await get_current_user(request))


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ============ Store / geo ============
@api.get("/store/info")
async def store_info():
    return {
        "name": STORE_NAME, "address": STORE_ADDRESS, "lat": STORE_LAT, "lng": STORE_LNG,
        "support_whatsapp": SUPPORT_WA, "support_whatsapp_link": "https://wa.me/6285814420843",
        "free_tiers": _shipping_cfg["free_tiers"], "shipping": _shipping_cfg,
    }


@api.get("/settings/shipping")
async def get_shipping_settings():
    return _shipping_cfg


@api.put("/admin/settings/shipping")
async def put_shipping_settings(data: ShippingSettingsIn, request: Request):
    await require_admin(request)
    await db.settings.update_one({"key": "shipping"}, {"$set": {"key": "shipping", **data.model_dump(), "updated_at": now_utc().isoformat()}}, upsert=True)
    return await load_shipping_cfg()


# ============ Vouchers ============
def _gen_code(prefix: str) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return f"{prefix.upper()}-{''.join(alphabet[b % len(alphabet)] for b in os.urandom(6))}"


def _voucher_doc(data: VoucherIn, code: str) -> dict:
    return {"voucher_id": f"vch_{uuid.uuid4().hex[:10]}", **data.model_dump(exclude={"count", "prefix"}), "code": code, "used_count": 0, "created_at": now_utc().isoformat()}


@api.post("/vouchers/validate")
async def voucher_validate(data: VoucherValidateIn, request: Request):
    user_id = None
    try:
        user_id = (await get_current_user(request))["user_id"]
    except HTTPException:
        pass
    fee = calculate_delivery_fee(data.subtotal, data.distance_km)["fee"]
    v = await validate_voucher(data.code, data.subtotal, fee, user_id)
    return {"code": v["code"], "type": v["type"], "value": v["value"], "discount": v["discount"], "description": v.get("description", "")}


@api.get("/admin/vouchers")
async def admin_vouchers(request: Request):
    await require_admin(request)
    return await db.vouchers.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.post("/admin/vouchers")
async def admin_create_voucher(data: VoucherIn, request: Request):
    await require_admin(request)
    code = (data.code or _gen_code("WWK")).strip().upper()
    if await db.vouchers.find_one({"code": code}):
        raise HTTPException(400, "Kode sudah ada")
    doc = _voucher_doc(data, code)
    await db.vouchers.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.post("/admin/vouchers/generate")
async def admin_generate_vouchers(data: VoucherGenerateIn, request: Request):
    await require_admin(request)
    docs = []
    while len(docs) < data.count:
        code = _gen_code(data.prefix or "WWK")
        if not await db.vouchers.find_one({"code": code}):
            docs.append(_voucher_doc(data, code))
    await db.vouchers.insert_many(docs)
    return [{k: v for k, v in d.items() if k != "_id"} for d in docs]


@api.put("/admin/vouchers/{voucher_id}")
async def admin_update_voucher(voucher_id: str, data: VoucherIn, request: Request):
    await require_admin(request)
    upd = data.model_dump(exclude={"code"})
    if data.code:
        upd["code"] = data.code.strip().upper()
    r = await db.vouchers.update_one({"voucher_id": voucher_id}, {"$set": upd})
    if not r.matched_count:
        raise HTTPException(404, "Not found")
    return await db.vouchers.find_one({"voucher_id": voucher_id}, {"_id": 0})


@api.delete("/admin/vouchers/{voucher_id}")
async def admin_delete_voucher(voucher_id: str, request: Request):
    await require_admin(request)
    await db.vouchers.delete_one({"voucher_id": voucher_id})
    return {"ok": True}


@api.post("/shipping/quote")
async def shipping_quote(data: ShippingQuoteIn):
    return {"distance_km": data.distance_km, **calculate_delivery_fee(data.subtotal, data.distance_km)}


@api.post("/geo/resolve")
async def geo_resolve(data: GeoResolveIn):
    geo = await geocode_address(data.address)
    rt = await route_from_store(geo["lat"], geo["lng"])
    quote = calculate_delivery_fee(data.subtotal, rt["distance_km"])
    return {
        "lat": geo["lat"], "lng": geo["lng"], "display_name": geo["display_name"], "precision": geo["precision"],
        "distance_km": rt["distance_km"], "duration_min": rt["duration_min"], "route": rt["route"], **quote,
    }


# ============ Products ============
@api.get("/products")
async def list_products(category: Optional[str] = None):
    query = {"is_active": True}
    if category:
        query["category"] = category
    return await db.products.find(query, {"_id": 0}).sort("sort", 1).to_list(500)


@api.get("/products/categories")
async def list_categories():
    docs = await db.products.find({"is_active": True}, {"_id": 0, "category": 1, "sort": 1}).sort("sort", 1).to_list(500)
    out = []
    for d in docs:
        if d["category"] not in out:
            out.append(d["category"])
    return out


@api.get("/admin/products")
async def admin_products(request: Request):
    await require_admin(request)
    return await db.products.find({}, {"_id": 0}).sort("sort", 1).to_list(500)


@api.post("/products")
async def create_product(data: ProductIn, request: Request):
    await require_admin(request)
    pid = f"prod_{uuid.uuid4().hex[:10]}"
    doc = {"product_id": pid, **data.model_dump(), "sort": 999, "created_at": now_utc().isoformat()}
    await db.products.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.put("/products/{product_id}")
async def update_product(product_id: str, data: ProductIn, request: Request):
    await require_admin(request)
    await db.products.update_one({"product_id": product_id}, {"$set": {**data.model_dump(), "updated_at": now_utc().isoformat()}})
    doc = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    return doc


@api.put("/admin/products/bulk-price")
async def bulk_price(data: BulkPriceIn, request: Request):
    await require_admin(request)
    changed = 0
    if data.percent is not None:
        q = {"category": data.category} if data.category else {}
        async for p in db.products.find(q, {"_id": 0, "product_id": 1, "price": 1}):
            new_price = int(round(p["price"] * (1 + data.percent / 100) / 100.0) * 100)
            await db.products.update_one({"product_id": p["product_id"]}, {"$set": {"price": max(100, new_price), "updated_at": now_utc().isoformat()}})
            changed += 1
    for u in data.updates:
        r = await db.products.update_one({"product_id": u.product_id}, {"$set": {"price": u.price, "updated_at": now_utc().isoformat()}})
        changed += r.modified_count
    return {"ok": True, "changed": changed}


@api.delete("/products/{product_id}")
async def delete_product(product_id: str, request: Request):
    await require_admin(request)
    await db.products.delete_one({"product_id": product_id})
    return {"ok": True}


# ============ Orders ============
def fmt_qty(qty: float, unit: str) -> str:
    if unit == "kg":
        grams = round(qty * 1000)
        return f"{grams} g" if grams < 1000 else f"{grams / 1000:g} kg"
    return f"{int(qty)} {unit}"


async def _load_items(items_in: List[OrderItemIn]):
    out, subtotal = [], 0
    for it in items_in:
        p = await db.products.find_one({"product_id": it.product_id}, {"_id": 0})
        if not p:
            raise HTTPException(400, f"Produk {it.product_id} tidak ditemukan")
        qty = it.quantity
        if p["unit"] == "kg":
            qty = round(qty, 3)
            if qty < 0.1:
                raise HTTPException(400, f"Minimal pembelian {p['name']} adalah 100 g")
        else:
            qty = int(qty)
            if qty < 1:
                raise HTTPException(400, f"Jumlah {p['name']} tidak valid")
        if p["stock"] < qty:
            raise HTTPException(400, f"Stok {p['name']} tidak cukup")
        line = int(round(p["price"] * qty))
        subtotal += line
        out.append({
            "product_id": p["product_id"], "name": p["name"], "unit": p["unit"], "price": p["price"],
            "quantity": qty, "quantity_label": fmt_qty(qty, p["unit"]),
            "grams": round(qty * 1000) if p["unit"] == "kg" else None,
            "line_total": line, "image_url": p.get("image_url", ""),
        })
    return out, subtotal


@api.post("/orders")
async def create_order(data: CreateOrderIn, request: Request):
    user = await get_current_user(request)
    items, subtotal = await _load_items(data.items)
    geo = await geocode_address(data.address)
    rt = await route_from_store(geo["lat"], geo["lng"])
    ship = calculate_delivery_fee(subtotal, rt["distance_km"])
    if ship.get("out_of_range"):
        raise HTTPException(400, ship["reason"])
    discount, voucher = 0, None
    if data.voucher_code:
        voucher = await validate_voucher(data.voucher_code, subtotal, ship["fee"], user["user_id"])
        discount = voucher["discount"]
    total = subtotal + ship["fee"] - discount
    order_id = f"WWK-{uuid.uuid4().hex[:10].upper()}"
    doc = {
        "order_id": order_id, "user_id": user["user_id"],
        "customer_name": user["name"], "customer_email": user["email"], "customer_phone": user.get("phone", ""),
        "items": items, "subtotal": subtotal,
        "distance_km": rt["distance_km"], "duration_min": rt["duration_min"], "route": rt["route"],
        "delivery_fee": ship["fee"], "free_shipping": ship["free"],
        "voucher_code": voucher["code"] if voucher else None, "discount": discount, "total": total,
        "address": data.address, "verified_address": geo["display_name"], "geo_precision": geo["precision"],
        "recipient_name": data.recipient_name, "recipient_phone": data.recipient_phone,
        "lat": geo["lat"], "lng": geo["lng"], "notes": data.notes,
        "status": "pending", "payment_status": "unpaid",
        "is_priority": user.get("completed_order_count", 0) >= 10,
        "created_at": now_utc().isoformat(), "updated_at": now_utc().isoformat(),
    }
    await db.orders.insert_one(doc)
    if voucher:
        await db.vouchers.update_one({"code": voucher["code"]}, {"$inc": {"used_count": 1}})
    for it in items:
        await db.products.update_one({"product_id": it["product_id"]}, {"$inc": {"stock": -it["quantity"]}})
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/orders/mine")
async def my_orders(request: Request):
    user = await get_current_user(request)
    return await db.orders.find({"user_id": user["user_id"]}, {"_id": 0, "route": 0}).sort("created_at", -1).to_list(200)


@api.get("/orders/{order_id}")
async def get_order(order_id: str, request: Request):
    user = await get_current_user(request)
    o = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Not found")
    if user.get("role") != "admin" and o["user_id"] != user["user_id"]:
        raise HTTPException(403, "Forbidden")
    o["store"] = {"lat": STORE_LAT, "lng": STORE_LNG, "name": STORE_NAME}
    return o


@api.get("/admin/orders")
async def admin_orders(request: Request, status: Optional[str] = None):
    await require_admin(request)
    q = {"status": status} if status else {}
    return await db.orders.find(q, {"_id": 0, "route": 0}).sort("created_at", -1).to_list(500)


@api.put("/admin/orders/{order_id}/status")
async def admin_update_status(order_id: str, data: UpdateOrderStatusIn, request: Request):
    await require_admin(request)
    o = await db.orders.find_one({"order_id": order_id})
    if not o:
        raise HTTPException(404, "Not found")
    old_status = o["status"]
    updates = {"status": data.status, "updated_at": now_utc().isoformat()}
    if data.status == "paid":
        updates["payment_status"] = "paid"
    if data.status == "out_for_delivery" and old_status != "out_for_delivery":
        updates["dispatched_at"] = now_utc().isoformat()
    if data.status == "completed":
        updates["delivered_at"] = now_utc().isoformat()
    await db.orders.update_one({"order_id": order_id}, {"$set": updates})
    if data.status == "completed" and old_status != "completed":
        await db.users.update_one({"user_id": o["user_id"]}, {"$inc": {"completed_order_count": 1}})
    return {"ok": True}


# ============ Midtrans ============
def midtrans_auth_header():
    return "Basic " + base64.b64encode(f"{MIDTRANS_SERVER_KEY}:".encode()).decode()


def _apply_midtrans_status(o: dict, tx: str, fraud: Optional[str], payment_type: Optional[str]):
    if tx in ("settlement", "capture") and fraud in (None, "accept"):
        new_status = "paid"
    elif tx in ("deny", "cancel", "expire", "failure", "refund"):
        new_status = "cancelled"
    else:
        new_status = "pending"
    updates = {"payment_method": payment_type, "midtrans_status": tx, "updated_at": now_utc().isoformat()}
    if new_status == "paid":
        updates.update({"payment_status": "paid", "paid_at": now_utc().isoformat()})
        if o.get("status") == "pending":
            updates["status"] = "paid"
    elif new_status == "cancelled" and o.get("status") == "pending":
        updates["status"] = "cancelled"
    return updates


@api.post("/payments/midtrans/token")
async def midtrans_token(payload: dict, request: Request):
    user = await get_current_user(request)
    order_id = payload.get("order_id")
    o = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not o or o["user_id"] != user["user_id"]:
        raise HTTPException(404, "Order tidak ditemukan")
    if o.get("payment_status") == "paid":
        raise HTTPException(400, "Pesanan sudah dibayar")
    if o.get("snap_token") and not str(o["snap_token"]).startswith("MOCK-"):
        return {"token": o["snap_token"], "mock": False, "client_key": MIDTRANS_CLIENT_KEY, "is_production": MIDTRANS_IS_PRODUCTION}
    if not MIDTRANS_SERVER_KEY:
        mock_token = f"MOCK-{order_id}"
        await db.orders.update_one({"order_id": order_id}, {"$set": {"snap_token": mock_token, "payment_method": "mock"}})
        return {"token": mock_token, "mock": True, "client_key": MIDTRANS_CLIENT_KEY, "is_production": MIDTRANS_IS_PRODUCTION}
    origin = request.headers.get("origin") or payload.get("origin") or ""
    body = {
        "transaction_details": {"order_id": order_id, "gross_amount": o["total"]},
        "enabled_payments": ["gopay", "shopeepay", "other_qris", "bank_transfer"],
        "customer_details": {"first_name": o["customer_name"], "email": o["customer_email"], "phone": o["customer_phone"] or ""},
        "item_details": [
            {"id": i["product_id"], "price": i["line_total"], "quantity": 1, "name": f"{i['name']} {i['quantity_label']}"[:50]}
            for i in o["items"]
        ] + ([{"id": "SHIP", "price": o["delivery_fee"], "quantity": 1, "name": "Ongkir"}] if o["delivery_fee"] > 0 else [])
          + ([{"id": "DISC", "price": -o["discount"], "quantity": 1, "name": f"Diskon {o.get('voucher_code', '')}"[:50]}] if o.get("discount") else []),
    }
    if origin:
        body["callbacks"] = {"finish": f"{origin}/payment/success?order_id={order_id}", "error": f"{origin}/payment/failed?order_id={order_id}", "pending": f"{origin}/payment/pending?order_id={order_id}"}
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.post(MIDTRANS_SNAP, headers={"Accept": "application/json", "Content-Type": "application/json", "Authorization": midtrans_auth_header()}, json=body)
    if r.status_code not in (200, 201):
        raise HTTPException(502, f"Midtrans error: {r.text}")
    tok = r.json()["token"]
    await db.orders.update_one({"order_id": order_id}, {"$set": {"snap_token": tok}})
    return {"token": tok, "mock": False, "client_key": MIDTRANS_CLIENT_KEY, "is_production": MIDTRANS_IS_PRODUCTION}


@api.post("/payments/midtrans/mock-pay/{order_id}")
async def midtrans_mock_pay(order_id: str, request: Request):
    user = await get_current_user(request)
    o = await db.orders.find_one({"order_id": order_id})
    if not o or o["user_id"] != user["user_id"]:
        raise HTTPException(404, "Not found")
    if MIDTRANS_SERVER_KEY:
        raise HTTPException(400, "Mock pay dinonaktifkan saat Midtrans aktif")
    await db.orders.update_one({"order_id": order_id}, {"$set": {"status": "paid", "payment_status": "paid", "payment_method": "qris_mock", "paid_at": now_utc().isoformat(), "updated_at": now_utc().isoformat()}})
    return {"ok": True}


@api.get("/payments/status/{order_id}")
async def payment_status(order_id: str, request: Request):
    """Sync order payment state with Midtrans (fallback when webhook has not arrived)."""
    user = await get_current_user(request)
    o = await db.orders.find_one({"order_id": order_id}, {"_id": 0, "route": 0})
    if not o or (user.get("role") != "admin" and o["user_id"] != user["user_id"]):
        raise HTTPException(404, "Not found")
    if o.get("payment_status") != "paid" and MIDTRANS_SERVER_KEY and not str(o.get("snap_token", "")).startswith("MOCK-"):
        try:
            async with httpx.AsyncClient(timeout=15) as hc:
                r = await hc.get(f"{MIDTRANS_API}/{order_id}/status", headers={"Accept": "application/json", "Authorization": midtrans_auth_header()})
            d = r.json()
            if d.get("transaction_status"):
                await db.orders.update_one({"order_id": order_id}, {"$set": _apply_midtrans_status(o, d["transaction_status"], d.get("fraud_status"), d.get("payment_type"))})
                o = await db.orders.find_one({"order_id": order_id}, {"_id": 0, "route": 0})
        except Exception as e:
            logging.warning(f"Midtrans status check failed: {e}")
    return {"order_id": o["order_id"], "status": o["status"], "payment_status": o["payment_status"], "payment_method": o.get("payment_method"), "total": o["total"]}


@api.post("/payments/midtrans/notification")
async def midtrans_notification(request: Request):
    data = await request.json()
    required = ("order_id", "status_code", "gross_amount", "signature_key")
    if any(k not in data for k in required):
        raise HTTPException(400, "Invalid notification")
    expected = hashlib.sha512((data["order_id"] + data["status_code"] + data["gross_amount"] + MIDTRANS_SERVER_KEY).encode()).hexdigest()
    if not hmac.compare_digest(expected, data["signature_key"]):
        raise HTTPException(403, "Invalid signature")
    o = await db.orders.find_one({"order_id": data["order_id"]})
    if not o:
        raise HTTPException(404, "Unknown")
    await db.orders.update_one({"order_id": data["order_id"]}, {"$set": _apply_midtrans_status(o, data.get("transaction_status"), data.get("fraud_status"), data.get("payment_type"))})
    return {"ok": True}


# ============ Analytics ============
@api.get("/admin/analytics")
async def admin_analytics(request: Request):
    await require_admin(request)
    total_revenue = total_orders = 0
    daily, weekly, monthly, top_customers, popular = {}, {}, {}, {}, {}
    async for o in db.orders.find({"payment_status": "paid", "status": {"$ne": "cancelled"}}, {"_id": 0, "route": 0}):
        total_orders += 1
        total_revenue += o["total"]
        dt = datetime.fromisoformat(o["created_at"])
        day = o["created_at"][:10]
        wk = f"{dt.isocalendar()[0]}-W{dt.isocalendar()[1]:02d}"
        mo = o["created_at"][:7]
        for bucket, k in ((daily, day), (weekly, wk), (monthly, mo)):
            b = bucket.setdefault(k, {"revenue": 0, "orders": 0})
            b["revenue"] += o["total"]
            b["orders"] += 1
        key = o["customer_email"]
        c = top_customers.setdefault(key, {"email": key, "name": o["customer_name"], "orders": 0, "revenue": 0})
        c["orders"] += 1
        c["revenue"] += o["total"]
        for it in o["items"]:
            p = popular.setdefault(it["product_id"], {"product_id": it["product_id"], "name": it["name"], "unit": it["unit"], "quantity": 0, "revenue": 0, "orders": 0})
            p["quantity"] += it["quantity"]
            p["revenue"] += it["line_total"]
            p["orders"] += 1
    growth = {}
    async for u in db.users.find({"role": "customer"}, {"_id": 0, "created_at": 1}):
        m = (u.get("created_at") or "")[:7]
        if m:
            growth[m] = growth.get(m, 0) + 1
    cum, growth_series = 0, []
    for m in sorted(growth):
        cum += growth[m]
        growth_series.append({"month": m, "new": growth[m], "total": cum})
    series = lambda d, key: [{key: k, **v} for k, v in sorted(d.items())]
    return {
        "total_revenue": total_revenue, "total_orders": total_orders,
        "pending_count": await db.orders.count_documents({"status": "pending"}),
        "total_customers": await db.users.count_documents({"role": "customer"}),
        "daily": series(daily, "date")[-14:], "weekly": series(weekly, "week")[-12:], "monthly": series(monthly, "month")[-12:],
        "top_customers": sorted(top_customers.values(), key=lambda x: x["revenue"], reverse=True)[:5],
        "popular_items": sorted(popular.values(), key=lambda x: x["revenue"], reverse=True)[:8],
        "customer_growth": growth_series[-12:],
    }


# ============ Seed ============
IMG = {
    "Sayuran Daun": "https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=600&auto=format",
    "Sayuran Buah": "https://images.unsplash.com/photo-1485637701894-09ad422f6de6?w=600&auto=format",
    "Umbi & Akar": "https://images.unsplash.com/photo-1447175008436-054170c2e979?w=600&auto=format",
    "Bawang": "https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?w=600&auto=format",
    "Cabai & Paprika": "https://images.unsplash.com/photo-1766158554276-fcba78477081?w=600&auto=format",
    "Jeruk": "https://images.unsplash.com/photo-1547514701-42782101795e?w=600&auto=format",
    "Rempah & Daun": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&auto=format",
}
CATALOG = [
    ("Sayuran Daun", [("Pakcoi", 16000), ("Sawi Putih", 16000), ("Sawi Hijau", 12000), ("Selada", 25000), ("Kol", 10000), ("Daun Bawang", 20000), ("Seledri", 30000)]),
    ("Sayuran Buah", [("Brokoli", 35000), ("Kembang Kol", 30000), ("Timun", 10000), ("Tomat", 16000), ("Terong Ungu", 14000), ("Pare", 16000), ("Oyong", 22000), ("Buncis", 28000), ("Kacang Panjang", 18000), ("Jagung Kecil", 20000), ("Jagung Manis", 6000, "pcs"), ("Labu Kecil", 18000), ("Labu Besar", 5000, "pcs")]),
    ("Umbi & Akar", [("Kentang", 18000), ("Kentang Jumbo", 22000), ("Wortel Lokal", 18000), ("Wortel Impor", 20000)]),
    ("Bawang", [("Bawang Merah Kupas", 40000), ("Bawang Putih Kupas", 40000), ("Bawang Merah", 35000), ("Bawang Putih", 40000), ("Bawang Kating", 45000), ("Bawang Bombay", 30000)]),
    ("Cabai & Paprika", [("Cabe Rawit Merah", 80000), ("Cabe Rawit Ijo", 50000), ("Cabe Kriting Merah", 60000), ("Cabe Kriting Hijau", 45000), ("Cabe TW Merah", 50000), ("Cabe TW Hijau", 35000), ("Paprika Hijau", 60000), ("Paprika Merah", 70000), ("Paprika Kuning", 80000)]),
    ("Jeruk", [("Jeruk Peres", 16000), ("Jeruk Lemon Lokal", 30000), ("Jeruk Lemon Import", 45000), ("Jeruk Limo", 30000), ("Jeruk Nipis", 30000)]),
    ("Rempah & Daun", [("Jahe", 30000), ("Laos", 14000), ("Kunyit", 20000), ("Sereh", 20000), ("Kencur", 55000), ("Daun Salam", 20000), ("Daun Jeruk", 60000), ("Daun Kunyit", 40000)]),
]


def build_catalog():
    out, sort = [], 0
    for cat, items in CATALOG:
        for it in items:
            name, price = it[0], it[1]
            unit = it[2] if len(it) > 2 else "kg"
            sort += 1
            out.append({
                "product_id": f"prod_{uuid.uuid4().hex[:10]}", "name": name, "category": cat, "price": price, "unit": unit,
                "stock": 200 if unit == "pcs" else 50.0, "image_url": IMG[cat],
                "description": f"{name} segar pilihan Wiwik Sayur. Harga per {unit}.", "is_active": True, "sort": sort,
                "created_at": now_utc().isoformat(),
            })
    return out


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.products.create_index("product_id", unique=True)
    await db.orders.create_index("order_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.geocache.create_index("key", unique=True)
    await db.vouchers.create_index("code", unique=True)
    await load_shipping_cfg()

    if not await db.users.find_one({"email": ADMIN_EMAIL}):
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}", "email": ADMIN_EMAIL, "name": "Bagus Satrio (Admin)",
            "phone": SUPPORT_WA, "password_hash": hash_password("Admin@123"), "role": "admin",
            "completed_order_count": 0, "created_at": now_utc().isoformat(),
        })
        logging.info(f"Seeded admin user {ADMIN_EMAIL}")
    for email, name, phone, pw, cnt in (
        ("setia@wiwiksayur.co.id", "Ibu Setia", "+628123456789", "Setia@123", 10),
        ("reguler@wiwiksayur.co.id", "Pelanggan Baru", "+628987654321", "Reguler@123", 0),
    ):
        if not await db.users.find_one({"email": email}):
            await db.users.insert_one({
                "user_id": f"user_{uuid.uuid4().hex[:12]}", "email": email, "name": name, "phone": phone,
                "password_hash": hash_password(pw), "role": "customer", "completed_order_count": cnt, "created_at": now_utc().isoformat(),
            })
    # One-time migration to Wiwik Sayur price-list catalog (also clears legacy orders)
    if not await db.meta.find_one({"key": "catalog_v2"}):
        await db.products.delete_many({})
        await db.orders.delete_many({})
        await db.products.insert_many(build_catalog())
        await db.meta.insert_one({"key": "catalog_v2", "at": now_utc().isoformat()})
        logging.info("Migrated to catalog v2 (Wiwik Sayur price list)")
    elif await db.products.count_documents({}) == 0:
        await db.products.insert_many(build_catalog())


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
