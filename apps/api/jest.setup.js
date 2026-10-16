process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-32-chars-minimum!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-32-chars-minimum!';
process.env.JWT_RESET_SECRET = process.env.JWT_RESET_SECRET || 'test-jwt-reset-secret-32-chars-minimum!';
process.env.SECRETS_ENCRYPTION_KEY = process.env.SECRETS_ENCRYPTION_KEY || 'test-encryption-key-must-be-32-bytes-long!';

// Silencia rejeições de mocks de teste que ainda não foram capturadas
// no momento da asserção (ex.: Jest 30 sinaliza unhandledRejection antes do
// `await` interno conseguir capturar).
//
// IMPORTANTE: este arquivo é carregado apenas pelo Jest (via `setupFiles` em
// `apps/api/jest.config.js`). Em produção os listeners padrão do Node
// permanecem intactos.
process.on('unhandledRejection', () => {
  // Intencionalmente vazio — ver comentário acima.
});
