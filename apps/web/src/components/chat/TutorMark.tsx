import React, { useId } from 'react';

interface ITutorMarkProps {
  readonly size?: number;
  readonly className?: string;
}

/** The Tutor's card-fan mark. Each instance owns its mask id, so two marks on one page never share a mask. */
export function TutorMark({ size = 20, className }: ITutorMarkProps): React.ReactElement {
  const maskId = `tutor-front-${useId().replace(/:/g, '')}`;
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-testid="tutor-mark"
    >
      <mask id={maskId}>
        <rect width="24" height="24" fill="#fff" stroke="none" />
        <rect x="6.3" y="1.3" width="11.4" height="15.4" rx="2" fill="#000" stroke="none" />
      </mask>
      <g mask={`url(#${maskId})`}>
        <rect x="7.5" y="6" width="9" height="13" rx="1.4" transform="rotate(-16 12 21)" />
        <rect x="7.5" y="6" width="9" height="13" rx="1.4" transform="rotate(16 12 21)" />
      </g>
      <rect x="7.5" y="2.5" width="9" height="13" rx="1.4" />
      <path d="M12 6.2v5.6" />
    </svg>
  );
}
