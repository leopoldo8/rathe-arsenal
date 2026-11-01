import React, { useEffect, useState } from 'react';
import styles from './Rails.module.css';

export interface IIndexItem {
  /** The id of the section the link jumps to. */
  readonly id: string;
  readonly label: string;
  readonly tone?: 'danger';
}

interface IIndexRailProps {
  readonly items: readonly IIndexItem[];
}

/** An index of the sections of a long page; the section in view is marked. */
export function IndexRail({ items }: IIndexRailProps): React.ReactElement {
  const [active, setActive] = useState<string>(items[0]?.id ?? '');

  useEffect(() => {
    let frame = 0;
    function update(): void {
      frame = 0;
      // The section whose top has passed a line a quarter of the way down the screen is the one being read.
      const line = window.innerHeight * 0.25;
      let current = items[0]?.id ?? '';
      for (const item of items) {
        const section = document.getElementById(item.id);
        if (section !== null && section.getBoundingClientRect().top <= line) current = item.id;
      }
      setActive(current);
    }
    function onScroll(): void {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [items]);

  return (
    <nav className={styles.index}>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={styles.indexLink}
              data-tone={item.tone}
              aria-current={active === item.id ? 'location' : undefined}
              onClick={(event) => {
                event.preventDefault();
                setActive(item.id);
                document.getElementById(item.id)?.scrollIntoView({ block: 'start' });
              }}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
