-- Do not silently abandon active legacy workflows on a different installation.
-- The audited installation has no v1 instances, OS templates or workflow rules.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ServiceProcessInstance" WHERE "engineVersion" = 1 AND status NOT IN ('COMPLETED', 'CANCELED', 'SUPERSEDED'))
    OR EXISTS (SELECT 1 FROM "OsProcessTemplate" WHERE enabled)
    OR EXISTS (SELECT 1 FROM "ServiceProcessTemplate" WHERE COALESCE(definition->>'engineVersion', '1') <> '2')
    OR EXISTS (SELECT 1 FROM "WorkflowRule" w, jsonb_array_elements(w.definition->'nodes') n
      WHERE w.enabled AND n->>'type' = 'action'
        AND n->>'subtype' NOT IN ('action_notify_slack', 'action_webhook', 'action_csat'))
  THEN
    RAISE EXCEPTION 'Migração operacional bloqueada: revisar e migrar processos/modelos legados antes de retirar seus motores.';
  END IF;
END $$;
