import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Shell } from "@/components/Shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { LayoutDashboard, BarChart3, TrendingUp, Users2, Wallet } from "lucide-react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { TID } from "@/constants/testIds";

const COLORS = ["hsl(32,95%,44%)", "hsl(38,92%,50%)", "hsl(22,78%,26%)", "hsl(180,30%,40%)"];

export default function ManagerDashboard() {
  const location = useLocation();
  const hashTab = (location.hash || "").replace("#", "");
  const [tab, setTab] = useState(hashTab || "financial");
  useEffect(() => { if (hashTab && hashTab !== tab) setTab(hashTab); /* eslint-disable-next-line */ }, [hashTab]);
  const [data, setData] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const load = async () => {
    try {
      const [s, a, i] = await Promise.all([
        api.get("/reports/summary"),
        api.get("/appointments"),
        api.get("/invoices"),
      ]);
      setData(s.data);
      setAppointments(a.data);
      setInvoices(i.data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Failed");
    }
  };
  useEffect(() => { load(); }, []);

  const nav = [
    { key: "overview", label: "Overview", to: "/manager", icon: LayoutDashboard },
    { key: "reports", label: "Reports", to: "/manager#reports", icon: BarChart3 },
  ];

  if (!data) {
    return <Shell navItems={nav} title="Manager"><div className="text-muted-foreground">Loading analytics…</div></Shell>;
  }

  return (
    <Shell navItems={nav} title="Manager">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.18em] text-[hsl(22,78%,30%)]">Operational insights</div>
        <h1 className="font-display text-3xl md:text-4xl font-semibold mt-1">Manager dashboard</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Kpi testid={TID.managerKpi("revenue")} label="Total revenue" value={`$${data.total_revenue.toFixed(2)}`} icon={Wallet} />
        <Kpi testid={TID.managerKpi("today")} label="Appointments today" value={data.appointments_today} icon={TrendingUp} />
        <Kpi testid={TID.managerKpi("patients")} label="Total patients" value={data.total_patients} icon={Users2} />
        <Kpi testid={TID.managerKpi("pending")} label="Pending billing" value={`$${data.pending_amount.toFixed(2)}`} icon={Wallet} accent />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2 rounded-2xl bg-white border-border shadow-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-display text-lg font-semibold">Revenue trend (last 7 days)</div>
            <Badge variant="outline">Paid invoices</Badge>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.revenue_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(36 40% 88%)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="hsl(32,95%,44%)" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="rounded-2xl bg-white border-border shadow-card p-5">
          <div className="font-display text-lg font-semibold mb-3">Appointments by status</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.appointments_by_status} dataKey="count" nameKey="status" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {data.appointments_by_status.map((entry, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl bg-white border-border shadow-card p-5 mb-6">
        <div className="font-display text-lg font-semibold mb-3">Therapist workload</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.workload}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(36 40% 88%)" />
              <XAxis dataKey="therapist" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="appointments" fill="hsl(32,95%,44%)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-[hsl(38,60%,94%)] rounded-full p-1 mb-3">
          <TabsTrigger value="financial" className="rounded-full">Financial reports</TabsTrigger>
          <TabsTrigger value="appointments" className="rounded-full">Appointment reports</TabsTrigger>
          <TabsTrigger value="reports" className="rounded-full">Therapist performance</TabsTrigger>
        </TabsList>

        <TabsContent value="financial">
          <Card className="rounded-2xl bg-white border-border shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[hsl(38,60%,94%)] text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Therapist</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Date</th></tr>
              </thead>
              <tbody>
                {invoices.slice(0, 30).map((inv) => (
                  <tr key={inv.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{inv.patient?.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.therapist?.name}</td>
                    <td className="px-4 py-3 font-semibold">${inv.amount.toFixed(2)}</td>
                    <td className="px-4 py-3"><Badge className={inv.status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-[hsl(38,92%,50%)]/20 text-[hsl(21,91%,14%)]"}>{inv.status}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(inv.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {invoices.length === 0 && <tr><td colSpan="5" className="px-4 py-10 text-center text-muted-foreground">No financial data yet.</td></tr>}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="appointments">
          <Card className="rounded-2xl bg-white border-border shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[hsl(38,60%,94%)] text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Therapist</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Status</th></tr>
              </thead>
              <tbody>
                {appointments.slice(0, 30).map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="px-4 py-3 text-muted-foreground">{new Date(a.scheduled_at).toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium">{a.patient?.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.therapist?.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.reason}</td>
                    <td className="px-4 py-3"><Badge className={
                      a.status === "completed" ? "bg-emerald-100 text-emerald-800" :
                      a.status === "cancelled" ? "bg-rose-100 text-rose-700" :
                      "bg-[hsl(38,92%,50%)]/20 text-[hsl(21,91%,14%)]"
                    }>{a.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card className="rounded-2xl bg-white border-border shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[hsl(38,60%,94%)] text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-4 py-3">Therapist</th><th className="px-4 py-3 text-right">Appointments</th></tr>
              </thead>
              <tbody>
                {(data.workload || []).map((w) => (
                  <tr key={w.therapist} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{w.therapist}</td>
                    <td className="px-4 py-3 text-right font-semibold">{w.appointments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>
    </Shell>
  );
}

function Kpi({ label, value, icon: Icon, accent, testid }) {
  return (
    <Card data-testid={testid} className={`rounded-2xl p-5 border-border shadow-card ${accent ? "bg-[hsl(32,95%,44%)] text-white" : "bg-white"}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
        <Icon size={18} className="opacity-80" />
      </div>
      <div className="font-display text-3xl font-semibold mt-2">{value}</div>
    </Card>
  );
}
