import PDFDocument from "pdfkit";
import { VENDOR_LABELS } from "@/lib/vendors";
import type { AccountReportData } from "@/lib/report-data";

const RISK_COLOR: Record<"high" | "medium" | "low", string> = {
  high: "#B3261E",
  medium: "#93650A",
  low: "#1F7A45",
};

const PAGE_BREAK_Y = 720;

function severityColor(severity: string): string {
  return severity === "high" || severity === "medium" || severity === "low" ? RISK_COLOR[severity] : "#2B3F46";
}

/**
 * Renders an AccountReportData into a downloadable PDF, using pdfkit (pure
 * Node, no headless browser) so this can run inside the app's own server —
 * see /api/reports/risk. Returns a Buffer rather than writing to disk,
 * since the route streams it straight back as the HTTP response body.
 */
export async function renderRiskReportPdf(data: AccountReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).fillColor("#0F2027").text("Breakwater — Vendor Risk Report");
    doc.moveDown(0.2);
    doc
      .fontSize(10)
      .fillColor("#51707A")
      .text(`${data.ownerLabel} · generated ${data.generatedAt.toLocaleString()}`);
    doc.moveDown(1);

    doc
      .fontSize(12)
      .fillColor("#0F2027")
      .text(
        `${data.repos.length} repositor${data.repos.length === 1 ? "y" : "ies"} watched — ` +
          `${data.highCount} high, ${data.mediumCount} medium, ${data.lowCount} low risk right now.`
      );
    doc.moveDown(1);

    if (data.repos.length === 0) {
      doc.fontSize(11).fillColor("#51707A").text("No repositories connected yet.");
    }

    for (const repo of data.repos) {
      if (doc.y > PAGE_BREAK_Y) doc.addPage();

      doc.moveDown(0.6);
      doc.fontSize(13).fillColor("#0F2027").text(repo.repoFullName);

      const vendorLabel = repo.vendor ? VENDOR_LABELS[repo.vendor] : "No vendor";
      const riskLabel = repo.effectiveRisk ? `${repo.effectiveRisk.toUpperCase()} risk` : "Not scanned yet";
      const riskColor = repo.effectiveRisk ? RISK_COLOR[repo.effectiveRisk] : "#8FA9B2";
      const scannedLabel = repo.latestScanAt ? ` · scanned ${repo.latestScanAt.toLocaleDateString()}` : "";
      doc.fontSize(9).fillColor(riskColor).text(riskLabel, { continued: true });
      doc.fillColor("#51707A").text(` · ${vendorLabel}${scannedLabel}`);

      if (repo.latestScanSummary) {
        doc.moveDown(0.25);
        doc.fontSize(9.5).fillColor("#2B3F46").text(repo.latestScanSummary, { width: 495 });
      }

      if (repo.openFindings.length > 0) {
        doc.moveDown(0.3);
        for (const f of repo.openFindings) {
          if (doc.y > PAGE_BREAK_Y) doc.addPage();
          doc.fontSize(9.5).fillColor(severityColor(f.severity)).text(`•  [${f.severity.toUpperCase()}] ${f.title}`, { width: 495 });
          doc.fontSize(8.5).fillColor("#51707A").text(f.explanation, { indent: 12, width: 483 });
          if (f.filePath) {
            doc.fontSize(8).fillColor("#8FA9B2").text(f.filePath, { indent: 12, width: 483 });
          }
          doc.moveDown(0.25);
        }
      } else {
        doc.moveDown(0.2);
        doc.fontSize(8.5).fillColor("#8FA9B2").text("No open findings.");
      }
    }

    doc.end();
  });
}
