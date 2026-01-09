import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// GET: Laad alle chats voor een gebruiker
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Haal alle chats op voor deze gebruiker
    const { data: chats, error: chatsError } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (chatsError) {
      console.error('Error fetching chats:', chatsError);
      return NextResponse.json(
        { error: 'Failed to fetch chats', details: chatsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ chats: chats || [] });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Maak een nieuwe chat of update bestaande
export async function POST(request: NextRequest) {
  try {
    const { userId, chatId, title, messages } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    let finalChatId = chatId;

    // Als er geen chatId is, maak een nieuwe chat
    if (!finalChatId) {
      const { data: newChat, error: chatError } = await supabase
        .from('chats')
        .insert({
          user_id: userId,
          title: title || `Chat ${new Date().toLocaleDateString()}`,
        })
        .select()
        .single();

      if (chatError) {
        console.error('Error creating chat:', chatError);
        return NextResponse.json(
          { error: 'Failed to create chat', details: chatError.message },
          { status: 500 }
        );
      }

      finalChatId = newChat.id;
    } else {
      // Update bestaande chat
      const { error: updateError } = await supabase
        .from('chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', finalChatId);

      if (updateError) {
        console.error('Error updating chat:', updateError);
      }
    }

    // Als er messages zijn, sla ze op
    if (messages && Array.isArray(messages) && messages.length > 0) {
      // Verwijder oude messages voor deze chat (optioneel - of gebruik upsert)
      await supabase.from('messages').delete().eq('chat_id', finalChatId);

      // Voeg nieuwe messages toe
      const messagesToInsert = messages.map((msg: { role: string; content: string }) => ({
        chat_id: finalChatId,
        role: msg.role,
        content: msg.content,
      }));

      const { error: messagesError } = await supabase
        .from('messages')
        .insert(messagesToInsert);

      if (messagesError) {
        console.error('Error saving messages:', messagesError);
        return NextResponse.json(
          { error: 'Failed to save messages', details: messagesError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ 
      success: true, 
      chatId: finalChatId 
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

