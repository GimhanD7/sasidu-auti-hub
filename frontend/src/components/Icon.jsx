const paths = {
  car: (
    <>
      <path d="m5 11 1.3-4a2 2 0 0 1 1.9-1.4h7.6a2 2 0 0 1 1.9 1.4l1.3 4" />
      <path d="M4 11h16l1 3v5h-2v-2H5v2H3v-5l1-3Z" />
      <path d="M6.5 14h.01M17.5 14h.01" />
    </>
  ),
  wrench: (
    <>
      <path d="M14.5 6.5a5 5 0 0 0-6.3 6.3l-5.3 5.3a2.1 2.1 0 0 0 3 3l5.3-5.3a5 5 0 0 0 6.3-6.3L14 13l-3-3 3.5-3.5Z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18M8 14h3m-3 3h6" />
    </>
  ),
};

export default function Icon({ name, className = '' }) {
  return (
    <svg
      className={`app-icon ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name] || paths.car}
    </svg>
  );
}
