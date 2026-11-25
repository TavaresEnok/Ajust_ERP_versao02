-- WhatsApp: o `target` guarda a URL do gateway; o número ou grupo que recebe a mensagem
-- não tinha onde ficar e os avisos saíam com a URL no lugar do telefone.
ALTER TABLE "NotificationConfig" ADD COLUMN "recipient" TEXT;
