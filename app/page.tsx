// @ts-nocheck
'use client';

import { useState, useRef, useEffect } from 'react';
import { Home, Settings, Send, Sparkles, ArrowRight, ArrowLeft, Volume2, Square, Mic, MicOff, MessageSquare, Menu, X, Camera, Lightbulb, Trash2, Heart, GraduationCap, Loader2, Pencil, MessageCircle, Presentation, Paperclip } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { getOrCreateUserId } from '@/lib/userId';
import { supabaseClient, testSupabaseConnection } from '@/lib/supabaseClient';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface UserProfile {
  naam: string;
  groep: string;
  taal: string;
  botNaam: string;
}

const talen = [
  { code: 'nl', naam: 'Nederlands', emoji: '🇳🇱' },
  { code: 'en', naam: 'English', emoji: '🇬🇧' },
  { code: 'es', naam: 'Español', emoji: '🇪🇸' },
  { code: 'fr', naam: 'Français', emoji: '🇫🇷' },
  { code: 'de', naam: 'Deutsch', emoji: '🇩🇪' },
];

// Global student levels
const studentLevels = [
  { value: 'Level 1', label: 'Level 1', category: 'Primary' },
  { value: 'Level 2', label: 'Level 2', category: 'Primary' },
  { value: 'Level 3', label: 'Level 3', category: 'Primary' },
  { value: 'Level 4', label: 'Level 4', category: 'Primary' },
  { value: 'Level 5', label: 'Level 5', category: 'Primary' },
  { value: 'Level 6', label: 'Level 6', category: 'Primary' },
  { value: 'Level 7', label: 'Level 7', category: 'Secondary' },
  { value: 'Level 8', label: 'Level 8', category: 'Secondary' },
  { value: 'Level 9', label: 'Level 9', category: 'Secondary' },
  { value: 'Level 10', label: 'Level 10', category: 'Senior' },
  { value: 'Level 11', label: 'Level 11', category: 'Senior' },
  { value: 'Level 12', label: 'Level 12', category: 'Senior' },
];

// Helper function to detect visual content
const hasVisualContent = (content: string): boolean => {
  // Check for markdown images
  const hasImage = /!\[.*?\]\(.*?\)/.test(content);
  // Check for code blocks
  const hasCodeBlock = /```[\s\S]*?```/.test(content);
  return hasImage || hasCodeBlock;
};

// Helper function to extract visual content
const extractVisualContent = (content: string): string | null => {
  // Extract code blocks
  const codeBlockMatch = content.match(/```[\w]*\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    return `\`\`\`text\n${codeBlockMatch[1]}\`\`\``;
  }
  // Extract images
  const imageMatch = content.match(/!\[.*?\]\(.*?\)/);
  if (imageMatch) {
    return imageMatch[0];
  }
  return null;
};

