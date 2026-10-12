export type Role = "employee" | "hr" | "admin";
export type Company = {
  id: string; name: string; correction_weeks: number; absence_approval: boolean;
  max_work_minutes: number; min_break_minutes: number;
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
  weekday_minutes: number[]; planned_start: string | null; planned_end: string | null;
};
export type Absence = {
  id: string; company_id: string; user_id: string; kind: "vacation" | "sick";
  starts_on: string; ends_on: string; fraction: number; status: "pending" | "approved" | "rejected";
};
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
    };
    Views: Record<string, never>;
    Functions: {
      check_in: { Args: { p_company: string; p_project: string }; Returns: string };
      check_out: { Args: { p_company: string }; Returns: undefined };
      record_entry: { Args: { p_company: string; p_user: string; p_project: string; p_start: string; p_end: string; p_note: string; p_reason: string }; Returns: string };
      correct_entry: { Args: { p_entry: string; p_project: string; p_start: string; p_end: string; p_note: string; p_reason: string }; Returns: undefined };
      request_absence: { Args: { p_company: string; p_kind: string; p_start: string; p_end: string; p_fraction: number }; Returns: string };
      review_absence: { Args: { p_absence: string; p_status: string; p_reason: string }; Returns: undefined };
      resolve_break: { Args: { p_entry: string; p_reason: string }; Returns: undefined };
      provision_company: { Args: { p_name: string; p_user: string; p_admin_name: string }; Returns: string };
      claim_checkout: { Args: { p_company: string }; Returns: { token: string; expires_at: number }[] };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
