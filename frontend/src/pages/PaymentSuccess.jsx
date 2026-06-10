import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo, BrandMark } from "@/components/Logo";
import { CheckCircle2, FileDown, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { downloadReceiptPdf } from "@/lib/receipt";
import { toast } from "sonner";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking"); // checking | success | failed
  const [invoice, setInvoice] = useState(null);
  const attempts = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      navigate("/", { replace: true });
      return;
    }
    let stopped = false;
    const poll = async () => {
      attempts.current += 1;
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (data.payment_status === "paid") {
          setStatus("success");
          // try fetch invoice
          try {
            const list = await api.get("/invoices");
            const paidInv = list.data.find((i) => i.payment_session_id === sessionId);
            if (paidInv) setInvoice(paidInv);
          } catch {}
          return;
        }
        if (data.status === "expired") {
          setStatus("failed");
          return;
        }
        if (attempts.current >= 8) {
          setStatus("failed");
          return;
        }
        if (!stopped) setTimeout(poll, 2000);
      } catch (e) {
        if (attempts.current >= 8) setStatus("failed");
        else if (!stopped) setTimeout(poll, 2000);
      }
    };
    poll();
    return () => { stopped = true; };
  }, [sessionId, navigate]);

  return (
    <div className="min-h-screen honeycomb-bg flex items-center justify-center p-6">
      <Card className="rounded-3xl bg-white border-border shadow-honey max-w-md w-full p-8 text-center">
        <div className="flex justify-center mb-4"><BrandMark /></div>
        {status === "checking" && (
          <>
            <div className="font-display text-2xl font-semibold mt-6">Confirming your payment…</div>
            <p className="text-sm text-muted-foreground mt-2">This usually takes just a few seconds.</p>
            <div className="mt-6 mx-auto h-1.5 w-32 bg-[hsl(38,60%,94%)] rounded-full overflow-hidden">
              <div className="h-full bg-[hsl(32,95%,44%)] animate-pulse w-1/2" />
            </div>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 size={56} className="mx-auto text-emerald-500 mt-4" />
            <div className="font-display text-2xl font-semibold mt-4">Payment successful</div>
            <p className="text-sm text-muted-foreground mt-2">Your invoice has been settled. A receipt is ready to download.</p>
            <div className="mt-6 flex flex-col gap-3">
              {invoice && (
                <Button onClick={() => downloadReceiptPdf(invoice)} variant="outline" className="rounded-full">
                  <FileDown size={16} className="mr-2" /> Download PDF receipt
                </Button>
              )}
              <Button onClick={() => navigate("/patient")} className="rounded-full bg-[hsl(32,95%,44%)] hover:bg-[hsl(28,90%,40%)] text-white">
                Back to dashboard <ArrowRight size={16} className="ml-1.5" />
              </Button>
            </div>
          </>
        )}
        {status === "failed" && (
          <>
            <div className="font-display text-2xl font-semibold mt-6 text-rose-600">Payment not confirmed</div>
            <p className="text-sm text-muted-foreground mt-2">We couldn't verify the payment in time. Please try again from your dashboard.</p>
            <Button onClick={() => navigate("/patient")} className="mt-6 rounded-full bg-[hsl(32,95%,44%)] text-white">
              Back to dashboard
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
