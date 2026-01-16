'use client'

import { useState, useEffect } from 'react'
import { Search, AlertTriangle, HelpCircle, CheckCircle2 } from 'lucide-react'
import StudentDetailSheet from './StudentDetailSheet'
import { supabase } from '../utils/supabase'
import { type UserProfile } from '../utils/auth'

interface Topic {
  name: string
  status: 'Critical' | 'Stable' | 'Flow'
  studentsStuck?: number
}

interface Student {
  name: string
  lastActivity: string
  currentTopic: string
  status: 'flow' | 'struggling' | 'inactive'
  summary?: string
}

export default function TeacherDashboard({ teacherName = 'Meneer Jansen', className = 'Groep 8A', userProfile }: { teacherName?: string; className?: string; userProfile?: UserProfile | null }) {
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [topics, setTopics] = useState<Topic[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [classroomId, setClassroomId] = useState<number | null>(null)

  // Setup klas en haal data op
  useEffect(() => {
    const setupAndFetch = async () => {
      try {
        // 1. Setup klas (maakt aan als niet bestaat)
        const setupResponse = await fetch('/api/setup-classroom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (setupResponse.ok) {
          const setupData = await setupResponse.json();
          setClassroomId(setupData.classroomId);
          console.log('[TEACHER DASHBOARD] Setup voltooid, classroomId:', setupData.classroomId);
        }

        // 2. Haal studenten op uit classroom_students
        // Gebruik teacher_id uit userProfile of fallback
        const teacherId = userProfile?.id || 'test-teacher-1';
        
        // FALLBACK: Als er geen classroom is, gebruik eerste beschikbare
        const { data: classroom, error: classroomError } = await supabase
          .from('classrooms')
          .select('id')
          .eq('name', className)
          .eq('teacher_id', teacherId)
          .single();

        // Als specifieke klas niet gevonden, probeer eerste klas van deze teacher
        let currentClassroomId: number | null = null;
        if (classroomError || !classroom) {
          console.log('[TEACHER DASHBOARD] Specifieke klas niet gevonden, zoek eerste klas...');
          const { data: anyClassroom } = await supabase
            .from('classrooms')
            .select('id')
            .eq('teacher_id', teacherId)
            .limit(1)
            .single();
          
          if (anyClassroom) {
            currentClassroomId = anyClassroom.id;
          }
        } else {
          currentClassroomId = classroom.id;
        }

        if (!currentClassroomId) {
          console.log('[TEACHER DASHBOARD] Geen klas gevonden, gebruik lege lijst');
          setStudents([]);
          setTopics([]);
          setIsLoading(false);
          return;
        }

        setClassroomId(currentClassroomId);

        const { data: classroomStudents, error: studentsError } = await supabase
          .from('classroom_students')
          .select('student_name')
          .eq('classroom_id', currentClassroomId);

        if (studentsError) {
          console.error('[TEACHER DASHBOARD] Error fetching students:', studentsError);
          setIsLoading(false);
          return;
        }

        if (!classroomStudents || classroomStudents.length === 0) {
          console.log('[TEACHER DASHBOARD] Geen studenten gevonden');
          setIsLoading(false);
          return;
        }

        // 3. Haal alle insights op (voor nu: er is geen student_name veld, dus gebruiken we alle insights)
        const { data: allInsightsForStudents, error: insightsError } = await supabase
          .from('insights')
          .select('*')
          .order('created_at', { ascending: false });

        // 4. Maak studentenlijst (voor nu: toon alle studenten, later koppelen we insights aan studenten)
        const studentNames = classroomStudents.map(s => s.student_name);
        const studentsWithInsights: Student[] = [];

        const formatDate = (dateString: string) => {
          const date = new Date(dateString);
          const now = new Date();
          const diffMs = now.getTime() - date.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          
          if (diffDays === 0) {
            return `Vandaag, ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
          } else if (diffDays === 1) {
            return `Gisteren, ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
          } else if (diffDays === 2) {
            return `Eergisteren, ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
          } else {
            return `${diffDays} dagen geleden`;
          }
        };

        // Voor nu: toon studenten, gebruik meest recente insight als voorbeeld (later: koppel via student_name)
        const mostRecentInsight = allInsightsForStudents && allInsightsForStudents.length > 0 ? allInsightsForStudents[0] : null;

        studentNames.forEach((studentName, index) => {
          // Gebruik de meest recente insight als voorbeeld (later: koppel via student_name veld)
          const studentInsight = allInsightsForStudents && allInsightsForStudents[index] ? allInsightsForStudents[index] : mostRecentInsight;

          const status: 'flow' | 'struggling' | 'inactive' = 
            studentInsight?.needs_attention ? 'struggling' :
            studentInsight?.flow_score >= 70 ? 'flow' : 'inactive';

          studentsWithInsights.push({
            name: studentName,
            lastActivity: studentInsight ? formatDate(studentInsight.created_at) : 'Geen activiteit',
            currentTopic: studentInsight?.topic || 'Geen onderwerp',
            status: status,
            summary: studentInsight?.summary
          });
        })

        setStudents(studentsWithInsights);

        // 5. Bereken Top 3 Knelpunten - alleen van studenten in deze klas
        const studentNamesInClass = classroomStudents.map(s => s.student_name);
        
        const { data: allInsights, error: topicsError } = await supabase
          .from('insights')
          .select('topic, needs_attention, student_name')
          .in('student_name', studentNamesInClass) // Alleen studenten uit deze klas
          .order('created_at', { ascending: false })
          .limit(1000);

        if (!topicsError && allInsights) {
          // Groepeer per topic en tel hoeveel studenten needs_attention hebben
          const topicMap = new Map<string, number>();
          
          allInsights.forEach(insight => {
            if (insight.needs_attention) {
              const current = topicMap.get(insight.topic) || 0;
              topicMap.set(insight.topic, current + 1);
            }
          });

          // Sorteer op aantal studenten met knelpunt
          const sortedTopics = Array.from(topicMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([topic, count]) => {
              let status: Topic['status'] = 'Critical';
              if (count <= 2) status = 'Stable';
              if (count === 0) status = 'Flow';
              
              return {
                name: topic.charAt(0).toUpperCase() + topic.slice(1),
                status: status,
                studentsStuck: count
              };
            });

          // Vul aan tot 3 als nodig
          while (sortedTopics.length < 3) {
            sortedTopics.push({
              name: 'Geen knelpunten',
              status: 'Flow' as Topic['status'],
              studentsStuck: 0
            });
          }

          setTopics(sortedTopics);
        }

      } catch (error) {
        console.error('[TEACHER DASHBOARD] Error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    setupAndFetch();
  }, [className])

  // Get today's date in Dutch format
  const today = new Date()
  const days = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']
  const months = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
  const dateString = `${today.getDate()} ${months[today.getMonth()]}`

  // Filter students based on search
  const filteredStudents = students.filter((student) =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleStudentClick = (studentName: string) => {
    setSelectedStudent(studentName)
  }

  const getTopicStyles = (status: Topic['status']) => {
    switch (status) {
      case 'Critical':
        return 'border-orange-400 ring-2 ring-orange-100'
      case 'Stable':
        return 'border-stone-400'
      case 'Flow':
        return 'border-emerald-400 ring-2 ring-emerald-100'
      default:
        return 'border-stone-400'
    }
  }

  const getTopicIcon = (status: Topic['status']) => {
    switch (status) {
      case 'Critical':
        return <AlertTriangle className="w-4 h-4 text-orange-500 mb-1" strokeWidth={2} />
      case 'Stable':
        return <HelpCircle className="w-4 h-4 text-stone-400 mb-1" strokeWidth={2} />
      case 'Flow':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 mb-1" strokeWidth={2} />
      default:
        return <HelpCircle className="w-4 h-4 text-stone-400 mb-1" strokeWidth={2} />
    }
  }

  const getTopicSubtext = (status: Topic['status']) => {
    switch (status) {
      case 'Critical':
        return 'KRITIEK KNELPUNT'
      case 'Stable':
        return 'STABIEL'
      case 'Flow':
        return 'GING GOED'
      default:
        return 'STABIEL'
    }
  }

  const getTopicNumberColor = (status: Topic['status']) => {
    switch (status) {
      case 'Critical':
        return 'text-orange-600'
      case 'Stable':
        return 'text-stone-600'
      case 'Flow':
        return 'text-emerald-600'
      default:
        return 'text-stone-600'
    }
  }

  const getStatusBadge = (status: Student['status']) => {
    switch (status) {
      case 'flow':
        return 'bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium'
      case 'struggling':
        return 'bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-medium'
      case 'inactive':
        return 'text-stone-400 text-xs'
      default:
        return 'text-stone-400 text-xs'
    }
  }

  const getStatusLabel = (status: Student['status']) => {
    switch (status) {
      case 'flow':
        return 'Flow'
      case 'struggling':
        return 'Hulp nodig'
      case 'inactive':
        return 'Inactief'
      default:
        return 'Inactief'
    }
  }

  const getInitials = (name: string) => {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  return (
    <div className="flex-1 overflow-y-auto bg-stone-50">
      <div className="max-w-7xl mx-auto mt-4 md:mt-12 p-4 md:p-8">
        {/* Header */}
        <div className="mb-5 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-bold text-stone-900 mb-1.5 md:mb-2 leading-tight">
            Goedemorgen, {teacherName}.
          </h1>
          <p className="text-stone-600 text-xs md:text-base font-medium">
            Overzicht {className} - {dateString}
          </p>
        </div>

        {/* Section 1: Topic Heatmap (Top 3) */}
        <div className="mb-5 md:mb-8">
          <h2 className="text-lg md:text-xl font-bold text-stone-900 mb-3 md:mb-4">Top 3 Knelpunten</h2>
          {isLoading ? (
            <div className="text-stone-500 text-sm">Laden...</div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {topics.slice(0, 3).map((topic, index) => (
              <div
                key={index}
                className={`bg-white rounded-2xl border-2 p-4 md:p-5 shadow-md transition-shadow hover:shadow-lg flex items-center justify-between ${getTopicStyles(topic.status)}`}
              >
                {/* Linkerkant: Context */}
                <div className="flex-1 min-w-0">
                  {getTopicIcon(topic.status)}
                  <h3 className="font-bold text-stone-900 text-base md:text-lg mb-0.5 md:mb-1">{topic.name}</h3>
                  <p className="text-xs font-bold uppercase tracking-wider text-stone-600">
                    {getTopicSubtext(topic.status)}
                  </p>
                </div>

                {/* Rechterkant: Data */}
                <div className="flex flex-col items-end ml-3 md:ml-4 flex-shrink-0">
                  <div className={`text-2xl md:text-3xl font-black tracking-tight ${getTopicNumberColor(topic.status)}`}>
                    {topic.studentsStuck !== undefined ? topic.studentsStuck : 0}
                  </div>
                  <div className="text-xs text-stone-500 font-medium">Leerlingen</div>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

        {/* Section 2: Class List */}
        <div className="bg-white rounded-2xl md:rounded-3xl border-2 border-stone-300 shadow-md p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-bold text-stone-900 mb-3 md:mb-4">Klassenlijst</h2>
          
          {/* Search */}
          <div className="mb-4 md:mb-6">
            <div className="relative">
              <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-stone-500" strokeWidth={2} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoek leerling..."
                className="w-full pl-10 md:pl-12 pr-3 md:pr-4 py-2.5 md:py-3 bg-stone-100 border border-stone-300 rounded-xl md:rounded-2xl shadow-inner text-sm md:text-base text-stone-900 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-stone-500 focus:bg-white transition-all font-medium"
              />
            </div>
          </div>

          {/* Student List */}
          <div className="space-y-1.5 md:space-y-2 max-h-[500px] md:max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <div className="text-stone-500 text-sm py-8 text-center">Laden...</div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-stone-500 text-sm py-8 text-center">Geen studenten gevonden</div>
            ) : (
              filteredStudents.map((student, index) => (
              <button
                key={index}
                onClick={() => handleStudentClick(student.name)}
                className={`w-full p-3 md:p-4 flex items-center gap-3 md:gap-4 rounded-xl md:rounded-2xl transition-all border cursor-pointer group text-left ${
                  selectedStudent === student.name
                    ? 'bg-stone-50 border-stone-300 ring-2 ring-stone-200'
                    : 'bg-white border-stone-200 hover:bg-stone-50 hover:shadow-sm hover:border-stone-300'
                }`}
              >
                {/* Avatar */}
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-stone-300 flex items-center justify-center text-stone-800 font-bold text-xs md:text-sm flex-shrink-0 border border-stone-400">
                  {getInitials(student.name)}
                </div>
                
                {/* Student Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-stone-900 text-sm md:text-base mb-0.5 md:mb-1">{student.name}</div>
                  <div className="text-xs md:text-sm text-stone-600 truncate font-medium">{student.currentTopic}</div>
                </div>
                
                {/* Last Activity & Status Badge */}
                <div className="flex flex-col md:flex-row items-end md:items-center gap-1.5 md:gap-3 flex-shrink-0">
                  <div className="text-xs md:text-sm text-stone-600 hidden md:block font-medium">
                    {student.lastActivity}
                  </div>
                  <span className={getStatusBadge(student.status)}>
                    {getStatusLabel(student.status)}
                  </span>
                </div>
              </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Student Detail Sheet */}
      {selectedStudent && (
        <StudentDetailSheet
          studentName={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  )
}
