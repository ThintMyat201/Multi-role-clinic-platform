import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BrandMark, Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { TID } from "@/constants/testIds";
import { formatApiErrorDetail } from "@/lib/api";

const DEMOS = [
  { role: "patient", email: "patient@honeybee.com", password: "Patient@123", label: "Patient" },
  { role: "receptionist", email: "reception@honeybee.com", password: "Reception@123", label: "Receptionist" },
  { role: "therapist", email: "therapist@honeybee.com", password: "Therapist@123", label: "Therapist" },
  { role: "manager", email: "manager@honeybee.com", password: "Manager@123", label: "Manager" },
  { role: "admin", email: "admin@honeybee.com", password: "Admin@123", label: "Admin" },
];

export default function LoginPage() {
  const { login, register, user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialTab = params.get("mode") === "register" ? "register" : "login";
  const [tab, setTab] = useState(initialTab);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate(`/${user.role}`, { replace: true });
  }, [user, loading, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      // Defensive: clear any stale token before login (otherwise the
      // axios interceptor will send an old Authorization header that the
      // backend ignores but some proxies trip on).
      localStorage.removeItem("honeybee_token");
      const u = await login(email, password);
      toast.success(`Welcome back, ${u.name.split(" ")[0]}`);
      navigate(`/${u.role}`, { replace: true });
    } catch (err) {
      const msg =
        formatApiErrorDetail(err.response?.data?.detail) ||
        err.response?.data?.message ||
        err.message ||
        "Login failed. Please check your connection and try again.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      localStorage.removeItem("honeybee_token");
      const u = await register({ email, password, name, phone });
      toast.success(`Welcome to HoneyBee, ${u.name.split(" ")[0]}`);
      navigate(`/${u.role}`, { replace: true });
    } catch (err) {
      const msg =
        formatApiErrorDetail(err.response?.data?.detail) ||
        err.response?.data?.message ||
        err.message ||
        "Sign up failed. Please check your connection and try again.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = (d) => {
    setEmail(d.email);
    setPassword(d.password);
    setTab("login");
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 honeycomb-bg">
      <div className="hidden md:flex relative">
        <img
          src="https://images.unsplash.com/photo-1580912458702-6fa698fc553e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGhvbmV5Y29tYiUyMHdhcm18ZW58MHx8fHwxNzgxMDg3MDEwfDA&ixlib=rb-4.1.0&q=85"
          alt="Honeycomb"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-[hsl(21,91%,14%)]/35" />
        <div className="absolute inset-0 p-12 flex flex-col">
          <Link to="/" className="text-white">
            <div className="flex items-center gap-3">
              <Logo size={42} />
              <div className="leading-tight">
                <div className="font-display text-lg font-semibold">HoneyBee</div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/70">Physiotherapy Centre</div>
              </div>
            </div>
          </Link>
          <div className="mt-auto text-white">
            <h2 className="font-display text-4xl font-semibold leading-tight">
              Where every patient<br /> is cared for, like family.
            </h2>
            <p className="mt-4 text-white/80 max-w-md">
              Sign in to your role-specific portal or quickly explore the demo using the buttons below.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-10 md:py-16">
        <div className="w-full max-w-md">
          <div className="md:hidden mb-8">
            <BrandMark />
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-[hsl(38,60%,94%)] rounded-full p-1 h-11 grid grid-cols-2 w-fit">
              <TabsTrigger value="login" data-testid={TID.authToggle + "-login"} className="rounded-full px-5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Sign in
              </TabsTrigger>
              <TabsTrigger value="register" data-testid={TID.authToggle + "-register"} className="rounded-full px-5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Create account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-7">
              <h1 className="font-display text-3xl font-semibold tracking-tight">Welcome back</h1>
              <p className="text-sm text-muted-foreground mt-1">Sign in with your HoneyBee account.</p>

              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Email</Label>
                  <Input
                    type="email"
                    required
                    autoComplete="email"
                    data-testid={TID.loginEmail}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-xl h-11 mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Password</Label>
                  <Input
                    type="password"
                    required
                    autoComplete="current-password"
                    data-testid={TID.loginPassword}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-xl h-11 mt-1 bg-white"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={busy}
                  data-testid={TID.loginSubmit}
                  className="w-full h-11 rounded-full bg-[hsl(32,95%,44%)] hover:bg-[hsl(28,90%,40%)] text-white"
                >
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </form>

              <div className="mt-8">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">
                  Quick demo accounts
                </div>
                <div className="flex flex-wrap gap-2">
                  {DEMOS.map((d) => (
                    <button
                      key={d.role}
                      type="button"
                      onClick={() => fillDemo(d)}
                      data-testid={TID.demoFill(d.role)}
                      className="text-xs rounded-full px-3 py-1.5 border border-[hsl(36,40%,75%)] bg-white hover:bg-[hsl(38,92%,50%)]/10 transition"
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="register" className="mt-7">
              <h1 className="font-display text-3xl font-semibold tracking-tight">Create your patient account</h1>
              <p className="text-sm text-muted-foreground mt-1">Staff accounts are created by your administrator.</p>

              <form onSubmit={handleRegister} className="mt-6 space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Full name</Label>
                  <Input
                    required
                    data-testid={TID.registerName}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-xl h-11 mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Email</Label>
                  <Input
                    type="email"
                    required
                    data-testid={TID.registerEmail}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-xl h-11 mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Phone (optional)</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="rounded-xl h-11 mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Password</Label>
                  <Input
                    type="password"
                    required
                    minLength={6}
                    data-testid={TID.registerPassword}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-xl h-11 mt-1 bg-white"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={busy}
                  data-testid={TID.registerSubmit}
                  className="w-full h-11 rounded-full bg-[hsl(32,95%,44%)] hover:bg-[hsl(28,90%,40%)] text-white"
                >
                  {busy ? "Creating…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
