import { Center, Container, Stack, Text } from '@mantine/core';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <Center mih="100vh">
      <Container size={600} w="100%" py="xl">
        <Stack gap="xl">
          <Text ta="center" fw={700} size="lg">
            Preq Station
          </Text>
          {children}
        </Stack>
      </Container>
    </Center>
  );
}
