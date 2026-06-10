import { useEffect, useState, useMemo } from "react";
import { Shell } from "@/components/Shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, Users, CalendarDays, Receipt, UserPlus, Plus, Wallet, ChevronLeft, ChevronRight } from "lucide-react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { TID } from "@/constants/testIds";

export default function ReceptionistDashboard() {
  const [tab, setTab] = useState("schedule");
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [day, setDay] = useState(new Date());

  // dialogs
  const [openPatient, setOpenPatient] = useState(false);
  const [openAppt, setOpenAppt] = useState(false);
  const [newPatient, setNewPatient] = useState({ name: "", email: "", phone: "" });
  const [newAppt, setNewAppt] = useState({ patient_id: "", therapist_id: "", date: "", time: "10:00", reason: "" });

  const loadAll = async () => {
    try {
      const [p, t, a, i] = await Promise.all([
        api.get("/patients", { params: search ? { q: search } : {} }),
        api.get("/users", { params: { role: "therapist" } }),
        api.get("/appointments", { params: { date_filter: day.toISOString().slice(0, 10) } }),
        api.get("/invoices"),
      ]);
      setPatients(p.data);
      setTherapists(t.data);
      setAppointments(a.data);
      setInvoices(i.data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Failed to load");
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [day]);
  useEffect(() => {
    const id = setTimeout(loadAll, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line
  }, [search]);

  const createPatient = async () => {
    try {
      await api.post("/patients", newPatient);
      toast.success("Patient registered");
      setOpenPatient(false);
      setNewPatient({ name: "", email: "", phone: "" });
      loadAll();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Failed");
    }
  };

  const createAppt = async () => {
    try {
      const dt = new Date(`${newAppt.date}T${newAppt.time}:00`);
      await api.post("/appointments", {
        patient_id: newAppt.patient_id,
        therapist_id: newAppt.therapist_id,
        scheduled_at: dt.toISOString(),
        duration_minutes: 45,
        reason: newAppt.reason,
        fee: 80,
      });
      toast.success("Appointment created");
      setOpenAppt(false);
      setNewAppt({ patient_id: "", therapist_id: "", date: "", time: "10:00", reason: "" });
      loadAll();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Failed");
    }
  };

  const cancel = async (id) => {
    try {
      await api.delete(`/appointments/${id}`);
      toast.success("Cancelled");
      loadAll();
    } catch (e) {
      toast.error("Failed");
    }
  };

  const markCompleted = async (id) => {
    try {
      await api.patch(`/appointments/${id}`, { status: "completed" });
      toast.success("Marked completed — invoice generated");
      loadAll();
    } catch (e) { toast.error("Failed"); }
  };

  const pendingInvoices = invoices.filter((i) => i.status === "pending");

  const nav = [
    { key: "schedule", label: "Daily schedule", to: "/receptionist", icon: CalendarDays },
    { key: "patients", label: "Patients", to: "/receptionist#patients", icon: Users },
    { key: "billing", label: "Billing", to: "/receptionist#billing", icon: Receipt },
  ];

  return (
    <Shell navItems={nav} title="Front Desk">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-[hsl(22,78%,30%)]">Front desk</div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold mt-1">Operations</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={openPatient} onOpenChange={setOpenPatient}>
            <DialogTrigger asChild>
              <Button data-testid={TID.recCreatePatient} className="rounded-full bg-[hsl(32,95%,44%)] hover:bg-[hsl(28,90%,40%)] text-white">
                <UserPlus size={16} className="mr-2" /> New patient
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl">
              <DialogHeader><DialogTitle>Register new patient</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={newPatient.name} onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })} className="rounded-xl mt-1" /></div>
                <div><Label>Email</Label><Input type="email" value={newPatient.email} onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })} className="rounded-xl mt-1" /></div>
                <div><Label>Phone</Label><Input value={newPatient.phone} onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })} className="rounded-xl mt-1" /></div>
                <p className="text-xs text-muted-foreground">A login is auto-created with temporary password <code className="text-foreground">Patient@123</code>.</p>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenPatient(false)} className="rounded-full">Cancel</Button>
                <Button onClick={createPatient} className="rounded-full bg-[hsl(32,95%,44%)] text-white">Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={openAppt} onOpenChange={setOpenAppt}>
            <DialogTrigger asChild>
              <Button data-testid={TID.recCreateAppt} variant="outline" className="rounded-full">
                <Plus size={16} className="mr-2" /> New appointment
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl">
              <DialogHeader><DialogTitle>Create appointment</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Patient</Label>
                  <Select value={newAppt.patient_id} onValueChange={(v) => setNewAppt({ ...newAppt, patient_id: v })}>
                    <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Choose patient" /></SelectTrigger>
                    <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Therapist</Label>
                  <Select value={newAppt.therapist_id} onValueChange={(v) => setNewAppt({ ...newAppt, therapist_id: v })}>
                    <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Choose therapist" /></SelectTrigger>
                    <SelectContent>{therapists.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Date</Label><Input type="date" value={newAppt.date} onChange={(e) => setNewAppt({ ...newAppt, date: e.target.value })} className="rounded-xl mt-1" /></div>
                  <div><Label>Time</Label><Input type="time" value={newAppt.time} onChange={(e) => setNewAppt({ ...newAppt, time: e.target.value })} className="rounded-xl mt-1" /></div>
                </div>
                <div><Label>Reason</Label><Input value={newAppt.reason} onChange={(e) => setNewAppt({ ...newAppt, reason: e.target.value })} className="rounded-xl mt-1" /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenAppt(false)} className="rounded-full">Cancel</Button>
                <Button onClick={createAppt} className="rounded-full bg-[hsl(32,95%,44%)] text-white">Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-xl">
        <Search size={18} className="absolute left-4 top-3.5 text-muted-foreground" />
        <Input
          data-testid={TID.recSearch}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patients by name, email or phone…"
          className="rounded-full h-12 pl-11 bg-white border-border"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-[hsl(38,60%,94%)] rounded-full p-1 mb-5">
          <TabsTrigger value="schedule" className="rounded-full">Daily schedule</TabsTrigger>
          <TabsTrigger value="patients" className="rounded-full">Patients ({patients.length})</TabsTrigger>
          <TabsTrigger value="billing" className="rounded-full">Billing ({pendingInvoices.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <Card className="rounded-2xl p-4 md:p-6 bg-white border-border shadow-card">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" onClick={() => setDay(new Date(day.getTime() - 86400000))} className="rounded-full"><ChevronLeft size={16} /></Button>
              <div className="font-display text-lg font-semibold">{day.toDateString()}</div>
              <Button variant="ghost" onClick={() => setDay(new Date(day.getTime() + 86400000))} className="rounded-full"><ChevronRight size={16} /></Button>
            </div>
            <ScheduleGrid therapists={therapists} appointments={appointments} onCancel={cancel} onComplete={markCompleted} />
          </Card>
        </TabsContent>

        <TabsContent value="patients">
          <Card className="rounded-2xl bg-white border-border shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[hsl(38,60%,94%)] text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Joined</th></tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.phone || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {patients.length === 0 && <tr><td colSpan="4" className="px-4 py-10 text-center text-muted-foreground">No patients match your search.</td></tr>}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card className="rounded-2xl bg-white border-border shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Wallet size={16} className="text-[hsl(32,95%,44%)]" />
              <div className="font-display text-lg font-semibold">Pending invoices</div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-[hsl(38,60%,94%)] text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Therapist</th><th className="px-4 py-3">Treatment</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th></tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{inv.patient?.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.therapist?.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.appointment?.reason || "Session"}</td>
                    <td className="px-4 py-3 font-semibold">${inv.amount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <Badge className={inv.status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-[hsl(38,92%,50%)]/20 text-[hsl(21,91%,14%)]"}>
                        {inv.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && <tr><td colSpan="5" className="px-4 py-10 text-center text-muted-foreground">No invoices yet.</td></tr>}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>
    </Shell>
  );
}

function ScheduleGrid({ therapists, appointments, onCancel, onComplete }) {
  const hours = useMemo(() => Array.from({ length: 10 }, (_, i) => 8 + i), []); // 8..17

  const byTherapist = (tid) => appointments.filter((a) => a.therapist_id === tid);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px] grid" style={{ gridTemplateColumns: `80px repeat(${therapists.length || 1}, minmax(180px, 1fr))` }}>
        <div></div>
        {therapists.map((t) => (
          <div key={t.id} className="px-3 py-2 text-sm font-semibold text-foreground border-b border-border bg-[hsl(40,100%,98%)]">
            {t.name}
            <div className="text-xs text-muted-foreground font-normal">{t.specialty || "Therapist"}</div>
          </div>
        ))}
        {hours.map((h) => (
          <FragmentRow key={h} hour={h} therapists={therapists} byTherapist={byTherapist} onCancel={onCancel} onComplete={onComplete} />
        ))}
      </div>
    </div>
  );
}

