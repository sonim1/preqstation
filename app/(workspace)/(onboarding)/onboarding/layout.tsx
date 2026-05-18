import { Center, Container, Stack, Text } from '@mantine/core';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <Center mih="100vh" className="onboarding-shell">
      <Container size={600} w="100%" py="xl" className="onboarding-shell-frame">
        <Stack gap="xl">
          <Text ta="center" fw={700} size="lg" className="onboarding-brand">
            Preq Station
          </Text>
          {children}
        </Stack>
      </Container>
    </Center>
  );
}
