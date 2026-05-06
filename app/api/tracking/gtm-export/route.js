import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const clienteNome = searchParams.get('cliente');

    if (!clienteNome) {
      return NextResponse.json({ success: false, error: 'Cliente não informado.' }, { status: 400 });
    }

    const cliente = await prisma.cliente.findFirst({ where: { nome: clienteNome } });
    if (!cliente) {
      return NextResponse.json({ success: false, error: 'Cliente não encontrado.' }, { status: 404 });
    }

    const pixelId = cliente.meta_pixel_id || 'INSERT_PIXEL_ID_HERE';

    // Template de exportação do GTM
    const gtmExport = {
      "exportFormatVersion": 2,
      "exportTime": new Date().toISOString().replace('T', ' ').split('.')[0],
      "container": {
        "accountId": "92837415",
        "containerId": "81726354",
        "name": `KrM-Tracking-${cliente.nome}`,
        "publicId": "GTM-KRMADS",
        "usageContext": ["WEB"],
        "fingerprint": "1730650000000"
      },
      "containerVersion": {
        "path": "accounts/92837415/containers/81726354/versions/0",
        "accountId": "92837415",
        "containerId": "81726354",
        "containerVersionId": "0",
        "name": "KrM Ads Tracking Version",
        "tag": [
          {
            "accountId": "92837415",
            "containerId": "81726354",
            "tagId": "1",
            "name": "Meta Pixel - Base Code",
            "type": "html",
            "parameter": [
              {
                "type": "TEMPLATE",
                "key": "html",
                "value": `\u003cscript\u003e\n!function(f,b,e,v,n,t,s)\n{if(f.fbq)return;n=f.fbq=function(){n.callMethod?\nn.callMethod.apply(n,arguments):n.queue.push(arguments)};\nif(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';\nn.queue=[];t=b.createElement(e);t.async=!0;\nt.src=v;s=b.getElementsByTagName(e)[0];\ns.parentNode.insertBefore(t,s)}(window, document,'script',\n'https://connect.facebook.net/en_US/fbevents.js');\nfbq('init', '{{Meta Pixel ID}}');\nfbq('track', 'PageView');\n\u003c/script\u003e`
              }
            ],
            "firingTriggerId": ["2147483647"],
            "tagFiringOption": "ONCE_PER_EVENT",
            "fingerprint": "1730650000001"
          },
          {
            "accountId": "92837415",
            "containerId": "81726354",
            "tagId": "2",
            "name": "Meta Pixel - Event - Lead (Button Click)",
            "type": "html",
            "parameter": [
              {
                "type": "TEMPLATE",
                "key": "html",
                "value": "\u003cscript\u003efbq('track', 'Lead');\u003c/script\u003e"
              }
            ],
            "firingTriggerId": ["100"],
            "tagFiringOption": "ONCE_PER_EVENT",
            "fingerprint": "1730650000002"
          }
        ],
        "trigger": [
          {
            "accountId": "92837415",
            "containerId": "81726354",
            "triggerId": "100",
            "name": "Click - Garantir Minha Vaga",
            "type": "CLICK",
            "filter": [
              {
                "type": "CONTAINS",
                "parameter": [
                  { "type": "TEMPLATE", "key": "arg0", "value": "{{Click Text}}" },
                  { "type": "TEMPLATE", "key": "arg1", "value": "Garantir minha vaga" }
                ]
              }
            ],
            "fingerprint": "1730650000003"
          }
        ],
        "variable": [
          {
            "accountId": "92837415",
            "containerId": "81726354",
            "variableId": "1",
            "name": "Meta Pixel ID",
            "type": "c",
            "parameter": [
              { "type": "TEMPLATE", "key": "value", "value": pixelId }
            ],
            "fingerprint": "1730650000004"
          }
        ],
        "builtInVariable": [
          { 
            "accountId": "92837415",
            "containerId": "81726354",
            "name": "Click Text", 
            "type": "CLICK_TEXT" 
          }
        ]
      },
      "fingerprint": "1730650000000"
    };

    return new NextResponse(JSON.stringify(gtmExport, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="GTM-KrM-Tracking-${cliente.slug || 'export'}.json"`
      }
    });

  } catch (error) {
    console.error('Erro ao gerar exportação GTM:', error);
    return NextResponse.json({ success: false, error: 'Erro ao gerar arquivo.' }, { status: 500 });
  }
}
