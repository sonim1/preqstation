import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

type Journal = {
  entries: Array<{
    idx: number;
    tag: string;
    when: number;
  }>;
};

describe('drizzle task notifications migration', () => {
  it('keeps the task notifications migration registered in the journal', () => {
    const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
    const taskNotificationsMigration = journal.entries.find(
      (entry) => entry.tag === '0014_task_notifications',
    );

    expect(taskNotificationsMigration).toBeTruthy();
    expect(taskNotificationsMigration?.idx).toBe(14);
    expect(existsSync(path.join(process.cwd(), 'drizzle', 'meta', '0014_snapshot.json'))).toBe(
      true,
    );
  });

  it('creates the task_notifications table with owner RLS coverage', () => {
    const migrationPath = path.join(process.cwd(), 'drizzle', '0014_task_notifications.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE TABLE "task_notifications"');
    expect(sql).toContain('ALTER TABLE "task_notifications" ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE "task_notifications" FORCE ROW LEVEL SECURITY;');
    expect(sql).toContain('CREATE POLICY "task_notifications_owner_all"');
    expect(sql).toContain('CREATE INDEX "task_notifications_owner_id_read_at_created_at_idx"');
    expect(sql).toContain('CREATE INDEX "task_notifications_owner_id_created_at_idx"');
    expect(sql).toContain('CREATE INDEX "task_notifications_task_id_idx"');
  });
});
