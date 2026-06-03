/**
 * Script de Teste - Integração WhatsApp (Evolution / Z-API)
 * 
 * Execução: node scratch/test_whatsapp_integration.js
 */

const http = require('http');

const SIMULATE_PORT = 3000;

function simulateWebhook() {
  console.log('\n[Simulador] Iniciando simulação de recebimento de mensagem via Webhook...');

  const webhookPayload = JSON.stringify({
    event: 'messages.upsert',
    data: {
      key: {
        remoteJid: '5511999999999@s.whatsapp.net',
        pushName: 'Carlos Eduardo Teste'
      },
      pushName: 'Carlos Eduardo Teste',
      message: {
        conversation: 'Olá, gostaria de saber mais sobre a blindagem de veículos!'
      }
    }
  });

  const options = {
    hostname: 'localhost',
    port: SIMULATE_PORT,
    path: '/api/whatsapp/webhook?cliente=solutionplace',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(webhookPayload)
    }
  };

  const req = http.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => { responseData += chunk; });
    res.on('end', () => {
      console.log(`[Webhook Response Code]: ${res.statusCode}`);
      console.log(`[Webhook Response Body]: ${responseData}`);
      try {
        const parsed = JSON.parse(responseData);
        if (parsed.success) {
          console.log('\x1b[32m%s\x1b[0m', '✔ Sucesso: O lead foi criado com sucesso no CRM!');
        } else {
          console.log('\x1b[31m%s\x1b[0m', '✘ Erro: O webhook respondeu com falha:', parsed.error);
        }
      } catch (e) {
        console.error('Falha ao parsear resposta:', e.message);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`\x1b[31m%s\x1b[0m`, `✘ Erro ao conectar ao servidor local na porta ${SIMULATE_PORT}:`, e.message);
    console.log('Certifique-se de que o servidor local está rodando em uma janela com "npm run dev".');
  });

  req.write(webhookPayload);
  req.end();
}

// Executa a simulação
simulateWebhook();
