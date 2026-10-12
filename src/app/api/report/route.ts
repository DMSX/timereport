import { DateTime } from "luxon";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import { apiError, HttpError, requireMember } from "@/lib/api";
import { allRows, checked } from "@/lib/query";
import { breakViolations, csvCell, displayTime, localTime, minutesLabel, monthRange, monthlyReport } from "@/lib/time";
import { dayReportCells, reportNote } from "@/lib/report-display";

export async function GET(request: Request) {
  try {
    const { company, user, month, format } = z.object({
      company: z.uuid(), user: z.uuid(), month: z.string(), format: z.enum(["csv", "pdf"]),
    }).parse(Object.fromEntries(new URL(request.url).searchParams));
    const { start, end } = monthRange(month);
    const auth = await requireMember(company, ["employee", "hr", "admin"]);
    if (auth.member.role === "employee" && user !== auth.user.id) throw new HttpError(403, "Nur der eigene Rapport ist zugänglich.");
    const now = DateTime.now();
    const [companyData, member, entries, models, absences, projects, resolutions] = await Promise.all([
      auth.db.from("companies").select("*").eq("id", company).single().then(checked),
      auth.db.from("company_members").select("*").eq("company_id", company).eq("user_id", user).single().then(checked),
      allRows((from, to) => auth.db.from("time_entries").select("*").eq("company_id", company).eq("user_id", user).order("started_at").order("id").range(from, to)),
      allRows((from, to) => auth.db.from("work_models").select("*").eq("company_id", company).eq("user_id", user).order("valid_from").order("id").range(from, to)),
      allRows((from, to) => auth.db.from("absences").select("*").eq("company_id", company).eq("user_id", user).order("starts_on").order("id").range(from, to)),
      allRows((from, to) => auth.db.from("projects").select("*").eq("company_id", company).order("id").range(from, to)),
      allRows((from, to) => auth.db.from("break_resolutions").select("*").eq("company_id", company).order("entry_id").range(from, to)),
    ]);
    if (typeof companyData.absence_tracking !== "boolean" || models.some((model) => !["hourly","scheduled"].includes(model.mode))) {
      throw new HttpError(503, "Datenbankmigration für flexible Zeiterfassungsmodelle fehlt.");
    }
    const report = monthlyReport(month, entries, models, absences, now);
    const blocks = entries.filter((e) => localTime(e.started_at) < end && localTime(e.ended_at ?? now.toISO()!) > start);
    const violations = breakViolations(entries, now);
    const pauseStatus = (id: string) => {
      if (!violations.has(id)) return "";
      const resolution = resolutions.find((r) => r.entry_id === id);
      return resolution ? `Geklärt: ${resolution.reason}` : "Pausenverstoss offen";
    };
    const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? `Projekt ${id}`;
    const blockMinutes = (e: typeof blocks[number]) => Math.max(0, (Math.min(localTime(e.ended_at ?? now.toISO()!).toMillis(), end.toMillis()) - Math.max(localTime(e.started_at).toMillis(), start.toMillis())) / 60000);
    const filename = `timereport-${month}.${format}`;
    const headers = {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    };
    if (format === "csv") {
      const rows: (string | number)[][] = [
        ["TimeReport", companyData.name, member.display_name, month, "Europe/Zurich"],
        ["Hinweis", reportNote(report)],
        ["Typ", "Datum", "Projekt", "Start", "Ende", "Arbeit (h:mm)", "Soll", "Feriengutschrift (h:mm)", "Krankheitsgutschrift (h:mm)", "Saldo", "Ferien (Kalendertage)", "Krankheit (Kalendertage)", "Modell", "Pausenprüfung", "Notiz"],
        ...report.map((d) => ["Tag", d.date, "", "", "", ...dayReportCells(d), "", ""]),
        ...blocks.map((e) => ["Arbeitsblock", localTime(e.started_at).toISODate()!, projectName(e.project_id), displayTime(e.started_at), e.ended_at ? displayTime(e.ended_at) : "Läuft", minutesLabel(blockMinutes(e)), "", "", "", "", "", "", "", pauseStatus(e.id), e.note]),
      ];
      return new Response("\uFEFF" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n"), {
        headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
      });
    }
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([595.28, 841.89]);
    let y = 800;
    function line(value: string, size = 10, strong = false) {
      if (y < 45) { page = pdf.addPage([595.28, 841.89]); y = 800; }
      const chosen = strong ? bold : font;
      const normalized = value.replace(/[\r\n\t]/g, " ");
      let remaining = normalized;
      while (chosen.widthOfTextAtSize(remaining, size) > 510) {
        let cut = remaining.length - 1;
        while (cut > 1 && chosen.widthOfTextAtSize(remaining.slice(0, cut), size) > 510) cut--;
        page.drawText(remaining.slice(0, cut), { x: 42, y, size, font: chosen, color: rgb(.09, .18, .16) });
        remaining = remaining.slice(cut); y -= size + 6;
        if (y < 45) { page = pdf.addPage([595.28, 841.89]); y = 800; }
      }
      page.drawText(remaining, { x: 42, y, size, font: chosen, color: rgb(.09, .18, .16) });
      y -= size + 8;
    }
    line("TimeReport | Monatsrapport", 22, true);
    line(`${companyData.name} | ${member.display_name}`, 12);
    line(`${month} | Europe/Zurich | Erstellt ${displayTime(now.toISO()!)}`);
    line(reportNote(report), 9);
    if (report.some((d) => d.mode === null)) line("ACHTUNG: Für einzelne Tage fehlt das Modell; kein Soll oder Saldo berechnet.", 10, true);
    y -= 10;
    const hasTarget = report.some((d) => d.hasTarget);
    line(hasTarget ? "Datum | Arbeit | Soll | Ferien/Krankheit (h) | Saldo" : "Datum | Arbeitszeit | Modell", 10, true);
    for (const d of report) {
      const cells = dayReportCells(d);
      line(`${DateTime.fromISO(d.date).toFormat("dd.MM.yyyy")} | ${cells[0]} | ${d.hasTarget ? `${cells[1]} | ${cells[2]}/${cells[3]} | ${cells[4]}` : cells[7]}`);
      if (d.vacationDays || d.sickDays) line(`Abwesenheit: Ferien ${d.vacationDays} / Krankheit ${d.sickDays} Kalendertage`, 9);
    }
    const totals = report.reduce((sum, d) => ({ work: sum.work + d.worked, target: sum.target + d.target, credited: sum.credited + d.vacation + d.sick, balance: sum.balance + d.balance }), { work: 0, target: 0, credited: 0, balance: 0 });
    y -= 10;
    line(`Total: Arbeit ${minutesLabel(totals.work)}` + (hasTarget ? ` | Soll ${minutesLabel(totals.target)} | Gutschrift ${minutesLabel(totals.credited)} | Saldo (Soll-Tage) ${minutesLabel(totals.balance)}` : " | Kein Soll-/Saldovergleich"), 10, true);
    y -= 15;
    line("Projektbuchungen", 14, true);
    for (const e of blocks) {
      line(`${projectName(e.project_id)} | ${minutesLabel(blockMinutes(e))} h im Monat`, 10, true);
      line(`${displayTime(e.started_at)} bis ${e.ended_at ? displayTime(e.ended_at) : "läuft (vorläufig)"}`, 9);
      if (pauseStatus(e.id)) line(pauseStatus(e.id), 9);
      if (e.note) line(e.note, 9);
    }
    const bytes = await pdf.save();
    return new Response(Buffer.from(bytes), { headers: { ...headers, "Content-Type": "application/pdf" } });
  } catch (e) { return apiError(e); }
}
