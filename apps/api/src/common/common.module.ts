import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { EmailService } from './email.service';

/**
 * CommonModule — exporta utilitários compartilhados entre todos os módulos da API.
 * Importe CommonModule em qualquer módulo que precisar de AuditService.
 */
@Module({
  providers: [AuditService, EmailService],
  exports: [AuditService, EmailService],
})
export class CommonModule {}
