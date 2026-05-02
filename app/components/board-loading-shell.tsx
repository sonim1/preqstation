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

import cardStyles from './cards.module.css';

const BOARD_LOADING_COLUMNS = [
  { titleWidth: 72, cards: [176, 142, 164] },
  { titleWidth: 88, cards: [168, 190, 132] },
  { titleWidth: 80, cards: [154, 176, 146] },
  { titleWidth: 76, cards: [188, 152, 170] },
  { titleWidth: 70, cards: [160, 138, 184] },
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

const BOARD_LOADING_ACTIONS = [42, 42, 42, 42, 42] as const;

function BoardLoadingCard({
  titleWidth,
  detailWidth,
  mobile = false,
}: {
  titleWidth: number;
  detailWidth: number;
  mobile?: boolean;
}) {
  return (
    <Paper
      p={0}
      radius={6}
      data-board-loading-mobile-card={mobile ? 'true' : undefined}
      data-board-loading-card={mobile ? undefined : 'true'}
      className={`${cardStyles.itemCard} ${cardStyles.kanbanCard}${mobile ? ' kanban-mobile-card' : ''}`}
    >
      <div className={cardStyles.kanbanCardFrame}>
        <div className={cardStyles.kanbanCardBody}>
          <div className={cardStyles.kanbanCardHead}>
            <div className={cardStyles.kanbanCardTopRow}>
              <Skeleton h={14} w={58} radius="sm" />
              <Skeleton h={20} w={20} radius="xl" />
              <span className={cardStyles.kanbanCardMenuSlot}>
                <Skeleton h={26} w={26} radius="xl" />
              </span>
            </div>
            <Skeleton h={18} w={titleWidth} maw="92%" radius="sm" />
            <Skeleton h={18} w={Math.max(92, titleWidth - 42)} maw="76%" radius="sm" />
          </div>
          <div className={cardStyles.kanbanMetaStack}>
            <div className={cardStyles.kanbanFooterBandTrack}>
              <Skeleton h={18} w={detailWidth} maw="72%" radius="xl" />
              <Skeleton h={18} w={48} radius="xl" />
            </div>
          </div>
        </div>
      </div>
    </Paper>
  );
}

export function BoardLoadingShell() {
  return (
    <Container className="dashboard-root is-board" fluid px={0} py={0}>
      <Stack gap="md" className="dashboard-stack is-board">
        <section className="kanban-stage">
          <div className="kanban-stage-content">
            <Box className="kanban-board-region" data-board-loading-shell="true">
              <Box className="board-loading-shell-mobile">
                <Tabs
                  value="inbox"
                  className="kanban-mobile-tabs"
                  data-board-loading-mobile-shell="true"
                >
                  <Box className="kanban-mobile-board-wrapper">
                    <Box className="kanban-mobile-panels">
                      <TabsPanel value="inbox" className="kanban-mobile-panel">
                        <Box className="kanban-mobile-panel-body kanban-fill-height">
                          <Box className="kanban-mobile-panel-list kanban-fill-height kanban-bottom-clearance">
                            {BOARD_LOADING_MOBILE_CARDS.map((card) => (
                              <BoardLoadingCard
                                key={`${card.keyWidth}-${card.titleWidth}`}
                                titleWidth={card.titleWidth}
                                detailWidth={card.detailWidth}
                                mobile
                              />
                            ))}
                            <Box className="kanban-column-drop-tail" aria-hidden="true" />
                            <Box className="kanban-bottom-gradient" aria-hidden="true" />
                          </Box>
                        </Box>
                      </TabsPanel>
                    </Box>
                  </Box>

                  <Box className="kanban-mobile-controls-wrapper">
                    <Box
                      className="kanban-action-island-anchor kanban-mobile-action-island-anchor"
                      data-board-loading-mobile-actions="true"
                    >
                      <Box className="kanban-action-island">
                        {BOARD_LOADING_ACTIONS.map((size, index) => (
                          <Skeleton key={index} h={size} w={size} radius="xl" />
                        ))}
                      </Box>
                    </Box>

                    <Box className="kanban-mobile-tab-bar">
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
                    </Box>
                  </Box>
                </Tabs>
              </Box>

              <Box className="board-loading-shell-desktop">
                <Box className="kanban-scroll kanban-fullscreen">
                  <Box className="kanban-board-shell">
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
                              {column.cards.map((titleWidth, cardIndex) => (
                                <BoardLoadingCard
                                  key={`${index}-${cardIndex}`}
                                  titleWidth={titleWidth}
                                  detailWidth={Math.max(96, titleWidth - 34)}
                                />
                              ))}
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
            </Box>
          </div>
        </section>
      </Stack>
    </Container>
  );
}
