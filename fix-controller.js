const fs = require('fs');
const file = '/home/app/projects/Ajust_ERP/apps/api/src/service-orders/service-orders.controller.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("this.serviceOrdersService.list(tenantId, input, req.auth?.role || '');", "this.serviceOrdersService.list(tenantId, input);");
content = content.replace("this.serviceOrdersService.summary(tenantId, input, req.auth?.role || '');", "this.serviceOrdersService.summary(tenantId, input);");
content = content.replace("this.serviceOrdersService.listOccurrences(tenantId, input, req.auth?.role || '');", "this.serviceOrdersService.listOccurrences(tenantId, input);");
content = content.replace("this.serviceOrdersService.getOccurrenceById(tenantId, occurrenceId, req.auth?.role || '');", "this.serviceOrdersService.getOccurrenceById(tenantId, occurrenceId);");
content = content.replace("this.serviceOrdersService.getById(tenantId, id, req.auth?.role || '');", "this.serviceOrdersService.getById(tenantId, id);");
content = content.replace("addAnnotation(tenantId, id, req.auth!.userId, req.auth!.role || '', input.message, !!input.hideFromClient)", "addOccurrenceAnnotation(tenantId, id, req.auth!.userId, input.message)");

// Wait, addAnnotation was maybe addOrderAnnotation? Let's check service
