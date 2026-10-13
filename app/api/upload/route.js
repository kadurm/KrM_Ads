import { NextResponse } from 'next/server';
import { storage } from '@/utils/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ success: false, error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `planner/${fileName}`;

    const storageRef = ref(storage, filePath);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const snapshot = await uploadBytesResumable(storageRef, buffer, {
      contentType: file.type || 'application/octet-stream'
    });

    const publicUrl = await getDownloadURL(snapshot.ref);

    return NextResponse.json({ success: true, url: publicUrl });

  } catch (error) {
    console.error('Firebase Upload Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
