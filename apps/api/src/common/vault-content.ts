import { z } from 'zod';
export const VaultAccessSchema = z.object({
  label: z.string().trim().min(1).max(120),
  method: z.enum(['WEB', 'SSH', 'WINBOX', 'RDP', 'TELNET', 'ANYDESK', 'BANCO', 'OUTROS']),
  host: z.string().trim().max(2000),
  port: z.number().int().min(1).max(65535).nullable().default(null),
  context: z.string().trim().max(120).default(''),
  username: z.string().max(500).default(''),
  secret: z.string().max(10000).default(''),
  notes: z.string().max(20000).default(''),
});
export const VaultAccessEntriesSchema = z.array(VaultAccessSchema).max(50);
export type VaultAccess = z.infer<typeof VaultAccessSchema>;
const prefix = 'vault-content:v2:';
export function unpackVaultContent(value: string | null | undefined): {
  text: string;
  accessEntries: VaultAccess[];
} {
  if (!value?.startsWith(prefix)) return { text: value || '', accessEntries: [] };
  const object = JSON.parse(value.slice(prefix.length));
  return {
    text: z.string().max(100000).parse(object.text),
    accessEntries: VaultAccessEntriesSchema.parse(object.accessEntries),
  };
}
export function packVaultContent(text: string, accessEntries: VaultAccess[]) {
  return (
    prefix +
    JSON.stringify({
      text: z.string().max(100000).parse(text),
      accessEntries: VaultAccessEntriesSchema.parse(accessEntries),
    })
  );
}
