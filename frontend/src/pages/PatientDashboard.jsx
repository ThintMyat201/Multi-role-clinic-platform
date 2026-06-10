import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LayoutDashboard, CalendarDays, Receipt, FileDown, CreditCard, ClipboardList } from "lucide-react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { TID } from "@/constants/testIds";
import { downloadReceiptPdf, printableReceiptUrl } from "@/lib/receipt";

const TIMES = ["09:00", "09:45", "10:30", "11:15", "13:00", "13:45", "14:30", "15:15", "16:00", "16:45"];

export default function PatientDashboard() {
  const { user } = useAuth();
  const [therapists, setTherapists] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [records, setRecords] = useState([]);

  const [date, setDate] = useState(new Date(Date.now() + 86400000));
  const [time, setTime] = useState("10:30");
  const [therapistId, setTherapistId] = useState("");
  const [reason, setReason] = useState("");
  const [booking, setBooking] = useState(false);

  const loadAll = async () => {
    try {
      const [t, a, i, r] = await Promise.all([
        api.get("/users", { params: { role: "therapist" } }),
        api.get("/appointments"),
        api.get("/invoices"),
        api.get("/treatment-records"),
      ]);
      setTherapists(t.data);
      setAppointments(a.data);
      setInvoices(i.data);
      setRecords(r.data);
      if (!therapistId && t.data[0]) setTherapistId(t.data[0].id);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Failed to load");
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  const book = async () => {
    if (!therapistId || !date) return toast.error("Pick a therapist and date");
    setBooking(true);
    try {
      const [h, m] = time.split(":");
      const dt = new Date(date);
      dt.setHours(parseInt(h), parseInt(m), 0, 0);
      await api.post("/appointments", {
        patient_id: "self",
        therapist_id: therapistId,
        scheduled_at: dt.toISOString(),
        duration_minutes: 45,
        reason: reason || "Physiotherapy session",
        fee: 80,
      });
      toast.success("Appointment booked");
      setReason("");
      loadAll();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Booking failed");
    } finally {
      setBooking(false);
    }
  };

  const cancel = async (id) => {
    try {
      await api.delete(`/appointments/${id}`);
      toast.success("Appointment cancelled");
      loadAll();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Cancel failed");
    }
  };

  const pay = async (inv) => {
    try {
      const { data } = await api.post("/payments/checkout", {
        invoice_id: inv.id,
        origin_url: window.location.origin,
      });
      window.location.href = data.url;
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Payment init failed");
    }
  };

  const upcoming = appointments.filter((a) => new Date(a.scheduled_at) >= new Date() && a.status !== "cancelled");
  const past = appointments.filter((a) => new Date(a.scheduled_at) < new Date() || a.status === "completed");
  const pendingInv = invoices.filter((i) => i.status === "pending");
  const paidInv = invoices.filter((i) => i.status === "paid");

  const nav = [
    { key: "overview", label: "Overview", to: "/patient", icon: LayoutDashboard },
  ];

  return (
    <Shell navItems={nav} title="Patient">
      <div className="max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-[hsl(22,78%,30%)]">
              Welcome back
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-semibold mt-1">
              Hello, {user?.name.split(" ")[0]} 👋
            </h1>
            <p className="text-muted-foreground mt-2 max-w-lg">
              Book your next session, review past visits and settle outstanding bills — all in one warm space.
            </p>
          </div>
          <div className="flex gap-3">
            <KpiPill label="Upcoming" value={upcoming.length} />
            <KpiPill label="Past sessions" value={past.length} />
            <KpiPill label="Pending bills" value={pendingInv.length} accent />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Book appointment */}
          <Card className="lg:col-span-2 rounded-2xl p-6 md:p-8 shadow-card border-border bg-white">
            <div className="flex items-center gap-2 mb-5">
              <CalendarDays size={18} className="text-[hsl(32,95%,44%)]" />
              <h2 className="font-display text-xl font-semibold">Book an appointment</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Choose a date</div>
                <div className="rounded-2xl border border-border bg-[hsl(40,100%,98%)] p-2 inline-block">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Therapist</div>
                  <Select value={therapistId} onValueChange={setTherapistId}>
                    <SelectTrigger data-testid={TID.patientTherapistSelect} className="rounded-xl h-11 bg-white">
                      <SelectValue placeholder="Select a therapist" />
                    </SelectTrigger>
                    <SelectContent>
                      {therapists.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}{t.specialty ? ` — ${t.specialty}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Time slot</div>
                  <div className="grid grid-cols-3 gap-2">
                    {TIMES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setTime(t)}
                        className={`rounded-full px-3 py-2 text-sm border transition ${
                          time === t
                            ? "bg-[hsl(32,95%,44%)] text-white border-[hsl(32,95%,44%)]"
                            : "bg-white border-border hover:border-[hsl(32,95%,44%)]"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Reason</div>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Lower back pain" className="rounded-xl h-11 bg-white" />
                </div>
                <Button
                  data-testid={TID.patientBookBtn}
                  onClick={book}
                  disabled={booking}
                  className="w-full h-11 rounded-full bg-[hsl(32,95%,44%)] hover:bg-[hsl(28,90%,40%)] text-white"
                >
                  {booking ? "Booking…" : "Confirm appointment"}
                </Button>
              </div>
            </div>
          </Card>

          {/* Pending bills */}
          <Card className="rounded-2xl p-6 shadow-card border-border bg-white">
            <div className="flex items-center gap-2 mb-4">
              <Receipt size={18} className="text-[hsl(32,95%,44%)]" />
              <h2 className="font-display text-xl font-semibold">Billing</h2>
            </div>
            <Tabs defaultValue="pending">
              <TabsList className="bg-[hsl(38,60%,94%)] rounded-full p-1">
                <TabsTrigger value="pending" className="rounded-full">Pending ({pendingInv.length})</TabsTrigger>
                <TabsTrigger value="paid" className="rounded-full">Receipts ({paidInv.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="pending" className="mt-3 space-y-3">
                {pendingInv.length === 0 && <EmptyState label="No pending bills 🎉" />}
                {pendingInv.map((inv) => (
                  <div key={inv.id} className="rounded-xl border border-border p-3 bg-[hsl(40,100%,97%)]">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">${inv.amount.toFixed(2)}</div>
                      <Badge className="bg-[hsl(38,92%,50%)] text-[hsl(21,91%,14%)]">Pending</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {inv.appointment?.reason || "Session"} · {new Date(inv.appointment?.scheduled_at || inv.created_at).toLocaleDateString()}
                    </div>
                    <Button
                      onClick={() => pay(inv)}
                      data-testid={TID.patientPayBtn(inv.id)}
                      className="mt-3 w-full rounded-full bg-[hsl(32,95%,44%)] hover:bg-[hsl(28,90%,40%)] text-white"
                    >
                      <CreditCard size={14} className="mr-2" /> Make payment
                    </Button>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="paid" className="mt-3 space-y-3">
                {paidInv.length === 0 && <EmptyState label="No receipts yet" />}
                {paidInv.map((inv) => (
                  <div key={inv.id} className="rounded-xl border border-border p-3 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">${inv.amount.toFixed(2)}</div>
                      <Badge className="bg-emerald-100 text-emerald-800">Paid</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(inv.paid_at || inv.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={TID.patientReceiptBtn(inv.id)}
                        onClick={() => downloadReceiptPdf(inv)}
                        className="rounded-full flex-1"
                      >
                        <FileDown size={14} className="mr-1.5" /> PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(printableReceiptUrl(inv), "_blank")}
                        className="rounded-full flex-1"
                      >
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </Card>

          {/* Appointments */}
          <Card className="lg:col-span-3 rounded-2xl p-6 shadow-card border-border bg-white">
            <Tabs defaultValue="upcoming">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-xl font-semibold">My appointments</h2>
                <TabsList className="bg-[hsl(38,60%,94%)] rounded-full p-1">
                  <TabsTrigger value="upcoming" className="rounded-full">Upcoming</TabsTrigger>
                  <TabsTrigger value="past" className="rounded-full">Past</TabsTrigger>
                  <TabsTrigger value="records" className="rounded-full">Treatment notes</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="upcoming" className="space-y-2">
                {upcoming.length === 0 && <EmptyState label="No upcoming appointments — book your next session above." />}
                {upcoming.map((a) => (
                  <AppointmentRow key={a.id} appt={a} onCancel={cancel} />
                ))}
              </TabsContent>
              <TabsContent value="past" className="space-y-2">
                {past.length === 0 && <EmptyState label="No past sessions yet." />}
                {past.map((a) => <AppointmentRow key={a.id} appt={a} />)}
              </TabsContent>
              <TabsContent value="records" className="space-y-2">
                {records.length === 0 && <EmptyState label="No treatment notes yet — your therapist will add them after sessions." />}
                {records.map((r) => (
                  <div key={r.id} className="rounded-xl border border-border p-4 bg-[hsl(40,100%,98%)]">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold flex items-center gap-2">
                        <ClipboardList size={14} className="text-[hsl(32,95%,44%)]" />
                        {r.therapist?.name}
                      </div>
                      <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                    </div>
                    <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">{r.notes}</p>
                    {r.session_summary && <p className="mt-2 text-xs text-muted-foreground"><span className="font-semibold">Summary:</span> {r.session_summary}</p>}
                    {r.next_steps && <p className="mt-1 text-xs text-muted-foreground"><span className="font-semibold">Next steps:</span> {r.next_steps}</p>}
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

function KpiPill({ label, value, accent }) {
  return (
    <div className={`rounded-2xl px-4 py-2 border ${accent ? "bg-[hsl(32,95%,44%)] text-white border-transparent" : "bg-white border-border"}`}>
      <div className="text-xs opacity-80 uppercase tracking-wide">{label}</div>
      <div className="font-display text-xl font-semibold">{value}</div>
    </div>
  );
}

function EmptyState({ label }) {
  return <div className="text-sm text-muted-foreground py-6 text-center">{label}</div>;
}

function AppointmentRow({ appt, onCancel }) {
  const d = new Date(appt.scheduled_at);
  const status = appt.status || "scheduled";
  const colors = {
    scheduled: "bg-[hsl(38,92%,50%)]/15 text-[hsl(21,91%,14%)]",
    completed: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-rose-100 text-rose-700",
  };
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3 bg-white">
      <div className="w-14 text-center">
        <div className="font-display text-2xl font-semibold text-[hsl(32,95%,44%)]">{d.getDate()}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{d.toLocaleString(undefined, { month: "short" })}</div>
      </div>
      <div className="flex-1 min-w-[180px]">
        <div className="text-sm font-semibold">{appt.therapist?.name}</div>
        <div className="text-xs text-muted-foreground">{d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" })} · {appt.duration_minutes} min · {appt.reason || "Session"}</div>
      </div>
      <Badge className={`${colors[status]} capitalize border-0`}>{status}</Badge>
      {onCancel && status === "scheduled" && (
        <Button size="sm" variant="ghost" onClick={() => onCancel(appt.id)} className="rounded-full text-rose-600">
          Cancel
        </Button>
      )}
    </div>
  );
}
