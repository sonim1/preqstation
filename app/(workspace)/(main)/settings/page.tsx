import {
  Container,
  Paper,
  Stack,
  Table,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
  Title,
} from '@mantine/core';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import classes from '@/app/(workspace)/(main)/settings/settings-page.module.css';
import { KitchenModeSettings } from '@/app/components/kitchen-mode-settings';
import panelStyles from '@/app/components/panels.module.css';
import { SyncSettings } from '@/app/components/sync-settings';
import { TaskPriorityIcon } from '@/app/components/task-priority-icon';
import { TelegramSettings } from '@/app/components/telegram-settings';
import { TimezoneSettings } from '@/app/components/timezone-settings';
import { WorkspacePageHeader } from '@/app/components/workspace-page-header';
import { writeAuditLog } from '@/lib/audit';
import { withOwnerDb } from '@/lib/db/rls';
import { getOwnerUserOrNull, requireOwnerUser } from '@/lib/owner';
import { TASK_PRIORITIES, TASK_PRIORITY_LABEL } from '@/lib/task-meta';
import { encryptTelegramToken } from '@/lib/telegram-crypto';
import { resolveTerminology } from '@/lib/terminology';
import { getUserSettings, SETTING_KEYS, setUserSetting } from '@/lib/user-settings';

export default async function SettingsPage() {
  const owner = await getOwnerUserOrNull();
  if (!owner) redirect('/login?reason=auth');

  const settings = await withOwnerDb(owner.id, async (client) => getUserSettings(owner.id, client));
  const terminology = resolveTerminology(settings.kitchen_mode === 'true');

  async function updateTelegramSettings(_prevState: unknown, formData: FormData) {
    'use server';
    const ownerUser = await requireOwnerUser();

    const botTokenInput = String(formData.get('telegram_bot_token') || '').trim();
    const chatId = String(formData.get('telegram_chat_id') || '').trim();
    const telegramEnabled = String(formData.get('telegram_enabled') || '') === 'true';

    const result = await withOwnerDb(ownerUser.id, async (client) => {
      const currentSettings = await getUserSettings(ownerUser.id, client);
      let encryptedToken = currentSettings[SETTING_KEYS.TELEGRAM_BOT_TOKEN] || '';
      if (botTokenInput) {
        encryptedToken = await encryptTelegramToken(botTokenInput);
      }

      if (telegramEnabled && !chatId) {
        return {
          ok: false as const,
          field: 'chatId' as const,
          message: 'Chat ID is required to enable Telegram.',
        };
      }

      if (telegramEnabled && !encryptedToken) {
        return {
          ok: false as const,
          field: 'botToken' as const,
          message: 'Bot Token is required to enable Telegram.',
        };
      }

      await Promise.all([
        setUserSetting(ownerUser.id, SETTING_KEYS.TELEGRAM_BOT_TOKEN, encryptedToken, client),
        setUserSetting(ownerUser.id, SETTING_KEYS.TELEGRAM_CHAT_ID, chatId, client),
        setUserSetting(
          ownerUser.id,
          SETTING_KEYS.TELEGRAM_ENABLED,
          telegramEnabled ? 'true' : 'false',
          client,
        ),
      ]);

      await writeAuditLog(
        {
          ownerId: ownerUser.id,
          action: 'telegram.settings_updated',
          targetType: 'setting',
          meta: {
            telegramEnabled,
            chatId,
            tokenUpdated: Boolean(botTokenInput),
          },
        },
        client,
      );

      return { ok: true as const, message: 'Telegram settings saved.' };
    });
    if (!result.ok) return result;

    revalidatePath('/settings');
    return result;
  }

  return (
    <Container
      className="dashboard-root"
      fluid
      px={{ base: 'sm', sm: 'md', lg: 'lg', xl: 'xl' }}
      py={{ base: 'md', sm: 'xl' }}
    >
      <Stack gap="md" className={`dashboard-stack ${classes.page}`} data-settings-style="desk">
        <WorkspacePageHeader
          title={`${terminology.task.singular} Settings`}
          description={`Manage workspace preferences and ${terminology.task.singularLower} priority symbols.`}
        />

        <Paper
          withBorder
          radius="lg"
          p={{ base: 'md', sm: 'lg' }}
          className={`${panelStyles.sectionPanel} ${classes.section}`}
        >
          <div className={classes.sectionHeader}>
            <div className={classes.sectionTitleGroup}>
              <Title component="h2" order={3} className={classes.sectionTitle}>
                Priority Icons
              </Title>
              <Text className={classes.sectionDescription} size="sm">
                Reference the symbols used across dashboards, lists, and task rows.
              </Text>
            </div>
          </div>
          <div className={classes.sectionBody}>
            <Table withTableBorder withColumnBorders highlightOnHover>
              <TableThead>
                <TableTr>
                  <TableTh>Priority</TableTh>
                  <TableTh>Icon</TableTh>
                </TableTr>
              </TableThead>
              <TableTbody>
                {TASK_PRIORITIES.map((priority) => (
                  <TableTr key={priority}>
                    <TableTd>{TASK_PRIORITY_LABEL[priority]}</TableTd>
                    <TableTd>
                      <TaskPriorityIcon priority={priority} size={16} />
                    </TableTd>
                  </TableTr>
                ))}
              </TableTbody>
            </Table>
          </div>
        </Paper>

        <Paper
          withBorder
          radius="lg"
          p={{ base: 'md', sm: 'lg' }}
          className={`${panelStyles.sectionPanel} ${classes.section}`}
        >
          <div className={classes.sectionHeader}>
            <div className={classes.sectionTitleGroup}>
              <Title component="h2" order={3} className={classes.sectionTitle}>
                Workspace Preferences
              </Title>
              <Text className={classes.sectionDescription} size="sm">
                Keep display terminology, timezone, and live refresh behavior together in one
                lighter settings group.
              </Text>
            </div>
          </div>
          <div className={classes.preferenceList} data-settings-group="workspace-preferences">
            <section className={classes.preferenceItem} data-settings-item="kitchen-mode">
              <div className={classes.preferenceHeader}>
                <Text fw={600} className={classes.preferenceTitle}>
                  Kitchen Mode
                </Text>
                <Text className={classes.preferenceDescription} size="sm">
                  Switch mapped UI copy for work items and workflow statuses across the app.
                </Text>
              </div>
              <div className={classes.preferenceBody}>
                <KitchenModeSettings defaultValue={settings.kitchen_mode === 'true'} />
              </div>
            </section>

            <section className={classes.preferenceItem} data-settings-item="timezone">
              <div className={classes.preferenceHeader}>
                <Text fw={600} className={classes.preferenceTitle}>
                  Timezone
                </Text>
                <Text className={classes.preferenceDescription} size="sm">
                  Save the IANA timezone used for dates, timestamps, and today logic.
                </Text>
              </div>
              <div className={classes.preferenceBody}>
                <TimezoneSettings defaultValue={settings.timezone} />
              </div>
            </section>

            <section className={classes.preferenceItem} data-settings-item="live-sync">
              <div className={classes.preferenceHeader}>
                <Text fw={600} className={classes.preferenceTitle}>
                  Live Sync
                </Text>
                <Text className={classes.preferenceDescription} size="sm">
                  Choose how often the workspace checks for API changes while the backend is
                  reachable.
                </Text>
              </div>
              <div className={classes.preferenceBody}>
                <SyncSettings defaultValue={settings.sync_interval} />
              </div>
            </section>
          </div>
        </Paper>

        <Paper
          withBorder
          radius="lg"
          p={{ base: 'md', sm: 'lg' }}
          className={`${panelStyles.sectionPanel} ${classes.section}`}
        >
          <div className={classes.sectionHeader}>
            <div className={classes.sectionTitleGroup}>
              <Title component="h2" order={3} className={classes.sectionTitle}>
                Telegram
              </Title>
              <Text className={classes.sectionDescription} size="sm">
                {`Save your Telegram bot configuration and test connectivity before enabling ${terminology.task.singularLower} message sends.`}
              </Text>
            </div>
          </div>
          <div className={classes.sectionBody}>
            <TelegramSettings
              action={updateTelegramSettings}
              defaultChatId={settings.telegram_chat_id}
              defaultEnabled={settings.telegram_enabled === 'true'}
              hasSavedBotToken={Boolean(settings.telegram_bot_token)}
            />
          </div>
        </Paper>
      </Stack>
    </Container>
  );
}
