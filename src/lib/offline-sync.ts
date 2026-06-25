// Offline-first draft management — saves work locally, syncs when online
// Keys: `draft:report-{reportId}` for full draft, `queue:pending` for sync tasks

interface DraftReport {
  id: string;
  summary: string;
  workLocation: string;
  items: { id?: string; category: string; description: string; source: string }[];
  updatedAt: string;
}

interface SyncTask {
  id: string;
  type: "update" | "addItem" | "removeItem" | "uploadAttachment";
  reportId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  retries: number;
}

const STORAGE_KEY_DRAFT = "draft:report";
const STORAGE_KEY_QUEUE = "queue:pending";

export function saveDraftLocally(report: DraftReport): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEY_DRAFT}-${report.id}`, JSON.stringify({
      ...report,
      updatedAt: new Date().toISOString(),
    }));
  } catch (e) {
    console.error("[offline] Failed to save draft:", e);
  }
}

export function loadDraftLocally(reportId: string): DraftReport | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const data = localStorage.getItem(`${STORAGE_KEY_DRAFT}-${reportId}`);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error("[offline] Failed to load draft:", e);
    return null;
  }
}

export function clearDraftLocally(reportId: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(`${STORAGE_KEY_DRAFT}-${reportId}`);
  } catch (e) {
    console.error("[offline] Failed to clear draft:", e);
  }
}

export function enqueueSyncTask(task: Omit<SyncTask, "retries" | "createdAt">): void {
  if (typeof localStorage === "undefined") return;
  try {
    const queue = getSyncQueue();
    queue.push({
      ...task,
      retries: 0,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(queue));
  } catch (e) {
    console.error("[offline] Failed to enqueue sync task:", e);
  }
}

export function getSyncQueue(): SyncTask[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY_QUEUE);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("[offline] Failed to load sync queue:", e);
    return [];
  }
}

export function removeSyncTask(taskId: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    const queue = getSyncQueue().filter(t => t.id !== taskId);
    localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(queue));
  } catch (e) {
    console.error("[offline] Failed to remove sync task:", e);
  }
}

export function updateSyncTaskRetries(taskId: string, retries: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    const queue = getSyncQueue().map(t => t.id === taskId ? { ...t, retries } : t);
    localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(queue));
  } catch (e) {
    console.error("[offline] Failed to update sync task retries:", e);
  }
}

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine ?? true;
}

export function useOnlineStatus(callback: (online: boolean) => void): (() => void) | undefined {
  if (typeof window === "undefined") return;

  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}
