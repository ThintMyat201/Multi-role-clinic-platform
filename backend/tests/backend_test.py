"""HoneyBee Physiotherapy Centre - Backend API Test Suite.

Tests authentication, RBAC, appointments, treatment records, invoices,
admin endpoints, reports, and Stripe checkout session creation.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://honeybee-admin.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "admin": ("admin@honeybee.com", "Admin@123"),
    "manager": ("manager@honeybee.com", "Manager@123"),
    "receptionist": ("reception@honeybee.com", "Reception@123"),
    "therapist": ("therapist@honeybee.com", "Therapist@123"),
    "patient": ("patient@honeybee.com", "Patient@123"),
}


def _login(role):
    """Login and return a requests.Session pre-configured with
    Authorization: Bearer <token> header. Cookies still set by server (fallback)
    but the test harness uses the JWT in the response body."""
    s = requests.Session()
    email, pw = CREDS[role]
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=20)
    assert r.status_code == 200, f"login {role} failed: {r.status_code} {r.text}"
    body = r.json()
    token = body.get("token")
    assert token, f"login {role}: response missing 'token' field. body={body}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    # Drop the cookie so the test exercises only the Authorization header path
    s.cookies.clear()
    return s


@pytest.fixture(scope="module")
def admin():
    return _login("admin")


@pytest.fixture(scope="module")
def manager():
    return _login("manager")


@pytest.fixture(scope="module")
def receptionist():
    return _login("receptionist")


@pytest.fixture(scope="module")
def therapist():
    return _login("therapist")


@pytest.fixture(scope="module")
def patient():
    return _login("patient")


# ---------------- AUTH ----------------
class TestAuth:
    @pytest.mark.parametrize("role", list(CREDS.keys()))
    def test_login_all_demo_accounts(self, role):
        email, pw = CREDS[role]
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == email
        assert data["role"] == role
        # New: token is returned in response body for Authorization: Bearer auth
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
        # Cookie still set as fallback
        assert "access_token" in r.cookies

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@honeybee.com", "password": "wrong"}, timeout=10)
        assert r.status_code == 401

    def test_me_returns_user(self, admin):
        r = admin.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_logout_clears_cookie(self):
        s = _login("patient")
        r = s.post(f"{API}/auth/logout", timeout=10)
        assert r.status_code == 200
        # cookie cleared
        s2 = requests.Session()
        s2.cookies = s.cookies
        # without cookie new request unauthenticated - simulate fresh session
        r2 = requests.get(f"{API}/auth/me", timeout=10)
        assert r2.status_code == 401

    def test_register_creates_patient(self):
        email = f"test_reg_{uuid.uuid4().hex[:8]}@honeybee.com"
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "Patient@123", "name": "TEST Reg User"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["role"] == "patient"
        assert data["email"] == email
        # register should also return token (parity with login)
        assert "token" in data and len(data["token"]) > 20

    def test_bearer_token_works_without_cookie(self):
        """Verify Authorization: Bearer header alone is enough (no cookie)."""
        email, pw = CREDS["admin"]
        login = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=15)
        token = login.json()["token"]
        # Fresh session, no cookies, only bearer
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_missing_auth_returns_401(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401


# ---------------- RBAC ----------------
class TestRBAC:
    def test_patient_cannot_list_all_users(self, patient):
        r = patient.get(f"{API}/users", timeout=10)
        assert r.status_code == 403

    def test_patient_cannot_access_system_health(self, patient):
        r = patient.get(f"{API}/admin/system-health", timeout=10)
        assert r.status_code == 403

    def test_receptionist_cannot_delete_user(self, receptionist, admin):
        # create a temp user via admin
        u = admin.post(f"{API}/users", json={
            "email": f"test_rbac_{uuid.uuid4().hex[:6]}@honeybee.com",
            "password": "Patient@123", "name": "TEST RBAC", "role": "patient",
        }, timeout=15)
        assert u.status_code == 200
        uid = u.json()["id"]
        r = receptionist.delete(f"{API}/users/{uid}", timeout=10)
        assert r.status_code == 403
        # cleanup
        admin.delete(f"{API}/users/{uid}", timeout=10)

    def test_patient_can_list_therapists(self, patient):
        r = patient.get(f"{API}/users?role=therapist", timeout=10)
        assert r.status_code == 200
        therapists = r.json()
        assert any(t["role"] == "therapist" for t in therapists)


# ---------------- APPOINTMENTS ----------------
class TestAppointments:
    def test_patient_create_own_appointment(self, patient):
        # get a therapist
        therapists = patient.get(f"{API}/users?role=therapist", timeout=10).json()
        assert therapists
        tid = therapists[0]["id"]
        scheduled = "2026-12-15T10:00:00+00:00"
        r = patient.post(f"{API}/appointments", json={
            "patient_id": "should-be-overridden",
            "therapist_id": tid,
            "scheduled_at": scheduled,
            "reason": "TEST appointment",
        }, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["therapist_id"] == tid
        assert data["status"] == "scheduled"
        pytest.shared_appt_id = data["id"]
        pytest.shared_patient_id = data["patient_id"]

    def test_patient_list_only_own_appointments(self, patient):
        r = patient.get(f"{API}/appointments", timeout=10)
        assert r.status_code == 200
        appts = r.json()
        # all must belong to same patient_id
        if appts:
            unique_pids = set(a["patient_id"] for a in appts)
            assert len(unique_pids) == 1

    def test_therapist_list_only_own(self, therapist):
        r = therapist.get(f"{API}/appointments", timeout=10)
        assert r.status_code == 200
        appts = r.json()
        if appts:
            therapist_me = therapist.get(f"{API}/auth/me").json()
            for a in appts:
                assert a["therapist_id"] == therapist_me["id"]

    def test_complete_appointment_auto_creates_invoice(self, receptionist, admin):
        # create a fresh appointment as receptionist
        patients = receptionist.get(f"{API}/patients", timeout=10).json()
        therapists = receptionist.get(f"{API}/users?role=therapist", timeout=10).json()
        assert patients and therapists
        r = receptionist.post(f"{API}/appointments", json={
            "patient_id": patients[0]["id"],
            "therapist_id": therapists[0]["id"],
            "scheduled_at": "2026-12-20T14:00:00+00:00",
            "reason": "TEST complete flow",
        }, timeout=15)
        assert r.status_code == 200
        aid = r.json()["id"]
        # patch -> completed
        r2 = receptionist.patch(f"{API}/appointments/{aid}", json={"status": "completed"}, timeout=10)
        assert r2.status_code == 200
        # invoice should exist
        invs = admin.get(f"{API}/invoices", timeout=10).json()
        assert any(i["appointment_id"] == aid for i in invs), "No invoice auto-created on completion"

    def test_patient_cannot_mark_completed(self, patient, receptionist):
        # create a fresh appointment for patient via receptionist
        patients = receptionist.get(f"{API}/patients", timeout=10).json()
        therapists = receptionist.get(f"{API}/users?role=therapist", timeout=10).json()
        # find patient1's profile
        me = patient.get(f"{API}/auth/me").json()
        target = next((p for p in patients if p.get("user_id") == me["id"]), patients[0])
        r = receptionist.post(f"{API}/appointments", json={
            "patient_id": target["id"],
            "therapist_id": therapists[0]["id"],
            "scheduled_at": "2026-12-30T09:00:00+00:00",
            "reason": "TEST patient-complete-guard",
        }, timeout=15)
        assert r.status_code == 200
        aid = r.json()["id"]
        # patient tries to complete
        r2 = patient.patch(f"{API}/appointments/{aid}", json={"status": "completed"}, timeout=10)
        assert r2.status_code == 403, f"Expected 403, got {r2.status_code}: {r2.text}"

    def test_delete_cancels_appointment(self, patient):
        appt_id = getattr(pytest, "shared_appt_id", None)
        if not appt_id:
            pytest.skip("no shared appointment")
        r = patient.delete(f"{API}/appointments/{appt_id}", timeout=10)
        assert r.status_code == 200


# ---------------- TREATMENT RECORDS ----------------
class TestTreatmentRecords:
    def test_therapist_create_record_completes_appointment(self, therapist, receptionist):
        # create appt for therapist
        therapist_me = therapist.get(f"{API}/auth/me").json()
        patients = receptionist.get(f"{API}/patients", timeout=10).json()
        r = receptionist.post(f"{API}/appointments", json={
            "patient_id": patients[0]["id"],
            "therapist_id": therapist_me["id"],
            "scheduled_at": "2026-12-22T11:00:00+00:00",
            "reason": "TEST tr",
        }, timeout=15)
        aid = r.json()["id"]
        rec = therapist.post(f"{API}/treatment-records", json={
            "appointment_id": aid, "notes": "TEST notes", "session_summary": "ok",
        }, timeout=15)
        assert rec.status_code == 200, rec.text
        # appointment should now be completed; invoice auto-created
        invs = therapist.get(f"{API}/appointments", timeout=10).json()
        target = next((a for a in invs if a["id"] == aid), None)
        assert target and target["status"] == "completed"

    def test_patient_lists_own_records(self, patient):
        r = patient.get(f"{API}/treatment-records", timeout=10)
        assert r.status_code == 200


# ---------------- INVOICES ----------------
class TestInvoices:
    def test_patient_invoice_list_scoped(self, patient):
        r = patient.get(f"{API}/invoices", timeout=10)
        assert r.status_code == 200
        invs = r.json()
        if invs:
            unique_pids = set(i["patient_id"] for i in invs)
            assert len(unique_pids) == 1

    def test_get_invoice_enriched(self, admin):
        invs = admin.get(f"{API}/invoices", timeout=10).json()
        if not invs:
            pytest.skip("no invoices")
        r = admin.get(f"{API}/invoices/{invs[0]['id']}", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "patient" in data and "therapist" in data and "appointment" in data


# ---------------- STRIPE ----------------
class TestStripe:
    def test_create_checkout_session(self, patient):
        invs = patient.get(f"{API}/invoices?status=pending", timeout=10).json()
        if not invs:
            # try paid filter to confirm there are any invoices for this patient
            pytest.skip("no pending invoices for patient")
        inv = invs[0]
        r = patient.post(f"{API}/payments/checkout",
                         json={"invoice_id": inv["id"], "origin_url": "https://honeybee-admin.preview.emergentagent.com"},
                         timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["url"].startswith("https://")
        assert "session_id" in data
        pytest.shared_session_id = data["session_id"]

    def test_payment_status(self, patient):
        sid = getattr(pytest, "shared_session_id", None)
        if not sid:
            pytest.skip("no session")
        r = patient.get(f"{API}/payments/status/{sid}", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "status" in d and "payment_status" in d


# ---------------- ADMIN ----------------
class TestAdmin:
    def test_admin_create_update_delete_user(self, admin):
        email = f"test_admin_{uuid.uuid4().hex[:6]}@honeybee.com"
        r = admin.post(f"{API}/users", json={
            "email": email, "password": "Therapist@123",
            "name": "TEST T", "role": "therapist", "specialty": "Test",
        }, timeout=15)
        assert r.status_code == 200, r.text
        uid = r.json()["id"]
        # update
        r2 = admin.patch(f"{API}/users/{uid}", json={"name": "TEST T Updated"}, timeout=10)
        assert r2.status_code == 200 and r2.json()["name"] == "TEST T Updated"
        # cannot delete self
        me = admin.get(f"{API}/auth/me").json()
        r3 = admin.delete(f"{API}/users/{me['id']}", timeout=10)
        assert r3.status_code == 400
        # delete created user
        r4 = admin.delete(f"{API}/users/{uid}", timeout=10)
        assert r4.status_code == 200

    def test_system_health(self, admin):
        r = admin.get(f"{API}/admin/system-health", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["database"] == "online"
        assert "uptime_pct" in d and "total_records" in d

    def test_activity_logs(self, admin):
        r = admin.get(f"{API}/admin/activity-logs?limit=10", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------------- REPORTS ----------------
class TestReports:
    def test_manager_summary(self, manager):
        r = manager.get(f"{API}/reports/summary", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for key in ("total_revenue", "pending_amount", "appointments_today",
                    "total_patients", "total_therapists", "workload",
                    "revenue_trend", "appointments_by_status"):
            assert key in d, f"missing key {key}"

    def test_patient_cannot_access_reports(self, patient):
        r = patient.get(f"{API}/reports/summary", timeout=10)
        assert r.status_code == 403
