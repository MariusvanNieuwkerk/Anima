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
  const [isLoading, setIsLoading] = useState(true)

  // OPTIMIZE QR CODE: Direct externe URL gebruiken (geen canvas conversie = veel sneller)
  // HIGH CONTRAST: Pure zwart (#000000) op pure wit (#ffffff)
  // - margin=2: Voldoende witte padding rondom
  // - qzone=2: Quiet zone (witte rand) voor betere scanning
  // - ecclevel=M: Medium error correction (goede balans)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&color=000000&bgcolor=ffffff&margin=2&qzone=2&ecc=M`

  return (
    <div 
      className="bg-white p-4 rounded-2xl shadow-lg flex items-center justify-center"
      style={{ 
        width: `${size + 32}px`, // Extra padding
        height: `${size + 32}px`
      }}
    >
      {isLoading && (
        <div className="absolute text-stone-400 text-sm">Laden...</div>
      )}
      <img 
        src={qrUrl} 
        alt="QR Code" 
        className="w-full h-full object-contain"
        style={{
          imageRendering: 'crisp-edges', // Scherpe randen voor QR-code
          minWidth: '200px',
          minHeight: '200px',
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.2s'
        }}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          console.error('QR-code kon niet worden geladen')
          setIsLoading(false)
        }}
      />
    </div>
  )
}

