/**
 * iOS Audio Unlock Utility
 * 
 * Forceert iOS om de audio-engine te activeren tijdens user interaction.
 * Dit voorkomt dat async audio wordt geblokkeerd door iOS autoplay restrictions.
 */

let audioContextInstance: AudioContext | null = null;

/**
 * Unlock audio context door een korte stille oscillator af te spelen.
 * Dit forceert iOS om de luidspreker te activeren tijdens user interaction.
 */
export function unlockAudioContext(): void {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) {
      console.warn('[AUDIO] AudioContext not supported');
      return;
    }

    // Maak of gebruik bestaande AudioContext
    if (!audioContextInstance) {
      audioContextInstance = new AudioContext();
    }

    const audioContext = audioContextInstance;

    // Resume als suspended
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(err => {
        console.warn('[AUDIO] Failed to resume audio context:', err);
      });
    }

    // Maak een korte stille oscillator om iOS audio-engine te activeren
    // Dit moet gebeuren tijdens user interaction (click/touch)
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    // Stel volume in op 0 (stil, maar activeert wel de audio-engine)
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    
    // Verbind oscillator -> gain -> destination
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Start en stop direct (1ms is genoeg om iOS te activeren)
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.001);

    // Cleanup na korte tijd
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };

    console.log('[AUDIO] Audio context unlocked via oscillator');
  } catch (err) {
    console.warn('[AUDIO] Failed to unlock audio context:', err);
  }
}

/**
 * Unlock SpeechSynthesis voor iOS
 * Zorgt dat SpeechSynthesis ready is voor gebruik
 */
export function unlockSpeechSynthesis(): void {
  try {
    if (!window.speechSynthesis) {
      console.warn('[AUDIO] SpeechSynthesis not supported');
      return;
    }

    // Cancel eventuele actieve speech
    window.speechSynthesis.cancel();

    // Maak een korte stille utterance om SpeechSynthesis te activeren
    const testUtterance = new SpeechSynthesisUtterance('');
    testUtterance.volume = 0;
    testUtterance.rate = 0.1;
    
    // Probeer te spreken (stil, maar activeert de engine)
    window.speechSynthesis.speak(testUtterance);
    
    // Cancel direct
    setTimeout(() => {
      window.speechSynthesis.cancel();
    }, 10);

    console.log('[AUDIO] SpeechSynthesis unlocked');
  } catch (err) {
    console.warn('[AUDIO] Failed to unlock SpeechSynthesis:', err);
  }
}

