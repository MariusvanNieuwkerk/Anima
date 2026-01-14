'use client'

import { useEffect, useState } from 'react'

interface QRCodeDisplayProps {
  url: string
  size?: number
}

/**
 * High-contrast QR-code component voor iPhone camera scanning
 * - Pure zwart (#000000) op pure wit (#ffffff)
 * - Minimale grootte: 200x200px
 * - Voldoende padding (witte rand)
 */
export default function QRCodeDisplay({ url, size = 256 }: QRCodeDisplayProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    // Gebruik externe QR-code service (geen library nodig)
    // HIGH CONTRAST: Pure zwart (#000000) op pure wit (#ffffff)
    // - margin=2: Voldoende witte padding rondom
    // - qzone=2: Quiet zone (witte rand) voor betere scanning
    // - ecclevel=M: Medium error correction (goede balans)
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&color=000000&bgcolor=ffffff&margin=2&qzone=2&ecc=M`
    
    // Preload de QR-code image
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // Converteer naar data URL voor betere controle
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      
      if (ctx) {
        // Witte achtergrond (zorgt voor padding)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, size, size)
        
        // Teken QR-code
        ctx.drawImage(img, 0, 0, size, size)
        
        setQrDataUrl(canvas.toDataURL('image/png'))
      }
    }
    img.onerror = () => {
      console.error('QR-code kon niet worden geladen')
    }
    img.src = qrUrl
  }, [url, size])

  if (!qrDataUrl) {
    return (
      <div 
        className="bg-white flex items-center justify-center"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        <div className="text-stone-400 text-sm">Laden...</div>
      </div>
    )
  }

  return (
    <div 
      className="bg-white p-4 rounded-2xl shadow-lg"
      style={{ 
        width: `${size + 32}px`, // Extra padding
        height: `${size + 32}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <img 
        src={qrDataUrl} 
        alt="QR Code" 
        className="w-full h-full object-contain"
        style={{
          imageRendering: 'crisp-edges', // Scherpe randen voor QR-code
          minWidth: '200px',
          minHeight: '200px'
        }}
      />
    </div>
  )
}

