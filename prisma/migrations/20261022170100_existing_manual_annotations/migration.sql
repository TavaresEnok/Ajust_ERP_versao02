-- The previous manual-annotation endpoint mirrored messages with this exact prefix.
-- Only reconcile notes with the same author and near-identical creation timestamp.
WITH matches AS (
 SELECT DISTINCT ON (n.id) n.id, a.id AS mirror_id
 FROM "ServiceOrderOccurrence" n
 JOIN "ServiceOrder" o ON o.id=n."serviceOrderId"
 JOIN "OccurrenceAnnotation" a ON a."occurrenceId"=o."occurrenceId"
  AND a."tenantId"=o."tenantId" AND a."actorUserId"=n."actorUserId"
  AND a.message=('[O.S ' || o.protocol || '] ' || n.message)
  AND abs(extract(epoch FROM (a."createdAt"-n."createdAt")))<2
 WHERE n."sourceSystem"='ERP' AND n."actorUserId" IS NOT NULL AND n."externalId" IS NULL
 ORDER BY n.id,a."createdAt",a.id
)
UPDATE "ServiceOrderOccurrence" n SET editable=true,"mirroredAnnotationId"=m.mirror_id
FROM matches m WHERE n.id=m.id;
