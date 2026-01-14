'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { UploadCloud, Check, Camera, Loader2 } from 'lucide-react'
import { supabase } from '@/utils/supabase'
import { compressImage } from '@/utils/imageUtils'

function UploadContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('s')
  
  const [preview, setPreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Gebruik de gedeelde compressImage utility

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      setIsUploading(true) // Even laden tijdens resizen
      
      try {
        // Direct verkleinen bij selecteren met gedeelde utility
        const resizedBase64 = await compressImage(selectedFile)
        setPreview(resizedBase64)
        setIsSuccess(false)
        setError(null)
      } catch (err) {
        console.error(err)
        setError("Kon foto niet verwerken.")
      } finally {
        setIsUploading(false)
      }
    }
  }

  const handleUpload = async () => {
    if (!preview || !sessionId) return
    
    setIsUploading(true)
    setError(null)

    try {
      // 1. Converteer base64 Data URL naar blob voor Storage upload
      // preview is al een base64 Data URL (data:image/jpeg;base64,...)
      const base64Data = preview.split(',')[1]; // Haal base64 string eruit
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });
      
      // 2. Genereer unieke filename
      const fileName = `${sessionId}-${Date.now()}.jpg`;
      const filePath = `mobile-uploads/${fileName}`;
      
      // 3. Upload naar Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('chat-images')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: false
        });
      
      if (storageError) throw storageError;
      
      // 4. Haal publieke URL op
      const { data: urlData } = supabase.storage
        .from('chat-images')
        .getPublicUrl(filePath);
      
      // 5. Insert record in mobile_uploads met image_path
      const { error: uploadError } = await supabase
        .from('mobile_uploads')
        .insert({
          session_id: sessionId,
          image_path: filePath,
          image_url: urlData.publicUrl
        });

      if (uploadError) throw uploadError;

      setIsUploading(false)
      setIsSuccess(true)
      setPreview(null)
      
      setTimeout(() => setIsSuccess(false), 3000)
      
    } catch (err: any) {
      console.error('[UPLOAD] Error:', err)
      setError('Upload mislukt. Probeer het opnieuw.')
      setIsUploading(false)
    }
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm text-center max-w-sm w-full">
          <p className="text-red-500 font-medium">Geen sessie gevonden.</p>
          <p className="text-stone-500 text-sm mt-2">Scan de QR-code opnieuw.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-stone-800 flex items-center justify-center gap-2">
            <UploadCloud className="w-6 h-6 text-stone-600" />
            Anima Bridge
          </h1>
          <p className="text-stone-500 text-sm mt-1">Stuur een foto naar je scherm</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-stone-100 p-2 overflow-hidden">
          
          <div className={`aspect-square rounded-2xl bg-stone-50 border-2 border-dashed border-stone-200 flex flex-col items-center justify-center relative transition-all ${preview ? 'border-solid border-stone-300' : ''}`}>
            
            {preview ? (
              <img src={preview} alt="Preview" className="w-full h-full object-contain rounded-2xl p-2" />
            ) : (
              <div className="text-center p-6">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-stone-400">
                  <Camera className="w-8 h-8" />
                </div>
                <p className="text-stone-400 font-medium">Maak een foto of kies een bestand</p>
              </div>
            )}

            <input 
              type="file" 
              accept="image/*" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              onChange={handleFileSelect}
            />
          </div>

          <div className="p-4">
            {isSuccess ? (
              <button disabled className="w-full py-4 rounded-xl bg-green-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-200 transition-all transform scale-100">
                <Check className="w-5 h-5" />
                Verstuurd!
              </button>
            ) : (
              <button 
                onClick={handleUpload}
                disabled={!preview || isUploading}
                className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-200 ${
                  !preview 
                    ? 'bg-stone-100 text-stone-400 cursor-not-allowed' 
                    : isUploading
                      ? 'bg-stone-800 text-white opacity-80 cursor-wait'
                      : 'bg-stone-800 text-white hover:bg-stone-900 shadow-lg shadow-stone-200'
                }`}
              >
                {isUploading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Even geduld...</>
                ) : (
                  <><UploadCloud className="w-5 h-5" /> Verstuur naar Laptop</>
                )}
              </button>
            )}
            
            {error && (
              <p className="text-red-500 text-sm text-center mt-3 animate-in fade-in">{error}</p>
            )}
          </div>
        </div>
        
        <p className="text-center text-stone-400 text-xs mt-8">
          Session ID: <span className="font-mono bg-stone-200 px-1 rounded">{sessionId.slice(0, 8)}...</span>
        </p>
      </div>
    </div>
  )
}

export default function UploadPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-400">Laden...</div>}>
      <UploadContent />
    </Suspense>
  )
}
