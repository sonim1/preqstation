type TaskEditRefreshState = {
  blocked: boolean;
  pending: boolean;
};

let state: TaskEditRefreshState = {
  blocked: false,
  pending: false,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

export function getTaskEditRefreshState() {
  return state;
}

export function subscribeTaskEditRefresh(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setTaskEditRefreshBlocked(blocked: boolean) {
  if (state.blocked === blocked) {
    return;
  }

  state = { ...state, blocked };
  notifyListeners();
}

export function markPendingTaskEditRefresh() {
  if (state.pending) {
    return;
  }

  state = { ...state, pending: true };
  notifyListeners();
}

export function consumePendingTaskEditRefresh() {
  if (!state.pending) {
    return false;
  }

  state = { ...state, pending: false };
  notifyListeners();
  return true;
}
