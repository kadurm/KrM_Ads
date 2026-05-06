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

    // Template de exportação do GTM (Minimalista e Robusto)
    const gtmExport = {
      "exportFormatVersion": 2,
      "exportTime": new Date().toISOString().replace('T', ' ').split('.')[0],
      "container": {
        "name": `KrM-Tracking`,
        "publicId": "GTM-KRMADS",
        "usageContext": ["WEB"]
      },
      "containerVersion": {
        "name": "KrM Ads Tracking",
        "tag": [
          {
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
            "tagFiringOption": "ONCE_PER_EVENT"
          },
          {
            "name": "Meta Pixel - Event - Lead (Button Click)",
            "type": "html",
            "parameter": [
              {
                "type": "TEMPLATE",
                "key": "html",
                "value": "\u003cscript\u003efbq('track', 'Lead');\u003c/script\u003e"
              }
            ],
            "firingTriggerId": ["1"],
            "tagFiringOption": "ONCE_PER_EVENT"
          }
        ],
        "trigger": [
          {
            "triggerId": "1",
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
            ]
          }
        ],
        "variable": [
          {
            "name": "Meta Pixel ID",
            "type": "c",
            "parameter": [
              { "type": "TEMPLATE", "key": "value", "value": pixelId }
            ]
          }
        ],
        "builtInVariable": [
          { "name": "Click Text", "type": "CLICK_TEXT" }
        ]
      }
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
