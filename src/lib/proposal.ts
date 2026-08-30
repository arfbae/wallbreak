import { jsPDF } from "jspdf";
import { formatMoney, type QuoteResult } from "@/lib/quote";

export interface ProposalInput {
  clientName: string;
  projectTitle: string;
  location: string;
  wallDimensions: string;
  timeline: string;
  budget: string;
  notes: string;
  sceneName: string;
  muralImageUrl: string;
  wallImageUrl?: string | null;
  artworkImageUrls?: string[];
  quote?: QuoteResult | null;
}

const PAGE_W = 595.28; // A4 portrait pt
const PAGE_H = 841.89;
const M = 48;
const INK = [16, 18, 22] as const;
const MUTED = [110, 116, 128] as const;
const ACCENT = [217, 70, 239] as const;

function imgFormat(dataUrl: string) {
  return dataUrl.slice(0, 30).includes("image/png") ? "PNG" : "JPEG";
}

async function imageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1600, h: img.naturalHeight || 1000 });
    img.onerror = () => resolve({ w: 1600, h: 1000 });
    img.src = src;
  });
}

function drawFooter(doc: jsPDF, page: number, title: string) {
  doc.setDrawColor(225, 227, 232);
  doc.line(M, PAGE_H - 46, PAGE_W - M, PAGE_H - 46);
  doc.setFont("courier", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(title.toUpperCase(), M, PAGE_H - 32);
  doc.text(String(page).padStart(2, "0"), PAGE_W - M, PAGE_H - 32, { align: "right" });
}

function label(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFont("courier", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(text.toUpperCase(), x, y);
}

function value(doc: jsPDF, text: string, x: number, y: number, size = 11) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  doc.setTextColor(...INK);
  doc.text(text || "—", x, y);
}

export async function generateProposalPdf(input: ProposalInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const contentW = PAGE_W - M * 2;
  const title = input.projectTitle || "Mural Proposal";
  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ---------- Page 1: cover ----------
  doc.setFillColor(12, 13, 16);
  doc.rect(0, 0, PAGE_W, 210, "F");
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150, 154, 165);
  doc.text("MURAL MOCKUP STUDIO · SPATIAL PLANNING ENGINE", M, 62);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.text(doc.splitTextToSize(title, contentW), M, 104);
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...ACCENT);
  doc.text(`${input.sceneName.toUpperCase()} · APPROVED CONCEPT`, M, 176);

  const hero = await imageSize(input.muralImageUrl);
  const heroH = Math.min(300, (contentW * hero.h) / hero.w);
  doc.addImage(input.muralImageUrl, imgFormat(input.muralImageUrl), M, 240, contentW, heroH, undefined, "FAST");

  let y = 240 + heroH + 34;
  const colW = contentW / 2;
  const rows: Array<[string, string]> = [
    ["Client", input.clientName],
    ["Date", today],
    ["Location", input.location],
    ["Wall dimensions", input.wallDimensions],
    ["Timeline", input.timeline],
    ["Investment", input.budget],
  ];
  rows.forEach(([k, v], i) => {
    const x = M + (i % 2) * colW;
    const ry = y + Math.floor(i / 2) * 52;
    label(doc, k, x, ry);
    value(doc, v, x, ry + 16);
  });
  drawFooter(doc, 1, title);

  // ---------- Page 2: scope + references ----------
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text("Scope & Execution", M, 78);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(2);
  doc.line(M, 88, M + 46, 88);
  doc.setLineWidth(1);

  const scope = input.notes?.trim()
    ? input.notes.trim()
    : `This proposal covers the design, site preparation, and hand-painted execution of the approved mural concept shown on the cover. The rendering is a photographic composite generated from the client's supplied wall photograph, so proportions, perspective, lighting, and existing obstructions reflect the real site conditions.

Included: surface cleaning and priming, projection/grid layout, exterior-grade acrylic application, protective anti-UV and anti-graffiti clear coat, and full site clean-down on completion. Access equipment, permits, and any structural repairs are quoted separately where required.`;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  const lines = doc.splitTextToSize(scope, contentW);
  doc.text(lines, M, 114, { lineHeightFactor: 1.55 });

  let ry = 114 + lines.length * 10.5 * 1.55 + 30;

  if (input.wallImageUrl) {
    label(doc, "Site photograph", M, ry);
    const s = await imageSize(input.wallImageUrl);
    const w = contentW * 0.56;
    const h = Math.min(210, (w * s.h) / s.w);
    doc.addImage(input.wallImageUrl, imgFormat(input.wallImageUrl), M, ry + 10, w, h, undefined, "FAST");
    ry += h + 34;
  }

  const arts = (input.artworkImageUrls ?? []).filter(Boolean);
  if (arts.length && ry < PAGE_H - 200) {
    label(doc, "Source artwork", M, ry);
    const gap = 12;
    const w = (contentW - gap * (arts.length - 1)) / arts.length;
    for (let i = 0; i < arts.length; i++) {
      const s = await imageSize(arts[i]!);
      const h = Math.min(150, (w * s.h) / s.w);
      doc.addImage(arts[i]!, imgFormat(arts[i]!), M + i * (w + gap), ry + 10, w, h, undefined, "FAST");
    }
  }
  drawFooter(doc, 2, title);

  let pageNo = 2;

  // ---------- Optional page: itemised quote ----------
  const q = input.quote;
  if (q) {
    doc.addPage();
    pageNo += 1;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...INK);
    doc.text("Investment Breakdown", M, 78);
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(2);
    doc.line(M, 88, M + 46, 88);
    doc.setLineWidth(1);

    label(doc, `Painted area · ${q.areaSqm} m²`, M, 110);

    let qy = 140;
    const right = PAGE_W - M;
    q.lines.forEach((l) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...INK);
      doc.text(l.label, M, qy);
      doc.text(formatMoney(l.amount, q.currency), right, qy, { align: "right" });
      doc.setFont("courier", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(l.detail.toUpperCase(), M, qy + 12);
      doc.setDrawColor(232, 234, 238);
      doc.line(M, qy + 22, right, qy + 22);
      qy += 40;
    });

    const totals: Array<[string, number, boolean]> = [
      ["Subtotal", q.subtotal, false],
      ["Contingency", q.contingency, false],
      ["Tax", q.tax, false],
      ["Total", q.total, true],
    ].filter(([, v]) => (v as number) > 0 || v === q.total) as Array<[string, number, boolean]>;

    qy += 8;
    totals.forEach(([k, v, bold]) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(bold ? 13 : 11);
      doc.setTextColor(...INK);
      doc.text(k, PAGE_W - M - 200, qy);
      doc.text(formatMoney(v, q.currency), right, qy, { align: "right" });
      qy += bold ? 0 : 22;
    });

    doc.setFont("courier", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      "ESTIMATE BASED ON SUPPLIED WALL DIMENSIONS · FINAL FIGURE CONFIRMED AFTER SITE INSPECTION",
      M,
      qy + 46,
    );
    drawFooter(doc, pageNo, title);
  }

  // ---------- Terms + sign-off ----------
  doc.addPage();
  pageNo += 1;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text("Terms & Approval", M, 78);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(2);
  doc.line(M, 88, M + 46, 88);
  doc.setLineWidth(1);

  const terms = [
    "50% deposit confirms the booking and covers materials; balance is due within 7 days of completion.",
    "Quoted price assumes uninterrupted site access during agreed working hours and a paintable, structurally sound surface.",
    "Weather delays on exterior work are rescheduled at no additional cost.",
    "The artist retains copyright and the right to photograph the finished mural for portfolio use.",
    "Design revisions: two rounds included prior to painting; further changes are billed hourly.",
    "This proposal is valid for 30 days from the date above.",
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  let ty = 118;
  terms.forEach((t) => {
    const tl = doc.splitTextToSize(t, contentW - 18);
    doc.setFillColor(...ACCENT);
    doc.circle(M + 3, ty - 3.5, 2, "F");
    doc.text(tl, M + 18, ty, { lineHeightFactor: 1.5 });
    ty += tl.length * 10.5 * 1.5 + 12;
  });

  const sy = Math.max(ty + 60, PAGE_H - 220);
  doc.setDrawColor(190, 194, 202);
  doc.line(M, sy, M + 210, sy);
  doc.line(PAGE_W - M - 210, sy, PAGE_W - M, sy);
  label(doc, "Client signature", M, sy + 16);
  label(doc, "Artist signature", PAGE_W - M - 210, sy + 16);
  label(doc, `Prepared for ${input.clientName || "client"} · ${today}`, M, sy + 52);
  drawFooter(doc, pageNo, title);

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
