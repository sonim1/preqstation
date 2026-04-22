import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const selectPropsMock = vi.hoisted(() => vi.fn());

vi.mock('@mantine/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/core')>();

  return {
    ...actual,
    Button: ({
      children,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Select: (props: {
      ariaLabel?: string;
      data?: Array<{ value: string; label: string }>;
      description?: string;
      label?: string;
      onChange?: (value: string | null) => void;
      placeholder?: string;
      searchable?: boolean;
      value?: string | null;
    }) => {
      selectPropsMock(props);
      return <div data-slot="timezone-select" />;
    },
    Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Text: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

type TimezoneSettingsComponent = (props: { defaultValue: string }) => React.ReactElement;

async function loadTimezoneSettings() {
  try {
    return (await import('@/app/components/timezone-settings')).TimezoneSettings as
      | TimezoneSettingsComponent
      | undefined;
  } catch {
    return undefined;
  }
}

function renderTimezoneSettings(Component: TimezoneSettingsComponent, defaultValue: string) {
  selectPropsMock.mockReset();
  return renderToStaticMarkup(<Component defaultValue={defaultValue} />);
}

describe('app/components/timezone-settings', () => {
  const originalSupportedValuesOf = Intl.supportedValuesOf;

  afterEach(() => {
    Intl.supportedValuesOf = originalSupportedValuesOf;
  });

  it('renders a searchable timezone selector using supported IANA values when available', async () => {
    Intl.supportedValuesOf = vi.fn(() => [
      'America/Toronto',
      'UTC',
    ]) as typeof Intl.supportedValuesOf;

    const TimezoneSettings = await loadTimezoneSettings();

    expect(typeof TimezoneSettings).toBe('function');
    const html = renderTimezoneSettings(TimezoneSettings!, 'America/Toronto');

    expect(html).toContain('Save timezone');
    expect(selectPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Timezone',
        searchable: true,
        value: 'America/Toronto',
        data: [
          { value: 'America/Toronto', label: 'America/Toronto' },
          { value: 'UTC', label: 'UTC' },
        ],
      }),
    );
  });

  it('falls back to the saved timezone when supportedValuesOf is unavailable', async () => {
    // @ts-expect-error test fallback branch
    delete Intl.supportedValuesOf;

    const TimezoneSettings = await loadTimezoneSettings();

    expect(typeof TimezoneSettings).toBe('function');
    renderTimezoneSettings(TimezoneSettings!, 'America/New_York');

    expect(selectPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 'America/New_York',
        data: [{ value: 'America/New_York', label: 'America/New_York' }],
      }),
    );
  });
});
