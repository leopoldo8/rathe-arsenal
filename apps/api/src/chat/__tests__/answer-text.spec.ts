import { cleanAnswerText } from '../answer-text';

describe('answer text cleanup', () => {
  it('turns LaTeX arrows into arrow characters', () => {
    expect(cleanAnswerText('**Spire Sniping (Yellow)** $\\rightarrow$ **Spire Sniping (Red)**, $\\to$ x, $\\leftarrow$ y')).toBe(
      '**Spire Sniping (Yellow)** → **Spire Sniping (Red)**, → x, ← y',
    );
  });

  it('turns <br> into a line break, or into a separator inside a table row', () => {
    expect(cleanAnswerText('first<br>second\n| a<br/>b | c |')).toBe('first\nsecond\n| a; b | c |');
  });

  it('leaves dollar amounts and plain text alone', () => {
    expect(cleanAnswerText('Costs $5 and $10; no math here.')).toBe('Costs $5 and $10; no math here.');
  });
});
