import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Essas chaves devem ser configuradas no seu .env para o upload funcionar
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Configuração do Supabase Storage ausente. Adicione as chaves NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY ao seu .env' 
      }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ success: false, error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `planner/${fileName}`;

    // Upload para o bucket 'krm-media'
    const { data, error } = await supabase.storage
      .from('krm-media')
      .upload(filePath, file);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Gerar URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('krm-media')
      .getPublicUrl(filePath);

    return NextResponse.json({ success: true, url: publicUrl });

  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
