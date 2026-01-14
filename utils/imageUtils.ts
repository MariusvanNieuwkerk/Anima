/**
 * Image Compression Utility
 * 
 * Comprimeert afbeeldingen client-side om Vercel timeout te voorkomen
 * - Resize naar max 1024x1024 pixels
 * - Converteer naar JPEG met kwaliteit 0.7
 * - Output: Base64 string
 */

export async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Bepaal nieuwe dimensies (max 1024x1024, behoud aspect ratio)
        let width = img.width;
        let height = img.height;
        const maxDimension = 1024;
        
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
        
        // Teken de afbeelding op het canvas (resized)
        ctx.drawImage(img, 0, 0, width, height);
        
        // Converteer naar JPEG met kwaliteit 0.7
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        
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

