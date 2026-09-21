import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getActiveWorkspace, getWorkspaceOptions } from "@/lib/workspace";
import { buildAccountReportData } from "@/lib/report-data";
import { renderRiskReportPdf } from "@/lib/pdf-report";

/**
 * GET /api/reports/risk — a stand-alone PDF snapshot of the active
 * workspace's current risk posture (one section per watched repo, with its
 * open findings), for sharing outside Breakwater — a compliance review, an
 * exec update, whatever doesn't want a dashboard login. Scoped to whichever
 * account the sidebar workspace switcher currently has selected, same as
 * the Overview page.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const workspace = await getActiveWorkspace(user.id);
  const options = await getWorkspaceOptions(user.id);
  const ownerLabel = options.find((o) => o.ownerId === workspace.ownerId)?.label ?? "Account";

  const data = await buildAccountReportData(workspace.ownerId, ownerLabel);
  const pdf = await renderRiskReportPdf(data);

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="breakwater-risk-report-${date}.pdf"`,
    },
  });
}
