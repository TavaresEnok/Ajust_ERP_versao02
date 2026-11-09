-- Prazo (SLA) próprio de cada serviço do catálogo, em horas úteis (24 h = 1 dia útil).
ALTER TABLE "ServiceCatalogItem" ADD COLUMN "slaHours" INTEGER;
