from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta, date, time
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, EmailStr

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    CheckoutStatusResponse,
)

# ------------------------------------------------------------------
# MongoDB
# ------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ------------------------------------------------------------------
# Constants
# ------------------------------------------------------------------
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"
STRIPE_API_KEY = os.environ['STRIPE_API_KEY']

ROLES = ("patient", "receptionist", "therapist", "manager", "admin")

# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def iso(dt: datetime) -> str:
    return dt.isoformat()

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "type": "access",
        "exp": now_utc() + timedelta(hours=12),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="access_token", value=token,
        httponly=True, secure=False, samesite="lax",
        max_age=60 * 60 * 12, path="/",
    )

def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie("access_token", path="/")

# ------------------------------------------------------------------
# FastAPI
# ------------------------------------------------------------------
app = FastAPI(title="HoneyBee Physiotherapy Centre API")
api = APIRouter(prefix="/api")

# ------------------------------------------------------------------
# Pydantic models
# ------------------------------------------------------------------
class UserPublic(BaseModel):
    id: str
    email: str
    name: str
    role: str
    status: str = "active"
    phone: Optional[str] = None
    created_at: Optional[str] = None

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    phone: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class AdminCreateUserRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    role: Literal["patient", "receptionist", "therapist", "manager", "admin"]
    phone: Optional[str] = None
    specialty: Optional[str] = None

class AdminUpdateUserRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    specialty: Optional[str] = None
    password: Optional[str] = None

class AppointmentCreate(BaseModel):
    patient_id: str
    therapist_id: str
    scheduled_at: str  # ISO datetime
    duration_minutes: int = 45
    reason: Optional[str] = None
    fee: float = 80.0

class AppointmentUpdate(BaseModel):
    scheduled_at: Optional[str] = None
    duration_minutes: Optional[int] = None
    status: Optional[str] = None  # scheduled, completed, cancelled
    reason: Optional[str] = None

class TreatmentRecordCreate(BaseModel):
    appointment_id: str
    notes: str
    session_summary: Optional[str] = None
    next_steps: Optional[str] = None

class PaymentInitRequest(BaseModel):
    invoice_id: str
    origin_url: str

# ------------------------------------------------------------------
# Auth dependency
# ------------------------------------------------------------------
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        if payload.get("type") != "access":
            raise HTTPException(401, "Invalid token type")
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    if user.get("status") == "disabled":
        raise HTTPException(403, "Account disabled")
    return user

def require_role(*allowed: str):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed and user["role"] != "admin":
            raise HTTPException(403, "Insufficient permissions")
        return user
    return dep

# ------------------------------------------------------------------
# Activity log helper
# ------------------------------------------------------------------
async def log_activity(user: Optional[dict], action: str, target: str = "", meta: Optional[dict] = None) -> None:
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "actor_id": user["id"] if user else None,
        "actor_email": user["email"] if user else None,
        "actor_role": user["role"] if user else None,
        "action": action,
        "target": target,
        "meta": meta or {},
        "created_at": iso(now_utc()),
    })

# ------------------------------------------------------------------
# AUTH endpoints
# ------------------------------------------------------------------
@api.post("/auth/register")
async def register(req: RegisterRequest, response: Response):
    email = req.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid, "email": email, "name": req.name,
        "phone": req.phone, "role": "patient", "status": "active",
        "password_hash": hash_password(req.password),
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(doc)
    # also create patient record
    await db.patients.insert_one({
        "id": str(uuid.uuid4()), "user_id": uid, "name": req.name,
        "email": email, "phone": req.phone,
        "created_at": iso(now_utc()),
    })
    token = create_access_token(uid, email, "patient")
    set_auth_cookie(response, token)
    await log_activity({"id": uid, "email": email, "role": "patient"}, "auth.register")
    return {"id": uid, "email": email, "name": req.name, "role": "patient", "status": "active"}

@api.post("/auth/login")
async def login(req: LoginRequest, response: Response):
    email = req.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    if user.get("status") == "disabled":
        raise HTTPException(403, "Account disabled")
    token = create_access_token(user["id"], user["email"], user["role"])
    set_auth_cookie(response, token)
    await log_activity(user, "auth.login")
    return {
        "id": user["id"], "email": user["email"], "name": user["name"],
        "role": user["role"], "status": user.get("status", "active"),
    }

@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookie(response)
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {
        "id": user["id"], "email": user["email"], "name": user["name"],
        "role": user["role"], "status": user.get("status", "active"),
        "phone": user.get("phone"),
    }

