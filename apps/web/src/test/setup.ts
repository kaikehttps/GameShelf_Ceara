import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Desmonta os componentes renderizados entre um teste e outro.
afterEach(() => {
  cleanup();
});
