// Curated, hand-authored SVG templates (diagram-first). Keep these stable for factual correctness.
// NOTE: Single quotes are used throughout for JSON-safety and to match our SVG rules.

export const diagramTemplates: Record<string, string> = {
  human_organs_basic: `
<svg viewBox='0 0 300 420' width='300' height='420' xmlns='http://www.w3.org/2000/svg'>
  <rect x='0' y='0' width='300' height='420' fill='white'/>

  <!-- Torso outline (simplified) -->
  <path id='torso' d='M 110 50
    C 90 70, 80 110, 82 150
    L 90 310
    C 92 350, 110 380, 150 392
    C 190 380, 208 350, 210 310
    L 218 150
    C 220 110, 210 70, 190 50
    C 175 38, 160 34, 150 34
    C 140 34, 125 38, 110 50 Z'
    fill='#f8fafc' stroke='#0f172a' stroke-width='2'/>

  <!-- Lungs -->
  <path id='lung_left' d='M 110 120
    C 100 130, 96 150, 98 175
    C 100 205, 110 225, 130 238
    C 140 210, 140 165, 132 130
    C 128 118, 120 112, 110 120 Z'
    fill='#e5e7eb' stroke='#0f172a' stroke-width='2'/>
  <path id='lung_right' d='M 190 120
    C 200 130, 204 150, 202 175
    C 200 205, 190 225, 170 238
    C 160 210, 160 165, 168 130
    C 172 118, 180 112, 190 120 Z'
    fill='#e5e7eb' stroke='#0f172a' stroke-width='2'/>

  <!-- Heart -->
  <path id='heart' d='M 150 165
    C 145 150, 125 150, 125 168
    C 125 188, 150 204, 150 214
    C 150 204, 175 188, 175 168
    C 175 150, 155 150, 150 165 Z'
    fill='#fecaca' stroke='#0f172a' stroke-width='2'/>

  <!-- Liver -->
  <path id='liver' d='M 110 240
    C 120 228, 145 222, 170 224
    C 200 226, 215 240, 212 258
    C 208 280, 170 286, 135 280
    C 110 276, 98 258, 110 240 Z'
    fill='#fde68a' stroke='#0f172a' stroke-width='2'/>

  <!-- Stomach -->
  <path id='stomach' d='M 135 270
    C 128 262, 120 262, 116 274
    C 110 292, 118 312, 140 318
    C 160 324, 178 316, 178 300
    C 178 288, 166 282, 156 284
    C 146 286, 142 278, 135 270 Z'
    fill='#bbf7d0' stroke='#0f172a' stroke-width='2'/>

  <!-- Intestines (simplified coil) -->
  <path id='intestines' d='M 112 325
    C 112 312, 130 306, 150 306
    C 180 306, 198 316, 198 332
    C 198 346, 182 354, 160 354
    C 140 354, 128 360, 128 372
    C 128 386, 150 392, 172 386
    C 192 380, 208 366, 206 346'
    fill='none' stroke='#0f172a' stroke-width='3' stroke-linecap='round'/>

  <!-- Neutral labels anchors (optional) -->
  <circle id='anchor_chest' cx='150' cy='160' r='2' fill='#0f172a'/>
  <circle id='anchor_abdomen' cx='150' cy='285' r='2' fill='#0f172a'/>
</svg>
`.trim(),

  human_skeleton_basic: `
<svg viewBox='0 0 300 420' width='300' height='420' xmlns='http://www.w3.org/2000/svg'>
  <rect x='0' y='0' width='300' height='420' fill='white'/>

  <!-- Skull -->
  <circle id='skull' cx='150' cy='70' r='38' fill='#f1f5f9' stroke='#0f172a' stroke-width='2'/>
  <circle cx='135' cy='65' r='4' fill='#0f172a'/>
  <circle cx='165' cy='65' r='4' fill='#0f172a'/>
  <path d='M 140 86 C 150 94, 160 94, 170 86' fill='none' stroke='#0f172a' stroke-width='2' stroke-linecap='round'/>

  <!-- Spine -->
  <path id='spine' d='M 150 108
    C 146 140, 154 170, 150 205
    C 146 240, 154 270, 150 305'
    fill='none' stroke='#0f172a' stroke-width='6' stroke-linecap='round'/>

  <!-- Ribcage -->
  <path id='ribcage' d='M 110 150
    C 125 125, 175 125, 190 150
    C 200 170, 190 210, 150 222
    C 110 210, 100 170, 110 150 Z'
    fill='#f8fafc' stroke='#0f172a' stroke-width='2'/>

  <!-- Pelvis -->
  <path id='pelvis' d='M 118 255
    C 130 238, 170 238, 182 255
    C 190 268, 182 292, 150 296
    C 118 292, 110 268, 118 255 Z'
    fill='#f8fafc' stroke='#0f172a' stroke-width='2'/>

  <!-- Arms -->
  <path id='arm_left' d='M 110 160 L 80 220 L 70 290' fill='none' stroke='#0f172a' stroke-width='5' stroke-linecap='round'/>
  <path id='arm_right' d='M 190 160 L 220 220 L 230 290' fill='none' stroke='#0f172a' stroke-width='5' stroke-linecap='round'/>

  <!-- Legs -->
  <path id='leg_left' d='M 140 296 L 120 360 L 112 404' fill='none' stroke='#0f172a' stroke-width='6' stroke-linecap='round'/>
  <path id='leg_right' d='M 160 296 L 180 360 L 188 404' fill='none' stroke='#0f172a' stroke-width='6' stroke-linecap='round'/>
</svg>
`.trim(),
}


