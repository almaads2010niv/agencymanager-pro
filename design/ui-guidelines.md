# AgencyManager Pro - Design System V2.0 (Locked)

## Philosophy
"2030 Cyber Premium". Clean, information-dense, dark mode only. 
Subtle glass effects, refined typography, and controlled neon accents.

## Core Rules (DO NOT BREAK)
1. **Background**: Always `#0B1121` (Deep Obsidian). Never pure black.
2. **Cards**: Use `Card` component. Background is `surface` with low opacity and backdrop blur.
3. **Borders**: Extremely subtle `white/10` or `white/5`. No thick borders.
4. **Glow**: Only on Primary Actions and Active States.
5. **Spacing**: Use spacious padding (p-6) for cards to allow content to breathe.
6. **Typography**: Heebo. Headings are bold/medium. Data is tabular/mono where financial.

## Components
- **Buttons**:
    - Primary: Cyan gradient/solid + Glow.
    - Secondary: Transparent + Border.
    - Ghost: Text only + Hover effect.
- **Inputs**: Darker than surface (`bg-[#0B1121]`), border `white/10`. Focus ring is `primary/50`.
- **Tables**: Sticky header, glass row hover.
- **Text Colors**:
    - Headings: `text-white`
    - Body: `text-gray-300`
    - Subtext: `text-gray-500`

## Maintainability
All UI elements must be imported from `@/components/ui`. Do not use raw Tailwind classes for layout structures in page files.