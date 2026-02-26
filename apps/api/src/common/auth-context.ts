export type AuthContext = {
  userId: string;
  sessionId: string;
  tenantId: string | null;
  role: string | null;
};
