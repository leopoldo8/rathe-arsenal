import { useEffect, useState } from 'react';

/** Under 720 px wide is a phone: the width where `AuthLayout` already switches its layout. */
export const PHONE_QUERY = '(max-width: 719px)';

export function useIsPhone(): boolean {
  const read = (): boolean => typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches;
  const [isPhone, setIsPhone] = useState<boolean>(read);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia(PHONE_QUERY);
    const onChange = (e: MediaQueryListEvent): void => setIsPhone(e.matches);
    mql.addEventListener('change', onChange);
    setIsPhone(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isPhone;
}
