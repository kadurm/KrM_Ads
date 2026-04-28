import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/atendimento/'],
    },
    sitemap: 'https://krmads.com.br/sitemap.xml',
  };
}
