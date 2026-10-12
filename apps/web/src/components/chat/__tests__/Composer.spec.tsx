import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Composer } from '../Composer';

function renderComposer(onSend = vi.fn()) {
  function Harness(): React.ReactElement {
    const [value, setValue] = React.useState('');
    return <Composer value={value} onChange={setValue} onSend={onSend} placeholder="Pergunte ao Tutor" disabled={false} error={null} />;
  }
  render(<Harness />);
  return { onSend, textbox: screen.getByRole('textbox', { name: 'Mensagem para o Tutor' }), send: screen.getByRole('button', { name: 'Enviar' }) };
}

describe('Composer', () => {
  it('the composer sends on Enter and only with text', async () => {
    const user = userEvent.setup();
    const { onSend, textbox, send } = renderComposer();

    expect(send).toBeDisabled();
    await user.type(textbox, '   ');
    expect(send).toBeDisabled();
    await user.keyboard('{Enter}');
    expect(onSend).not.toHaveBeenCalled();
    expect(textbox).toHaveAttribute('maxLength', '4000');

    await user.clear(textbox);
    await user.type(textbox, 'linha um');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(onSend).not.toHaveBeenCalled();
    expect(textbox).toHaveValue('linha um\n');

    await user.type(textbox, 'linha dois');
    expect(send).toBeEnabled();
    await user.keyboard('{Enter}');
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('linha um\nlinha dois');
  });
});