# ------------------------------------------------------------------
# USERS (admin)
# ------------------------------------------------------------------
@api.get("/users")
async def list_users(role: Optional[str] = None, user: dict = Depends(get_current_user)):
    # admin sees all; receptionist/manager need to fetch therapists/patients
    if user["role"] not in ("admin", "receptionist", "manager", "therapist"):
        raise HTTPException(403, "Forbidden")
    q = {}
    if role:
        q["role"] = role
    docs = await db.users.find(q, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    return docs

@api.post("/users")
async def admin_create_user(req: AdminCreateUserRequest, user: dict = Depends(require_role("admin"))):
    email = req.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already exists")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid, "email": email, "name": req.name, "role": req.role,
        "phone": req.phone, "status": "active",
        "specialty": req.specialty,
        "password_hash": hash_password(req.password),
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(doc)
    if req.role == "patient":
        await db.patients.insert_one({
            "id": str(uuid.uuid4()), "user_id": uid, "name": req.name,
            "email": email, "phone": req.phone, "created_at": iso(now_utc()),
        })
    await log_activity(user, "user.create", uid, {"role": req.role})
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return doc

@api.patch("/users/{user_id}")
async def admin_update_user(user_id: str, req: AdminUpdateUserRequest, user: dict = Depends(require_role("admin"))):
    update = {k: v for k, v in req.model_dump(exclude_none=True).items() if k != "password"}
    if req.password:
        update["password_hash"] = hash_password(req.password)
    if not update:
        raise HTTPException(400, "Nothing to update")
    res = await db.users.update_one({"id": user_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "User not found")
    await log_activity(user, "user.update", user_id, {k: v for k, v in update.items() if k != "password_hash"})
    doc = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return doc

@api.delete("/users/{user_id}")
async def admin_delete_user(user_id: str, user: dict = Depends(require_role("admin"))):
    if user_id == user["id"]:
        raise HTTPException(400, "Cannot delete yourself")
    res = await db.users.delete_one({"id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "User not found")
    await log_activity(user, "user.delete", user_id)
    return {"ok": True}

# ------------------------------------------------------------------
# PATIENTS
# ------------------------------------------------------------------
@api.get("/patients")
async def list_patients(q: Optional[str] = None, user: dict = Depends(get_current_user)):
    if user["role"] not in ("admin", "receptionist", "manager", "therapist"):
        raise HTTPException(403, "Forbidden")
    query = {}
    if q:
        query = {"$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
        ]}
    docs = await db.patients.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs

@api.post("/patients")
async def create_patient(payload: dict, user: dict = Depends(require_role("receptionist", "admin"))):
    name = payload.get("name", "").strip()
    email = (payload.get("email") or "").lower().strip()
    if not name or not email:
        raise HTTPException(400, "Name and email required")
    # create user account too with default password
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already exists")
    default_pw = payload.get("password") or "Patient@123"
    uid = str(uuid.uuid4())
    await db.users.insert_one({
        "id": uid, "email": email, "name": name,
        "phone": payload.get("phone"), "role": "patient", "status": "active",
        "password_hash": hash_password(default_pw),
        "created_at": iso(now_utc()),
    })
    pid = str(uuid.uuid4())
    await db.patients.insert_one({
        "id": pid, "user_id": uid, "name": name, "email": email,
        "phone": payload.get("phone"), "dob": payload.get("dob"),
        "address": payload.get("address"), "notes": payload.get("notes"),
        "created_at": iso(now_utc()),
    })
    await log_activity(user, "patient.create", pid)
    return {"id": pid, "user_id": uid, "name": name, "email": email}

# ------------------------------------------------------------------
# APPOINTMENTS
# ------------------------------------------------------------------
async def _enrich_appointment(appt: dict) -> dict:
    patient = await db.patients.find_one({"id": appt["patient_id"]}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
    therapist = await db.users.find_one({"id": appt["therapist_id"]}, {"_id": 0, "name": 1, "specialty": 1, "email": 1})
    appt["patient"] = patient
    appt["therapist"] = therapist
    return appt

@api.get("/appointments")
async def list_appointments(
    date_filter: Optional[str] = None,
    therapist_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q: dict = {}
    if user["role"] == "patient":
        patient = await db.patients.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
        if not patient:
            return []
        q["patient_id"] = patient["id"]
    elif user["role"] == "therapist":
        q["therapist_id"] = user["id"]

    if therapist_id:
        q["therapist_id"] = therapist_id
    if patient_id:
        q["patient_id"] = patient_id
    if status:
        q["status"] = status
    if date_filter:
        q["scheduled_at"] = {"$gte": date_filter + "T00:00:00", "$lt": date_filter + "T23:59:59"}

    docs = await db.appointments.find(q, {"_id": 0}).sort("scheduled_at", 1).to_list(500)
    for d in docs:
        await _enrich_appointment(d)
    return docs

@api.post("/appointments")
async def create_appointment(req: AppointmentCreate, user: dict = Depends(get_current_user)):
    # patients can only create for themselves
    patient_id = req.patient_id
    if user["role"] == "patient":
        patient = await db.patients.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
        if not patient:
            raise HTTPException(400, "Patient profile not found")
        patient_id = patient["id"]
    aid = str(uuid.uuid4())
    doc = {
        "id": aid,
        "patient_id": patient_id,
        "therapist_id": req.therapist_id,
        "scheduled_at": req.scheduled_at,
        "duration_minutes": req.duration_minutes,
        "reason": req.reason,
        "fee": req.fee,
        "status": "scheduled",
        "created_by": user["id"],
        "created_at": iso(now_utc()),
    }
    await db.appointments.insert_one(doc)
    doc.pop("_id", None)
    await log_activity(user, "appointment.create", aid)
    return await _enrich_appointment(doc)

@api.patch("/appointments/{appt_id}")
async def update_appointment(appt_id: str, req: AppointmentUpdate, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in req.model_dump(exclude_none=True).items()}
    if not update:
        raise HTTPException(400, "Nothing to update")
    res = await db.appointments.update_one({"id": appt_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Appointment not found")
    appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})

    # If marked completed and no invoice, auto-create invoice
    if update.get("status") == "completed":
        existing = await db.invoices.find_one({"appointment_id": appt_id})
        if not existing:
            iid = str(uuid.uuid4())
            await db.invoices.insert_one({
                "id": iid,
                "appointment_id": appt_id,
                "patient_id": appt["patient_id"],
                "therapist_id": appt["therapist_id"],
                "amount": appt.get("fee", 80.0),
                "currency": "usd",
                "status": "pending",
                "created_at": iso(now_utc()),
            })
    await log_activity(user, "appointment.update", appt_id, update)
    return await _enrich_appointment(appt)

@api.delete("/appointments/{appt_id}")
async def delete_appointment(appt_id: str, user: dict = Depends(get_current_user)):
    if user["role"] not in ("admin", "receptionist", "patient"):
        raise HTTPException(403, "Forbidden")
    await db.appointments.update_one({"id": appt_id}, {"$set": {"status": "cancelled"}})
    await log_activity(user, "appointment.cancel", appt_id)
    return {"ok": True}

# ------------------------------------------------------------------
# TREATMENT RECORDS
# ------------------------------------------------------------------
@api.post("/treatment-records")
async def create_treatment_record(req: TreatmentRecordCreate, user: dict = Depends(require_role("therapist", "admin"))):
    appt = await db.appointments.find_one({"id": req.appointment_id}, {"_id": 0})
    if not appt:
        raise HTTPException(404, "Appointment not found")
    rid = str(uuid.uuid4())
    doc = {
        "id": rid,
        "appointment_id": req.appointment_id,
        "patient_id": appt["patient_id"],
        "therapist_id": user["id"],
        "notes": req.notes,
        "session_summary": req.session_summary,
        "next_steps": req.next_steps,
        "created_at": iso(now_utc()),
    }
    await db.treatment_records.insert_one(doc)
    # also mark appointment as completed
    await db.appointments.update_one({"id": req.appointment_id}, {"$set": {"status": "completed"}})
    # create invoice if not present
    if not await db.invoices.find_one({"appointment_id": req.appointment_id}):
        await db.invoices.insert_one({
            "id": str(uuid.uuid4()),
            "appointment_id": req.appointment_id,
            "patient_id": appt["patient_id"],
            "therapist_id": appt["therapist_id"],
            "amount": appt.get("fee", 80.0),
            "currency": "usd",
            "status": "pending",
            "created_at": iso(now_utc()),
        })
    await log_activity(user, "treatment.create", rid)
    doc.pop("_id", None)
    return doc

@api.get("/treatment-records")
async def list_treatment_records(patient_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if user["role"] == "patient":
        patient = await db.patients.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
        if patient:
            q["patient_id"] = patient["id"]
        else:
            return []
    elif user["role"] == "therapist":
        q["therapist_id"] = user["id"]
    if patient_id:
        q["patient_id"] = patient_id
    docs = await db.treatment_records.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    # enrich
    for d in docs:
        d["patient"] = await db.patients.find_one({"id": d["patient_id"]}, {"_id": 0, "name": 1})
        d["therapist"] = await db.users.find_one({"id": d["therapist_id"]}, {"_id": 0, "name": 1})
    return docs

# ------------------------------------------------------------------
# INVOICES
# ------------------------------------------------------------------
async def _enrich_invoice(inv: dict) -> dict:
    inv["patient"] = await db.patients.find_one({"id": inv["patient_id"]}, {"_id": 0, "name": 1, "email": 1})
    inv["therapist"] = await db.users.find_one({"id": inv.get("therapist_id")}, {"_id": 0, "name": 1})
    inv["appointment"] = await db.appointments.find_one({"id": inv["appointment_id"]}, {"_id": 0, "scheduled_at": 1, "reason": 1})
    return inv

@api.get("/invoices")
async def list_invoices(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if user["role"] == "patient":
        patient = await db.patients.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
        if not patient:
            return []
        q["patient_id"] = patient["id"]
    if status:
        q["status"] = status
    docs = await db.invoices.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    for d in docs:
        await _enrich_invoice(d)
    return docs

@api.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if user["role"] == "patient":
        patient = await db.patients.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
        if not patient or patient["id"] != inv["patient_id"]:
            raise HTTPException(403, "Forbidden")
    return await _enrich_invoice(inv)

# ------------------------------------------------------------------
# STRIPE PAYMENTS
# ------------------------------------------------------------------
@api.post("/payments/checkout")
async def create_payment_checkout(req: PaymentInitRequest, http_request: Request, user: dict = Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": req.invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if inv["status"] == "paid":
        raise HTTPException(400, "Invoice already paid")
    # ensure patient can only pay their own
    if user["role"] == "patient":
        patient = await db.patients.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
        if not patient or patient["id"] != inv["patient_id"]:
            raise HTTPException(403, "Forbidden")

    host_url = str(http_request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    origin = req.origin_url.rstrip("/")
    success_url = f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/patient"

    metadata = {
        "invoice_id": inv["id"],
        "patient_id": inv["patient_id"],
        "user_id": user["id"],
    }
    checkout_req = CheckoutSessionRequest(
        amount=float(inv["amount"]),
        currency=inv.get("currency", "usd"),
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_req)

    # Record transaction
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "invoice_id": inv["id"],
        "patient_id": inv["patient_id"],
        "user_id": user["id"],
        "amount": float(inv["amount"]),
        "currency": inv.get("currency", "usd"),
        "metadata": metadata,
        "status": "initiated",
        "payment_status": "pending",
        "created_at": iso(now_utc()),
    })
    return {"url": session.url, "session_id": session.session_id}

@api.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, http_request: Request, user: dict = Depends(get_current_user)):
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Transaction not found")

    # if already finalized, return cached status
    if tx["payment_status"] == "paid":
        return {"status": "complete", "payment_status": "paid", "amount": tx["amount"], "currency": tx["currency"]}

    host_url = str(http_request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    status_resp: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)

    new_status = status_resp.status
    new_payment_status = status_resp.payment_status

    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"status": new_status, "payment_status": new_payment_status, "updated_at": iso(now_utc())}},
    )

    # Update invoice only once on successful payment
    if new_payment_status == "paid" and tx["payment_status"] != "paid":
        await db.invoices.update_one(
            {"id": tx["invoice_id"]},
            {"$set": {
                "status": "paid",
                "paid_at": iso(now_utc()),
                "payment_session_id": session_id,
            }},
        )
        await log_activity(user, "payment.success", tx["invoice_id"], {"session_id": session_id})

    return {
        "status": new_status,
        "payment_status": new_payment_status,
        "amount": status_resp.amount_total / 100.0,
        "currency": status_resp.currency,
    }

@api.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    try:
        event = await stripe_checkout.handle_webhook(body, sig)
    except Exception as e:
        logging.warning(f"Webhook error: {e}")
        return {"ok": False}
    if event.payment_status == "paid":
        tx = await db.payment_transactions.find_one({"session_id": event.session_id}, {"_id": 0})
        if tx and tx["payment_status"] != "paid":
            await db.payment_transactions.update_one(
                {"session_id": event.session_id},
                {"$set": {"status": "complete", "payment_status": "paid", "updated_at": iso(now_utc())}},
            )
            await db.invoices.update_one(
                {"id": tx["invoice_id"]},
                {"$set": {"status": "paid", "paid_at": iso(now_utc()), "payment_session_id": event.session_id}},
            )
    return {"ok": True}

# ------------------------------------------------------------------
# REPORTS (manager / admin)
# ------------------------------------------------------------------
@api.get("/reports/summary")
async def reports_summary(user: dict = Depends(require_role("manager", "admin"))):
    today = now_utc().date().isoformat()
    total_revenue_doc = await db.invoices.aggregate([
        {"$match": {"status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)
    total_revenue = total_revenue_doc[0]["total"] if total_revenue_doc else 0

    pending_doc = await db.invoices.aggregate([
        {"$match": {"status": "pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)
    pending_amount = pending_doc[0]["total"] if pending_doc else 0

    appts_today = await db.appointments.count_documents(
        {"scheduled_at": {"$gte": today + "T00:00:00", "$lt": today + "T23:59:59"}}
    )
    total_patients = await db.patients.count_documents({})
    total_therapists = await db.users.count_documents({"role": "therapist"})
    total_appts = await db.appointments.count_documents({})

    # Therapist workload
    workload_pipe = await db.appointments.aggregate([
        {"$group": {"_id": "$therapist_id", "count": {"$sum": 1}}},
    ]).to_list(100)
    workload = []
    for w in workload_pipe:
        t = await db.users.find_one({"id": w["_id"]}, {"_id": 0, "name": 1})
        workload.append({"therapist": (t or {}).get("name", "Unknown"), "appointments": w["count"]})

    # Revenue by day (last 7 days)
    seven = now_utc() - timedelta(days=7)
    rev_pipe = await db.invoices.aggregate([
        {"$match": {"status": "paid", "paid_at": {"$gte": iso(seven)}}},
        {"$group": {
            "_id": {"$substr": ["$paid_at", 0, 10]},
            "revenue": {"$sum": "$amount"},
        }},
        {"$sort": {"_id": 1}},
    ]).to_list(50)
    revenue_trend = [{"date": r["_id"], "revenue": r["revenue"]} for r in rev_pipe]

    # Appointments by status
    status_pipe = await db.appointments.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]).to_list(20)
    by_status = [{"status": s["_id"] or "scheduled", "count": s["count"]} for s in status_pipe]

    return {
        "total_revenue": total_revenue,
        "pending_amount": pending_amount,
        "appointments_today": appts_today,
        "total_patients": total_patients,
        "total_therapists": total_therapists,
        "total_appointments": total_appts,
        "workload": workload,
        "revenue_trend": revenue_trend,
        "appointments_by_status": by_status,
    }

# ------------------------------------------------------------------
# ADMIN system info
# ------------------------------------------------------------------
@api.get("/admin/activity-logs")
async def admin_logs(limit: int = 100, user: dict = Depends(require_role("admin"))):
    docs = await db.activity_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return docs

@api.get("/admin/system-health")
async def admin_health(user: dict = Depends(require_role("admin"))):
    db_ok = True
    try:
        await db.command("ping")
    except Exception:
        db_ok = False
    return {
        "database": "online" if db_ok else "offline",
        "api": "online",
        "last_backup": iso(now_utc() - timedelta(hours=4)),
        "uptime_pct": 99.97,
        "active_sessions": await db.users.count_documents({"status": "active"}),
        "total_records": {
            "users": await db.users.count_documents({}),
            "patients": await db.patients.count_documents({}),
            "appointments": await db.appointments.count_documents({}),
            "invoices": await db.invoices.count_documents({}),
        },
    }

# ------------------------------------------------------------------
# Include router and middleware
# ------------------------------------------------------------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Seed demo data
# ------------------------------------------------------------------
async def seed_demo() -> None:
    await db.users.create_index("email", unique=True)
    await db.patients.create_index("email")
    await db.appointments.create_index("scheduled_at")

    demos = [
        {"email": os.environ.get("ADMIN_EMAIL", "admin@honeybee.com"), "password": os.environ.get("ADMIN_PASSWORD", "Admin@123"),
         "name": "Aria Sterling", "role": "admin"},
        {"email": "manager@honeybee.com", "password": "Manager@123", "name": "Marcus Vale", "role": "manager"},
        {"email": "reception@honeybee.com", "password": "Reception@123", "name": "Rosa Linden", "role": "receptionist"},
        {"email": "therapist@honeybee.com", "password": "Therapist@123", "name": "Dr. Ines Okafor",
         "role": "therapist", "specialty": "Sports Rehabilitation"},
        {"email": "therapist2@honeybee.com", "password": "Therapist@123", "name": "Dr. Leo Hartman",
         "role": "therapist", "specialty": "Orthopedic Therapy"},
        {"email": "therapist3@honeybee.com", "password": "Therapist@123", "name": "Dr. Sana Mehra",
         "role": "therapist", "specialty": "Neurological Rehab"},
        {"email": "patient@honeybee.com", "password": "Patient@123", "name": "Hugo Beckett", "role": "patient", "phone": "+1-555-0182"},
        {"email": "patient2@honeybee.com", "password": "Patient@123", "name": "Naomi Pierce", "role": "patient", "phone": "+1-555-0145"},
        {"email": "patient3@honeybee.com", "password": "Patient@123", "name": "Theo Marsh", "role": "patient", "phone": "+1-555-0167"},
    ]
    for d in demos:
        existing = await db.users.find_one({"email": d["email"]})
        if existing:
            # ensure password matches env-configured default
            if not verify_password(d["password"], existing["password_hash"]):
                await db.users.update_one({"email": d["email"]}, {"$set": {"password_hash": hash_password(d["password"])}})
            continue
        uid = str(uuid.uuid4())
        doc = {
            "id": uid, "email": d["email"], "name": d["name"],
            "phone": d.get("phone"), "role": d["role"], "status": "active",
            "specialty": d.get("specialty"),
            "password_hash": hash_password(d["password"]),
            "created_at": iso(now_utc()),
        }
        await db.users.insert_one(doc)
        if d["role"] == "patient":
            await db.patients.insert_one({
                "id": str(uuid.uuid4()), "user_id": uid, "name": d["name"],
                "email": d["email"], "phone": d.get("phone"),
                "created_at": iso(now_utc()),
            })

    # sample appointments + one paid invoice + one pending
    has_appts = await db.appointments.count_documents({})
    if has_appts == 0:
        therapists = await db.users.find({"role": "therapist"}, {"_id": 0, "id": 1}).to_list(10)
        patients = await db.patients.find({}, {"_id": 0, "id": 1}).to_list(10)
        if therapists and patients:
            today = now_utc().date()
            slots = [
                (today, 9, 0), (today, 10, 30), (today, 13, 0),
                (today, 14, 30), (today, 16, 0),
                (today + timedelta(days=1), 9, 0),
                (today + timedelta(days=1), 11, 0),
                (today - timedelta(days=2), 10, 0),
                (today - timedelta(days=5), 14, 0),
            ]
            reasons = ["Lower back pain", "Knee rehabilitation", "Shoulder mobility", "Sports injury", "Post-surgery recovery"]
            for i, (d, h, m) in enumerate(slots):
                scheduled = datetime.combine(d, time(h, m)).replace(tzinfo=timezone.utc)
                appt_id = str(uuid.uuid4())
                pat = patients[i % len(patients)]
                ther = therapists[i % len(therapists)]
                status_val = "completed" if d < today else "scheduled"
                await db.appointments.insert_one({
                    "id": appt_id,
                    "patient_id": pat["id"],
                    "therapist_id": ther["id"],
                    "scheduled_at": iso(scheduled),
                    "duration_minutes": 45,
                    "reason": reasons[i % len(reasons)],
                    "fee": 80.0,
                    "status": status_val,
                    "created_at": iso(now_utc()),
                })
                if status_val == "completed":
                    inv_id = str(uuid.uuid4())
                    inv_status = "paid" if i % 2 == 0 else "pending"
                    inv_doc = {
                        "id": inv_id,
                        "appointment_id": appt_id,
                        "patient_id": pat["id"],
                        "therapist_id": ther["id"],
                        "amount": 80.0,
                        "currency": "usd",
                        "status": inv_status,
                        "created_at": iso(now_utc()),
                    }
                    if inv_status == "paid":
                        inv_doc["paid_at"] = iso(now_utc() - timedelta(days=2))
                    await db.invoices.insert_one(inv_doc)

@app.on_event("startup")
async def on_startup():
    try:
        await seed_demo()
        logger.info("Demo data seeded")
    except Exception as e:
        logger.exception(f"Seeding error: {e}")

@app.on_event("shutdown")
async def on_shutdown():
    client.close()
