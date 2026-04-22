CREATE OR REPLACE FUNCTION dashboard_owner_timezone(p_owner_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_candidate text;
  v_fallback text;
BEGIN
  SELECT COALESCE(
    NULLIF(TRIM((
      SELECT "value"
      FROM "user_settings"
      WHERE "owner_id" = p_owner_id
        AND "key" = 'timezone'
      LIMIT 1
    )), ''),
    NULLIF(current_setting('app.default_timezone', true), ''),
    'UTC'
  )
  INTO v_candidate;

  v_fallback := COALESCE(NULLIF(current_setting('app.default_timezone', true), ''), 'UTC');

  PERFORM now() AT TIME ZONE v_candidate;
  RETURN v_candidate;
EXCEPTION
  WHEN invalid_parameter_value THEN
    RETURN v_fallback;
END;
$$;
