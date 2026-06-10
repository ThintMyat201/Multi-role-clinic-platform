import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Users, Shield, Activity, Server, Database, Plus, Pencil, Trash2 } from "lucide-react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { TID } from "@/constants/testIds";

const ROLES = ["patient", "receptionist", "therapist", "manager", "admin"];

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [health, setHealth] = useState(null);
  const [logs, setLogs] = useState([]);
  const [openAdd, setOpenAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "receptionist", phone: "", specialty: "" });

  const load = async () => {
    try {
      const [u, h, l] = await Promise.all([
        api.get("/users"),
        api.get("/admin/system-health"),
        api.get("/admin/activity-logs", { params: { limit: 30 } }),
      ]);
      setUsers(u.data);
      setHealth(h.data);
      setLogs(l.data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Failed");
    }
  };
  useEffect(() => { load(); }, []);

  const submitNew = async () => {
    try {
      await api.post("/users", form);
      toast.success("User created");
      setOpenAdd(false);
      setForm({ name: "", email: "", password: "", role: "receptionist", phone: "", specialty: "" });
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Failed");
    }
  };

  const submitEdit = async () => {
    try {
      const { id, ...rest } = editing;
      const payload = Object.fromEntries(Object.entries(rest).filter(([k, v]) => v !== "" && v !== null && k !== "created_at"));
      await api.patch(`/users/${id}`, payload);
      toast.success("Updated");
      setEditing(null);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Failed");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this user?")) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error("Failed");
    }
  };

  const toggleStatus = async (u) => {
    try {
      await api.patch(`/users/${u.id}`, { status: u.status === "disabled" ? "active" : "disabled" });
      toast.success("Status updated");
      load();
    } catch (e) { toast.error("Failed"); }
  };

  const nav = [
    { key: "users", label: "User accounts", to: "/admin", icon: Users },
    { key: "maintenance", label: "Maintenance", to: "/admin#maintenance", icon: Server },
    { key: "logs", label: "Activity logs", to: "/admin#logs", icon: Activity },
  ];

  return (
    <Shell navItems={nav} title="Admin Portal" accent="admin">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-[hsl(22,78%,30%)] flex items-center gap-2">
            <Shield size={12} /> System administration
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold mt-1">HoneyBee · Admin Portal</h1>
        </div>
        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogTrigger asChild>
            <Button data-testid={TID.adminAddUser} className="rounded-full bg-[hsl(32,95%,44%)] hover:bg-[hsl(28,90%,40%)] text-white">
              <Plus size={16} className="mr-2" /> Add user
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl max-w-md">
            <DialogHeader><DialogTitle>Add user account</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl mt-1" /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl mt-1" /></div>
              <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-xl mt-1" /></div>
              <div>
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.role === "therapist" && (
                <div><Label>Specialty</Label><Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} className="rounded-xl mt-1" /></div>
              )}
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-xl mt-1" /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpenAdd(false)} className="rounded-full">Cancel</Button>
              <Button onClick={submitNew} className="rounded-full bg-[hsl(32,95%,44%)] text-white">Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* System health */}
      {health && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <HealthBadge label="API" value={health.api} icon={Server} ok={health.api === "online"} />
          <HealthBadge label="Database" value={health.database} icon={Database} ok={health.database === "online"} />
          <HealthBadge label="Uptime" value={`${health.uptime_pct}%`} icon={Activity} ok />
          <HealthBadge label="Last backup" value={new Date(health.last_backup).toLocaleString()} icon={Shield} ok />
        </div>
      )}

      <Tabs defaultValue="users">
        <TabsList className="bg-[hsl(38,60%,94%)] rounded-full p-1 mb-4">
          <TabsTrigger value="users" className="rounded-full">User accounts ({users.length})</TabsTrigger>
          <TabsTrigger value="maintenance" className="rounded-full">System maintenance</TabsTrigger>
          <TabsTrigger value="logs" className="rounded-full">Activity logs</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card className="rounded-2xl bg-white border-border shadow-card overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-[hsl(38,60%,94%)] text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">User ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{u.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className="capitalize">{u.role}</Badge></td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleStatus(u)} className="text-left">
                        <Badge className={u.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}>
                          {u.status || "active"}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        data-testid={TID.adminEditUser(u.id)}
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status || "active", phone: u.phone || "", specialty: u.specialty || "", password: "" })}
                        className="rounded-full"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        data-testid={TID.adminDeleteUser(u.id)}
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(u.id)}
                        className="rounded-full text-rose-600"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card className="rounded-2xl bg-white border-border shadow-card p-6">
            <h3 className="font-display text-lg font-semibold mb-4">System maintenance</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <Stat label="Total users" value={health?.total_records?.users ?? "—"} />
              <Stat label="Patients" value={health?.total_records?.patients ?? "—"} />
              <Stat label="Appointments" value={health?.total_records?.appointments ?? "—"} />
              <Stat label="Invoices" value={health?.total_records?.invoices ?? "—"} />
              <Stat label="Active sessions" value={health?.active_sessions ?? "—"} />
              <Stat label="Backup status" value="Healthy · daily" />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card className="rounded-2xl bg-white border-border shadow-card overflow-hidden">
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-[hsl(38,60%,94%)] text-left text-xs uppercase tracking-wide text-muted-foreground sticky top-0">
                  <tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Target</th></tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</td>
                      <td className="px-4 py-2">{l.actor_email}</td>
                      <td className="px-4 py-2 capitalize text-muted-foreground">{l.actor_role}</td>
                      <td className="px-4 py-2 font-mono text-xs">{l.action}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground font-mono">{(l.target || "").slice(0, 12)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader><DialogTitle>Edit user</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="rounded-xl mt-1" /></div>
              <div><Label>Role</Label>
                <Select value={editing.role} onValueChange={(v) => setEditing({ ...editing, role: v })}>
                  <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Status</Label>
                <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">active</SelectItem><SelectItem value="disabled">disabled</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Phone</Label><Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} className="rounded-xl mt-1" /></div>
              <div><Label>Reset password (optional)</Label><Input type="password" value={editing.password} onChange={(e) => setEditing({ ...editing, password: e.target.value })} className="rounded-xl mt-1" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} className="rounded-full">Cancel</Button>
            <Button onClick={submitEdit} className="rounded-full bg-[hsl(32,95%,44%)] text-white">Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

function HealthBadge({ label, value, icon: Icon, ok }) {
  return (
    <Card className={`rounded-2xl p-4 border-border shadow-card flex items-center gap-3 ${ok ? "bg-white" : "bg-rose-50"}`}>
      <div className={`p-2.5 rounded-xl ${ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
        <Icon size={16} />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="font-semibold text-sm">{value}</div>
      </div>
    </Card>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-border p-4 bg-[hsl(40,100%,98%)]">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
