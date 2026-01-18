/**
 * Image Compression Utility
 * 
 * Comprimeert afbeeldingen client-side om Vercel timeout te voorkomen
 * - Resize naar max 1600x1600 pixels (betere leesbaarheid voor tekst/OCR)
 * - Converteer naar JPEG met kwaliteit 0.82 (minder artifacts op kleine tekst)
 * - Output: Base64 string
 */

/**
 * Converteer Base64 Data URL naar Blob object
 * @param base64 - Base64 Data URL (bijv. "data:image/jpeg;base64,...")
 * @param mimeType - MIME type (default: 'image/jpeg')
 * @returns Blob object geschikt voor Supabase Storage upload
 */
export function base64ToBlob(base64: string, mimeType: string = 'image/jpeg'): Blob {
  // Haal de base64 string eruit (verwijder "data:image/jpeg;base64," prefix)
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  
  // Decodeer base64 naar binary string
  const byteCharacters = atob(base64Data);
  
  // Converteer naar Uint8Array
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  
  // Maak Blob object
  return new Blob([byteArray], { type: mimeType });
}

export async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Bepaal nieuwe dimensies (max 1024x1024, behoud aspect ratio)
        let width = img.width;
        let height = img.height;
        const maxDimension = 1600;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }
        
        // Maak canvas en teken de afbeelding op de nieuwe grootte
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context niet beschikbaar'));
          return;
        }
        // Improve downscale quality for text-heavy photos (receipts/workbooks).
        ctx.imageSmoothingEnabled = true;
        // imageSmoothingQuality exists in modern browsers; cast to avoid TS lib mismatch.
        (ctx as any).imageSmoothingQuality = 'high';
        
        // Teken de afbeelding op het canvas (resized)
        ctx.drawImage(img, 0, 0, width, height);
        
        // Converteer naar JPEG met iets hogere kwaliteit (minder OCR-fouten)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
        
        resolve(compressedBase64);
      };
      
      img.onerror = () => {
        reject(new Error('Fout bij het laden van de afbeelding'));
      };
      
      // Start het laden van de afbeelding
      if (e.target?.result) {
        img.src = e.target.result as string;
      } else {
        reject(new Error('FileReader result is null'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Fout bij het lezen van het bestand'));
    };
    
    // Lees het bestand als Data URL
    reader.readAsDataURL(file);
  });
}

