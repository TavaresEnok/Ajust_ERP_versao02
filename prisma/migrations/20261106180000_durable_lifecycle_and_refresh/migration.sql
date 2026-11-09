ALTER TABLE "SatisfactionResponse" ADD COLUMN "emailSentAt" TIMESTAMP(3);
-- Cached refresh rotations make retries idempotent across replicas (15-second grace).
ALTER TABLE "Session"
  ADD COLUMN "previousRefreshTokenHash" TEXT,
  ADD COLUMN "refreshResponseEnc" TEXT,
  ADD COLUMN "refreshResponseExpiresAt" TIMESTAMP(3);

CREATE TABLE "ServiceOrderLifecycleEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "completedEffects" JSONB NOT NULL DEFAULT '[]',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3),
  "claimToken" TEXT,
  "processedAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ServiceOrderLifecycleEvent_processedAt_availableAt_idx"
  ON "ServiceOrderLifecycleEvent"("processedAt", "availableAt");
CREATE INDEX "ServiceOrderLifecycleEvent_orderId_createdAt_idx"
  ON "ServiceOrderLifecycleEvent"("orderId", "createdAt");

-- Capture a limited snapshot, excluding internal notes, descriptions and credentials.
CREATE FUNCTION order_lifecycle_snapshot(o "ServiceOrder") RETURNS JSONB
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('id', o."id", 'tenantId', o."tenantId", 'protocol', o."protocol",
    'type', o."type", 'priority', o."priority", 'status', o."status", 'title', o."title",
    'requester', o."requester", 'sector', o."sector", 'analystName', o."analystName",
    'deadlineAt', o."deadlineAt", 'occurrenceId', o."occurrenceId",
    'processInstanceId', o."processInstanceId", 'approvalCompleted', o."approvalCompleted",
    'changeRequestId', o."changeRequestId", 'version', o."version");
$$;
CREATE FUNCTION enqueue_order_created() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "ServiceOrderLifecycleEvent" ("id", "tenantId", "orderId", "kind", "payload")
  VALUES ('created:' || NEW."id", NEW."tenantId", NEW."id", 'created',
    jsonb_build_object('order', order_lifecycle_snapshot(NEW)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER order_created_outbox AFTER INSERT ON "ServiceOrder"
FOR EACH ROW EXECUTE FUNCTION enqueue_order_created();

CREATE FUNCTION enqueue_order_status() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE o "ServiceOrder";
BEGIN
  IF NEW."fromStatus" = NEW."toStatus" THEN RETURN NEW; END IF;
  SELECT * INTO STRICT o FROM "ServiceOrder" WHERE "id" = NEW."serviceOrderId";
  IF o."tenantId" <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Status event tenant does not match order tenant';
  END IF;
  INSERT INTO "ServiceOrderLifecycleEvent" ("id", "tenantId", "orderId", "kind", "payload")
  VALUES ('status:' || NEW."id", NEW."tenantId", NEW."serviceOrderId", 'status',
    jsonb_build_object('order', order_lifecycle_snapshot(o), 'change',
      jsonb_build_object('tenantId', NEW."tenantId", 'orderId', NEW."serviceOrderId",
        'from', NEW."fromStatus", 'to', NEW."toStatus", 'actorId', NEW."actorUserId",
        'reason', NEW."reason", 'source', CASE
          WHEN NEW."metadata"->>'engine' = 'operational-v2' THEN 'process'
          WHEN NEW."metadata"->>'source' LIKE '%ixc%' OR NEW."metadata"->>'source' = 'integration'
            THEN 'integration' ELSE 'transition' END,
        'workflows', NOT (NEW."toStatus" = 'FECHADA' AND NEW."metadata"->>'engine' IS NOT DISTINCT FROM 'operational-v2'))));
  RETURN NEW;
END;
$$;
CREATE TRIGGER order_status_outbox AFTER INSERT ON "ServiceOrderStatusEvent"
FOR EACH ROW EXECUTE FUNCTION enqueue_order_status();
