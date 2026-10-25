import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SaveDeckChoice } from '../SaveDeckChoice';

function renderChoice(onSave = vi.fn(), onClose = vi.fn()): { onSave: typeof onSave; onClose: typeof onClose } {
  render(
    <SaveDeckChoice
      sharerName="Caio"
      originals={['Swing Big']}
      replacements={['Runner Runner']}
      pending={false}
      failed={false}
      onSave={onSave}
      onClose={onClose}
    />,
  );
  return { onSave, onClose };
}

describe('SaveDeckChoice', () => {
  it('asks which list, nothing selected, Salvar disabled until a pick', async () => {
    const user = userEvent.setup();
    const { onSave } = renderChoice();

    expect(screen.getByRole('heading', { name: 'Qual lista você quer salvar?' })).toBeInTheDocument();
    const options = screen.getAllByRole('radio');
    expect(options.map((option) => option.closest('label')?.textContent)).toEqual([
      'A lista antes das trocas do Caio (com Swing Big)',
      'Como o Caio montou (com Runner Runner)',
    ]);
    expect(options.every((option) => !(option as HTMLInputElement).checked)).toBe(true);
    const save = screen.getByRole('button', { name: 'Salvar' });
    expect(save).toBeDisabled();

    await user.click(options[0]!);
    expect(save).toBeEnabled();
    await user.click(save);

    expect(onSave).toHaveBeenCalledWith('original');
  });

  it('sends as_built when the sharer own list is picked', async () => {
    const user = userEvent.setup();
    const { onSave } = renderChoice();

    await user.click(screen.getAllByRole('radio')[1]!);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onSave).toHaveBeenCalledWith('as_built');
  });

  it('names several cards when several were swapped', () => {
    render(
      <SaveDeckChoice
        sharerName="Caio"
        originals={['Swing Big', 'Pummel']}
        replacements={['Runner Runner', 'Wounding Blow']}
        pending={false}
        failed={false}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('A lista antes das trocas do Caio (com Swing Big, Pummel)')).toBeInTheDocument();
    expect(screen.getByText('Como o Caio montou (com Runner Runner, Wounding Blow)')).toBeInTheDocument();
  });
});
