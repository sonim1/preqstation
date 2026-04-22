import '@mantine/core/styles.css';
import '@mantine/charts/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/spotlight/styles.css';
import './globals.css';

import { ColorSchemeScript } from '@mantine/core';
import type { Metadata } from 'next';

import { PwaRegistration } from './components/pwa-registration';
import { Providers } from './providers';
import { COLOR_SCHEME_STORAGE_KEY, DEFAULT_COLOR_SCHEME } from './theme-config';

export const metadata: Metadata = {
  title: 'Preq Station',
  description: 'Owner-only personal projects manager',
  manifest: '/manifest.webmanifest',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      'max-image-preview': 'none',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript
          defaultColorScheme={DEFAULT_COLOR_SCHEME}
          localStorageKey={COLOR_SCHEME_STORAGE_KEY}
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
        <PwaRegistration />
      </body>
    </html>
  );
}
