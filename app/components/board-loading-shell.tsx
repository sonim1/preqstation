import {
  Box,
  Container,
  Paper,
  Skeleton,
  Stack,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from '@mantine/core';

const BOARD_LOADING_COLUMNS = [
  { titleWidth: 72, bodyMinHeight: 280 },
  { titleWidth: 88, bodyMinHeight: 340 },
  { titleWidth: 80, bodyMinHeight: 300 },
  { titleWidth: 76, bodyMinHeight: 320 },
  { titleWidth: 70, bodyMinHeight: 260 },
] as const;

const BOARD_LOADING_MOBILE_TABS = [
  { value: 'inbox', labelWidth: 34, countWidth: 18 },
  { value: 'todo', labelWidth: 48, countWidth: 18 },
  { value: 'ready', labelWidth: 42, countWidth: 18 },
  { value: 'done', labelWidth: 36, countWidth: 18 },
] as const;

const BOARD_LOADING_MOBILE_CARDS = [
  { keyWidth: 56, titleWidth: 176, detailWidth: 124 },
  { keyWidth: 52, titleWidth: 154, detailWidth: 112 },
  { keyWidth: 60, titleWidth: 168, detailWidth: 118 },
] as const;

export function BoardLoadingShell() {
  return (
    <Container className="dashboard-root is-board" fluid px={0} py={0}>
      <Stack gap="md" className="dashboard-stack is-board">
        <section className="kanban-stage">
          <Box className="kanban-scroll" data-board-loading-shell="true">
            <Box className="kanban-fullscreen">
              <Box className="board-loading-shell-mobile">
                <Tabs
                  value="inbox"
                  className="kanban-mobile-tabs"
                  data-board-loading-mobile-shell="true"
                >
                  <TabsList>
                    {BOARD_LOADING_MOBILE_TABS.map((tab) => (
                      <TabsTab
                        key={tab.value}
                        value={tab.value}
                        disabled
                        className="kanban-mobile-tab"
                        data-board-loading-mobile-tab="true"
                      >
                        <span className="kanban-mobile-tab-shell">
                          <span className="kanban-mobile-tab-copy">
                            <span className="kanban-mobile-tab-label">
                              <Skeleton h={10} w={tab.labelWidth} radius="sm" />
                            </span>
                          </span>
                          <span className="kanban-mobile-tab-count">
                            <Skeleton h={16} w={tab.countWidth} radius="xl" />
                          </span>
                        </span>
                      </TabsTab>
                    ))}
                  </TabsList>

                  <Box className="kanban-mobile-panels">
                    <TabsPanel value="inbox" className="kanban-mobile-panel">
                      <Box className="kanban-mobile-panel-body kanban-fill-height">
                        <Box className="kanban-mobile-panel-list kanban-fill-height kanban-bottom-clearance">
                          {BOARD_LOADING_MOBILE_CARDS.map((card, index) => (
                            <Paper
                              key={index}
                              data-board-loading-mobile-card="true"
                              radius={6}
                              p="md"
                              className="kanban-mobile-card"
                              style={{
                                background: 'var(--ui-card-bg)',
                                boxShadow:
                                  '0 16px 30px -24px rgba(21, 45, 89, 0.28), 0 6px 14px -10px rgba(21, 45, 89, 0.14)',
                              }}
                            >
                              <Stack gap={8}>
                                <Skeleton h={10} w={card.keyWidth} radius="sm" />
                                <Skeleton h={14} w={card.titleWidth} radius="sm" />
                                <Skeleton h={10} w={card.detailWidth} radius="sm" />
                              </Stack>
                            </Paper>
                          ))}
                          <Box className="kanban-column-drop-tail" aria-hidden="true" />
                          <Box className="kanban-bottom-gradient" aria-hidden="true" />
                        </Box>
                      </Box>
                    </TabsPanel>
                  </Box>
                </Tabs>
              </Box>

              <Box className="board-loading-shell-desktop">
                <Box className="kanban-grid">
                  {BOARD_LOADING_COLUMNS.map((column, index) => (
                    <Paper
                      key={index}
                      data-board-loading-column="true"
                      radius={0}
                      p="sm"
                      className="kanban-column"
                      style={{ background: 'transparent' }}
                    >
                      <Box
                        className="kanban-column-header"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                      >
                        <Skeleton h={18} w={column.titleWidth} radius="sm" />
                        <Skeleton h={22} w={26} radius="xl" />
                      </Box>

                      <Box className="kanban-column-body" data-board-loading-body="true">
                        <Box className="kanban-column-list kanban-fill-height kanban-bottom-clearance">
                          <Skeleton
                            radius="xl"
                            style={{
                              minHeight: column.bodyMinHeight,
                              flex: '1 1 auto',
                              opacity: 0.7,
                            }}
                          />
                          <Box className="kanban-column-drop-tail" aria-hidden="true" />
                          <Box className="kanban-bottom-gradient" aria-hidden="true" />
                        </Box>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              </Box>
            </Box>
          </Box>
        </section>
      </Stack>
    </Container>
  );
}
