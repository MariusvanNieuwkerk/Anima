'use client'

import { useState, useEffect, useRef } from 'react'
import { Menu, Smartphone, Camera, Image as ImageIcon, QrCode, X, UploadCloud, Phone, Cloud, Monitor } from 'lucide-react'
import ChatColumn from './ChatColumn'
import BoardColumn from './BoardColumn'
import InputDock from './InputDock'
import MobileHeader from './MobileHeader'
import SideMenu from './SideMenu'
import SettingsModal from './SettingsModal'
import ParentDashboard from './ParentDashboard'
import TeacherDashboard from './TeacherDashboard'
import { supabase } from '../utils/supabase'
import { getUserProfile, type UserProfile } from '../utils/auth'
import { compressImage } from '../utils/imageUtils'
import { unlockAudioContext, unlockSpeechSynthesis } from '../utils/audioUnlock'
import { getBestVoice, waitForVoices } from '../utils/voiceSelector'
import QRCodeDisplay from './QRCodeDisplay'

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

type TutorMode = 'focus' | 'explorer' | 'growth'
type UserRole = 'student' | 'parent' | 'teacher'
type Language = 'nl' | 'en' | 'es' | 'de' | 'fr' | 'it' | 'pt' | 'zh' | 'ar' | 'hi'
type EducationLevel = '6-12' | '13-17' | '18+'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: string[] // Base64 image data voor preview in chat
}

