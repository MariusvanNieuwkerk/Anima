import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

export async function POST(req: NextRequest) {
  try {
    // Voor nu gebruiken we een hardcoded teacher_id, later via auth
    const teacherId = 'test-teacher-1'; // TODO: Vervang met echte auth
    
    // 1. Check of klas al bestaat
    const { data: existingClass, error: checkError } = await supabase
      .from('classrooms')
      .select('*')
      .eq('name', 'Groep 8A')
      .eq('teacher_id', teacherId)
      .single();

    let classroomId: number;

    if (existingClass) {
      classroomId = existingClass.id;
      console.log('[SETUP] Klas bestaat al:', classroomId);
    } else {
      // 2. Maak nieuwe klas aan
      const { data: newClass, error: createError } = await supabase
        .from('classrooms')
        .insert({
          name: 'Groep 8A',
          teacher_id: teacherId
        })
        .select()
        .single();

      if (createError) {
        console.error('[SETUP] Error creating classroom:', createError);
        return NextResponse.json({ error: "Error creating classroom", details: createError }, { status: 500 });
      }

      classroomId = newClass.id;
      console.log('[SETUP] Klas aangemaakt:', classroomId);
    }

    // 3. Check of Rens al gekoppeld is
    const { data: existingStudent, error: studentCheckError } = await supabase
      .from('classroom_students')
      .select('*')
      .eq('classroom_id', classroomId)
      .eq('student_name', 'Rens')
      .single();

    if (!existingStudent) {
      // 4. Koppel Rens aan de klas
      const { error: linkError } = await supabase
        .from('classroom_students')
        .insert({
          classroom_id: classroomId,
          student_name: 'Rens'
        });

      if (linkError) {
        console.error('[SETUP] Error linking student:', linkError);
        return NextResponse.json({ error: "Error linking student", details: linkError }, { status: 500 });
      }

      console.log('[SETUP] Rens gekoppeld aan klas');
    } else {
      console.log('[SETUP] Rens is al gekoppeld');
    }

    return NextResponse.json({ success: true, classroomId });

  } catch (error) {
    console.error("Setup API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

