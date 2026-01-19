import { ImageResponse } from 'next/og'

export const runtime = 'edge'

function Logo({ size }: { size: number }) {
  const stroke = '#5b4026'
  const paper = '#efe4cf'

  return (
    <div
      style={{
        width: size,
        height: size,
        background: paper,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: Math.round(size * 0.14),
        paddingBottom: Math.round(size * 0.1),
        boxSizing: 'border-box',
      }}
    >
      <svg
        width={Math.round(size * 0.74)}
        height={Math.round(size * 0.52)}
        viewBox="0 0 320 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        <path
          d="M86 168 C86 128, 120 104, 160 104 C200 104, 234 128, 234 168 C234 196, 210 206, 160 206 C110 206, 86 196, 86 168 Z"
          stroke={stroke}
          strokeWidth="12"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d="M90 168 C90 132, 122 110, 160 110 C198 110, 230 132, 230 168 C230 191, 209 199, 160 199 C111 199, 90 191, 90 168 Z"
          stroke={stroke}
          strokeWidth="7"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path d="M166 108 C166 78, 178 54, 204 34" stroke={stroke} strokeWidth="12" strokeLinecap="round" />
        <path d="M162 110 C162 80, 174 56, 200 36" stroke={stroke} strokeWidth="7" strokeLinecap="round" opacity="0.85" />
        <path
          d="M204 34 C230 18, 266 20, 286 44 C268 76, 226 76, 204 34 Z"
          stroke={stroke}
          strokeWidth="12"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d="M210 36 C232 24, 262 26, 278 46 C262 72, 230 70, 210 36 Z"
          stroke={stroke}
          strokeWidth="7"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path d="M230 42 C242 54, 256 60, 272 58" stroke={stroke} strokeWidth="6" strokeLinecap="round" opacity="0.9" />
      </svg>

      <div
        style={{
          marginTop: Math.round(size * 0.02),
          fontSize: Math.round(size * 0.15),
          letterSpacing: Math.round(size * 0.02),
          color: stroke,
          fontWeight: 700,
          fontFamily: 'ui-rounded, ui-serif, "Comic Sans MS", cursive',
          lineHeight: 1,
        }}
      >
        ANIMA
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


