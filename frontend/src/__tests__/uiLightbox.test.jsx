/**
 * @file Tests de Lightbox (componente ui/ nuevo — issue #130).
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Lightbox } from '../components/ui';

const IMAGES = [
  { url: 'https://example.com/a.png', caption: 'Primera' },
  { url: 'https://example.com/b.png', caption: 'Segunda' },
  { url: 'https://example.com/c.png' },
];

describe('Lightbox', () => {
  it('no renderiza nada si images está vacío', () => {
    const { container } = render(
      <Lightbox images={[]} index={0} onIndexChange={() => {}} onClose={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza la imagen del índice actual + caption + contador', () => {
    render(
      <Lightbox images={IMAGES} index={1} onIndexChange={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByAltText('Segunda')).toHaveAttribute('src', 'https://example.com/b.png');
    expect(screen.getByText('Segunda')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('sin caption no revienta y no muestra párrafo de caption', () => {
    render(
      <Lightbox images={IMAGES} index={2} onIndexChange={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByAltText('')).toBeInTheDocument();
  });

  it('click en X dispara onClose', () => {
    const onClose = vi.fn();
    render(<Lightbox images={IMAGES} index={0} onIndexChange={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('click fuera de la imagen (overlay) dispara onClose', () => {
    const onClose = vi.fn();
    render(<Lightbox images={IMAGES} index={0} onIndexChange={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('click en la imagen NO dispara onClose (stopPropagation)', () => {
    const onClose = vi.fn();
    render(<Lightbox images={IMAGES} index={0} onIndexChange={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByAltText('Primera'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('flechas siguiente/anterior llaman onIndexChange con wraparound', () => {
    const onIndexChange = vi.fn();
    render(
      <Lightbox images={IMAGES} index={2} onIndexChange={onIndexChange} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(onIndexChange).toHaveBeenCalledWith(0); // wraparound al final
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it('con una sola imagen no muestra flechas de navegación', () => {
    render(
      <Lightbox images={[IMAGES[0]]} index={0} onIndexChange={() => {}} onClose={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anterior' })).not.toBeInTheDocument();
  });

  it('teclado: Escape cierra, ArrowRight/ArrowLeft navegan', () => {
    const onClose = vi.fn();
    const onIndexChange = vi.fn();
    render(
      <Lightbox images={IMAGES} index={0} onIndexChange={onIndexChange} onClose={onClose} />,
    );
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onIndexChange).toHaveBeenCalledWith(1);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onIndexChange).toHaveBeenCalledWith(2); // wraparound hacia atrás desde 0
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
