export async function getUnsplashVisual(keyword: string, topic: string, age?: number, coach?: string) {
  const UNSPLASH_KEY = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;
  
  if (!UNSPLASH_KEY) {
    console.error('Unsplash Access Key niet gevonden in environment variables');
    return null;
  }
  
  // We bouwen een 'Power Query' die PRECIES het onderwerp zoekt.
  // Belangrijk: Gebruik NIET alleen het eerste woord; we willen juist details zoals "bindings".
  // We forceren descriptieve modifiers om sfeerbeelden (bergen) te vermijden.
  const normalizedKeyword = (keyword || '').trim().replace(/\s+/g, ' ');
  const normalizedTopic = (topic || '').trim();

  const hasDescriptiveModifier = (q: string) => {
    const lower = q.toLowerCase();
    return (
      lower.includes('close up') ||
      lower.includes('close-up') ||
      lower.includes('detail') ||
      lower.includes('isolated') ||
      lower.includes('product shot') ||
      lower.includes('macro') ||
      lower.includes('technical') ||
      lower.includes('diagram')
    );
  };

  // Start met het volledige keyword (zoals de AI het geeft)
  let powerQuery = normalizedKeyword;

  // HARDCORE FALLBACK: als query te kort is, plak er automatisch detail-modifiers achter
  if (powerQuery.length < 10) {
    powerQuery = `${powerQuery} close up detail`.trim();
  }

  // Als er maar 1 woord is of er ontbreken modifiers, maak het expliciet "object/product shot"
  if (!powerQuery.includes(' ') || !hasDescriptiveModifier(powerQuery)) {
    powerQuery = `${powerQuery} isolated product shot close up detail`.trim();
  }
  
  // Specifieke correctie voor veelvoorkomende missers (alleen voor deze specifieke gevallen)
  if (normalizedTopic.toLowerCase().includes("zon") || normalizedKeyword.toLowerCase().includes("sun")) {
    powerQuery = "sun surface NASA telescope detailed";
  } else if (normalizedTopic.toLowerCase().includes("atoom") || normalizedKeyword.toLowerCase().includes("atom")) {
    powerQuery = "atom structure diagram scientific detailed";
  } else if (normalizedTopic.toLowerCase().includes("maan") || normalizedKeyword.toLowerCase().includes("moon")) {
    powerQuery = "moon surface crater close up detail";
  }

  try {
    // VISIBILITY (DEBUG): laat de uiteindelijke query zien in server logs
    console.log('Unsplash Query:', powerQuery);

    const response = await fetch(
      // Voor objecten werkt "squarish" vaak beter dan landscape (minder sfeer/landschap).
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(powerQuery)}&per_page=1&orientation=squarish&content_filter=high&client_id=${UNSPLASH_KEY}`
    );
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      return data.results[0].urls.regular;
    }

    // HOTFIX (V5.4): geen database logging (visual_misses) — visuals moeten DB-onafhankelijk zijn
    
    return null;
  } catch (error) {
    // HOTFIX (V5.4): geen database logging (visual_misses)
    console.error('Unsplash fetch error:', error);
    return null;
  }
}
