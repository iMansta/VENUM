#!/usr/bin/env node
/**
 * VENUM — Instalação do ambiente (estilo setup Next.js)
 *
 * Uso: npm run setup
 */
import { existsSync, copyFileSync } from 'fs';
import { execSync } from 'child_process';

const nodeMajor = Number(process.version.slice(1).split('.')[0]);
if (nodeMajor < 18) {
  console.error('❌ Node.js 18+ é obrigatório');
  process.exit(1);
}

console.log('🐍 VENUM — Setup I V E N U M I\n');

if (!existsSync('.env') && existsSync('.env.example')) {
  copyFileSync('.env.example', '.env');
  console.log('✅ .env criado a partir de .env.example');
  console.log('   → Preencha SUPABASE_URL, chaves e DISCORD_WEBHOOK_URL\n');
} else if (existsSync('.env')) {
  console.log('ℹ️  .env já existe\n');
}

console.log('📦 Instalando dependências...');
execSync('npm install', { stdio: 'inherit' });

console.log('\n========================================');
console.log('Próximos passos:');
console.log('  1. Configure .env (Supabase + Discord)');
console.log('  2. Rode SQL: supabase/UPDATE_PRODUCTION.sql');
console.log('  3. Rode SQL: supabase/UPDATE_PHASE2.sql');
console.log('  4. Popule catálogo: npm run catalog:seed');
console.log('  5. Dev web: npm run dev');
console.log('  6. Coletor 24/7: npm run collector');
console.log('========================================\n');
