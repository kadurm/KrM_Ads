/**
 * Script para corrigir slugs com acentos no banco de dados.
 * Remove acentos dos slugs existentes para garantir consistência
 * com a lógica de resolução de credenciais.
 */
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) return;
  const key = trimmed.substring(0, eqIdx).trim();
  let val = trimmed.substring(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  process.env[key] = val;
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clientes = await prisma.cliente.findMany();
  
  console.log('Corrigindo slugs com acentos...\n');
  
  for (const c of clientes) {
    const cleanSlug = c.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (c.slug !== cleanSlug) {
      console.log(`  ${c.nome}: "${c.slug}" → "${cleanSlug}"`);
      await prisma.cliente.update({
        where: { id: c.id },
        data: { slug: cleanSlug }
      });
    } else {
      console.log(`  ${c.nome}: ✅ OK ("${c.slug}")`);
    }
  }
  
  console.log('\n✅ Concluído.');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
