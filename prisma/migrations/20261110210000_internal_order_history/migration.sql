-- Histórico da O.S. e anotações da ocorrência são internos por padrão: o portal do cliente
-- mostra só a conclusão do atendimento ("Atendimento concluído: ...").
ALTER TABLE "ServiceOrderOccurrence" ALTER COLUMN "isCustomerVisible" SET DEFAULT false;
ALTER TABLE "OccurrenceAnnotation" ALTER COLUMN "isCustomerVisible" SET DEFAULT false;

-- Registros antigos gravados com o padrão anterior (true): anotações de trabalho, motivos de
-- transição, prazos, anexos e notas de integração deixam de aparecer para o cliente.
UPDATE "ServiceOrderOccurrence"
SET "isCustomerVisible" = false
WHERE "isCustomerVisible" = true
  AND "message" NOT LIKE 'Atendimento concluído:%';

UPDATE "OccurrenceAnnotation"
SET "isCustomerVisible" = false
WHERE "isCustomerVisible" = true;
