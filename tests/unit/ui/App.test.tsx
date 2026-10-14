// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../../src/ui/App';

afterEach(cleanup);

describe('App', () => {
  it('muestra el aviso de entorno no apto para pagos', () => {
    render(<App />);
    expect(screen.getByRole('note')).toHaveTextContent('No apto para pagos');
    expect(screen.getByRole('note')).toHaveTextContent('PENDIENTE DE HOMOLOGACION');
  });
});
