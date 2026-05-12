# Offline Board

The board now includes an offline-first path for browser sessions. `/sw.js` caches same-origin
`/board`, `/board/:key`, and `/projects` navigations plus static assets so those workspace routes
can reopen after the user has already loaded them online at least once. While the browser is
online, `OfflineBoardRouteWarmer` also refreshes the current `/board` or `/board/:key` document
into the `preq-board-v2` cache so visited board routes stay warm between sync attempts. API
responses are not cached by the service worker.

Browser storage in IndexedDB (`preqstation-offline`) keeps three kinds of local state:

- recent board snapshots keyed by project so `/board` can hydrate while offline
- the latest projects-index snapshot so `/projects` can render cached project cards offline
- task-edit title/note drafts
- queued task create/edit/move/delete mutations for replay

While offline, quick-add, task edits, board moves, and task deletes are applied optimistically in the UI and
written to the local mutation queue. Once `/api/ping` reports the backend reachable again, the app
replays those mutations against the normal internal board APIs and replaces temporary `OFFLINE-*`
task keys with server-issued task keys after sync. If a replayed note edit conflicts with newer
server notes, or if a browser draft was based on an older server title, the conflicting patch is
removed from the queue, the latest server task snapshot is restored into the board/task panel, and
the saved local draft remains available for manual restore. Browser drafts whose title and note
fingerprints still match the latest server task are auto-saved after reconnect instead of asking the
user to restore them manually.

---
