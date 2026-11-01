import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SpareRowMenu } from '../SpareRowMenu';

function renderMenu(onWhy: () => void = vi.fn()): { trigger: HTMLElement; onLinkClick: ReturnType<typeof vi.fn> } {
  render(
    <>
      <SpareRowMenu name="Snatch" cardName="Snatch" onWhy={onWhy} />
      <input aria-label="sheet field" />
    </>,
  );
  const onLinkClick = vi.fn((event: Event) => event.preventDefault());
  return { trigger: screen.getByRole('button', { name: /^Mais ações de Snatch/ }), onLinkClick };
}

async function openWithKeyboard(trigger: HTMLElement): Promise<void> {
  trigger.focus();
  await userEvent.keyboard('{Enter}');
}

describe('SpareRowMenu focus after an item is activated with the keyboard', () => {
  it('returns focus to the button after "Por que sobra?"', async () => {
    const onWhy = vi.fn();
    const { trigger } = renderMenu(onWhy);
    await openWithKeyboard(trigger);

    await userEvent.keyboard('{Enter}');

    expect(onWhy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('returns focus to the button after "Ver na LigaFAB"', async () => {
    const { trigger, onLinkClick } = renderMenu();
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{ArrowDown}');
    screen.getByRole('menuitem', { name: /Ver na LigaFAB/ }).addEventListener('click', onLinkClick);

    await userEvent.keyboard('{Enter}');

    expect(onLinkClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('activates "Ver na LigaFAB" with Space, like the other item', async () => {
    const { trigger, onLinkClick } = renderMenu();
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{ArrowDown}');
    screen.getByRole('menuitem', { name: /Ver na LigaFAB/ }).addEventListener('click', onLinkClick);

    await userEvent.keyboard(' ');

    expect(onLinkClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('activates "Por que sobra?" with Space', async () => {
    const onWhy = vi.fn();
    const { trigger } = renderMenu(onWhy);
    await openWithKeyboard(trigger);

    await userEvent.keyboard(' ');

    expect(onWhy).toHaveBeenCalledTimes(1);
  });

  it('leaves the focus where an opened sheet put it', async () => {
    const field = (): HTMLElement => screen.getByLabelText('sheet field');
    const { trigger } = renderMenu(() => field().focus());
    await openWithKeyboard(trigger);

    await userEvent.keyboard('{Enter}');

    expect(field()).toHaveFocus();
  });
});
