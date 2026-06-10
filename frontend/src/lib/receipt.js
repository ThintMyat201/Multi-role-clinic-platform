import jsPDF from "jspdf";

export function downloadReceiptPdf(invoice) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const left = 60;
  let y = 70;

  // Brand bar
  doc.setFillColor(217, 119, 6);
  doc.rect(0, 0, 612, 14, "F");

  // Logo block
  doc.setTextColor(53, 21, 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("HoneyBee Physiotherapy Centre", left, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(140, 90, 30);
  doc.text("Healing in motion · Receipt", left, y + 18);

  // Divider
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(1);
  doc.line(left, y + 30, 552, y + 30);

  y += 70;

  doc.setTextColor(53, 21, 4);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Receipt #", left, y);
  doc.setFont("helvetica", "normal");
  doc.text(String(invoice.id || "").slice(0, 13), left + 80, y);

  doc.setFont("helvetica", "bold");
  doc.text("Date", 350, y);
  doc.setFont("helvetica", "normal");
  doc.text(new Date(invoice.paid_at || invoice.created_at || Date.now()).toLocaleString(), 400, y);

  y += 24;
  doc.setFont("helvetica", "bold");
  doc.text("Patient", left, y);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.patient?.name || "—", left + 80, y);

  doc.setFont("helvetica", "bold");
  doc.text("Therapist", 350, y);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.therapist?.name || "—", 410, y);

  y += 40;
  doc.setFillColor(255, 247, 230);
  doc.rect(left, y, 492, 60, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Description", left + 16, y + 22);
  doc.text("Amount", 470, y + 22);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Physiotherapy session — ${invoice.appointment?.reason || "Treatment"}`,
    left + 16,
    y + 44
  );
  doc.text(
    `$${Number(invoice.amount).toFixed(2)} ${invoice.currency?.toUpperCase() || "USD"}`,
    470,
    y + 44
  );

  y += 90;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(217, 119, 6);
  doc.text(
    `TOTAL PAID: $${Number(invoice.amount).toFixed(2)} ${invoice.currency?.toUpperCase() || "USD"}`,
    left,
    y
  );

  doc.setFontSize(9);
  doc.setTextColor(140, 90, 30);
  doc.text("Thank you for choosing HoneyBee. Wishing you continued healing.", left, 740);

  doc.save(`receipt-${(invoice.id || "honeybee").slice(0, 8)}.pdf`);
}

export function printableReceiptUrl(invoice) {
  const html = `
    <html><head><title>Receipt</title>
    <style>
      body { font-family: ui-sans-serif, system-ui; color: #3b1e08; padding: 40px; max-width: 720px; margin: auto; }
      h1 { color: #b45309; margin-bottom: 4px; }
      .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e8c187; }
      .total { font-size: 22px; color: #b45309; font-weight: 700; margin-top: 20px; }
      .bar { height: 8px; background: #d97706; margin-bottom: 24px; }
    </style></head><body>
    <div class="bar"></div>
    <h1>HoneyBee Physiotherapy Centre</h1>
    <p>Receipt — ${new Date(invoice.paid_at || invoice.created_at || Date.now()).toLocaleString()}</p>
    <div class="row"><span>Receipt #</span><strong>${(invoice.id || "").slice(0, 13)}</strong></div>
    <div class="row"><span>Patient</span><strong>${invoice.patient?.name || ""}</strong></div>
    <div class="row"><span>Therapist</span><strong>${invoice.therapist?.name || ""}</strong></div>
    <div class="row"><span>Treatment</span><strong>${invoice.appointment?.reason || "Physiotherapy session"}</strong></div>
    <div class="total">Total: $${Number(invoice.amount).toFixed(2)} ${invoice.currency?.toUpperCase() || "USD"}</div>
    <p style="margin-top:32px;color:#8a5a1e">Thank you for choosing HoneyBee. Wishing you continued healing.</p>
    <button onclick="window.print()" style="margin-top:20px;padding:10px 16px;background:#d97706;color:white;border:none;border-radius:999px;cursor:pointer">Print</button>
    </body></html>
  `;
  const blob = new Blob([html], { type: "text/html" });
  return URL.createObjectURL(blob);
}
