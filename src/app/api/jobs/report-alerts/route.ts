import { timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import { z } from "zod";
import { apiError, HttpError } from "@/lib/api";
import { requiredEnv, serviceClient } from "@/lib/supabase/server";
import { checked } from "@/lib/query";
import { alertLabels, notificationText } from "@/lib/report-notifications";
import type { ReportAlert } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const expected = Buffer.from('Bearer ' + requiredEnv('CRON_SECRET'));
    const supplied = Buffer.from(request.headers.get("authorization") ?? "");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new HttpError(401, "Scheduler nicht autorisiert.");
    const db = serviceClient();
    const created = checked(await db.rpc("refresh_report_alerts", {}));
    // Missing SMTP configuration is an explicit failure, while in-app hints remain persisted.
    const host = requiredEnv("SMTP_HOST");
    const port = z.coerce.number().int().min(1).max(65535).parse(requiredEnv("SMTP_PORT"));
    const secure = z.enum(["true", "false"]).parse(requiredEnv("SMTP_SECURE")) === "true";
    const transport = nodemailer.createTransport({
      host, port, secure, requireTLS: !secure,
      auth: { user: requiredEnv("SMTP_USER"), pass: requiredEnv("SMTP_PASSWORD") },
      connectionTimeout: 10000, socketTimeout: 20000,
    });
    const from = requiredEnv("SMTP_FROM");
    const base = new URL(requiredEnv("APP_URL"));
    const jobs = checked(await db.rpc("claim_report_emails", {}));
    let sent = 0, failed = 0;
    for (const job of jobs) {
      try {
        const alert = checked<ReportAlert>(await db.from("report_alerts").select("*").eq("id", job.alert_id).single());
        const condition = checked(await db.rpc("report_condition", { p_company: alert.company_id, p_user: alert.user_id, p_day: alert.work_day }));
        const membership = checked(await db.from("company_members").select("*")
          .eq("company_id", job.company_id).eq("user_id", job.recipient_id));
        if (alert.status !== "open" || alert.kind !== job.kind || condition[0]?.kind !== job.kind ||
          !membership.length || (job.purpose === "responsible" && (
            alert.responsible_id !== job.recipient_id || !["hr", "admin"].includes(membership[0].role)
          ))) {
          checked(await db.from("email_outbox").update({ status: "canceled", lease_until: null })
            .eq("id", job.id).eq("lease_token", job.lease_token!).select().single());
          continue;
        }
        if (new Date(condition[0].due_at).getTime() > Date.now()) {
          checked(await db.from("email_outbox").update({
            status: "pending", next_attempt_at: condition[0].due_at, attempts: job.attempts - 1, lease_until: null,
          }).eq("id", job.id).eq("lease_token", job.lease_token!).select().single());
          continue;
        }
        const { data, error } = await db.auth.admin.getUserById(job.recipient_id);
        if (error) throw error;
        if (!data.user.email) throw new Error("Recipient has no email address.");
        const response = await transport.sendMail({
          from, to: data.user.email,
          subject: job.purpose === "reminder" ? "TimeReport: Bitte Zeiterfassung prüfen" : `TimeReport: ${alertLabels[alert.kind]}`,
          text: notificationText(alert.kind, alert.work_day, job.purpose === "reminder", new URL("/#notifications", base).href),
          messageId: `<${job.id}@${base.hostname}>`,
        });
        if (response.rejected.length || !response.accepted.length) throw new Error("SMTP server rejected the recipient.");
        checked(await db.from("email_outbox").update({ status: "sent", sent_at: new Date().toISOString(), last_error: null, lease_until: null })
          .eq("id", job.id).eq("lease_token", job.lease_token!).select().single());
        sent++;
      } catch (error) {
        console.error("Report notification delivery failed", { job: job.id, error: error instanceof Error ? error.message : "Unknown error" });
        checked(await db.from("email_outbox").update({
          status: "failed", last_error: "E-Mail-Zustellung fehlgeschlagen. SMTP-Konfiguration und Serverprotokoll prüfen.",
          next_attempt_at: new Date(Date.now() + Math.min(60, 2 ** job.attempts) * 60000).toISOString(), lease_until: null,
        }).eq("id", job.id).eq("lease_token", job.lease_token!).select().single());
        failed++;
      }
    }
    if (failed) return Response.json({ created, sent, failed, error: "Nicht alle E-Mails wurden zugestellt. Gespeicherte Fehlversuche prüfen." }, { status: 502 });
    return Response.json({ created, sent, failed });
  } catch (error) { return apiError(error); }
}
