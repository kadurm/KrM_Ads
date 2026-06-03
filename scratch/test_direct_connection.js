const fs = require('fs');
const path = require('path');

// Manually parse .env file
try {
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.substring(0, eqIdx).trim();
    let val = trimmed.substring(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  });
  console.log('Environment variables loaded manually from .env.');
} catch (e) {
  console.warn('Could not load .env file manually:', e.message);
}

// Override DATABASE_URL with DIRECT_URL for direct connection test
if (process.env.DIRECT_URL) {
  console.log('Overriding DATABASE_URL with DIRECT_URL for direct connection test...');
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Testing direct connection to Supabase via Prisma...');
  try {
    const clientes = await prisma.cliente.findMany();
    console.log('Successfully connected directly via Prisma!');
    console.log(`Found ${clientes.length} clients in database:`);
    clientes.forEach(c => {
      console.log(`- ${c.nome} (ID: ${c.id})`);
    });
  } catch (err) {
    console.error('Direct connection test failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
