# HoneyBee Physiotherapy Centre — PRD

## Original Problem Statement
Multi-role clinic management web app for HoneyBee Physiotherapy Centre with five distinct portals:
1. **Patient Portal** — Book Appointment, My Appointments, Billing & Payments + PDF receipts
2. **Receptionist Dashboard** — Sidebar nav, patient search, daily multi-therapist calendar, quick actions (Register Patient, Create/Update/Cancel Appointment), Billing module
3. **Therapist Dashboard** — My Schedule (today chronological) + Patient History; clicking patient opens Treatment Record modal to capture notes
4. **Manager Dashboard** — KPI cards, charts (Appointment / Financial / Therapist Performance reports), data tables
5. **Admin Panel** — Secure user account CRUD table, System Maintenance (backup status, activity logs, system health)

User choices: JWT custom auth, Stripe (test mode), PDF receipts + printable HTML, seed demo data, honey/amber + cream warm palette.

## Architecture
- **Backend**: FastAPI (server.py), MongoDB via motor, JWT cookie auth (bcrypt), emergentintegrations.payments.stripe.checkout for Stripe
- **Frontend**: React + react-router-dom + axios (withCredentials), shadcn/ui, recharts, jsPDF, sonner toasts, Outfit + Plus Jakarta Sans fonts
- **Routes**: `/` landing, `/login`, `/patient`, `/receptionist`, `/therapist`, `/manager`, `/admin`, `/payment/success`

## Personas
- **Patient**: books sessions, pays bills, downloads receipts
- **Receptionist**: schedules, manages patient registry, marks treatments complete (auto-creates invoice)
- **Therapist**: views own daily schedule, captures treatment notes
- **Manager**: reviews KPIs, revenue, workload, financial reports
- **Admin**: manages all user accounts, monitors system health, audits activity

## What's Been Implemented (2026-02-10 / displayed as 2026-06-10 in container)
- Auth: login/register/logout/me with bcrypt + JWT in httpOnly cookies
- Demo seed: 1 admin, 1 manager, 1 reception, 3 therapists, 3 patients, 9 appointments, sample invoices (some paid, some pending)
- 5 fully-styled role dashboards with sidebar shell (warm walnut sidebar for admin, light for others)
- Patient: shadcn Calendar booking + therapist Select + time pills + appointments tabs + billing tabs + treatment notes view
- Receptionist: live patient search, multi-therapist day grid (8AM–5PM), new-patient + new-appointment dialogs, billing table, mark-complete inline action
- Therapist: chronological today timeline, treatment-record dialog with notes/summary/next-steps, history tab
- Manager: 4 KPI cards + recharts line chart (revenue trend) + pie (status) + bar (workload) + financial/appointments tables
- Admin: user table CRUD with role+status, system health badges, system maintenance stats, activity logs
- Stripe Checkout integration with /api/payments/checkout, status polling, /api/webhook/stripe, payment_transactions collection
- PDF receipts via jsPDF + printable HTML blob view
- Honey/amber + cream warm palette, hexagon/bee SVG logo, honeycomb dotted background
- Role-based route guards + role redirect after login
- Activity logging on all mutations
- Testing: 31/31 backend tests pass

## Backlog (P0 / P1 / P2)
- **P1**: Therapist-side specialty/availability windows (currently any time slot is acceptable)
- **P1**: Email confirmations on booking (Resend integration)
- **P2**: Patient ability to reschedule (currently only cancel)
- **P2**: Admin "force backup now" button and backup history
- **P2**: Export reports to CSV/PDF from manager dashboard
- **P2**: Per-therapist availability calendar override
- **P2**: SMS reminders (Twilio)
- **P3**: Multi-clinic / multi-tenant support
- **P3**: Insurance claims module

## Demo Credentials
See `/app/memory/test_credentials.md`
