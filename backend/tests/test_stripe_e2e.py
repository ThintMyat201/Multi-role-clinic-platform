"""End-to-end Stripe checkout test.

Receptionist creates an appointment for patient1, marks it completed (auto-invoice),
then patient1 calls POST /api/payments/checkout and expects a Stripe session URL.
Actual payment is NOT completed.
"""
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, r.text
    return s


def test_stripe_e2e_checkout_session():
    receptionist = _login("reception@honeybee.com", "Reception@123")
    patient = _login("patient@honeybee.com", "Patient@123")
    me = patient.get(f"{API}/auth/me").json()
    patients = receptionist.get(f"{API}/patients", timeout=10).json()
    target = next((p for p in patients if p.get("user_id") == me["id"]), None)
    assert target, "patient profile not found"
    therapists = receptionist.get(f"{API}/users?role=therapist", timeout=10).json()
    assert therapists
    # Create appointment
    r = receptionist.post(f"{API}/appointments", json={
        "patient_id": target["id"],
        "therapist_id": therapists[0]["id"],
        "scheduled_at": "2026-12-28T15:00:00+00:00",
        "reason": "TEST stripe e2e",
    }, timeout=15)
    assert r.status_code == 200, r.text
    aid = r.json()["id"]
    # Mark completed
    r2 = receptionist.patch(f"{API}/appointments/{aid}", json={"status": "completed"}, timeout=10)
    assert r2.status_code == 200
    # patient finds invoice
    invs = patient.get(f"{API}/invoices?status=pending", timeout=10).json()
    inv = next((i for i in invs if i["appointment_id"] == aid), None)
    assert inv, f"invoice for {aid} not found in pending list"
    # checkout
    r3 = patient.post(f"{API}/payments/checkout", json={
        "invoice_id": inv["id"],
        "origin_url": BASE_URL,
    }, timeout=30)
    assert r3.status_code == 200, r3.text
    data = r3.json()
    assert data.get("url", "").startswith("https://"), data
    assert "session_id" in data
    # status check (will be 'open' since not paid)
    r4 = patient.get(f"{API}/payments/status/{data['session_id']}", timeout=20)
    assert r4.status_code == 200, r4.text
    s = r4.json()
    assert "status" in s and "payment_status" in s
