ALTER TABLE "tasks" ADD COLUMN "search_vector" tsvector;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_search_vector_idx" ON "tasks" USING gin ("search_vector");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION refresh_task_search_document(task_uuid uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_label_text text;
BEGIN
  SELECT COALESCE(string_agg(tl.name, ' ' ORDER BY tla.position), '')
    INTO v_label_text
  FROM "task_label_assignments" tla
  INNER JOIN "task_labels" tl ON tl.id = tla.label_id
  WHERE tla.task_id = task_uuid;

  UPDATE "tasks" t
  SET "search_vector" =
    setweight(to_tsvector('simple', COALESCE(t.task_key, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(t.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(t.branch, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(v_label_text, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(t.note, '')), 'C')
  WHERE t.id = task_uuid;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION search_tasks_fts(
  p_owner_id uuid,
  p_query text,
  p_project_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  task_id uuid,
  score real
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_query text := btrim(COALESCE(p_query, ''));
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
BEGIN
  IF v_query = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH input AS (
    SELECT websearch_to_tsquery('simple', v_query) AS tsq
  )
  SELECT
    t.id AS task_id,
    (
      ts_rank_cd(t.search_vector, input.tsq, 32)
      + CASE WHEN t.task_key = v_query THEN 10.0 ELSE 0.0 END
      + CASE WHEN lower(t.title) = lower(v_query) THEN 2.0 ELSE 0.0 END
    )::real AS score
  FROM "tasks" t
  CROSS JOIN input
  WHERE t.owner_id = p_owner_id
    AND (p_project_id IS NULL OR t.project_id = p_project_id)
    AND t.status <> 'archived'
    AND (
      t.search_vector @@ input.tsq
      OR t.task_key = v_query
    )
  ORDER BY score DESC, t.updated_at DESC
  LIMIT v_limit;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION tasks_refresh_search_vector_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM refresh_task_search_document(NEW.id);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION task_label_assignments_refresh_search_vector_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM refresh_task_search_document(COALESCE(NEW.task_id, OLD.task_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION task_labels_refresh_search_vector_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_task_id uuid;
BEGIN
  FOR v_task_id IN
    SELECT DISTINCT tla.task_id
    FROM "task_label_assignments" tla
    WHERE tla.label_id = NEW.id
  LOOP
    PERFORM refresh_task_search_document(v_task_id);
  END LOOP;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "tasks_refresh_search_vector"
AFTER INSERT OR UPDATE OF "task_key", "title", "note", "branch" ON "tasks"
FOR EACH ROW
EXECUTE FUNCTION tasks_refresh_search_vector_trigger();
--> statement-breakpoint
CREATE TRIGGER "task_label_assignments_refresh_search_vector"
AFTER INSERT OR UPDATE OR DELETE ON "task_label_assignments"
FOR EACH ROW
EXECUTE FUNCTION task_label_assignments_refresh_search_vector_trigger();
--> statement-breakpoint
CREATE TRIGGER "task_labels_refresh_search_vector"
AFTER UPDATE OF "name" ON "task_labels"
FOR EACH ROW
EXECUTE FUNCTION task_labels_refresh_search_vector_trigger();
--> statement-breakpoint
UPDATE "tasks" SET "search_vector" = NULL;
--> statement-breakpoint
DO $$
DECLARE
  task_row RECORD;
BEGIN
  FOR task_row IN SELECT id FROM "tasks"
  LOOP
    PERFORM refresh_task_search_document(task_row.id);
  END LOOP;
END;
$$;
