import React from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import styles from './AnswerMarkdown.module.css';

const RULE_CITATION = /\((?:rule|regra)\s+(\d+(?:\.\d+)*[a-z]?)\)/gi;
const RULE_MARKER = 'rule ';
const SAFE_LINK = /^https?:\/\//i;

function markRuleCitations(text: string): string {
  return text.replace(RULE_CITATION, (_match, number: string) => `\`${RULE_MARKER}${number}\``);
}

function Heading({ children }: { readonly children?: React.ReactNode }): React.ReactElement {
  return <h3 className={styles.heading}>{children}</h3>;
}

export function AnswerMarkdown({ text }: { readonly text: string }): React.ReactElement {
  const { t } = useTranslation();
  const components: Components = {
    h1: Heading,
    h2: Heading,
    h3: Heading,
    h4: Heading,
    h5: Heading,
    h6: Heading,
    a: ({ href, children }) =>
      href && SAFE_LINK.test(href) ? (
        <a href={href} target="_blank" rel="noopener noreferrer nofollow">
          {children}
        </a>
      ) : (
        <>{children}</>
      ),
    code: ({ children }) => {
      const content = String(children);
      return content.startsWith(RULE_MARKER) ? (
        <span className={styles.rule} data-rule-chip="">
          {t('chat.ruleChip', { number: content.slice(RULE_MARKER.length) })}
        </span>
      ) : (
        <code className={styles.code}>{children}</code>
      );
    },
    table: ({ children }) => (
      <div className={styles.tableWrap}>
        <table className={styles.table}>{children}</table>
      </div>
    ),
  };
  return (
    <div className={styles.answer}>
      <Markdown remarkPlugins={[remarkGfm]} disallowedElements={['img']} components={components}>
        {markRuleCitations(text)}
      </Markdown>
    </div>
  );
}
