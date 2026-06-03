import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    const expectedUsername = process.env.ADMIN_USERNAME || 'AdminKrM';
    const expectedPassword = process.env.ADMIN_PASSWORD || 'AdminKrM';

    if (username === expectedUsername && password === expectedPassword) {
      console.log(`[AUTH] Login efetuado com sucesso para o usuário: ${username}`);
      
      return NextResponse.json({ 
        success: true, 
        token: 'krm-auth-token-2026',
        message: 'Autenticação bem-sucedida.'
      });
    } else {
      console.warn(`[AUTH] Tentativa de login inválida para o usuário: ${username}`);
      
      return NextResponse.json({ 
        success: false, 
        error: 'Usuário ou senha incorretos.' 
      }, { status: 401 });
    }
  } catch (error) {
    console.error('[AUTH] Erro no processamento de login:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: 'Erro interno no servidor de autenticação.' 
    }, { status: 500 });
  }
}
