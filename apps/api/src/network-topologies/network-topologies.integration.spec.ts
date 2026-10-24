import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { NetworkTopologiesController } from './network-topologies.controller';
import { decryptSecret } from '../common/secrets.crypto';
import type { RequestWithAuth } from '../common/request-with-auth';

const dbDescribe = process.env.PROCESS_DB_TESTS === '1' ? describe : describe.skip;
dbDescribe('Topologias: persistência, isolamento e versões com rollback', () => {
  const prisma = new PrismaClient();
  afterAll(() => prisma.$disconnect());
  it('preserva documentos, cifra versões, bloqueia conflito e não entrega diagrama na lista', async () => {
    const rollback = new Error('ROLLBACK_NETWORK_TOPOLOGIES');
    try {
      await prisma.$transaction(
        async (tx) => {
          const member = await tx.userTenant.findFirstOrThrow({
            where: { role: { code: 'analista' }, user: { status: 'ACTIVE' } },
          });
          const token = randomUUID();
          const customer = await tx.customer.create({
            data: {
              tenantId: member.tenantId,
              taxId: token,
              legalName: 'Teste transacional',
              tradeName: 'Teste de topologia',
              personType: 'PJ',
            },
          });
          const client = { ...tx, $transaction: async (cb: (t: typeof tx) => unknown) => cb(tx) };
          const controller = new NetworkTopologiesController(client as never);
          const req = {
            auth: {
              userId: member.userId,
              tenantId: member.tenantId,
              role: 'analista',
              sessionId: token,
            },
          } as RequestWithAuth;
          const diagramXml =
            '<mxfile><diagram id="rede"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';
          const first = await controller.save(req, customer.id, {
            title: 'Rede',
            diagramXml,
            expectedVersion: 0,
            sourceFileName: 'bookstack.drawio',
          });
          expect(first.version).toBe(1);
          const stored = await tx.networkTopology.findUniqueOrThrow({
            where: { customerId: customer.id },
          });
          expect(stored.xmlEnc).toMatch(/^enc:v1:/);
          expect(decryptSecret(stored.xmlEnc)).toBe(diagramXml);
          const list = await controller.list(req);
          const listed = list.find((c) => c.id === customer.id)!;
          expect(listed.networkTopology).not.toHaveProperty('xmlEnc');
          expect(listed.networkTopology).not.toHaveProperty('diagramXml');
          await expect(
            controller.save(req, customer.id, { title: 'Antiga', diagramXml, expectedVersion: 0 }),
          ).rejects.toMatchObject({ status: 409 });
          await controller.save(req, customer.id, {
            title: 'Rede revisada',
            diagramXml,
            expectedVersion: 1,
          });
          const history = await controller.history(req, customer.id);
          expect(history.map((r) => r.version)).toEqual([2, 1]);
          expect(history[0]).not.toHaveProperty('xmlEnc');
          expect((await controller.revision(req, customer.id, '1')).diagramXml).toBe(diagramXml);
          expect((await controller.get(req, customer.id)).topology?.version).toBe(2);
          const otherTenant = { auth: { ...req.auth!, tenantId: randomUUID() } } as RequestWithAuth;
          await expect(controller.get(otherTenant, customer.id)).rejects.toMatchObject({
            status: 404,
          });
          const external = { auth: { ...req.auth!, role: 'cliente' } } as RequestWithAuth;
          expect(() => controller.list(external)).toThrow();
          throw rollback;
        },
        { timeout: 15000 },
      );
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
