import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    const expectedUsername = process.env.SOLUTION_USERNAME || 'AdminSolution';
    const expectedPassword = process.env.SOLUTION_PASSWORD || 'AdminSolution';

    if (username === expectedUsername && password === expectedPassword) {
      console.log(`[AUTH-SOLUTION] Login efetuado com sucesso para o usuário: ${username}`);
      
      return NextResponse.json({ 
        success: true, 
        token: 'solution-auth-token-2026',
        message: 'Autenticação bem-sucedida.'
      });
    } else {
      console.warn(`[AUTH-SOLUTION] Tentativa de login inválida para o usuário: ${username}`);
      
      return NextResponse.json({ 
        success: false, 
        error: 'Usuário ou senha incorretos.' 
      }, { status: 401 });
    }
  } catch (error) {
    console.error('[AUTH-SOLUTION] Erro no processamento de login:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: 'Erro interno no servidor de autenticação.' 
    }, { status: 500 });
  }
}
