import { DateTime } from "luxon";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import { apiError, HttpError, requireMember } from "@/lib/api";
import { allRows, checked } from "@/lib/query";
import { breakViolations, csvCell, displayTime, localTime, minutesLabel, monthRange, monthlyReport } from "@/lib/time";

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
        ["Hinweis", "Saldo inkl. Soll des ganzen Monats. Laufende Buchungen vorläufig. Keine automatischen Feiertage."],
        ["Typ", "Datum", "Projekt", "Start", "Ende", "Arbeit (h:mm)", "Soll", "Ferien", "Krankheit", "Saldo", "Pausenprüfung", "Notiz"],
        ...report.map((d) => ["Tag", d.date, "", "", "", minutesLabel(d.worked), minutesLabel(d.target), minutesLabel(d.vacation), minutesLabel(d.sick), minutesLabel(d.balance), "", ""]),
        ...blocks.map((e) => ["Arbeitsblock", localTime(e.started_at).toISODate()!, projectName(e.project_id), displayTime(e.started_at), e.ended_at ? displayTime(e.ended_at) : "Läuft", minutesLabel(blockMinutes(e)), "", "", "", "", pauseStatus(e.id), e.note]),
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
    line("Saldo inkl. Soll des ganzen Monats; laufende Buchungen sind vorläufig.", 9);
    line("Feiertage werden nicht automatisch berücksichtigt.", 9);
    if (!models.length) line("ACHTUNG: Kein Arbeitsmodell vorhanden; Sollzeit ist 0.", 10, true);
    y -= 10;
    line("Datum           Arbeit       Soll       Ferien       Krankheit       Saldo", 10, true);
    for (const d of report) line(`${DateTime.fromISO(d.date).toFormat("dd.MM.yyyy")}     ${minutesLabel(d.worked)}     ${minutesLabel(d.target)}     ${minutesLabel(d.vacation)}     ${minutesLabel(d.sick)}     ${minutesLabel(d.balance)}`);
    const totals = report.reduce((sum, d) => ({ work: sum.work + d.worked, target: sum.target + d.target, credited: sum.credited + d.vacation + d.sick, balance: sum.balance + d.balance }), { work: 0, target: 0, credited: 0, balance: 0 });
    y -= 10;
    line(`Total: Arbeit ${minutesLabel(totals.work)} | Soll ${minutesLabel(totals.target)} | Abwesenheiten ${minutesLabel(totals.credited)} | Saldo ${minutesLabel(totals.balance)}`, 10, true);
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
