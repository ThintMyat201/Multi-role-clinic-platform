import { Link } from "react-router-dom";
import { BrandMark, Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { TID } from "@/constants/testIds";
import { ArrowRight, Calendar, HeartHandshake, Receipt, ShieldCheck, Sparkles } from "lucide-react";

const HERO_IMG = "https://images.unsplash.com/photo-1630226040750-d934f017f0e4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBwaHlzaW90aGVyYXB5JTIwY2xpbmljJTIwd2FybXxlbnwwfHx8fDE3ODEwODcwMTF8MA&ixlib=rb-4.1.0&q=85";

export default function Landing() {
  return (
    <div className="min-h-screen honeycomb-bg">
      {/* Top bar */}
      <header className="max-w-7xl mx-auto flex items-center justify-between px-6 md:px-10 py-6">
        <BrandMark />
        <div className="flex items-center gap-2">
          <Link to="/login">
            <Button
              data-testid={TID.landingCtaLogin}
              variant="ghost"
              className="rounded-full text-foreground hover:bg-[hsl(38,92%,50%)]/15"
            >
              Sign in
            </Button>
          </Link>
          <Link to="/login?mode=register">
            <Button
              data-testid={TID.landingCtaRegister}
              className="rounded-full bg-[hsl(32,95%,44%)] hover:bg-[hsl(28,90%,40%)] text-white"
            >
              Get started <ArrowRight size={16} className="ml-1.5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 md:px-10 grid md:grid-cols-2 gap-12 items-center pt-8 pb-20">
        <div>
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[hsl(22,78%,30%)] bg-[hsl(38,92%,50%)]/10 px-3 py-1.5 rounded-full mb-6">
            <Sparkles size={12} /> Multi-role clinic platform
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-balance leading-[1.05]">
            Healing in motion,
            <span className="block text-[hsl(32,95%,44%)]">made beautifully simple.</span>
          </h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-xl">
            HoneyBee Physiotherapy Centre brings patients, therapists, receptionists, managers and admins
            into one warm, intuitive workspace — from booking to billing, treatment notes to insights.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link to="/login?mode=register">
              <Button
                className="rounded-full bg-[hsl(32,95%,44%)] hover:bg-[hsl(28,90%,40%)] text-white px-6 h-12"
                data-testid="landing-hero-cta"
              >
                Book your first session
                <ArrowRight size={18} className="ml-2" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" className="rounded-full h-12 px-6 border-[hsl(36,40%,70%)]">
                Staff sign-in
              </Button>
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-6 max-w-md">
            {[
              { n: "5", label: "Role portals" },
              { n: "24/7", label: "Self-service booking" },
              { n: "PDF", label: "Receipts on demand" },
            ].map((s) => (
              <div key={s.label}>
                <div className="font-display text-2xl font-semibold text-[hsl(32,95%,44%)]">{s.n}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 bg-[hsl(38,92%,50%)]/10 rounded-[2.5rem] rotate-2" />
          <div className="relative overflow-hidden rounded-[2rem] shadow-honey border border-[hsl(36,40%,80%)]">
            <img src={HERO_IMG} alt="Warm physiotherapy clinic" className="w-full h-[480px] object-cover" />
            <div className="absolute bottom-5 left-5 right-5 glass-card rounded-2xl px-5 py-4 flex items-center gap-3">
              <Logo size={32} />
              <div>
                <div className="text-sm font-semibold">Next session</div>
                <div className="text-xs text-muted-foreground">Tomorrow · 10:30 AM · Dr. Okafor</div>
              </div>
              <div className="ml-auto text-xs rounded-full bg-[hsl(32,95%,44%)] text-white px-3 py-1.5">Confirmed</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 md:px-10 pb-24">
        <h2 className="font-display text-2xl md:text-3xl font-semibold mb-8">One hive, every role.</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { icon: Calendar, title: "Smart scheduling", body: "Book with the right therapist, see therapy schedules side-by-side, prevent overlaps." },
            { icon: HeartHandshake, title: "Treatment continuity", body: "Therapists capture session notes and progress against every appointment." },
            { icon: Receipt, title: "Billing & receipts", body: "Stripe checkout for outstanding bills, downloadable PDF receipts in one click." },
            { icon: ShieldCheck, title: "Role-based access", body: "Patient, receptionist, therapist, manager and admin — each with the right view." },
            { icon: Sparkles, title: "Manager insights", body: "Revenue trends, therapist workload, productivity — all in one analytical view." },
            { icon: Logo, title: "Warm & welcoming", body: "A calm, honey-toned interface designed to feel human, not clinical." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl bg-white border border-border p-6 shadow-card">
              <f.icon size={22} className="text-[hsl(32,95%,44%)]" />
              <div className="mt-4 font-display text-lg font-semibold">{f.title}</div>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border bg-white/60">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <BrandMark />
          <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} HoneyBee Physiotherapy Centre · All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
