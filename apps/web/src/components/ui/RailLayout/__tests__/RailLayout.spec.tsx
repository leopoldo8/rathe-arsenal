import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IndexRail, RailLayout, StepsRail } from '..';

describe('RailLayout', () => {
  it('draws the rail as a labelled complementary region next to the content', () => {
    render(
      <RailLayout railLabel="Passos" rail={<span>the rail</span>} head={<h1>Title</h1>}>
        <p>the content</p>
      </RailLayout>,
    );

    const rail = screen.getByRole('complementary', { name: 'Passos' });
    expect(rail).toHaveTextContent('the rail');
    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument();
    expect(screen.getByText('the content')).toBeInTheDocument();
  });

  it('draws the content alone when there is no rail', () => {
    render(
      <RailLayout railLabel="Passos" rail={null}>
        <p>the content</p>
      </RailLayout>,
    );

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.getByText('the content')).toBeInTheDocument();
  });

  it('keeps the phone reading order: the content first when the rail goes below it', () => {
    render(
      <RailLayout railLabel="Formas" rail={<span>ways in</span>} railOnPhone="below">
        <p>paste box</p>
      </RailLayout>,
    );

    const content = screen.getByText('paste box');
    const rail = screen.getByRole('complementary', { name: 'Formas' });
    expect(content.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps the rail first when it is hidden or drawn above the content on a phone', () => {
    render(
      <RailLayout railLabel="Passos" rail={<span>steps</span>} railOnPhone="above">
        <p>content</p>
      </RailLayout>,
    );

    const rail = screen.getByRole('complementary', { name: 'Passos' });
    expect(rail.compareDocumentPosition(screen.getByText('content')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('StepsRail', () => {
  it('marks only the current step', () => {
    render(<StepsRail steps={[{ label: 'One' }, { label: 'Two' }, { label: 'Three' }]} current={1} />);

    expect(screen.getByText('Two').closest('[aria-current]')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('One').closest('[aria-current]')).toBeNull();
    expect(screen.getByText('Three').closest('[aria-current]')).toBeNull();
  });
});

describe('IndexRail', () => {
  it('links to each section and marks the one that was picked', () => {
    render(
      <>
        <IndexRail items={[{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }, { id: 'c', label: 'Danger', tone: 'danger' }]} />
        <section id="a">A</section>
        <section id="b">B</section>
        <section id="c">C</section>
      </>,
    );
    Element.prototype.scrollIntoView = (): void => undefined;

    expect(screen.getByRole('link', { name: 'Alpha' })).toHaveAttribute('href', '#a');
    expect(screen.getByRole('link', { name: 'Alpha' })).toHaveAttribute('aria-current', 'location');

    fireEvent.click(screen.getByRole('link', { name: 'Beta' }));

    expect(screen.getByRole('link', { name: 'Beta' })).toHaveAttribute('aria-current', 'location');
    expect(screen.getByRole('link', { name: 'Alpha' })).not.toHaveAttribute('aria-current');
  });
});
