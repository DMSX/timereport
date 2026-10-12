export type Role = "employee" | "hr" | "admin";
export type Company = {
  id: string; name: string; correction_weeks: number; absence_approval: boolean;
  max_work_minutes: number; min_break_minutes: number;
  absence_tracking: boolean; report_alerts_enabled: boolean;
};
export type Member = {
  company_id: string; user_id: string; display_name: string; role: Role; vacation_days: number;
};
export type Project = {
  id: string; company_id: string; name: string; active: boolean;
  max_work_minutes: number | null; min_break_minutes: number | null;
};
export type Entry = {
  id: string; company_id: string; user_id: string; project_id: string;
  started_at: string; ended_at: string | null; note: string;
  max_work_minutes: number; min_break_minutes: number;
};
export type WorkModel = {
  id: string; company_id: string; user_id: string; valid_from: string;
  mode: "scheduled" | "hourly";
  weekday_minutes: number[]; planned_start: string | null; planned_end: string | null;
};
export type Absence = {
  id: string; company_id: string; user_id: string; kind: "vacation" | "sick";
  starts_on: string; ends_on: string; fraction: number; status: "pending" | "approved" | "rejected";
  day_part?: "morning" | "afternoon" | null;
};
export type ReportSetting = { company_id: string; user_id: string; responsible_id: string | null; delay_minutes: number | null; enabled: boolean };
export type ReportAlert = {
  id: string; company_id: string; user_id: string; responsible_id: string; work_day: string; due_at: string;
  kind: "missing" | "pending_absence" | "unclear_half_day"; status: "open" | "resolved" | "clarified";
  resolution: string | null; resolved_by: string | null; reminded_at: string | null; created_at: string; updated_at: string;
};
export type EmailJob = {
  id: string; alert_id: string; company_id: string; recipient_id: string; purpose: "responsible" | "reminder";
  kind: string; status: "pending" | "sending" | "sent" | "failed" | "canceled"; attempts: number;
  next_attempt_at: string; lease_token: string | null; lease_until: string | null; last_error: string | null; sent_at: string | null;
};
export type OnboardingProgress = { user_id: string; scope: string; step: number; completed: boolean; updated_at: string };
export type Subscription = {
  company_id: string; complimentary: boolean; status: string;
  stripe_customer_id: string | null; stripe_subscription_id: string | null;
  checkout_lease: string | null; checkout_lease_until: string | null;
};
export type Resolution = {
  entry_id: string; company_id: string; resolved_by: string; reason: string; resolved_at: string;
};
type Table<T, Required extends keyof T> = { Row: T; Insert: Pick<T, Required> & Partial<Omit<T, Required>>; Update: Partial<T>; Relationships: [] };
export type Database = {
  public: {
    Tables: {
      companies: Table<Company, "name">;
      company_members: Table<Member, "company_id" | "user_id" | "display_name">;
      operators: Table<{ user_id: string }, "user_id">;
      subscriptions: Table<Subscription, "company_id">;
      projects: Table<Project, "company_id" | "name">;
      project_members: Table<{ company_id: string; project_id: string; user_id: string }, "company_id" | "project_id" | "user_id">;
      work_models: Table<WorkModel, "company_id" | "user_id" | "valid_from" | "weekday_minutes">;
      time_entries: Table<Entry, "company_id" | "user_id" | "project_id" | "started_at" | "max_work_minutes" | "min_break_minutes">;
      absences: Table<Absence, "company_id" | "user_id" | "kind" | "starts_on" | "ends_on" | "status">;
      break_resolutions: Table<Resolution, "entry_id" | "company_id" | "resolved_by" | "reason">;
      audit_log: Table<{ id: string; company_id: string; actor_id: string; entity_id: string; action: string; reason: string; created_at: string }, "company_id" | "actor_id" | "entity_id" | "action" | "reason">;
      onboarding_progress: Table<OnboardingProgress, "user_id" | "scope">;
      report_settings: Table<ReportSetting, "company_id" | "user_id">;
      company_holidays: Table<{ company_id: string; day: string; label: string }, "company_id" | "day" | "label">;
      report_alerts: Table<ReportAlert, "company_id" | "user_id" | "responsible_id" | "work_day" | "due_at" | "kind">;
      email_outbox: Table<EmailJob, "alert_id" | "company_id" | "recipient_id" | "purpose" | "kind">;
      scheduler_status: Table<{ id: number; last_checked_at: string | null }, "id">;
    };
    Views: Record<string, never>;
    Functions: {
      check_in: { Args: { p_company: string; p_project: string }; Returns: string };
      check_out: { Args: { p_company: string }; Returns: undefined };
      record_entry: { Args: { p_company: string; p_user: string; p_project: string; p_start: string; p_end: string; p_note: string; p_reason: string }; Returns: string };
      correct_entry: { Args: { p_entry: string; p_project: string; p_start: string; p_end: string; p_note: string; p_reason: string }; Returns: undefined };
      request_absence: { Args: { p_company: string; p_kind: string; p_start: string; p_end: string; p_fraction: number; p_part?: string | null }; Returns: string };
      review_absence: { Args: { p_absence: string; p_status: string; p_reason: string }; Returns: undefined };
      resolve_break: { Args: { p_entry: string; p_reason: string }; Returns: undefined };
      provision_company: { Args: { p_name: string; p_user: string; p_admin_name: string }; Returns: string };
      claim_checkout: { Args: { p_company: string }; Returns: { token: string; expires_at: number }[] };
      refresh_report_alerts: { Args: Record<string, never>; Returns: number };
      report_condition: { Args: { p_company: string; p_user: string; p_day: string }; Returns: { kind: string; due_at: string }[] };
      claim_report_emails: { Args: Record<string, never>; Returns: EmailJob[] };
      handle_report_alert: { Args: { p_alert: string; p_action: string; p_reason?: string }; Returns: undefined };
      retry_report_email: { Args: { p_job: string }; Returns: undefined };
      set_absence_part: { Args: { p_absence: string; p_part: string; p_reason: string }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
