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
