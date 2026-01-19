import { ImageResponse } from 'next/og'

export const runtime = 'edge'

function Logo({ size }: { size: number }) {
  const stroke = '#6b4e2e'
  const paper = '#efe4cf'
  const shadow = '#0000000a'

  return (
    <div
      style={{
        width: size,
        height: size,
        background: paper,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Math.round(size * 0.12),
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: Math.round(size * 0.22),
          background: '#ffffffb3',
          boxShadow: `0 10px 30px ${shadow}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: Math.round(size * 0.06),
          padding: Math.round(size * 0.14),
        }}
      >
        <svg
          width={Math.round(size * 0.62)}
          height={Math.round(size * 0.44)}
          viewBox="0 0 240 170"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M70 130 C70 100, 95 85, 120 85 C145 85, 170 100, 170 130 C170 150, 152 160, 120 160 C88 160, 70 150, 70 130 Z"
            stroke={stroke}
            strokeWidth="10"
            strokeLinejoin="round"
          />
          <path d="M122 88 C122 62, 132 44, 150 30" stroke={stroke} strokeWidth="10" strokeLinecap="round" />
          <path
            d="M146 32 C164 18, 190 18, 204 36 C190 58, 160 58, 146 32 Z"
            stroke={stroke}
            strokeWidth="10"
            strokeLinejoin="round"
          />
          <path
            d="M162 32 C171 40, 180 45, 194 44"
            stroke={stroke}
            strokeWidth="6"
            strokeLinecap="round"
            opacity="0.9"
          />
        </svg>

        <div
          style={{
            fontSize: Math.round(size * 0.12),
            letterSpacing: Math.round(size * 0.01),
            color: stroke,
            fontWeight: 800,
            fontFamily: 'ui-serif, Georgia, Times, serif',
            lineHeight: 1,
          }}
        >
          ANIMA
        </div>
      </div>
    </div>
  )
}

export default function AppleIcon() {
  const size = 180
  return new ImageResponse(<Logo size={size} />, {
    width: size,
    height: size,
  })
}