export default function AnimaPage() {
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    naam: '',
    groep: '',
    taal: 'nl',
    botNaam: 'Anima',
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'chat' | 'stage'>('chat');
  const [hasNewContent, setHasNewContent] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showVisionModal, setShowVisionModal] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [boardContent, setBoardContent] = useState<{ url: string; type: 'image'; fallbackUrl?: string } | null>(null);
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);
  const [useFallback, setUseFallback] = useState<boolean>(false);
  const [userId, setUserId] = useState<string>('');
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'chat' | 'parent-dashboard' | 'teacher-dashboard'>('chat');
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [studentLevel, setStudentLevel] = useState<string>('Level 4');
  const [showLevelSelector, setShowLevelSelector] = useState(false);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(false);
  const [dashboardData, setDashboardData] = useState<{
    averageSessionMinutes: number;
    sessionsThisWeek: number;
    topics: string[];
    hasData: boolean;
  }>({
    averageSessionMinutes: 0,
    sessionsThisWeek: 0,
    topics: [],
    hasData: false,
  });
  const [stats, setStats] = useState<{
    topics: { [key: string]: number };
    sentiments: { [key: string]: number };
    total: number;
  }>({
    topics: {},
    sentiments: {},
    total: 0,
  });
  const levelSelectorRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // For gallery upload (Paperclip)
  const cameraInputRef = useRef<HTMLInputElement>(null); // For camera capture

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-switch to stage tab when visual content arrives or image is selected
  useEffect(() => {
    if (activeView !== 'chat') return; // Don't auto-switch when viewing dashboards
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant' && hasVisualContent(lastMessage.content)) {
      setActiveMobileTab('stage');
    }
    // Don't auto-switch to stage when image is selected - stay in chat view (WhatsApp style)
  }, [messages, activeView]);

  // Auto-switch to chat when user starts typing
  useEffect(() => {
    if (input.trim() && activeMobileTab === 'stage') {
      setActiveMobileTab('chat');
    }
  }, [input, activeMobileTab]);

  // Initialize userId, currentLevel, and test Supabase connection on mount
  useEffect(() => {
    const id = getOrCreateUserId();
    setUserId(id);
    
    // Test Supabase connection first (silent - no errors thrown)
    testSupabaseConnection().then((connected) => {
      setIsSupabaseConnected(connected);
      if (connected) {
        // Test database connection by sending a test message
        if (id) {
          testDatabaseConnection(id);
          // If connected, try to load currentLevel from Supabase first (priority)
          loadLevelFromSupabase(id).then((levelLoaded) => {
            // If Supabase load failed, fall back to localStorage
            if (!levelLoaded) {
              const savedLevel = localStorage.getItem('anima_current_level');
    if (savedLevel) {
                const levelNum = parseInt(savedLevel, 10);
                if (levelNum >= 1 && levelNum <= 12) {
                  setCurrentLevel(levelNum);
                  setStudentLevel(`Level ${levelNum}`);
                }
              }
            }
          });
        }
      } else {
        // Fallback to localStorage if Supabase not connected
        const savedLevel = localStorage.getItem('anima_current_level');
        if (savedLevel) {
          const levelNum = parseInt(savedLevel, 10);
          if (levelNum >= 1 && levelNum <= 12) {
            setCurrentLevel(levelNum);
            setStudentLevel(`Level ${levelNum}`);
          }
        }
      }
    }).catch(() => {
      // Silent failure - app continues in offline mode with localStorage
      setIsSupabaseConnected(false);
      const savedLevel = localStorage.getItem('anima_current_level');
      if (savedLevel) {
        const levelNum = parseInt(savedLevel, 10);
        if (levelNum >= 1 && levelNum <= 12) {
          setCurrentLevel(levelNum);
          setStudentLevel(`Level ${levelNum}`);
        }
      }
    });
  }, []);

  // Test database connection by sending a test message to chats table
  const testDatabaseConnection = async (userId: string): Promise<void> => {
    try {
      // Send a test message to the chats table
      const { error } = await supabaseClient
        .from('chats')
        .insert({
          user_id: userId,
          message_text: '[Anima Cloud Sync Test]',
          is_ai: false,
        });
      
      // Silent success - no logging needed for production
    } catch {
      // Silent failure - test fails silently, app continues
    }
  };

  // Load currentLevel from Supabase (silent - no errors thrown)
  // Returns true if level was loaded from Supabase, false otherwise
  const loadLevelFromSupabase = async (userId: string): Promise<boolean> => {
    try {
      // Use profiles table with user_id (new schema)
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('current_level')
        .eq('user_id', userId)
        .single();
      
      if (!error && data?.current_level) {
        const levelNum = parseInt(data.current_level.toString(), 10);
        if (levelNum >= 1 && levelNum <= 12) {
          setCurrentLevel(levelNum);
          setStudentLevel(`Level ${levelNum}`);
          return true;
        }
      }
    } catch {
      // Silent failure - return false to trigger localStorage fallback
    }
    return false;
  };

  // Save currentLevel to localStorage and Supabase when it changes
  useEffect(() => {
    localStorage.setItem('anima_current_level', currentLevel.toString());
    setStudentLevel(`Level ${currentLevel}`);
    
    // Save to Supabase if connected (silent - no errors thrown)
    if (isSupabaseConnected && userId) {
      saveLevelToSupabase(userId, currentLevel);
    }
  }, [currentLevel, isSupabaseConnected, userId]);

  // Save currentLevel to Supabase (silent - no errors thrown)
  const saveLevelToSupabase = async (userId: string, level: number) => {
    try {
      // Use profiles table with user_id (new schema)
      await supabaseClient
        .from('profiles')
        .upsert({
          user_id: userId,
          current_level: level,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });
    } catch {
      // Silent failure - localStorage backup is still available
    }
  };

  // Classify message topic based on keywords
  const classifyTopic = (messageText: string): string => {
    const text = messageText.toLowerCase();
    
    // Wiskunde keywords
    const wiskundeKeywords = ["breuk", "pizza", "rekenen", "som", "getal", "keer", "deel", "plus", "min", "vierkant", "cirkel"];
    if (wiskundeKeywords.some(keyword => text.includes(keyword))) {
      return "Wiskunde";
    }
    
    // Biologie keywords
    const biologieKeywords = ["hart", "lichaam", "bloed", "dier", "plant", "natuur", "groeien", "eten"];
    if (biologieKeywords.some(keyword => text.includes(keyword))) {
      return "Biologie";
    }
    
    // Heelal/Aardrijkskunde keywords
    const heelalKeywords = ["zon", "maan", "ster", "planeet", "aarde", "land", "stad", "wereld", "kaart"];
    if (heelalKeywords.some(keyword => text.includes(keyword))) {
      return "Heelal";
    }
    
    // Filosofie/Denken keywords
    const filosofieKeywords = ["waarom", "hoezo", "denken", "bestaan", "god", "dood", "leven", "eerlijk", "ziel"];
    if (filosofieKeywords.some(keyword => text.includes(keyword))) {
      return "Filosofie";
    }
    
    // Geschiedenis keywords
    const geschiedenisKeywords = ["vroeger", "ridder", "oorlog", "tijd", "koning", "jaar", "oud"];
    if (geschiedenisKeywords.some(keyword => text.includes(keyword))) {
      return "Geschiedenis";
    }
    
    // Taal keywords
    const taalKeywords = ["spellen", "woord", "letter", "zin", "lezen", "schrijven", "boek"];
    if (taalKeywords.some(keyword => text.includes(keyword))) {
      return "Taal";
    }
    
    // Default fallback
    return "Algemeen";
  };

  // Save chat message to Supabase (silent - no errors thrown)
  const saveChatMessageToSupabase = async (userId: string, messageText: string, isAi: boolean, boardUrl?: string) => {
    try {
      if (!isSupabaseConnected) {
        return; // Skip if not connected
      }
      
      // Classify topic and sentiment
      const text = messageText.toLowerCase();
      const topic = classifyTopic(messageText);
      const sentiment = text.includes("stom") || text.includes("niet") || text.includes("moeilijk") || text.includes(":(") ? "Gefrustreerd" :
                       text.includes("leuk") || text.includes("goed") || text.includes("snap") || text.includes(":)") ? "Blij" : "Neutraal";
      
      // Data sanity check - ensure values are valid strings
      const dbTopic = (topic && typeof topic === 'string') ? topic : "Algemeen";
      const dbSentiment = (sentiment && typeof sentiment === 'string') ? sentiment : "Neutraal";
      const dbUser = userId ? userId : "anonymous_user";
      
      // Build safe payload with all required fields
      const payload: any = {
        user_id: dbUser,
        message_text: messageText || "",
        is_ai: isAi || false,
        topic: dbTopic,
        sentiment: dbSentiment,
        created_at: new Date().toISOString(),
      };
      if (boardUrl) {
        payload.board_url = boardUrl;
      }
      
      // Debug logging with JSON.stringify for better visibility
      console.log("Payload being sent:", JSON.stringify(payload, null, 2));
      
      // Insert with 'as any' cast and .select() for better error handling
      const { data, error } = await supabaseClient
        .from('chats')
        .insert([payload as any])
        .select();
      
      if (error) {
        console.error('FULL SUPABASE ERROR:', JSON.stringify(error, null, 2));
      }
    } catch (error) {
      // Silent failure - chat continues without saving (console.error for debugging only)
      console.error('Fout bij opslaan naar Supabase (stil afgehandeld):', error);
    }
  };

  // Classify message to extract topic and sentiment
  const classifyMessage = (text: string): { topic: string; sentiment: string } => {
    const lowerText = text.toLowerCase();
    
    // Topic classification
    let topic = 'Algemeen';
    if (lowerText.includes('breuk') || lowerText.includes('pizza') || lowerText.includes('rekenen') || 
        lowerText.includes('som') || lowerText.includes('getal') || lowerText.includes('deel') ||
        lowerText.includes('optellen') || lowerText.includes('aftrekken') || lowerText.includes('vermenigvuldigen') ||
        lowerText.includes('delen') || lowerText.includes('staartdeling')) {
      topic = 'Wiskunde';
    } else if (lowerText.includes('hart') || lowerText.includes('bloed') || lowerText.includes('lichaam') ||
               lowerText.includes('spier') || lowerText.includes('bot') || lowerText.includes('organen') ||
               lowerText.includes('hersenen') || lowerText.includes('longen')) {
      topic = 'Biologie';
    } else if (lowerText.includes('zon') || lowerText.includes('maan') || lowerText.includes('planeet') ||
               lowerText.includes('ster') || lowerText.includes('zonnestelsel') || lowerText.includes('ruimte') ||
               lowerText.includes('aarde') || lowerText.includes('mars')) {
      topic = 'Heelal';
    }
    
    // Sentiment classification
    let sentiment = 'Neutraal';
    if (lowerText.includes(':)') || lowerText.includes('leuk') || lowerText.includes('goed') ||
        lowerText.includes('snap') || lowerText.includes('dank') || lowerText.includes('geweldig') ||
        lowerText.includes('mooi') || lowerText.includes('cool') || lowerText.includes('top')) {
      sentiment = 'Blij';
    } else if (lowerText.includes(':(') || lowerText.includes('stom') || lowerText.includes('snap niet') ||
               lowerText.includes('moeilijk') || lowerText.includes('help') || lowerText.includes('niet begrijp') ||
               lowerText.includes('vervelend') || lowerText.includes('lastig')) {
      sentiment = 'Gefrustreerd';
    }
    
    return { topic, sentiment };
  };

  // Fallback URLs voor wanneer Pollinations faalt
  const getFallbackUrl = (keyword: string): string => {
    const lowerKeyword = keyword.toLowerCase();
    if (lowerKeyword.includes('pizza') || lowerKeyword.includes('breuk') || lowerKeyword.includes('stuk') || lowerKeyword.includes('taart')) {
      return "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80";
    }
    if (lowerKeyword.includes('hart') || lowerKeyword.includes('bloed')) {
      return "https://images.unsplash.com/photo-1559757131-40878c426213?auto=format&fit=crop&w=800&q=80";
    }
    if (lowerKeyword.includes('zon') || lowerKeyword.includes('planeet') || lowerKeyword.includes('zonnestelsel')) {
      return "https://images.unsplash.com/photo-1614730341194-75c60740a2d3?auto=format&fit=crop&w=800&q=80";
    }
    if (lowerKeyword.includes('huis') || lowerKeyword.includes('gebouw') || lowerKeyword.includes('kasteel')) {
      return "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=800&q=80";
    }
    return "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80"; // Generic fallback
  };

  // Generate dynamic image URL using Pollinations.ai
  const generateDynamicImage = (keyword: string, contextText: string): { url: string; fallbackUrl: string } | null => {
    const lowerText = contextText.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    
    // Extract numbers from context text
    const numberMatch = contextText.match(/\d+/);
    const number = numberMatch ? parseInt(numberMatch[0], 10) : null;
    
    let prompt = '';
    
    // Pizza/Taart scenario
    if (lowerKeyword.includes('pizza') || lowerKeyword.includes('breuk') || lowerKeyword.includes('stuk') || lowerKeyword.includes('taart')) {
      if (number && number > 0 && number <= 12) {
        prompt = `pizza cut into ${number} slices, top view, white background`;
      } else {
        prompt = 'pizza top view, white background';
      }
    }
    // Hart/Biologie scenario
    else if (lowerKeyword.includes('hart') || lowerKeyword.includes('bloed')) {
      prompt = 'anatomical heart diagram, white background';
    }
    // Zonnestelsel scenario
    else if (lowerKeyword.includes('zon') || lowerKeyword.includes('planeet') || lowerKeyword.includes('zonnestelsel')) {
      prompt = 'solar system planets, white background';
    }
    // Huis/Gebouw/Kasteel scenario
    else if (lowerKeyword.includes('huis') || lowerKeyword.includes('gebouw') || lowerKeyword.includes('kasteel')) {
      prompt = 'house building architecture, white background';
    }
    else {
      return null;
    }
    
    // Construct Pollinations.ai URL with proper encoding, random seed, and model
    const seed = Math.floor(Math.random() * 100000);
    const url = "https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt) + "?width=800&height=600&nologo=true&seed=" + seed + "&model=turbo";
    const fallbackUrl = getFallbackUrl(keyword);
    return { url, fallbackUrl };
  };

  // Scan text for keywords and return corresponding board image URL
  const scanForBoardContent = (text: string): { url: string; fallbackUrl: string } | null => {
    const lowerText = text.toLowerCase();
    
    // Determine keyword category
    if (lowerText.includes('pizza') || lowerText.includes('breuk') || lowerText.includes('stuk') || lowerText.includes('taart')) {
      return generateDynamicImage('pizza', text);
    }
    
    if (lowerText.includes('hart') || lowerText.includes('bloed')) {
      return generateDynamicImage('hart', text);
    }
    
    if (lowerText.includes('zon') || lowerText.includes('planeet') || lowerText.includes('zonnestelsel')) {
      return generateDynamicImage('zon', text);
    }
    
    if (lowerText.includes('huis') || lowerText.includes('gebouw') || lowerText.includes('kasteel')) {
      return generateDynamicImage('huis', text);
    }
    
    return null;
  };

  // Extract topics from message text
  const extractTopics = (messageText: string): string[] => {
    const topicKeywords: { [key: string]: string } = {
      'menselijk hart': 'Menselijk Hart',
      'hart': 'Menselijk Hart',
      'planeten': 'Planeten',
      'zonnestelsel': 'Planeten',
      'breuken': 'Breuken',
      'vermenigvuldigen': 'Vermenigvuldigen',
      'optellen': 'Optellen & Aftrekken',
      'aftrekken': 'Optellen & Aftrekken',
      'staartdelingen': 'Staartdelingen',
      'delen': 'Staartdelingen',
      'meetkunde': 'Meetkunde',
      'grafieken': 'Grafieken lezen',
      'fotosynthese': 'Fotosynthese',
      'dieren': 'Dieren',
      'geschiedenis': 'Geschiedenis',
      'taal': 'Taal',
    };

    const foundTopics: string[] = [];
    const lowerText = messageText.toLowerCase();

    for (const [keyword, topic] of Object.entries(topicKeywords)) {
      if (lowerText.includes(keyword) && !foundTopics.includes(topic)) {
        foundTopics.push(topic);
      }
    }

    return foundTopics;
  };

  // Fetch dashboard data from Supabase
  const fetchDashboardData = async (userId: string) => {
    try {
      if (!isSupabaseConnected) {
        setDashboardData({
          averageSessionMinutes: 0,
          sessionsThisWeek: 0,
          topics: [],
          hasData: false,
        });
        return;
      }

      // Get all messages for this user
      const { data: messages, error } = await supabaseClient
        .from('chats')
        .select('created_at, message_text')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error || !messages || messages.length === 0) {
        setDashboardData({
          averageSessionMinutes: 0,
          sessionsThisWeek: 0,
          topics: [],
          hasData: false,
        });
        return;
      }

      // Calculate unique days with chat activity (sessions)
      const uniqueDays = new Set<string>();
      messages.forEach(msg => {
        const msgDate = new Date(msg.created_at);
        const dayKey = msgDate.toISOString().split('T')[0]; // YYYY-MM-DD
        uniqueDays.add(dayKey);
      });
      const sessionsCount = uniqueDays.size;

      // Calculate focus time: total number of messages * 2 minutes
      const messageCount = messages.length;
      const averageSessionMinutes = messageCount * 2;

      // Extract topics from all messages
      const allTopics = new Set<string>();
      messages.forEach(msg => {
        const topics = extractTopics(msg.message_text);
        topics.forEach(topic => allTopics.add(topic));
      });

      setDashboardData({
        averageSessionMinutes,
        sessionsThisWeek: sessionsCount,
        topics: Array.from(allTopics),
        hasData: true,
      });
    } catch (error) {
      // Silent failure - show empty state (console.error for debugging only)
      console.error('Fout bij ophalen dashboard data (stil afgehandeld):', error);
      setDashboardData({
        averageSessionMinutes: 0,
        sessionsThisWeek: 0,
        topics: [],
        hasData: false,
      });
    }
  };

  // Fetch dashboard stats from Supabase (topic and sentiment counts)
  const fetchDashboardStats = async (userId: string) => {
    try {
      if (!isSupabaseConnected) {
        setStats({ topics: {}, sentiments: {}, total: 0 });
        return;
      }

      // Get topic and sentiment data from chats table
      const { data: messages, error } = await supabaseClient
        .from('chats')
        .select('topic, sentiment')
        .eq('user_id', userId);

      if (error || !messages || messages.length === 0) {
        setStats({ topics: {}, sentiments: {}, total: 0 });
        return;
      }

      // Count topics and sentiments
      const topicCounts: { [key: string]: number } = {};
      const sentimentCounts: { [key: string]: number } = {};

      messages.forEach(msg => {
        // Count topics (filter NULL values as "Onbekend")
        const topic = msg.topic || 'Onbekend';
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;

        // Count sentiments (filter NULL values as "Onbekend")
        const sentiment = msg.sentiment || 'Onbekend';
        sentimentCounts[sentiment] = (sentimentCounts[sentiment] || 0) + 1;
      });

      setStats({
        topics: topicCounts,
        sentiments: sentimentCounts,
        total: messages.length,
      });
    } catch (error) {
      // Silent failure - show empty state (console.error for debugging only)
      console.error('Fout bij ophalen dashboard stats (stil afgehandeld):', error);
      setStats({ topics: {}, sentiments: {}, total: 0 });
    }
  };

  // Fetch dashboard data when parent dashboard is opened
  useEffect(() => {
    if (activeView === 'parent-dashboard' && userId) {
      fetchDashboardData(userId);
      fetchDashboardStats(userId);
    }
  }, [activeView, userId, isSupabaseConnected]);

  // Close level selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (levelSelectorRef.current && !levelSelectorRef.current.contains(event.target as Node)) {
        setShowLevelSelector(false);
      }
    };

    if (showLevelSelector) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showLevelSelector]);

  // Load profile from localStorage and load latest chat on mount
  useEffect(() => {
    const savedProfile = localStorage.getItem('anima_profile');
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile) as UserProfile;
        setUserProfile(profile);
        setOnboardingStep(4); // Skip to chat
      } catch (error) {
        console.error('Error loading profile from localStorage:', error);
      }
    }
  }, []);

  // Load latest chat and messages when userId and profile are ready
  useEffect(() => {
    if (!userId || onboardingStep < 4) return;

    const loadLatestChat = async () => {
      try {
        // Load latest chat
        try {
        const chatsResponse = await fetch(`/api/chats?userId=${userId}`);
        if (!chatsResponse.ok) {
            // Silently handle failure - no backend available yet
          return;
        }

        const chatsData = await chatsResponse.json();
        const chats = chatsData.chats || [];

        if (chats.length > 0) {
          const latestChat = chats[0];
          setCurrentChatId(latestChat.id);

          // Load messages for this chat
            try {
          const messagesResponse = await fetch(`/api/chats/${latestChat.id}/messages`);
          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json();
            const loadedMessages = messagesData.messages || [];
            
            // Convert database format to Message format
            const formattedMessages: Message[] = loadedMessages.map((msg: any) => ({
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
            }));

            if (formattedMessages.length > 0) {
              setMessages(formattedMessages);
            }
              }
            } catch (error) {
              // Silently handle message loading errors
          }
        }
      } catch (error) {
          // Silently handle fetch errors - backend may not be available
        }
      } catch (error) {
        // Silently handle any other errors
      }
    };

    loadLatestChat();
  }, [userId, onboardingStep]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const speakMessage = (text: string, messageIndex: number) => {
    if (!window.speechSynthesis) {
      console.warn('Speech synthesis not supported');
      return;
    }

    // Stop any current speech
    window.speechSynthesis.cancel();
    setSpeakingId(null);

    // If clicking on the same message that's speaking, just stop it
    if (speakingId === messageIndex) {
      setSpeakingId(null);
      return;
    }

    // Clean text for speech: remove emojis and markdown
    let cleanText = text;
    
    // Remove emojis (various unicode ranges)
    cleanText = cleanText
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags (iOS)
      .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
      .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols and Pictographs
      .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
      .replace(/[\u{1FA70}-\u{1FAFF}]/gu, ''); // Symbols and Pictographs Extended-A
    
    // Remove markdown formatting
    cleanText = cleanText
      .replace(/\*\*(.*?)\*\*/g, '$1')      // Bold
      .replace(/\*(.*?)\*/g, '$1')          // Italic
      .replace(/`(.*?)`/g, '$1')            // Inline code
      .replace(/```[\s\S]*?```/g, '')       // Code blocks
      .replace(/^#{1,6}\s+/gm, '')          // Headers
      .replace(/^\*\s+/gm, '')              // Unordered list
      .replace(/^\d+\.\s+/gm, '')           // Ordered list
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // Links
    
    // Clean up extra whitespace
    cleanText = cleanText.replace(/\s+/g, ' ').trim();

    // Map taal codes to speech synthesis language codes
    const taalMap: { [key: string]: string } = {
      nl: 'nl-NL',
      en: 'en-GB',
      es: 'es-ES',
      fr: 'fr-FR',
      de: 'de-DE',
    };

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = taalMap[userProfile.taal] || 'nl-NL';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => {
      setSpeakingId(null);
      utteranceRef.current = null;
    };

    utterance.onerror = () => {
      setSpeakingId(null);
      utteranceRef.current = null;
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setSpeakingId(messageIndex);
  };

  const handleSend = async () => {
    if ((!input.trim() && !currentImage) || isLoading || !userId) return;

    const userMessage = input.trim() || (currentImage ? 'Wat zie je op deze foto?' : '');
    const imageUrlToSend = currentImage;
    setInput('');
    setCurrentImage(null); // Clear image after sending
    const newUserMessage = { role: 'user' as const, content: userMessage };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    // Scan user message for board content keywords
    const userBoardData = scanForBoardContent(userMessage);
    if (userBoardData) {
      setImageLoading(true);
      setImageError(false);
      setUseFallback(false);
      setBoardContent({ url: userBoardData.url, fallbackUrl: userBoardData.fallbackUrl, type: 'image' });
      
      // Trigger notification if not on board tab
      if (activeMobileTab !== 'stage') {
        setHasNewContent(true);
      }
      
      // Timeout fallback: zet loading op false na 10 seconden
      setTimeout(() => {
        setImageLoading(false);
      }, 10000);
    }

    // Harde aanroep naar saveChatMessageToSupabase direct na setMessages
    saveChatMessageToSupabase(userId, userMessage, false, userBoardData?.url || undefined).then(() => {
      // Refresh dashboard data if parent dashboard is active
      if (activeView === 'parent-dashboard') {
        fetchDashboardData(userId);
      }
    });

    try {
      // Send to chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          history: updatedMessages,
          userProfile: userProfile,
          studentLevel: studentLevel,
          currentLevel: currentLevel,
          imageUrl: imageUrlToSend || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      const assistantMessage = { role: 'assistant' as const, content: data.response };
      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);

      // Scan AI response for board content keywords
      const aiBoardData = scanForBoardContent(data.response);
      if (aiBoardData) {
        setImageLoading(true);
        setImageError(false);
        setUseFallback(false);
        setBoardContent({ url: aiBoardData.url, fallbackUrl: aiBoardData.fallbackUrl, type: 'image' });
        
        // Trigger notification if not on board tab
        if (activeMobileTab !== 'stage') {
          setHasNewContent(true);
        }
        
        // Timeout fallback: zet loading op false na 10 seconden
        setTimeout(() => {
          setImageLoading(false);
        }, 10000);
      }

      // Extract board URL if message contains visual content (legacy support)
      let boardUrl: string | undefined = aiBoardData?.url || undefined;
      if (!boardUrl && hasVisualContent(data.response)) {
        const extractedUrl = extractVisualContent(data.response);
        if (extractedUrl) {
          boardUrl = extractedUrl;
          setBoardContent({ url: extractedUrl, type: 'image' });
          
          // Trigger notification if not on board tab
          if (activeMobileTab !== 'stage') {
            setHasNewContent(true);
          }
        }
      }

      // Save assistant message to Supabase immediately (silent - no errors thrown)
      await saveChatMessageToSupabase(userId, data.response, true, boardUrl);

      // Refresh dashboard data if parent dashboard is active
      if (activeView === 'parent-dashboard') {
        fetchDashboardData(userId);
      }

      // Also save to old API endpoint for backward compatibility (silent - no errors thrown)
      try {
        const saveResponse = await fetch('/api/chats', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userId,
            chatId: currentChatId,
            messages: finalMessages,
          }),
        });

        if (saveResponse.ok) {
          const saveData = await saveResponse.json();
          if (saveData.chatId && !currentChatId) {
            setCurrentChatId(saveData.chatId);
          }
        }
      } catch {
        // Silent failure - chat continues without saving to old endpoint
      }
    } catch (error) {
      // Silently handle error - user can continue chatting
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, er is een fout opgetreden. Probeer het opnieuw.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleListening = () => {
    // Type declarations for SpeechRecognition
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported');
      alert('Speech recognition wordt niet ondersteund in deze browser.');
      return;
    }

    if (isListening) {
      // Stop listening
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    // Start listening
    const recognition = new SpeechRecognition();
    
    // Map taal codes to SpeechRecognition language codes
    const taalMap: { [key: string]: string } = {
      nl: 'nl-NL',
      en: 'en-GB',
      es: 'es-ES',
      fr: 'fr-FR',
      de: 'de-DE',
    };

    recognition.lang = taalMap[userProfile.taal] || 'nl-NL';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(' ');
      setInput((prev) => (prev ? prev + ' ' + transcript : transcript));
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const nextStep = () => {
    if (onboardingStep < 3) {
      setOnboardingStep(onboardingStep + 1);
    }
  };

  const prevStep = () => {
    if (onboardingStep > 0) {
      setOnboardingStep(onboardingStep - 1);
    }
  };

  const finishOnboarding = async () => {
    // Save profile to localStorage
    localStorage.setItem('anima_profile', JSON.stringify(userProfile));
    
    // Save/update user profile in Supabase (optional, voor toekomstige uitbreidingen)
    if (userId) {
      try {
        // This would create/update user profile in Supabase
        // For now, we'll just save to localStorage
        // In the future, you can add an API endpoint for this
      } catch (error) {
        console.error('Error saving profile to Supabase:', error);
      }
    }
    
    setOnboardingStep(4);
  };

  const handleSettings = () => {
    const confirmed = confirm('Wil je je profiel wissen en opnieuw beginnen?');
    if (confirmed) {
      localStorage.removeItem('anima_profile');
      window.location.reload();
    }
  };

  const handleGalleryClick = () => {
    // Open file picker for gallery selection
    fileInputRef.current?.click();
  };

  const handleCameraClick = () => {
    // Open camera directly with capture="environment"
    cameraInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/') || !userId) return;

    setIsImageUploading(true);
    try {
      // Upload to Supabase
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', userId);
      if (currentChatId) {
        formData.append('chatId', currentChatId);
      }

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const uploadData = await uploadResponse.json();
      
      // Use the uploaded image URL
      setCurrentImage(uploadData.fileUrl);
      setIsImageUploading(false);
      // Stay in chat view - no auto-switch
    } catch (error) {
      console.error('Error uploading file:', error);
      setIsImageUploading(false);
      // Fallback: use local preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setCurrentImage(event.target?.result as string);
        // Stay in chat view - no auto-switch
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setCurrentImage(null);
    setIsImageUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  const handleClearMessages = () => {
    const confirmed = confirm('Wil je alle berichten wissen?');
    if (confirmed) {
      setMessages([]);
      setCurrentChatId(null);
    }
  };

  const canProceedStep1 = userProfile.naam.trim(); // Groep is nu optioneel
  const canProceedStep2 = userProfile.taal !== '';
  const canProceedStep3 = userProfile.botNaam.trim() !== '';

  // Get visual content from last assistant message
  const getLastVisualContent = (): string | null => {
    const lastAssistantMessage = [...messages].reverse().find(msg => msg.role === 'assistant');
    if (lastAssistantMessage && hasVisualContent(lastAssistantMessage.content)) {
      return extractVisualContent(lastAssistantMessage.content) || lastAssistantMessage.content;
    }
    return null;
  };

  // Dashboard Components
  const ParentDashboard = () => {
    // Calculate progress based on currentLevel
    const previousLevel = Math.max(1, currentLevel - 1);
    const nextLevel = Math.min(12, currentLevel + 1);
    const levelCategory = currentLevel <= 6 ? 'Primary' : currentLevel <= 9 ? 'Secondary' : 'Senior';
    
    return (
    <div className="min-h-screen overflow-y-visible max-w-5xl mx-auto w-full px-4 py-8 md:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Ouder Dashboard</h1>
          <p className="text-gray-600">Inzicht in de voortgang en ontwikkeling van {userProfile.naam || 'je kind'}</p>
          </div>
          <button
            onClick={() => {
              if (userId) {
                fetchDashboardData(userId);
                fetchDashboardStats(userId);
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Ververs
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Focus-tijd Card */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Focus-tijd</h2>
            {dashboardData.hasData ? (
            <div className="space-y-4">
              <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <div className="text-3xl font-bold text-blue-600 mb-1">{dashboardData.averageSessionMinutes} min</div>
                  <div className="text-sm text-gray-600">Focus tijd</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-xl">
                  <div className="text-3xl font-bold text-green-600 mb-1">{dashboardData.sessionsThisWeek}</div>
                  <div className="text-sm text-gray-600">Sessies</div>
              </div>
            </div>
            ) : (
              <div className="text-center p-8">
                <div className="text-4xl mb-3">🚀</div>
                <div className="text-lg font-medium text-gray-700 mb-2">Klaar voor de start</div>
                <div className="text-sm text-gray-500">Begin met leren om je voortgang te zien</div>
              </div>
            )}
          </div>

          {/* Beheerste onderwerpen Card */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Beheerste onderwerpen</h2>
            {stats.total > 0 && Object.keys(stats.topics).length > 0 ? (
            <div className="space-y-4">
                {Object.entries(stats.topics)
                  .sort(([, a], [, b]) => b - a) // Sort by count descending
                  .map(([topic, count]) => {
                    const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                    return (
                      <div key={topic}>
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                          <span className="font-medium text-gray-700">{topic}</span>
                          <span className="text-gray-500">{count}x</span>
                </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-blue-600 h-2.5 rounded-full transition-all duration-500" 
                            style={{ width: `${percentage}%` }}
                          ></div>
                </div>
              </div>
                    );
                  })}
                </div>
            ) : (
              <div className="text-center p-8">
                <div className="text-4xl mb-3">📚</div>
                <div className="text-lg font-medium text-gray-700 mb-2">Nog geen onderwerpen</div>
                <div className="text-sm text-gray-500">Begin met chatten om onderwerpen te ontdekken</div>
                </div>
            )}
          </div>

          {/* Gevoel Card */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Stemming</h2>
            {stats.total > 0 && Object.keys(stats.sentiments).length > 0 ? (
            <div className="space-y-3">
                {Object.entries(stats.sentiments)
                  .sort(([, a], [, b]) => b - a) // Sort by count descending
                  .map(([sentiment, count]) => {
                    const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                    
                    // Determine color and emoji based on sentiment
                    let bgColor = 'bg-gray-50';
                    let borderColor = 'border-gray-100';
                    let emoji = '😐';
                    
                    if (sentiment === 'Blij') {
                      bgColor = 'bg-green-50';
                      borderColor = 'border-green-100';
                      emoji = '😊';
                    } else if (sentiment === 'Gefrustreerd') {
                      bgColor = 'bg-red-50';
                      borderColor = 'border-red-100';
                      emoji = '😔';
                    } else if (sentiment === 'Neutraal') {
                      bgColor = 'bg-blue-50';
                      borderColor = 'border-blue-100';
                      emoji = '😌';
                    }
                    
                    return (
                      <div key={sentiment} className={`p-4 ${bgColor} rounded-xl border ${borderColor}`}>
                <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">{sentiment}</span>
                          <span className="text-2xl">{emoji}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-600">{count}x besproken</span>
                          <span className="text-xs text-gray-500">{Math.round(percentage)}%</span>
                </div>
                        <div className="w-full bg-white/50 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-2 rounded-full transition-all duration-500 ${
                              sentiment === 'Blij' ? 'bg-green-500' :
                              sentiment === 'Gefrustreerd' ? 'bg-red-500' :
                              'bg-blue-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          ></div>
              </div>
            </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-center p-8">
                <div className="text-4xl mb-3">💭</div>
                <div className="text-lg font-medium text-gray-700 mb-2">Nog geen gesprekken vandaag</div>
                <div className="text-sm text-gray-500">Begin met chatten om stemmingen te zien</div>
              </div>
            )}
          </div>

          {/* Groei Card */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Groei</h2>
            <div className="space-y-3">
              <div className="p-4 bg-blue-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Huidige niveau</span>
                  <span className="text-lg font-bold text-blue-600">Level {currentLevel}</span>
                </div>
                <p className="text-xs text-gray-600">
                  {currentLevel > previousLevel ? `Vooruitgang: Level ${previousLevel} → ${currentLevel}` : 'Basis niveau'}
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Volgende doel</span>
                  <span className="text-lg font-bold text-purple-600">Level {nextLevel}</span>
                </div>
                <p className="text-xs text-gray-600">
                  {nextLevel <= 6 ? 'Op weg naar Primary niveau' : nextLevel <= 9 ? 'Op weg naar Secondary niveau' : 'Op weg naar Senior niveau'}
                </p>
              </div>
            </div>
          </div>

          {/* Moeilijke onderwerpen Card */}
          <div className="bg-white rounded-2xl shadow-sm p-6 md:col-span-2 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Moeilijke onderwerpen</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
                <div className="text-2xl flex-shrink-0">⚠️</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Breuken</h3>
                  <p className="text-sm text-gray-600">Nog moeite met optellen en aftrekken</p>
                  <div className="mt-2 text-xs text-red-600 font-medium">3x geprobeerd</div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                <div className="text-2xl flex-shrink-0">💡</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Staartdelingen</h3>
                  <p className="text-sm text-gray-600">Goed bezig, nog wat oefening nodig</p>
                  <div className="mt-2 text-xs text-yellow-600 font-medium">In verbetering</div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="text-2xl flex-shrink-0">📐</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Meetkunde</h3>
                  <p className="text-sm text-gray-600">Basisbegrippen zijn lastig</p>
                  <div className="mt-2 text-xs text-blue-600 font-medium">2x gevraagd</div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-xl border border-purple-100">
                <div className="text-2xl flex-shrink-0">📊</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Grafieken lezen</h3>
                  <p className="text-sm text-gray-600">Begint het te snappen</p>
                  <div className="mt-2 text-xs text-purple-600 font-medium">Vooruitgang</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
  };

  const TeacherDashboard = () => {
    // Mock data for individual students (in production, this would come from API)
    const students = [
      { id: 1, name: 'Rens', status: 'red', strugglePoint: 'Level 10 - Algebra', level: 'Level 10' },
      { id: 2, name: 'Sophie', status: 'orange', strugglePoint: 'Level 8 - Grammatica', level: 'Level 8' },
      { id: 3, name: 'Daan', status: 'green', strugglePoint: 'Level 4 - Lezen', level: 'Level 4' },
    ];

    const [selectedStudent, setSelectedStudent] = useState<number | null>(null);

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'red':
          return 'bg-red-500';
        case 'orange':
          return 'bg-orange-500';
        case 'green':
          return 'bg-green-500';
        default:
          return 'bg-gray-400';
      }
    };

    return (
      <div className="min-h-screen overflow-y-visible max-w-5xl mx-auto w-full px-4 py-8 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Leraren Dashboard</h1>
            <p className="text-gray-600">Overzicht van klasprestaties en leerling ontwikkeling</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Klasstatistieken - Overzicht */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Klasstatistieken</h2>
            <div className="space-y-4">
              <div className="text-center p-4 bg-blue-50 rounded-xl">
                <div className="text-3xl font-bold text-blue-600 mb-1">24</div>
                <div className="text-sm text-gray-600">Actieve leerlingen</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-xl">
                <div className="text-3xl font-bold text-green-600 mb-1">1.247</div>
                <div className="text-sm text-gray-600">Totaal vragen</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-xl">
                <div className="text-3xl font-bold text-purple-600 mb-1">8.4</div>
                <div className="text-sm text-gray-600">Gem. score</div>
              </div>
            </div>
          </div>

          {/* Prestatieverdeling */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Prestatieverdeling</h2>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Uitstekend (9-10)</span>
                  <span className="font-semibold">8</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-green-400 to-green-500 h-2.5 rounded-full" style={{ width: '33%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Goed (7-8)</span>
                  <span className="font-semibold">12</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-400 to-blue-500 h-2.5 rounded-full" style={{ width: '50%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Voldoende (6)</span>
                  <span className="font-semibold">3</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 h-2.5 rounded-full" style={{ width: '13%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Aandacht nodig (&lt;6)</span>
                  <span className="font-semibold">1</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-red-400 to-red-500 h-2.5 rounded-full" style={{ width: '4%' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Onderwerpen */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Populaire Onderwerpen</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                <span className="text-gray-700 font-medium">Wiskunde</span>
                <span className="font-bold text-blue-600">48%</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                <span className="text-gray-700 font-medium">Taal</span>
                <span className="font-bold text-green-600">32%</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-xl">
                <span className="text-gray-700 font-medium">Natuur</span>
                <span className="font-bold text-yellow-600">20%</span>
              </div>
            </div>
          </div>

          {/* Klasprestaties - Volledige breedte */}
          <div className="bg-white rounded-2xl shadow-sm p-6 md:col-span-3 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Klasprestaties</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
                <div className="text-2xl flex-shrink-0">📊</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">5 leerlingen hebben moeite met breuken</h3>
                  <p className="text-sm text-gray-600">Overweeg extra oefening in de les</p>
                  <div className="mt-2 flex gap-2">
                    <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">Actie nodig</span>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                <div className="text-2xl flex-shrink-0">📝</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">3 leerlingen vragen veel over spelling</h3>
                  <p className="text-sm text-gray-600">Mogelijk extra aandacht nodig</p>
                  <div className="mt-2 flex gap-2">
                    <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full font-medium">Monitoren</span>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
                <div className="text-2xl flex-shrink-0">✅</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Vermenigvuldigen gaat uitstekend!</h3>
                  <p className="text-sm text-gray-600">De meeste leerlingen beheersen dit onderwerp goed</p>
                  <div className="mt-2 flex gap-2">
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">Sterk punt</span>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="text-2xl flex-shrink-0">📈</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Staartdelingen verbeteren</h3>
                  <p className="text-sm text-gray-600">Zichtbare vooruitgang bij 8 leerlingen</p>
                  <div className="mt-2 flex gap-2">
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">Vooruitgang</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Leerlingenoverzicht Sectie */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Leerlingenoverzicht</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Naam</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Onderwerp</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actie</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr
                    key={student.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{student.name}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-2 text-sm font-medium">
                        {student.status === 'red' ? '🔴' : student.status === 'orange' ? '🟡' : '🟢'}
                        <span className="text-gray-700">
                          {student.status === 'red' ? 'Vastgelopen' : student.status === 'orange' ? 'Bezig' : 'Gaat goed'}
                        </span>
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-700 font-medium">{student.strugglePoint}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedStudent(student.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        Analyseer
                        <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </div>
  );
  };

  // Render Wizard Steps
  if (onboardingStep < 4) {
    return (
      <div className="flex h-screen bg-white overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-8">
          <motion.div
            key={onboardingStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-white/80 backdrop-blur-xl border border-gray-200 rounded-3xl shadow-2xl p-8 w-full max-w-md"
          >
            <AnimatePresence mode="wait">
              {onboardingStep === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center"
                >
                  <div className="text-6xl mb-6">👋</div>
                  <h1 className="text-3xl font-semibold text-gray-900 mb-4">
                    Hoi!
                  </h1>
                  <p className="text-gray-600 mb-8 text-lg">
                    Ik ben jouw nieuwe tutor. Laten we beginnen!
                  </p>
                  <button
                    onClick={nextStep}
                    className="w-full bg-blue-500 text-white rounded-xl px-6 py-4 text-lg font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                  >
                    Beginnen <ArrowRight size={20} />
                  </button>
                </motion.div>
              )}

              {onboardingStep === 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <h1 className="text-2xl font-semibold text-gray-900 mb-6">
                    Vertel me over jezelf
                  </h1>
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Hoe heet jij?
                      </label>
                      <input
                        type="text"
                        value={userProfile.naam}
                        onChange={(e) =>
                          setUserProfile({ ...userProfile, naam: e.target.value })
                        }
                        placeholder="Je naam..."
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        In welke klas/groep zit je? (Optioneel)
                      </label>
                      <input
                        type="text"
                        value={userProfile.groep}
                        onChange={(e) =>
                          setUserProfile({ ...userProfile, groep: e.target.value })
                        }
                        placeholder="Bijv. Groep 5 (optioneel)"
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Het niveau kan je later aanpassen in de sidebar
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={prevStep}
                      className="flex-1 bg-gray-100 text-gray-700 rounded-xl px-6 py-3 font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                    >
                      <ArrowLeft size={18} /> Terug
                    </button>
                    <button
                      onClick={nextStep}
                      disabled={!canProceedStep1}
                      className="flex-1 bg-blue-500 text-white rounded-xl px-6 py-3 font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      Volgende <ArrowRight size={18} />
                    </button>
                  </div>
                </motion.div>
              )}

              {onboardingStep === 2 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <h1 className="text-2xl font-semibold text-gray-900 mb-6">
                    In welke taal wil je praten?
                  </h1>
                  <div className="space-y-3 mb-6">
                    {talen.map((taal) => (
                      <button
                        key={taal.code}
                        onClick={() =>
                          setUserProfile({ ...userProfile, taal: taal.code })
                        }
                        className={`w-full border-2 rounded-xl px-4 py-4 text-left transition-all ${
                          userProfile.taal === taal.code
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className="text-2xl mr-3">{taal.emoji}</span>
                        <span className="font-medium text-gray-900">
                          {taal.naam}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={prevStep}
                      className="flex-1 bg-gray-100 text-gray-700 rounded-xl px-6 py-3 font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                    >
                      <ArrowLeft size={18} /> Terug
                    </button>
                    <button
                      onClick={nextStep}
                      disabled={!canProceedStep2}
                      className="flex-1 bg-blue-500 text-white rounded-xl px-6 py-3 font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      Volgende <ArrowRight size={18} />
                    </button>
                  </div>
                </motion.div>
              )}

              {onboardingStep === 3 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                    Hoe moet ik heten?
                  </h1>
                  <p className="text-gray-600 mb-6">
                    Je kunt me een eigen naam geven!
                  </p>
                  <div className="mb-6">
                    <input
                      type="text"
                      value={userProfile.botNaam}
                      onChange={(e) =>
                        setUserProfile({ ...userProfile, botNaam: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={prevStep}
                      className="flex-1 bg-gray-100 text-gray-700 rounded-xl px-6 py-3 font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                    >
                      <ArrowLeft size={18} /> Terug
                    </button>
                    <button
                      onClick={finishOnboarding}
                      disabled={!canProceedStep3}
                      className="flex-1 bg-blue-500 text-white rounded-xl px-6 py-3 font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      Klaar! <ArrowRight size={18} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    );
  }

  // Get visual content for Main Stage
  const visualContent = getLastVisualContent();

  // Render Split-Screen Chat Interface
  return (
    <div className="flex w-full bg-white lg:h-screen lg:overflow-hidden">
      {/* Hidden File Input for Gallery Upload (Paperclip) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        id="galleryInput"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Hidden File Input for Camera Capture */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        id="cameraInput"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Sidebar Overlay - Mobile & iPad */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Mobile/iPad: Slide-out, Desktop: Always visible (260px) */}
      <div className={`fixed lg:relative inset-y-0 left-0 z-50 w-64 lg:w-[260px] flex-col border-r bg-white p-4 transition-transform duration-300 ${
        isSidebarOpen ? 'flex' : 'hidden'
      } lg:flex`}>
        {/* Mobile/iPad Close Button - No logo here, logo is in header */}
        <div className="lg:hidden flex justify-end items-center mb-8">
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} className="text-gray-600" />
          </button>
        </div>

        {/* Desktop Title - Only on large screens */}
        <button
          onClick={() => {
            setActiveView('chat');
            setActiveMobileTab('chat');
          }}
          className="hidden lg:block text-gray-900 text-2xl font-semibold mb-8 hover:text-blue-600 hover:opacity-80 transition-all cursor-pointer text-left"
        >
          Anima
        </button>

        {/* Niveau Selector */}
        <div className="mb-6 px-4">
          <div className="relative" ref={levelSelectorRef}>
            <button
              onClick={() => setShowLevelSelector(!showLevelSelector)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors group"
            >
              <span className="text-sm font-semibold text-gray-900">
                Niveau: {studentLevel}
              </span>
              <Pencil size={14} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
            </button>

            {/* Level Selector Popover */}
            <AnimatePresence>
              {showLevelSelector && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-64 overflow-y-auto"
                >
                  <div className="p-1.5">
                    {['Primary', 'Secondary', 'Senior'].map((category) => (
                      <div key={category} className="mb-1 last:mb-0">
                        <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          {category}
                        </div>
                        {studentLevels
                          .filter(level => level.category === category)
                          .map((level) => {
                            const levelNum = parseInt(level.value.split(' ')[1], 10);
                            const isActive = currentLevel === levelNum;
                            return (
                            <button
                              key={level.value}
                              onClick={() => {
                                  setCurrentLevel(levelNum);
                                setShowLevelSelector(false);
                                  // Save to Supabase immediately when level is selected
                                  if (isSupabaseConnected && userId) {
                                    saveLevelToSupabase(userId, levelNum);
                                  }
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                                  isActive
                                    ? 'bg-blue-50 text-blue-600 font-medium shadow-md shadow-blue-200/50 ring-2 ring-blue-200'
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {level.label}
                            </button>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex flex-col gap-3 mt-8">
          <button
            onClick={() => {
              setActiveView('parent-dashboard');
              setActiveMobileTab('stage');
              setIsSidebarOpen(false);
            }}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
              activeView === 'parent-dashboard'
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
            }`}
          >
            <Heart size={20} />
            <span className="lg:inline">Ouder Dashboard</span>
          </button>
          <button
            onClick={() => {
              setActiveView('teacher-dashboard');
              setActiveMobileTab('stage');
              setIsSidebarOpen(false);
            }}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
              activeView === 'teacher-dashboard'
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
            }`}
          >
            <GraduationCap size={20} />
            <span className="lg:inline">Leraren Dashboard</span>
          </button>
          <button
            onClick={() => {
              handleSettings();
              setIsSidebarOpen(false);
            }}
            className="flex items-center gap-3 text-gray-600 hover:text-blue-600 hover:bg-blue-50 px-4 py-2.5 rounded-lg transition-colors"
          >
            <Settings size={20} />
            <span className="lg:inline">Settings</span>
          </button>
        </div>
      </div>

      {/* Content Area - Flex-1 */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50 lg:overflow-hidden">
        {/* Universele Header */}
        <div className={`sticky top-0 z-10 h-16 bg-white/80 backdrop-blur border-b border-slate-100 flex items-center px-6 ${
          activeView === 'chat' ? 'lg:hidden' : ''
        }`}>
          {/* Links: Hamburger + Logo alleen op mobiel/tablet bij chat, alleen hamburger bij dashboards */}
          {activeView === 'chat' ? (
            <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu size={24} className="text-gray-600" />
            </button>
              <button
                onClick={() => {
                  setActiveView('chat');
                  setActiveMobileTab('chat');
                  setIsSidebarOpen(false);
                }}
                className="text-xl font-semibold text-gray-900 hover:text-blue-600 hover:opacity-80 transition-all"
              >
                Anima
              </button>
          </div>
          ) : (
            <div className="lg:hidden flex items-center">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Menu size={24} className="text-gray-600" />
              </button>
            </div>
          )}
          {/* Rechts: Terug knop alleen bij dashboards */}
          {activeView !== 'chat' && (
            <div className="ml-auto flex items-center">
              <button
                onClick={() => setActiveView('chat')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-all mr-6"
              >
                <ArrowLeft size={16} />
                <span>Terug naar de les</span>
              </button>
            </div>
          )}
        </div>

        {/* Tab Header - Mobile & iPad (until lg) - Only show when viewing chat */}
        {activeView === 'chat' && (
          <div className="lg:hidden sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur-sm py-3 px-4">
            <div className="max-w-md mx-auto bg-gray-100 rounded-full p-1 flex">
              <button
                onClick={() => setActiveMobileTab('chat')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-full transition-all duration-200 ${
                  activeMobileTab === 'chat'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <MessageCircle size={18} />
                <span>Chat</span>
              </button>
              <button
                onClick={() => {
                  setActiveMobileTab('stage');
                  setHasNewContent(false);
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-full transition-all duration-200 relative ${
                  activeMobileTab === 'stage'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Presentation size={18} />
                <span>Board</span>
                {hasNewContent && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-gray-800 rounded-full animate-pulse"></span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Split-View Body - Tabs on mobile/iPad, split-screen on large screens */}
        <div className="flex flex-col lg:flex-row lg:h-full lg:overflow-hidden">
          {/* Chat Panel */}
          <div className={`flex flex-col bg-white transition-all duration-300 ${
            activeMobileTab === 'chat' ? 'flex' : 'hidden'
          } ${
            activeView === 'chat' ? 'lg:flex lg:flex-1' : 'lg:hidden'
          } border-r border-gray-200 lg:overflow-hidden`}>
            {/* Chat Header with Trash Icon */}
            <div className="hidden lg:flex items-center justify-end px-4 md:px-8 pt-4 pb-2">
              {messages.length > 0 && (
                <button
                  onClick={handleClearMessages}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Alle berichten wissen"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6 lg:overflow-y-auto">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="mb-4">
                    <Sparkles size={64} className="text-gray-300" />
                  </div>
                  <h2 className="text-lg text-gray-600 font-medium">
                    Klaar voor de start
                  </h2>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto space-y-4 pt-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 relative group ${
                          message.role === 'user'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {message.role === 'user' ? (
                          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                            {message.content}
                          </p>
                        ) : (
                          <div className="prose prose-sm max-w-none prose-p:leading-relaxed">
                            <ReactMarkdown components={{ img: () => null }}>
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        )}
                        {message.role === 'assistant' && (
                          <button
                            onClick={() => speakMessage(message.content, index)}
                            className={`absolute -bottom-2 -right-2 p-1.5 rounded-full transition-colors ${
                              speakingId === index
                                ? 'bg-blue-500 text-white'
                                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                            } shadow-sm`}
                            title={speakingId === index ? 'Stop' : 'Spreek uit'}
                          >
                            {speakingId === index ? (
                              <Square size={14} />
                            ) : (
                              <Volume2 size={14} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">Anima typt</span>
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Area - Inside Chat Panel */}
            <div className="border-t border-gray-200 bg-white px-4 md:px-8 py-4">
              <div className="max-w-2xl mx-auto">
                {/* Image Preview - WhatsApp style (small thumbnail above input) */}
                <AnimatePresence>
                  {currentImage && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="mb-3 flex items-center gap-3"
                    >
                      <div className="relative">
                        <img
                          src={currentImage}
                          alt="Selected"
                          className="h-[60px] w-auto object-cover rounded-lg border border-gray-200 shadow-sm"
                        />
                        {isImageUploading && (
                          <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                            <Loader2 size={16} className="text-white animate-spin" />
                          </div>
                        )}
                        <button
                          onClick={handleRemoveImage}
                          className="absolute -top-1 -right-1 bg-gray-800 text-white rounded-full p-0.5 hover:bg-gray-700 transition-colors shadow-sm z-10"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="bg-white border border-gray-200 shadow-lg rounded-2xl p-3 md:p-4 flex gap-3 items-center">
                  <button
                    onClick={handleGalleryClick}
                    className="p-2 rounded-full transition-colors flex items-center justify-center flex-shrink-0 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Afbeelding uit galerij"
                  >
                    <Paperclip size={18} />
                  </button>
                  <button
                    onClick={handleCameraClick}
                    className="p-2 rounded-full transition-colors flex items-center justify-center flex-shrink-0 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Foto maken"
                  >
                    <Camera size={18} />
                  </button>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={currentImage ? "Wat wil je weten over deze foto?" : "Stel een vraag..."}
                    rows={1}
                    className="flex-1 resize-none border-0 focus:outline-none bg-transparent text-gray-900 placeholder-gray-400 text-[15px] md:text-[15px] leading-relaxed py-2"
                    style={{
                      minHeight: '44px',
                      maxHeight: '200px',
                    }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = `${target.scrollHeight}px`;
                    }}
                  />
                  <button
                    onClick={toggleListening}
                    className={`p-2 rounded-full transition-colors flex items-center justify-center flex-shrink-0 ${
                      isListening
                        ? 'text-red-500 animate-pulse'
                        : 'text-gray-400 hover:bg-gray-100'
                    }`}
                    title={isListening ? 'Stop met opnemen' : 'Spreek in'}
                  >
                    {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={(!input.trim() && !currentImage) || isLoading}
                    className="bg-gray-900 text-white rounded-xl px-4 py-2 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 flex-shrink-0"
                  >
                    {currentImage ? (
                      <>
                        <Camera size={18} />
                        <span className="hidden sm:inline">Verzend</span>
                      </>
                    ) : (
                      <Send size={18} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Stage Panel */}
          <div className={`flex flex-col bg-gray-50 transition-all duration-300 min-h-[500px] lg:min-h-0 ${
            activeMobileTab === 'stage' ? 'flex' : 'hidden'
          } ${
            activeView !== 'chat' ? 'lg:flex lg:flex-1' : 'lg:flex lg:flex-1'
          } lg:overflow-hidden`}>
            <div className={`flex-1 overflow-y-auto lg:overflow-y-auto ${
              activeView === 'parent-dashboard' || activeView === 'teacher-dashboard' ? '' : 'flex items-center justify-center p-6 md:p-12'
          }`}>
              {activeView === 'parent-dashboard' ? (
                <ParentDashboard />
              ) : activeView === 'teacher-dashboard' ? (
                <TeacherDashboard />
              ) : boardContent ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="w-full max-w-4xl"
                >
                  <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
                    {imageLoading ? (
                      <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                        <p className="text-gray-600 text-sm">Afbeelding wordt gegenereerd...</p>
                      </div>
                    ) : (
                      <>
                        {imageError ? (
                          <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg">
                            <p className="text-gray-600 text-sm text-center px-4">
                              Afbeelding kon even niet geladen worden. Probeer het opnieuw.
                            </p>
                          </div>
                        ) : (
                          <img
                            src={useFallback && boardContent.fallbackUrl ? boardContent.fallbackUrl : boardContent.url}
                            alt="Anima's uitleg"
                            className="object-cover w-full h-64 rounded-lg shadow-md"
                            onLoad={() => {
                              setImageLoading(false);
                              setImageError(false);
                            }}
                            onError={() => {
                              // Fallback naar Unsplash als Pollinations faalt
                              if (!useFallback && boardContent.fallbackUrl) {
                                setUseFallback(true);
                                setImageLoading(true); // Reset loading voor fallback image
                              } else {
                                setImageLoading(false);
                                setImageError(true);
                              }
                            }}
                          />
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              ) : visualContent ? (
                <div className="w-full max-w-4xl">
                  <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
                    <div className="prose prose-lg max-w-none prose-img:rounded-xl prose-img:shadow-md prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded-xl prose-pre:overflow-x-auto">
                      <ReactMarkdown>{visualContent}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="mb-8">
                    <motion.div
                      animate={{
                        scale: [1, 1.03, 1],
                      }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <Lightbulb size={72} className="text-gray-300" />
                    </motion.div>
                  </div>
                  <h2 className="text-3xl font-semibold text-gray-800 mb-3">
                    Anima's Uitleg
                  </h2>
                  <p className="text-gray-500 max-w-md text-lg">
                    Hier verschijnen tekeningen en foto's die je helpen bij je les.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
