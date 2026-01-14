/**
 * Voice Selector Utility
 * 
 * Selecteert de beste beschikbare stem voor Text-to-Speech
 * op basis van taal en platform (iOS/Desktop)
 */

/**
 * Krijg de beste beschikbare stem voor een specifieke taal
 * @param langCode - Taalcode (bijv. 'nl-NL', 'en-US')
 * @returns SpeechSynthesisVoice of null als geen geschikte stem gevonden
 */
export function getBestVoice(langCode: string): SpeechSynthesisVoice | null {
  if (!window.speechSynthesis) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  
  if (voices.length === 0) {
    console.warn('[VOICE] No voices available');
    return null;
  }

  // Filter op taal
  const langVoices = voices.filter(voice => voice.lang === langCode || voice.lang.startsWith(langCode.split('-')[0]));
  
  if (langVoices.length === 0) {
    console.warn(`[VOICE] No voices found for ${langCode}, using default`);
    return voices[0]; // Fallback naar eerste beschikbare stem
  }

  // Prioriteit: Google > Siri > Microsoft > andere
  const preferredNames = ['Google', 'Siri', 'Microsoft', 'Enhanced'];
  
  for (const preferredName of preferredNames) {
    const preferredVoice = langVoices.find(voice => 
      voice.name.includes(preferredName)
    );
    if (preferredVoice) {
      console.log(`[VOICE] Selected preferred voice: ${preferredVoice.name} (${preferredVoice.lang})`);
      return preferredVoice;
    }
  }

  // Als geen voorkeursstem gevonden, gebruik de eerste beschikbare voor deze taal
  console.log(`[VOICE] Selected default voice: ${langVoices[0].name} (${langVoices[0].lang})`);
  return langVoices[0];
}

/**
 * Wacht tot voices geladen zijn (iOS heeft soms een delay)
 * @param callback - Callback functie die wordt aangeroepen wanneer voices beschikbaar zijn
 */
export function waitForVoices(callback: () => void, maxWait: number = 2000): void {
  if (!window.speechSynthesis) {
    callback();
    return;
  }

  const voices = window.speechSynthesis.getVoices();
  
  if (voices.length > 0) {
    callback();
    return;
  }

  // Wacht op voices (iOS laadt ze soms async)
  let attempts = 0;
  const maxAttempts = maxWait / 100; // Check elke 100ms
  
  const checkVoices = () => {
    const currentVoices = window.speechSynthesis.getVoices();
    if (currentVoices.length > 0 || attempts >= maxAttempts) {
      callback();
    } else {
      attempts++;
      setTimeout(checkVoices, 100);
    }
  };
  
  // iOS: voices worden soms pas geladen na een speak() call
  window.speechSynthesis.onvoiceschanged = () => {
    callback();
  };
  
  checkVoices();
}

