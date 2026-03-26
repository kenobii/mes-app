if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET não configurado em produção. Encerrando servidor.');
  process.exit(1);
}

module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_insecure',
};