export default function Workspace() {
  const [mobileView, setMobileView] = useState<'chat' | 'board'>('chat')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false)
  const [isQRModalOpen, setIsQRModalOpen] = useState(false)
  
  // Brain Settings - Initialiseer met defaults, useEffect laadt ze uit storage
  const [tutorMode, setTutorMode] = useState<TutorMode>('explorer')
  const [userRole, setUserRole] = useState<UserRole>('student')
  const [language, setLanguage] = useState<Language>('nl')
  const [educationLevel, setEducationLevel] = useState<EducationLevel>('13-17')
  const [age, setAge] = useState(10)
  const [studentName, setStudentName] = useState<string>('Rens')
  const [animaName, setAnimaName] = useState<string>('Anima')
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  // --- NIEUW: Veiligheidspal voor laden settings ---
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false)
  
  // Chat & Board State
  const [messages, setMessages] = useState<Message[]>([]) 
  const [boardData, setBoardData] = useState<{ url: string | null, topic: string | null }>({ url: null, topic: null })
  
  // Vision State
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [hasNewImage, setHasNewImage] = useState(false) 

  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  
  // Audio State
  const [isListening, setIsListening] = useState(false)
  const [isVoiceOn, setIsVoiceOn] = useState(false) 
  
  // --- NIEUW: Dynamische Sessie ID ---
  const [sessionId, setSessionId] = useState<string>('') 

  const attachMenuDesktopRef = useRef<HTMLDivElement>(null)
  const attachMenuMobileRef = useRef<HTMLDivElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // --- 1. INIT & AUTH ---
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Haal user profile op
        const profile = await getUserProfile();
        
        if (profile) {
          setUserProfile(profile);
          setUserRole(profile.role);
          
          // PERSONALIZATION: Zet naam op basis van role
          if (profile.role === 'student' && profile.student_name) {
            setStudentName(profile.student_name);
          } else if (profile.role === 'parent' && profile.parent_name) {
            setStudentName(profile.parent_name);
          } else if (profile.role === 'teacher' && profile.teacher_name) {
            setStudentName(profile.teacher_name);
          } else {
            // Fallback: gebruik eerste beschikbare naam
            setStudentName(profile.student_name || profile.parent_name || profile.teacher_name || 'Gebruiker');
          }
          
          console.log(`DEBUG: Gebruiker ingelogd met rol: ${profile.role}`);
        } else {
          // FALLBACK: Geen profile gevonden, gebruik standaard student profile
          const { createFallbackProfile } = await import('../utils/auth');
          const fallbackProfile = createFallbackProfile();
          setUserProfile(fallbackProfile);
          setUserRole('student');
          setStudentName('Rens');
          
          console.log('DEBUG: Geen profile gevonden, gebruik fallback student profile');
        }
      } catch (error) {
        console.error('[WORKSPACE] Auth initialization error:', error);
        // FALLBACK: Bij error, gebruik student profile
        const { createFallbackProfile } = await import('../utils/auth');
        const fallbackProfile = createFallbackProfile();
        setUserProfile(fallbackProfile);
        setUserRole('student');
        setStudentName('Rens');
        
        console.log('DEBUG: Auth error, gebruik fallback student profile');
      } finally {
        setIsAuthLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // --- 2. INIT SETTINGS ---
  useEffect(() => {
    if (isAuthLoading) return; // Wacht tot auth geladen is
    
    // Laad voorkeuren
    const storedMode = localStorage.getItem('anima_mode') as TutorMode;
    const storedAge = localStorage.getItem('anima_age');
    const storedLang = localStorage.getItem('anima_lang') as Language;
    
    // We updaten de state ALLEEN als er iets in storage zat
    if (storedMode) setTutorMode(storedMode);
    if (storedAge) setAge(parseInt(storedAge));
    if (storedLang) setLanguage(storedLang);

    // Laad of maak Sessie ID
    let currentSession = localStorage.getItem('anima_session_id');
    if (!currentSession) {
        currentSession = crypto.randomUUID(); 
        localStorage.setItem('anima_session_id', currentSession);
    }
    setSessionId(currentSession);

    // BELANGRIJK: Geef sein dat we klaar zijn met laden
    setIsSettingsLoaded(true);
  }, [isAuthLoading]);

  // --- 2. OPSLAAN SETTINGS ---
  useEffect(() => {
    if (!isSettingsLoaded) return; // STOP! Niet opslaan als we nog aan het opstarten zijn.

    if (tutorMode) localStorage.setItem('anima_mode', tutorMode);
    if (age) localStorage.setItem('anima_age', age.toString());
    if (language) localStorage.setItem('anima_lang', language);
  }, [tutorMode, age, language, isSettingsLoaded]); // <--- Dependency toegevoegd

  // --- 3. LADEN CHAT HISTORY ---
  useEffect(() => {
    if (!sessionId) return; // Wacht tot ID er is

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading chats:', error);
      } else if (data && data.length > 0) {
        const loadedMessages = data.map(msg => ({
          id: msg.id.toString(),
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }));
        setMessages(loadedMessages);
      } else {
        // Nieuwe sessie: Toon intro (maar sla nog niet op in DB om vervuiling te voorkomen)
        // Nieuwe sessie: Toon gepersonaliseerde intro met student naam
        const studentNameDisplay = studentName || 'jij';
        const introMsg = { 
          id: 'intro', 
          role: 'assistant', 
          content: `Hoi ${studentNameDisplay}! Ik ben Anima. Waar gaan we aan werken?` 
        };
        setMessages([introMsg as Message]);
      }
    };

    fetchMessages();
  }, [sessionId]);

  // --- 4. REALTIME MOBILE BRIDGE (Supabase Realtime) 🌉 ---
  // Luister naar INSERT events op mobile_uploads voor deze sessie
  useEffect(() => {
    if (!sessionId) return;

    console.log(`[WORKSPACE] Realtime listener gestart voor sessie: ${sessionId}`);

    // Maak een Supabase Realtime channel
    const channel = supabase
      .channel(`mobile_uploads:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mobile_uploads',
          filter: `session_id=eq.${sessionId}`
        },
        async (payload) => {
          console.log('📥 Nieuwe mobile upload ontvangen:', payload.new);
          
          const newRecord = payload.new as { id: string; session_id: string; image_url?: string; image_path?: string; image_data?: string };
          
          try {
            // 1. Haal de image URL op (prioriteit: image_url > image_data)
            let imageBase64: string | null = null;
            
            if (newRecord.image_url) {
              // Download van Storage URL
              const response = await fetch(newRecord.image_url);
              const blob = await response.blob();
              const reader = new FileReader();
              imageBase64 = await new Promise<string>((resolve, reject) => {
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
            } else if (newRecord.image_data) {
              // Fallback naar oude base64 data
              imageBase64 = newRecord.image_data;
            }
            
            if (imageBase64) {
              // 2. Voeg toe aan de previews
              setSelectedImages(prev => [...prev, imageBase64!]);
              
              // 3. Sluit de QR modal als die open staat
              setIsQRModalOpen(false);
              
              // 4. VERWIJDER het record uit de database (cleanup)
              await supabase
                .from('mobile_uploads')
                .delete()
                .eq('id', newRecord.id);
              
              console.log('✅ Mobile upload verwerkt en verwijderd');
            } else {
              console.warn('⚠️ Geen image data gevonden in upload record');
            }
          } catch (error) {
            console.error('[WORKSPACE] Error processing mobile upload:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log(`[WORKSPACE] Realtime subscription status: ${status}`);
      });

    // Cleanup: unsubscribe bij unmount
    return () => {
      console.log(`[WORKSPACE] Realtime listener gestopt voor sessie: ${sessionId}`);
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // --- iOS AUDIO UNLOCK: Unlock audio context bij eerste user interaction ---
  useEffect(() => {
    let unlocked = false;
    
    const unlockOnInteraction = () => {
      if (!unlocked) {
        unlockAudioContext();
        unlockSpeechSynthesis();
        unlocked = true;
        // Remove listeners after first unlock
        document.removeEventListener('touchstart', unlockOnInteraction);
        document.removeEventListener('click', unlockOnInteraction);
      }
    };
    
    // Listen for touchstart (iOS) and click (fallback)
    document.addEventListener('touchstart', unlockOnInteraction, { once: true, passive: true });
    document.addEventListener('click', unlockOnInteraction, { once: true, passive: true });
    
    return () => {
      document.removeEventListener('touchstart', unlockOnInteraction);
      document.removeEventListener('click', unlockOnInteraction);
    };
  }, []);

  // --- HULPFUNCTIE: Opslaan in DB (gebruikt de huidige sessionId) ---
  const saveMessageToDb = async (role: 'user' | 'assistant', content: string, activeSessionId: string) => {
    if (!activeSessionId) return;
    const { error } = await supabase.from('messages').insert({
      role,
      content,
      session_id: activeSessionId
    });
    if (error) console.error('Error saving message:', error);
  };

  const getTTSLangCode = (lang: Language) => {
    switch(lang) {
      case 'nl': return 'nl-NL'; case 'en': return 'en-US'; case 'es': return 'es-ES';
      case 'de': return 'de-DE'; case 'fr': return 'fr-FR'; case 'it': return 'it-IT';
      case 'pt': return 'pt-PT'; case 'zh': return 'zh-CN'; case 'ar': return 'ar-SA';
      case 'hi': return 'hi-IN'; default: return 'nl-NL';
    }
  };

  // iOS AUDIO UNLOCK: Gebruik de utility functie uit utils/audioUnlock.ts
  // Deze wordt aangeroepen tijdens user interaction om iOS audio te activeren

  const speakText = (text: string) => {
    if (!isVoiceOn) return;
    
    // iOS AUDIO UNLOCK: Unlock audio context en SpeechSynthesis voordat we spreken
    unlockAudioContext();
    unlockSpeechSynthesis();
    
    window.speechSynthesis.cancel();
    // Remove emojis using a simple approach that works in all environments (es5 compatible)
    // Simple emoji removal: remove common emoji characters
    const cleanText = text.replace(/[\u2600-\u27BF]/g, '').replace(/[\uD83C][\uDF00-\uDFFF]|[\uD83D][\uDC00-\uDE4F]|[\uD83D][\uDE80-\uDEFF]/g, '');
    
    const langCode = getTTSLangCode(language);
    
    // TUNE AI VOICE: Wacht tot voices beschikbaar zijn en selecteer beste stem
    waitForVoices(() => {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = langCode;
      
      // TUNE AI VOICE: Selecteer beste beschikbare stem (Google/Siri > default)
      const bestVoice = getBestVoice(langCode);
      if (bestVoice) {
        utterance.voice = bestVoice;
        console.log(`[VOICE] Using voice: ${bestVoice.name} for ${langCode}`);
      }
      
      // TUNE AI VOICE: Natuurlijker spreektempo en pitch
      utterance.rate = 0.95;    // Rustiger tempo (was al 0.95, blijft hetzelfde)
      utterance.pitch = 1.0;    // Neutrale pitch (was 1.05, nu 1.0 voor natuurlijker geluid)
      utterance.volume = 1.0;   // FORCE SPEAKER: Zet volume expliciet op 1.0 voor iOS
      
      // iOS AUDIO: Wacht tot speechSynthesis ready is
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      
      // iOS AUDIO AUTOPLAY: Probeer te spreken in een try-catch om errors op te vangen
      try {
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('[AUDIO] Failed to speak text:', err);
      }
    });
  };

  // --- NIEUWE SESSIE HANDLER ---
  const handleStartNewSession = async () => {
    console.log('Starting new session...');
    
    // 1. POST-SESSION LOGICA: Genereer insight voor de oude sessie (als er messages zijn)
    if (sessionId && messages.length > 1) { // Meer dan alleen het intro bericht
      try {
        await fetch('/api/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId,
            studentName: studentName, // Voeg student name toe voor koppeling
            userAge: age,
            tutorMode: tutorMode,
            language: language
          })
        });
        // Stil falen bij errors (graceful degradation volgens Blueprint)
      } catch (error) {
        console.error('Error generating insight:', error);
      }
    }
    
    // 2. Maak nieuwe ID
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);
    localStorage.setItem('anima_session_id', newSessionId); // Bewaar, zodat F5 in deze nieuwe sessie blijft
    
    // 3. Reset UI
    const msg = language === 'en' ? 'New session! How can I help?' : 'Nieuwe sessie! Waar kan ik je mee helpen?';
    setMessages([{ id: Date.now().toString(), role: 'assistant', content: msg }]);
    setBoardData({ url: null, topic: null });
    setHasNewImage(false);
    setSelectedImages([]);
    
    // 4. Spreek
    speakText(msg);
  }

  const handleLogout = async () => {
    try {
      // LOGOUT ACTION: Sign out en redirect naar /login
      await supabase.auth.signOut()
      window.location.href = '/login'
    } catch (error) {
      console.error('[LOGOUT] Error:', error)
      // Bij error, forceer redirect naar login
      window.location.href = '/login'
    }
  }
  const handleAttachClick = () => { setIsAttachMenuOpen(!isAttachMenuOpen) }

  const handleMicClick = async () => {
    if (isListening) { 
      setIsListening(false); 
      return; 
    }

    // IOS MIC FIX: Check browser support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) { 
      alert("Browser ondersteunt geen spraakherkenning."); 
      return; 
    }

    // IOS MIC FIX: Vraag om microfoon toestemming op iOS VOOR SpeechRecognition
    // Dit is cruciaal op iOS - zonder deze check werkt de microfoon niet
    try {
      // Op iOS moet je eerst om toestemming vragen via getUserMedia
      // Dit triggert de iOS permission prompt
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      // Stop de stream direct (we gebruiken alleen SpeechRecognition)
      stream.getTracks().forEach(track => track.stop());
      
      // Wacht even zodat de permission dialog kan sluiten
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: any) {
      // PERMISSION HANDLING: Toon nette error message
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert("Geef toegang tot je microfoon in de iOS instellingen.\n\nGa naar: Instellingen > Safari > Microfoon\n\nZet dit aan en probeer het opnieuw.");
        setIsListening(false);
        return;
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        alert("Geen microfoon gevonden. Controleer je apparaat instellingen.");
        setIsListening(false);
        return;
      } else {
        console.error("Microfoon error:", error);
        // Bij andere errors, probeer toch door te gaan (misschien werkt SpeechRecognition wel)
        // Maar toon wel een waarschuwing
        console.warn("Microfoon permission check gefaald, maar proberen door te gaan met SpeechRecognition");
      }
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = getTTSLangCode(language); 
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) setInput(prev => (prev ? prev + " " + transcript : transcript));
    };
    recognition.onerror = (event: any) => { 
      console.error("Speech error:", event.error);
      setIsListening(false);
      
      // PERMISSION HANDLING: Toon specifieke error messages
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        alert("Microfoon toegang geweigerd. Geef toegang in de iOS instellingen.");
      } else if (event.error === 'no-speech') {
        // Stil falen bij geen spraak (geen alert)
        console.log("Geen spraak gedetecteerd");
      } else {
        console.error("Speech recognition error:", event.error);
      }
    };
    
    try {
      recognition.start();
    } catch (error) {
      console.error("Failed to start recognition:", error);
      setIsListening(false);
    }
  };

  const handleSmartScan = () => {
    setIsAttachMenuOpen(false)
    const isMobile = window.innerWidth < 1024
    if (isMobile) { cameraInputRef.current?.click() } else { setIsQRModalOpen(true) }
  }

  const handleSimulateUpload = () => { console.log('Simulating upload from phone...'); setIsQRModalOpen(false) }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // IOS CAMERA FIX: Op iOS moet je eerst om camera permission vragen via getUserMedia
    // Dit voorkomt het zwarte beeld probleem
    try {
      // Vraag om camera permission met environment (achtercamera)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment' // CAMERA CONSTRAINTS: Gebruik achtercamera
        } 
      });
      // Stop de stream direct (we gebruiken alleen file input voor de foto)
      stream.getTracks().forEach(track => track.stop());
    } catch (error: any) {
      // PERMISSION HANDLING: Toon nette error message
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert("Geef toegang tot je camera in de iOS instellingen. Ga naar Instellingen > Safari > Camera en zet dit aan.");
        // Reset de file input
        if (cameraInputRef.current) {
          cameraInputRef.current.value = '';
        }
        return;
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        alert("Geen camera gevonden. Controleer je apparaat instellingen.");
        if (cameraInputRef.current) {
          cameraInputRef.current.value = '';
        }
        return;
      } else {
        console.error("Camera error:", error);
        // Probeer toch door te gaan (misschien werkt file input wel)
      }
    }

    // IMAGE COMPRESSION: Comprimeer alle afbeeldingen voordat we ze toevoegen
    try {
      console.log(`[WORKSPACE] Comprimeren van ${files.length} afbeelding(en)...`);
      const compressionPromises: Promise<string>[] = [];
      
      Array.from(files).forEach((file) => {
        compressionPromises.push(compressImage(file));
      });
      
      const compressedResults = await Promise.all(compressionPromises);
      console.log(`[WORKSPACE] ${compressedResults.length} afbeelding(en) gecomprimeerd`);
      
      // Voeg de gecomprimeerde afbeeldingen toe aan de state
      setSelectedImages(prev => [...prev, ...compressedResults]);
      setIsAttachMenuOpen(false);
    } catch (error) {
      console.error("[WORKSPACE] Error comprimeren van afbeeldingen:", error);
      alert("Er is een fout opgetreden bij het verwerken van de foto's. Probeer het opnieuw.");
    }
  };

  const removeImage = (indexToRemove: number) => {
      setSelectedImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleViewChange = (view: 'chat' | 'board') => {
    setMobileView(view);
    if (view === 'board') {
        setHasNewImage(false);
    }
  }

  // Client-side functie om Unsplash visual op te halen
  const fetchAnimaVisual = async (keyword: string, topic: string, userAge: number, activeCoach: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword,
          topic,
          age: userAge,
          coach: activeCoach
        })
      });

      if (response.ok) {
        const { url } = await response.json();
        return url;
      }
      return null;
    } catch (error) {
      console.error('Error fetching visual:', error);
      return null;
    }
  }

  const handleSendMessage = async () => {
    if ((!input.trim() && selectedImages.length === 0) || !sessionId) return;

    // iOS AUDIO UNLOCK: Activeer audio-engine DIRECT tijdens user interaction (klik)
    // Dit moet gebeuren VOORDAT de API call start, zodat iOS de klik als toestemming ziet
    unlockAudioContext();
    unlockSpeechSynthesis();

    let displayContent = input;
    const imagesForMessage = selectedImages.length > 0 ? [...selectedImages] : undefined;
    
    // Als er alleen afbeeldingen zijn (geen tekst), gebruik lege string als content
    if (selectedImages.length > 0 && !input.trim()) {
      displayContent = '';
    }
    
    const userMessage: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: displayContent,
      images: imagesForMessage
    };
    setMessages(prev => [...prev, userMessage]);
    
    // --- OPSLAAN MET HUIDIGE SESSION ID ---
    saveMessageToDb('user', displayContent, sessionId);

    const imagesToSend = [...selectedImages];
    
    setInput('');
    setSelectedImages([]);
    setIsTyping(true);
    
    // Reset board data alleen bij tekstvragen (zonder afbeelding upload)
    // Bij afbeelding upload blijft het board zoals het is (wordt alleen bijgewerkt als AI expliciet visual_keyword geeft)
    if (imagesToSend.length === 0) {
      setBoardData({ url: null, topic: null });
      setHasNewImage(false);
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...messages, userMessage], 
          data: { 
              tutorMode, 
              userAge: age, 
              userLanguage: language,
              images: imagesToSend 
          } 
        }),
      });

      if (!response.ok) throw new Error('API Error');
      if (!response.body) return;

      const aiMessageId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: aiMessageId, role: 'assistant', content: '' }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let fullStreamedResponse = ''; 

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value);
          fullStreamedResponse += chunk;
          setMessages(prev => 
            prev.map(msg => msg.id === aiMessageId ? { ...msg, content: fullStreamedResponse } : msg)
          );
        }
      }

      let finalChatMessage = fullStreamedResponse;
      let visualKeyword: string | null = null;
      let topic: string | null = null;

      // Try to parse JSON response
      try {
        // Extract JSON from response (can be embedded in text with markdown code blocks)
        let jsonText = fullStreamedResponse.trim();
        
        // Try to find JSON object in the response (handle markdown code blocks)
        const jsonMatch = jsonText.match(/```json\s*(\{[\s\S]*?\})\s*```/) || jsonText.match(/```\s*(\{[\s\S]*?\})\s*```/) || jsonText.match(/(\{[\s\S]*?"action"\s*:\s*"update_board"[\s\S]*?\})/);
        
        if (jsonMatch && jsonMatch[1]) {
          jsonText = jsonMatch[1].trim();
        } else if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```\n?/g, '').trim();
        }
        
        const parsed = JSON.parse(jsonText);
        
        if (parsed.message && parsed.visual_keyword && parsed.action === 'update_board') {
          finalChatMessage = parsed.message;
          visualKeyword = parsed.visual_keyword;
          topic = parsed.topic || null;
          
          // Update board ALLEEN als er GEEN afbeelding is geüpload
          // Bij afbeelding upload blijft het board zoals het is (analyse gebeurt wel, maar geen visual update)
          if (imagesToSend.length === 0 && visualKeyword) {
            try {
              const visualResponse = await fetch('/api/visual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  keyword: visualKeyword,
                  topic: topic || visualKeyword,
                  age: age,
                  coach: tutorMode
                })
              });
              
              if (visualResponse.ok) {
                const { url } = await visualResponse.json();
                // Update "Het Bord" met de nieuwe foto URL (Primair: Unsplash API)
                setBoardData({
                  url: url,
                  topic: topic || visualKeyword
                });
                setHasNewImage(true);
              } else {
                // Secundair: Stijlvolle tekst-placeholder (Blueprint V5.3)
                setBoardData({
                  url: null,
                  topic: topic || visualKeyword
                });
                setHasNewImage(true);
              }
            } catch (visualError) {
              console.error('Error fetching visual:', visualError);
              // Secundair: Stijlvolle tekst-placeholder (Blueprint V5.3)
              setBoardData({
                url: null,
                topic: topic || visualKeyword
              });
              setHasNewImage(true);
            }
          }
          
          setMessages(prev => 
            prev.map(msg => msg.id === aiMessageId ? { ...msg, content: finalChatMessage } : msg)
          );
        }
      } catch (e) {
        // Not valid JSON, fallback to old [IMAGE: ...] tag parsing (legacy support)
        const imageMatch = fullStreamedResponse.match(/\[IMAGE:\s*(.*?)\]/);
        
        if (imageMatch && imageMatch[1]) {
          const extractedPrompt = imageMatch[1].trim();
          // Legacy: probeer alsnog via Unsplash API, anders tekst-placeholder
          // Maar ALLEEN als er GEEN afbeelding is geüpload
          if (imagesToSend.length === 0) {
            try {
              const visualResponse = await fetch('/api/visual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  keyword: extractedPrompt,
                  topic: extractedPrompt,
                  age: age,
                  coach: tutorMode
                })
              });
              
              if (visualResponse.ok) {
                const { url } = await visualResponse.json();
                setBoardData({ url: url, topic: extractedPrompt });
              } else {
                setBoardData({ url: null, topic: extractedPrompt });
              }
              setHasNewImage(true);
            } catch (err) {
              setBoardData({ url: null, topic: extractedPrompt });
              setHasNewImage(true);
            }
          }
          
          finalChatMessage = fullStreamedResponse.replace(imageMatch[0], '').trim();
          
          setMessages(prev => 
            prev.map(msg => msg.id === aiMessageId ? { ...msg, content: finalChatMessage } : msg)
          );
        }
      }

      // --- OPSLAAN MET HUIDIGE SESSION ID ---
      saveMessageToDb('assistant', finalChatMessage, sessionId);

      // TEST-TRIGGER: Genereer proef-insight na 3e bericht (gebruiker + AI = 2 berichten, na 3e AI bericht = totaal 6 berichten)
      // Of simpelweg: na elke 3e user message (3 user messages = 6 totaal berichten)
      const totalMessages = [...messages, userMessage, { id: aiMessageId, role: 'assistant' as const, content: finalChatMessage }].length;
      const userMessageCount = [...messages, userMessage].filter(m => m.role === 'user').length;
      
      if (userMessageCount >= 3 && userMessageCount % 3 === 0) {
        console.log(`[INSIGHTS TRIGGER] Generating test insight after ${userMessageCount} user messages...`);
        try {
          const insightResponse = await fetch('/api/insights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: sessionId,
              studentName: studentName, // Voeg student name toe
              userAge: age,
              tutorMode: tutorMode,
              language: language
            })
          });

          if (insightResponse.ok) {
            const result = await insightResponse.json();
            console.log('[INSIGHTS TRIGGER] ✅ Successfully generated insight:', result);
          } else {
            const error = await insightResponse.json();
            console.error('[INSIGHTS TRIGGER] ❌ Error generating insight:', error);
          }
        } catch (error) {
          console.error('[INSIGHTS TRIGGER] ❌ Exception while generating insight:', error);
        }
      }

      if (isVoiceOn) {
        speakText(finalChatMessage);
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Oeps, even geen verbinding.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const isInsideDesktop = attachMenuDesktopRef.current?.contains(target) ?? false
      const isInsideMobile = attachMenuMobileRef.current?.contains(target) ?? false
      if (isAttachMenuOpen && !isInsideDesktop && !isInsideMobile) { setIsAttachMenuOpen(false) }
    }
    if (isAttachMenuOpen) { document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside) }
  }, [isAttachMenuOpen])

  // Loading state
  if (isAuthLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-stone-50">
        <div className="text-stone-600">Laden...</div>
      </div>
    );
  }

  // ROLE-BASED RENDERING: Alleen juiste dashboard tonen op basis van role
  if (userRole === 'parent') {
    return (
      <div className="h-[100dvh] w-screen flex flex-col bg-stone-50 overflow-hidden">
        <ParentDashboard 
          studentName={userProfile?.student_name || 'Rens'} 
          parentName={userProfile?.parent_name || 'Ouder'}
          userProfile={userProfile}
        />
      </div>
    );
  }

  if (userRole === 'teacher') {
    return (
      <div className="h-[100dvh] w-screen flex flex-col bg-stone-50 overflow-hidden">
        <TeacherDashboard userProfile={userProfile} />
      </div>
    );
  }

  // Student view - alleen studenten kunnen de chat interface zien

  const ImagePreviews = () => (
    selectedImages.length > 0 ? (
        <div className="absolute -top-28 left-0 right-0 p-2 mx-2 sm:mx-0">
          <div className="flex gap-2 overflow-x-auto p-2 bg-white rounded-xl border border-stone-200 shadow-lg animate-in slide-in-from-bottom-2 no-scrollbar">
            {selectedImages.map((img, index) => (
              <div key={index} className="relative flex-shrink-0 group">
                <img src={img} alt={`Preview ${index}`} className="h-20 w-20 rounded-lg object-cover border border-stone-100" />
                <button onClick={() => removeImage(index)} className="absolute -top-2 -right-2 bg-stone-800 text-white p-1 rounded-full shadow-md hover:bg-stone-700 hover:scale-110 transition-all"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        </div>
    ) : null
  );

  return (
    <div className="h-[100dvh] w-screen flex flex-col bg-stone-50 fixed inset-0 overflow-hidden">
      <SideMenu 
        isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} 
        studentName={studentName} tutorMode={tutorMode} onTutorModeChange={setTutorMode}
        language={language} onLanguageChange={setLanguage}
        educationLevel={educationLevel} onEducationLevelChange={setEducationLevel}
        onStartNewSession={handleStartNewSession} onLogout={handleLogout}
      />
      <SettingsModal 
        isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}
        tutorMode={tutorMode} onModeChange={setTutorMode}
        age={age} onAgeChange={setAge}
        onStartNewSession={handleStartNewSession}
        onLogout={handleLogout}
      />
      {/* HIGH CONTRAST QR MODAL: Zwart op wit voor iPhone camera */}
      {isQRModalOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100] transition-opacity" 
            onClick={() => setIsQRModalOpen(false)} 
          />
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl border border-stone-300 max-w-md w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-stone-200">
                <h2 className="text-xl font-semibold text-stone-900">Koppel je telefoon</h2>
                <button 
                  onClick={() => setIsQRModalOpen(false)} 
                  className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-50 rounded-xl transition-all duration-200"
                >
                  <X className="w-5 h-5" strokeWidth={2} />
                </button>
              </div>
              
              {/* QR Code Section */}
              <div className="p-6 space-y-6">
                <div className="flex justify-center">
                  {typeof window !== 'undefined' && sessionId ? (
                    <QRCodeDisplay 
                      url={`${window.location.origin}/upload?s=${sessionId}`}
                      size={256}
                    />
                  ) : (
                    <div className="w-64 h-64 bg-stone-100 border-2 border-stone-300 rounded-2xl flex items-center justify-center">
                      <div className="text-stone-400 text-sm">Laden...</div>
                    </div>
                  )}
                </div>
                
                {/* Korte instructie (geen lange URL tekst) */}
                <p className="text-sm text-stone-600 text-center leading-relaxed font-medium">
                  Scan mij met je camera
                </p>
                <p className="text-xs text-stone-500 text-center leading-relaxed">
                  Open je camera app en richt op de code om een foto naar dit scherm te sturen.
                </p>
              </div>
              
              {/* Footer */}
              <div className="p-6 border-t border-stone-200">
                <button 
                  onClick={handleSimulateUpload} 
                  className="w-full py-3 px-4 bg-stone-800 text-white rounded-xl hover:bg-stone-900 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                >
                  <UploadCloud className="w-4 h-4" />
                  Simuleer Upload
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* STICKY ZONES: Header - flex-none z-50 relative (mag niet krimpen) */}
      <div className="lg:hidden flex-none z-50 relative">
        <MobileHeader 
          activeView={mobileView} 
          onViewChange={handleViewChange} 
          animaName={animaName}
          onMenuClick={() => setIsMenuOpen(true)}
          tutorMode={tutorMode}
          hasNewImage={hasNewImage} 
        />
      </div>

      {/* STICKY ZONES: Chat Area - flex-1 overflow-y-auto overscroll-contain (alleen dit stuk mag scrollen) */}
      <main className="lg:hidden flex-1 overflow-y-auto overscroll-contain bg-stone-50" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="p-4 md:p-8">
          {mobileView === 'chat' ? (
            <ChatColumn messages={messages} isTyping={isTyping} />
          ) : (
            <BoardColumn imageUrl={boardData.url} topic={boardData.topic} />
          )}
        </div>
      </main>

      <div className="hidden lg:flex lg:flex-1 lg:min-h-0 lg:overflow-hidden relative">
        <div className="hidden lg:flex absolute top-4 left-4 z-40"><button onClick={() => setIsSettingsOpen(true)} className="p-3 bg-white/80 backdrop-blur-md border border-stone-200 shadow-sm rounded-full hover:bg-white hover:shadow-md transition-all text-stone-600 hover:text-stone-800"><Menu className="w-6 h-6" /></button></div>
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 min-h-0 flex flex-col bg-stone-50 overflow-hidden">
            <div className="flex-1 grid grid-cols-2 gap-8 p-8 max-w-7xl mx-auto w-full min-h-0">
              <ChatColumn messages={messages} isTyping={isTyping} />
              <BoardColumn imageUrl={boardData.url} topic={boardData.topic} />
            </div>

            <div className="bg-gradient-to-t from-white/95 to-white/80 backdrop-blur-sm px-8 py-6">
              <div className="max-w-4xl mx-auto w-full relative">
                <ImagePreviews />
                <InputDock 
                    input={input} setInput={setInput} onSend={handleSendMessage} onAttachClick={handleAttachClick} onMicClick={handleMicClick} isListening={isListening} isVoiceOn={isVoiceOn} onVoiceToggle={() => { unlockAudioContext(); unlockSpeechSynthesis(); setIsVoiceOn(!isVoiceOn); }} 
                    hasAttachment={selectedImages.length > 0} 
                />
                {isAttachMenuOpen && (
                  <div ref={attachMenuDesktopRef} className="absolute bottom-14 left-0 bg-white rounded-2xl shadow-xl border border-stone-100 p-2 w-64 z-50 flex flex-col gap-1 animate-in slide-in-from-bottom-2 fade-in">
                    <button onClick={() => cameraInputRef.current?.click()} className="flex items-center gap-3 p-3 hover:bg-stone-50 rounded-xl text-left transition-colors text-stone-700 text-sm font-medium"><ImageIcon className="w-5 h-5 text-stone-600" strokeWidth={2} /><span>Foto of Bestand</span></button>
                    <button onClick={() => cameraInputRef.current?.click()} className="flex items-center gap-3 p-3 hover:bg-stone-50 rounded-xl text-left transition-colors text-stone-700 text-sm font-medium"><Camera className="w-5 h-5 text-stone-600" strokeWidth={2} /><span>Webcam gebruiken</span></button>
                    <button onClick={handleSmartScan} className="flex items-center gap-3 p-3 hover:bg-stone-50 rounded-xl text-left transition-colors text-stone-700 text-sm font-medium"><Smartphone className="w-5 h-5 text-stone-600" strokeWidth={2} /><div className="flex flex-col"><span>Scan met Telefoon</span><span className="text-xs text-stone-500 font-normal">Gebruik je mobiel als camera</span></div></button>
                  </div>
                )}
              </div>
            </div>

          </main>
        </div>
      </div>

      {/* STICKY ZONES: Input Dock - flex-none z-50 pb-[env(safe-area-inset-bottom)] (blijft vast op de bodem) */}
      <div className="lg:hidden flex-none z-50 px-4 bg-stone-50" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="relative">
           <ImagePreviews />
          <InputDock input={input} setInput={setInput} onSend={handleSendMessage} onAttachClick={handleAttachClick} onMicClick={handleMicClick} isListening={isListening} isVoiceOn={isVoiceOn} onVoiceToggle={() => { unlockAudioContext(); unlockSpeechSynthesis(); setIsVoiceOn(!isVoiceOn); }} hasAttachment={selectedImages.length > 0} />
          {isAttachMenuOpen && (
            <div ref={attachMenuMobileRef} className="absolute bottom-14 left-4 bg-white rounded-2xl shadow-xl border border-stone-100 p-2 w-64 z-50 flex flex-col gap-1 animate-in slide-in-from-bottom-2 fade-in">
              <button onClick={() => cameraInputRef.current?.click()} className="flex items-center gap-3 p-3 hover:bg-stone-50 rounded-xl text-left transition-colors text-stone-700 text-sm font-medium"><ImageIcon className="w-5 h-5 text-stone-600" strokeWidth={2} /><span>Foto of Bestand</span></button>
              <button onClick={() => cameraInputRef.current?.click()} className="flex items-center gap-3 p-3 hover:bg-stone-50 rounded-xl text-left transition-colors text-stone-700 text-sm font-medium"><Camera className="w-5 h-5 text-stone-600" strokeWidth={2} /><span>Webcam gebruiken</span></button>
              <button onClick={handleSmartScan} className="flex items-center gap-3 p-3 hover:bg-stone-50 rounded-xl text-left transition-colors text-stone-700 text-sm font-medium"><Smartphone className="w-5 h-5 text-stone-600" strokeWidth={2} /><div className="flex flex-col"><span>Scan met Telefoon</span><span className="text-xs text-stone-500 font-normal">Gebruik je mobiel als camera</span></div></button>
            </div>
          )}
        </div>
      </div>
      {/* IOS CAMERA FIX: capture="environment" voor achtercamera, en voeg ook capture="user" fallback toe */}
      <input 
        type="file" 
        accept="image/*" 
        capture="environment"
        multiple 
        className="hidden" 
        ref={cameraInputRef} 
        onChange={handleFileSelect}
        // IOS FIX: Voeg webkitdirectory toe voor betere iOS support (niet nodig maar helpt soms)
      />
    </div>
  )
}
