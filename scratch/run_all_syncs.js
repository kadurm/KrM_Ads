const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Start a simulated local request to the sync API
async function main() {
    const clientes = await prisma.cliente.findMany();
    const today = new Date().toISOString().split('T')[0];
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    console.log('Forcing full sync for all clients...');

    for (const c of clientes) {
        console.log(`Syncing ${c.nome}...`);
        try {
            // we will call the API handler directly to avoid starting the server
            // wait, we can just run the logic, but the route handler is Next.js.
            // Let's just start the Next server and call it?
            // Actually, I can just use curl against localhost:3000 if the user has it running.
            // If not, I can just tell the user they need to click the Sync button in the UI.
        } catch(e) {}
    }
}
main();
