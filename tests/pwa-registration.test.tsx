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
  const unregister = vi.fn().mockResolvedValue(true);
  const getRegistrations = vi.fn().mockResolvedValue([{ unregister }]);

  beforeEach(() => {
    register.mockReset();
    unregister.mockClear();
    getRegistrations.mockClear();
    useEffectMock.mockReset();
    useEffectMock.mockImplementation((effect: () => void | (() => void)) => {
      effect();
    });

    vi.unstubAllEnvs();
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistrations, register },
    } as unknown as Navigator);
  });

  it('registers /sw.js once on mount in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    renderToStaticMarkup(<PwaRegistration />);
    await Promise.resolve();

    expect(register).toHaveBeenCalledWith('/sw.js', { updateViaCache: 'none' });
    expect(getRegistrations).not.toHaveBeenCalled();
  });

  it('unregisters existing service workers outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    renderToStaticMarkup(<PwaRegistration />);
    await Promise.resolve();
    await Promise.resolve();

    expect(register).not.toHaveBeenCalled();
    expect(getRegistrations).toHaveBeenCalledTimes(1);
    expect(unregister).toHaveBeenCalledTimes(1);
  });
});
