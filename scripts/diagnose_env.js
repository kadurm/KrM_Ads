const dotenv = require('dotenv');
dotenv.config();

const clients = [
  'Carretel Aviamentos',
  'Direito Direto',
  'Mind Gestão Empresarial',
  'Oratória Delio Pinheiro',
  'Cepel Arte Decore'
];

console.log('--- DIAGNÓSTICO DE CREDENCIAIS ---');
console.log('TOKEN GLOBAL:', process.env.META_ACCESS_TOKEN_GLOBAL ? 'OK' : 'FALTANDO');

clients.forEach(name => {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
  const shortName = normalized.split(' ')[0];
  const tokenKey = `META_ACCESS_TOKEN_${shortName}`;
  const accountKey = `META_AD_ACCOUNT_ID_${shortName}`;
  
  console.log(`\nCliente: ${name}`);
  console.log(`  Key Base: ${shortName}`);
  console.log(`  ${accountKey}: ${process.env[accountKey] || 'FALTANDO'}`);
  console.log(`  ${tokenKey}: ${process.env[tokenKey] || (process.env.META_ACCESS_TOKEN_GLOBAL ? 'OK (Global)' : 'FALTANDO')}`);
});