function FragmentRow({ hour, therapists, byTherapist, onCancel, onComplete }) {
  return (
    <>
      <div className="px-3 py-3 text-xs text-muted-foreground border-t border-border">{String(hour).padStart(2, "0")}:00</div>
      {therapists.map((t) => {
        const appts = byTherapist(t.id).filter((a) => new Date(a.scheduled_at).getHours() === hour);
        return (
          <div key={t.id} className="border-t border-l border-border p-1.5 min-h-[64px] bg-white">
            {appts.map((a) => (
              <div key={a.id} className={`rounded-lg px-2 py-1.5 text-xs mb-1 ${
                a.status === "completed" ? "bg-emerald-50 border border-emerald-200" :
                a.status === "cancelled" ? "bg-rose-50 border border-rose-200 line-through" :
                "bg-[hsl(38,92%,50%)]/15 border border-[hsl(38,92%,50%)]/30"
              }`}>
                <div className="font-semibold text-foreground">{a.patient?.name}</div>
                <div className="text-muted-foreground">{new Date(a.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {a.reason}</div>
                {a.status === "scheduled" && (
                  <div className="flex gap-1 mt-1">
                    <button onClick={() => onComplete(a.id)} className="text-emerald-700 hover:underline">Complete</button>
                    <span className="text-muted-foreground">·</span>
                    <button onClick={() => onCancel(a.id)} className="text-rose-600 hover:underline">Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
