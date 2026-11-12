/** Pièce d'or dessinée (l'émoji 🪙 ressemble à une lune grise sur certains Android). */
export function GoldIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" style={{ verticalAlign: '-3px' }}>
      <circle cx="10" cy="10" r="9" fill="#f5b700" stroke="#9a6a00" strokeWidth="1.2" />
      <circle cx="10" cy="10" r="6.2" fill="none" stroke="#ffe27a" strokeWidth="1.2" />
      <path d="M7.2 6.5 Q10 5 12.8 6.5" stroke="#fff6c9" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </svg>
  );
}
