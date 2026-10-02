interface GrandpaAvatarIconProps {
  size?: number;
}

export function GrandpaAvatarIcon({ size = 22 }: GrandpaAvatarIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3.8 31c.5-5.3 4.5-8.2 12.2-8.2s11.7 2.9 12.2 8.2H3.8Z" fill="#F5F7FB" />
      <path d="M12.2 22.1v4.5l3.8 2.2 3.8-2.2v-4.5h-7.6Z" fill="#E8B995" />
      <path d="M7.7 13.1c0-5.5 3.5-9.4 8.3-9.4s8.3 3.9 8.3 9.4v4.1c0 4.6-3.7 8.3-8.3 8.3s-8.3-3.7-8.3-8.3v-4.1Z" fill="#F1C8A5" />
      <path d="M7.7 14.3c-1.3-5.1.2-10.8 5.1-12.1 4.8-1.3 10.4 1.1 11.4 6.9l-2.3-.5c-2.5 2.5-6.8 3.2-11.8 2.7l-2.4 3Z" fill="#D7DDE7" />
      <path d="M8.1 12.5c-1.4 1.7-1.4 4.5-.6 6.5l1.5.5v-5.8l-.9-1.2Zm15.8 0c1.4 1.7 1.4 4.5.6 6.5l-1.5.5v-5.8l.9-1.2Z" fill="#CFD6E1" />
      <path d="M10.1 14.3c1.2-.9 2.9-1 4.2-.2m3.4 0c1.3-.8 3-.7 4.2.2" stroke="#667085" strokeWidth="1.1" strokeLinecap="round" />
      <rect x="8.8" y="14.5" width="6.1" height="4.5" rx="1.8" stroke="#596579" strokeWidth="1.15" />
      <rect x="17.1" y="14.5" width="6.1" height="4.5" rx="1.8" stroke="#596579" strokeWidth="1.15" />
      <path d="M14.9 16.5h2.2" stroke="#596579" strokeWidth="1.1" />
      <circle cx="11.9" cy="16.7" r=".65" fill="#344054" />
      <circle cx="20.1" cy="16.7" r=".65" fill="#344054" />
      <path d="M15.4 17.8c-.2.8-.4 1.5-.7 2.1.4.3 1 .4 1.5.1" stroke="#C28E6F" strokeWidth=".9" strokeLinecap="round" />
      <path d="M10.2 20.1c1.5 4.3 3.5 6.1 5.8 6.1s4.3-1.8 5.8-6.1c-1.6 1-3.4 1.4-5.8 1.4s-4.2-.4-5.8-1.4Z" fill="#D7DDE7" />
      <path d="M13.1 21.2c.8-.7 1.8-.9 2.9-.5 1.1-.4 2.1-.2 2.9.5-.6 1-1.5 1.5-2.9 1.5s-2.3-.5-2.9-1.5Z" fill="#C8D0DC" />
      <path d="M14.5 24.8h3l-1.5 2.1-1.5-2.1Z" fill="#AEB8C7" />
    </svg>
  );
}