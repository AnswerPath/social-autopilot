-- Security Advisor: Security Definer View — use invoker semantics (PostgreSQL 15+)
-- so RLS and permissions follow the querying role; service_role usage unchanged.

ALTER VIEW public.posts_pending_approval SET (security_invoker = true);
ALTER VIEW public.approval_statistics SET (security_invoker = true);
ALTER VIEW public.approval_dashboard_summary SET (security_invoker = true);
