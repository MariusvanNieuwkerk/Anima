import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const chatId = formData.get('chatId') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `chat-images/${fileName}`;

    // Convert File to ArrayBuffer then to Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat-images')
      .upload(filePath, uint8Array, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file', details: uploadError.message },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('chat-images')
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    // Save metadata to database
    const { data: photoRecord, error: dbError } = await supabase
      .from('photo_uploads')
      .insert({
        user_id: userId,
        chat_id: chatId || null,
        file_path: filePath,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error saving photo metadata:', dbError);
      // File is already uploaded, but metadata failed - log but don't fail
      // Optionally: delete the uploaded file
    }

    return NextResponse.json({
      success: true,
      fileUrl: publicUrl,
      filePath: filePath,
      photoId: photoRecord?.id || null,
    });
  } catch (error) {
    console.error('Upload API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

