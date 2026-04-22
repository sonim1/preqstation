import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useEffectMock = vi.hoisted(() => vi.fn());

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useEffect: useEffectMock,
  };
});

import { PwaRegistration } from '@/app/components/pwa-registration';

describe('app/components/pwa-registration', () => {
  const register = vi.fn().mockResolvedValue({});

  beforeEach(() => {
    register.mockReset();
    useEffectMock.mockReset();
    useEffectMock.mockImplementation((effect: () => void | (() => void)) => {
      effect();
    });

    vi.stubGlobal('navigator', {
      serviceWorker: { register },
    } as unknown as Navigator);
  });

  it('registers /sw.js once on mount', async () => {
    renderToStaticMarkup(<PwaRegistration />);
    await Promise.resolve();

    expect(register).toHaveBeenCalledWith('/sw.js');
  });
});
