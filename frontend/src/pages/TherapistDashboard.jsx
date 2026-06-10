import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CalendarClock, Notebook, Clock, ClipboardList } from "lucide-react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { TID } from "@/constants/testIds";

export default function TherapistDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [records, setRecords] = useState([]);
  const [openAppt, setOpenAppt] = useState(null);
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    try {
      const [a, r] = await Promise.all([
        api.get("/appointments"),
        api.get("/treatment-records"),
      ]);
      setAppointments(a.data);
      setRecords(r.data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Failed");
    }
  };
  useEffect(() => { loadAll(); }, []);

  const today = new Date().toDateString();
  const todays = appointments.filter((a) => new Date(a.scheduled_at).toDateString() === today)
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const upcoming = appointments.filter((a) => new Date(a.scheduled_at) > new Date() && new Date(a.scheduled_at).toDateString() !== today && a.status !== "cancelled");

  const openRecord = (appt) => {
    setOpenAppt(appt);
    setNotes("");
    setSummary("");
    setNextSteps("");
  };

  const saveRecord = async () => {
    if (!notes.trim()) return toast.error("Please add session notes");
    setSaving(true);
    try {
      await api.post("/treatment-records", {
        appointment_id: openAppt.id,
        notes,
        session_summary: summary,
        next_steps: nextSteps,
      });
      toast.success("Treatment record saved");
      setOpenAppt(null);
      loadAll();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const nav = [
    { key: "schedule", label: "My schedule", to: "/therapist", icon: CalendarClock },
    { key: "history", label: "Patient history", to: "/therapist#history", icon: ClipboardList },
  ];

  return (
    <Shell navItems={nav} title="Therapist">
      <div className="max-w-6xl">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.18em] text-[hsl(22,78%,30%)]">Today&apos;s clinic</div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold mt-1">My schedule</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">A quiet, distraction-free view of your day. Click any patient to capture treatment notes.</p>
        </div>

        <Tabs defaultValue="today">
          <TabsList className="bg-[hsl(38,60%,94%)] rounded-full p-1 mb-5">
            <TabsTrigger value="today" className="rounded-full">Today ({todays.length})</TabsTrigger>
            <TabsTrigger value="upcoming" className="rounded-full">Upcoming ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="history" className="rounded-full">Patient history</TabsTrigger>
          </TabsList>

          <TabsContent value="today">
            <Card className="rounded-2xl bg-white border-border shadow-card divide-y divide-border">
              {todays.length === 0 && <div className="py-12 text-center text-muted-foreground">No appointments scheduled for today.</div>}
              {todays.map((a) => <TimelineRow key={a.id} appt={a} onOpen={openRecord} />)}
            </Card>
          </TabsContent>

          <TabsContent value="upcoming">
            <Card className="rounded-2xl bg-white border-border shadow-card divide-y divide-border">
              {upcoming.length === 0 && <div className="py-12 text-center text-muted-foreground">No upcoming appointments.</div>}
              {upcoming.map((a) => <TimelineRow key={a.id} appt={a} onOpen={openRecord} showDate />)}
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="rounded-2xl bg-white border-border shadow-card divide-y divide-border">
              {records.length === 0 && <div className="py-12 text-center text-muted-foreground">No treatment records yet.</div>}
              {records.map((r) => (
                <div key={r.id} className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{r.patient?.name}</div>
                      <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                    </div>
                    <Notebook size={16} className="text-[hsl(32,95%,44%)]" />
                  </div>
                  <p className="mt-3 text-sm whitespace-pre-wrap">{r.notes}</p>
                  {r.session_summary && <p className="text-xs mt-2"><span className="font-semibold">Summary: </span>{r.session_summary}</p>}
                  {r.next_steps && <p className="text-xs mt-1"><span className="font-semibold">Next: </span>{r.next_steps}</p>}
                </div>
              ))}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!openAppt} onOpenChange={(o) => !o && setOpenAppt(null)}>
        <DialogContent className="rounded-3xl max-w-lg">
          <DialogHeader>
            <DialogTitle>Treatment record · {openAppt?.patient?.name}</DialogTitle>
          </DialogHeader>
          <div className="text-xs text-muted-foreground mb-3">
            {openAppt && new Date(openAppt.scheduled_at).toLocaleString()} · {openAppt?.reason}
          </div>
          <div className="space-y-3">
            <div>
              <Label>Session notes</Label>
              <Textarea
                rows={5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-xl mt-1"
                placeholder="Observations, range of motion, pain levels, exercises performed..."
              />
            </div>
            <div>
              <Label>Session summary</Label>
              <Textarea
                rows={2}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="rounded-xl mt-1"
                placeholder="Brief summary for the patient record"
              />
            </div>
            <div>
              <Label>Next steps</Label>
              <Textarea
                rows={2}
                value={nextSteps}
                onChange={(e) => setNextSteps(e.target.value)}
                className="rounded-xl mt-1"
                placeholder="Home exercises, schedule next visit in 1 week..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenAppt(null)} className="rounded-full">Cancel</Button>
            <Button
              data-testid={TID.therapistSaveNotes}
              onClick={saveRecord}
              disabled={saving}
              className="rounded-full bg-[hsl(32,95%,44%)] hover:bg-[hsl(28,90%,40%)] text-white"
            >
              {saving ? "Saving…" : "Save & complete session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

function TimelineRow({ appt, onOpen, showDate }) {
  const d = new Date(appt.scheduled_at);
  return (
    <button
      data-testid={TID.therapistOpenRecord(appt.id)}
      onClick={() => onOpen(appt)}
      disabled={appt.status === "cancelled"}
      className="w-full text-left p-5 hover:bg-[hsl(40,100%,98%)] transition flex items-center gap-5 disabled:opacity-60"
    >
      <div className="w-20 text-center">
        <div className="font-display text-2xl font-semibold text-[hsl(32,95%,44%)]">{d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
        {showDate && <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{d.toLocaleDateString()}</div>}
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground"><Clock size={10} className="inline mr-0.5" />{appt.duration_minutes}m</div>
      </div>
      <div className="flex-1">
        <div className="font-semibold">{appt.patient?.name}</div>
        <div className="text-sm text-muted-foreground">{appt.reason || "Physiotherapy session"}</div>
      </div>
      <Badge className={
        appt.status === "completed" ? "bg-emerald-100 text-emerald-800" :
        appt.status === "cancelled" ? "bg-rose-100 text-rose-700" :
        "bg-[hsl(38,92%,50%)]/20 text-[hsl(21,91%,14%)]"
      }>
        {appt.status || "scheduled"}
      </Badge>
    </button>
  );
}
