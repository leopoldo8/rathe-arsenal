import React from 'react';

interface ILinkProps extends Record<string, unknown> {
  readonly to: string;
  readonly params?: Readonly<Record<string, string>>;
  readonly children?: React.ReactNode;
  readonly className?: string;
}

/** A plain anchor for the router's `Link`, so a component renders in a test with no router around it. */
function MockLink({ to, params = {}, children, className, ...rest }: ILinkProps): React.ReactElement {
  const href = Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to);
  const { 'data-testid': testId } = rest as { 'data-testid'?: string };
  return (
    <a href={href} className={className} data-testid={testId}>
      {children}
    </a>
  );
}

export function withLinkMock<T extends object>(actual: T): T & { Link: typeof MockLink } {
  return { ...actual, Link: MockLink };
}
