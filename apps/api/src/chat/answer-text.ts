const LATEX_ARROWS: ReadonlyArray<[RegExp, string]> = [
  [/\$\s*\\(?:rightarrow|to|Rightarrow|longrightarrow)\s*\$/g, '→'],
  [/\$\s*\\(?:leftarrow|Leftarrow|gets)\s*\$/g, '←'],
  [/\$\s*\\(?:leftrightarrow|Leftrightarrow)\s*\$/g, '↔'],
];
const LINE_BREAK_TAG = /<br\s*\/?>/gi;

// The model writes these despite the instruction not to, and the chat shows them as raw text.
export function cleanAnswerText(text: string): string {
  const arrows = LATEX_ARROWS.reduce((current, [pattern, arrow]) => current.replace(pattern, arrow), text);
  return arrows
    .split('\n')
    .map((line) => line.replace(LINE_BREAK_TAG, line.trimStart().startsWith('|') ? '; ' : '\n'))
    .join('\n');
}
