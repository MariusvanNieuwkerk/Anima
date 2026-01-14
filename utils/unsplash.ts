import { supabase } from './supabase';

export async function getUnsplashVisual(keyword: string, topic: string, age?: number, coach?: string) {
  const UNSPLASH_KEY = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;
  
  if (!UNSPLASH_KEY) {
    console.error('Unsplash Access Key niet gevonden in environment variables');
    return null;
  }
  
  // We bouwen een 'Power Query' die PRECIES het onderwerp zoekt.
  // Het keyword (het exacte onderwerp) staat ALTIJD voorop en wordt gebruikt zoals het is.
  // We voegen minimale qualifiers toe om de zoekopdracht te verfijnen.
  
  // Extract het eerste woord uit keyword (het exacte onderwerp)
  const firstWord = keyword.split(' ')[0];
  
  // Bouw een precieze query: eerst het exacte onderwerp, dan minimale verfijning
  let powerQuery = `${firstWord} clear detailed`;
  
  // Specifieke correctie voor veelvoorkomende missers (alleen voor deze specifieke gevallen)
  if (topic.toLowerCase().includes("zon") || keyword.toLowerCase().includes("sun")) {
    powerQuery = "sun surface NASA telescope";
  } else if (topic.toLowerCase().includes("atoom") || keyword.toLowerCase().includes("atom")) {
    powerQuery = "atom structure diagram scientific";
  } else if (topic.toLowerCase().includes("maan") || keyword.toLowerCase().includes("moon")) {
    powerQuery = "moon surface crater detailed";
  }

  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(powerQuery)}&per_page=1&orientation=landscape&client_id=${UNSPLASH_KEY}`
    );
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      return data.results[0].urls.regular;
    }

    // Als zelfs dit faalt, loggen we het als een kwalitatieve misser in Supabase
    try {
      await supabase.from('visual_misses').insert({
        keyword: keyword,
        topic: topic,
        query: powerQuery,
        age: age || null,
        coach: coach || null
      });
    } catch (logError) {
      // Stil falen bij logging errors (graceful degradation)
      console.error('Error logging visual miss:', logError);
    }
    
    return null;
  } catch (error) {
    // Log ook errors tijdens de fetch
    try {
      await supabase.from('visual_misses').insert({
        keyword: keyword,
        topic: topic,
        query: powerQuery,
        age: age || null,
        coach: coach || null,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } catch (logError) {
      console.error('Error logging visual miss:', logError);
    }
    return null;
  }
}
