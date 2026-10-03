import React, { useEffect, useRef } from 'react';
import { setCssVar } from '../../lib/dom/setCssVar';

interface IVarFillProps {
  readonly className: string;
  readonly cssVar: `--${string}`;
  readonly value: string | number;
  readonly testId?: string;
}

/** A div whose geometry comes from one CSS custom property, set without a style prop. */
export function VarFill({ className, cssVar, value, testId }: IVarFillProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setCssVar(ref.current, cssVar, value);
  }, [cssVar, value]);
  return <div ref={ref} className={className} data-testid={testId} />;
}
