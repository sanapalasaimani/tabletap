-- ====================================================================
-- TableTap / DineSmart Migration: Read-Only Analytics RPC & Role
-- Created: 2026-10-30
-- Description:
--   1. Creates dedicated non-login role `chatbot_ro`.
--   2. Grants SELECT only on allowlisted operational tables.
--   3. Strictly excludes sensitive columns (e.g. `staff.password`).
--   4. Grants BYPASSRLS to `chatbot_ro` for accurate aggregate reporting.
--   5. Creates SECURITY INVOKER function `execute_readonly_sql(query_text)`
--      with single SELECT/WITH verification, 10s statement timeout,
--      and local role switching.
--   6. Grants EXECUTE exclusively to `service_role`.
-- ====================================================================

-- 1. Create role `chatbot_ro` if it does not already exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'chatbot_ro') THEN
        CREATE ROLE chatbot_ro NOLOGIN;
    END IF;
END $$;

-- 2. Schema USAGE
GRANT USAGE ON SCHEMA public TO chatbot_ro;

-- 3. Revoke all default table permissions from chatbot_ro
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM chatbot_ro;

-- 4. Table-level SELECT grants on non-sensitive operational tables
GRANT SELECT ON TABLE public.orders TO chatbot_ro;
GRANT SELECT ON TABLE public.menu_items TO chatbot_ro;
GRANT SELECT ON TABLE public.loyalty_profiles TO chatbot_ro;
GRANT SELECT ON TABLE public.waiter_requests TO chatbot_ro;
GRANT SELECT ON TABLE public.reviews TO chatbot_ro;
GRANT SELECT ON TABLE public.inventory TO chatbot_ro;
GRANT SELECT ON TABLE public.feedback TO chatbot_ro;
GRANT SELECT ON TABLE public.promotions TO chatbot_ro;
GRANT SELECT ON TABLE public.tables TO chatbot_ro;
GRANT SELECT ON TABLE public.activity_logs TO chatbot_ro;

-- 5. Column-level SELECT grants for `staff` (EXCLUDES `password`)
REVOKE ALL ON TABLE public.staff FROM chatbot_ro;
GRANT SELECT (
    id,
    name,
    mobile,
    role,
    shift,
    salary,
    attendance,
    performance,
    empid
) ON TABLE public.staff TO chatbot_ro;

-- 6. Role-Level Security (RLS) Configuration
-- We grant BYPASSRLS to chatbot_ro because this internal role is used solely by
-- the read-only analytics engine to calculate system-wide aggregates (SUM, AVG, COUNT).
-- Its access is strictly ring-fenced by column grants and statement parsing.
ALTER ROLE chatbot_ro BYPASSRLS;

-- 7. Grant chatbot_ro membership to service_role so it can run SET LOCAL ROLE
GRANT chatbot_ro TO service_role;

-- 8. Create the Secure Read-Only SQL Execution Function
CREATE OR REPLACE FUNCTION public.execute_readonly_sql(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    cleaned_query text;
    result jsonb;
BEGIN
    -- Step A: Validate query presence
    IF query_text IS NULL OR length(trim(query_text)) = 0 THEN
        RAISE EXCEPTION 'SQL Execution Error: Query cannot be empty.';
    END IF;

    cleaned_query := trim(query_text);

    -- Strip trailing semicolons safely
    WHILE right(cleaned_query, 1) = ';' LOOP
        cleaned_query := trim(left(cleaned_query, length(cleaned_query) - 1));
    END LOOP;

    -- Step B: Prohibit multiple statements / statement stacking
    IF position(';' in cleaned_query) > 0 THEN
        RAISE EXCEPTION 'Security Violation: Multi-statement queries containing semicolons are forbidden.';
    END IF;

    -- Step C: Verify query starts strictly with SELECT or WITH
    IF NOT (cleaned_query ~* '^\s*(SELECT|WITH)\s+') THEN
        RAISE EXCEPTION 'Security Violation: Only read-only SELECT or WITH statements are permitted.';
    END IF;

    -- Step D: Deny DDL / DML / Administrative commands
    IF cleaned_query ~* '\m(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|RESET|COPY|EXECUTE|VACUUM|REINDEX|CLUSTER|COMMENT|LOCK)\M' THEN
        RAISE EXCEPTION 'Security Violation: Prohibited statement keyword detected.';
    END IF;

    -- Step E: Apply isolated role and timeout for current transaction
    PERFORM set_config('role', 'chatbot_ro', true);
    PERFORM set_config('statement_timeout', '10000', true);

    -- Step F: Execute wrapped query returning JSONB array
    EXECUTE 'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (' || cleaned_query || ') t'
    INTO result;

    RETURN result;
END;
$$;

-- 9. Function Access Controls:
-- Revoke from all public / client accounts and grant strictly to service_role
REVOKE ALL ON FUNCTION public.execute_readonly_sql(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_readonly_sql(text) FROM anon;
REVOKE ALL ON FUNCTION public.execute_readonly_sql(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.execute_readonly_sql(text) TO service_role;

