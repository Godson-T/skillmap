/** SkillMap mark: a card ticket with a punched hole and a rail line through it. */
export default function Logo({ size = 28 }) {
  return (
    <svg width={size} height={Math.round(size * 0.72)} viewBox="0 0 36 26" aria-hidden="true" focusable="false">
      <path
        d="M3 2h30a1 1 0 0 1 1 1v6.2a3.8 3.8 0 0 0 0 7.6V23a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-6.2a3.8 3.8 0 0 0 0-7.6V3a1 1 0 0 1 1-1z"
        fill="#f4c3ae"
      />
      <path d="M6 18.5h24" stroke="#162c66" strokeWidth="2" strokeLinecap="round" />
      <circle cx="11" cy="18.5" r="2.6" fill="#f4c3ae" stroke="#162c66" strokeWidth="1.8" />
      <circle cx="25" cy="18.5" r="2.6" fill="#162c66" />
      <circle cx="27" cy="8" r="2.4" fill="#1f3c88" />
      <path d="M7 8h12" stroke="#162c66" strokeWidth="1.6" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}
