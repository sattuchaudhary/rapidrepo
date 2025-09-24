// Lightweight EventEmitter compatible with React Native (no Node stdlib)
class SimpleEventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  on(eventName, listener) {
    const listenersForEvent = this.listeners.get(eventName) || new Set();
    listenersForEvent.add(listener);
    this.listeners.set(eventName, listenersForEvent);
  }

  removeListener(eventName, listener) {
    const listenersForEvent = this.listeners.get(eventName);
    if (!listenersForEvent) return;
    listenersForEvent.delete(listener);
    if (listenersForEvent.size === 0) {
      this.listeners.delete(eventName);
    }
  }

  emit(eventName, payload) {
    const listenersForEvent = this.listeners.get(eventName);
    if (!listenersForEvent) return;
    // Clone to avoid mutation during emit
    Array.from(listenersForEvent).forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        // Swallow to avoid breaking other listeners
        console.warn('SimpleEventEmitter listener error:', error);
      }
    });
  }
}
import { runOptimizedBulkDownload, runMissingOnlySync } from './offlineSync';

// Singleton SyncManager to orchestrate a single global sync operation
class SyncManagerInternal {
  constructor() {
    this.emitter = new SimpleEventEmitter();
    this.isSyncing = false;
    this.progress = null;
    this.result = null;
  }

  subscribe(listener) {
    this.emitter.on('change', listener);
    return () => this.emitter.removeListener('change', listener);
  }

  emitChange() {
    this.emitter.emit('change', {
      isSyncing: this.isSyncing,
      progress: this.progress,
      result: this.result,
    });
  }

  getState() {
    return {
      isSyncing: this.isSyncing,
      progress: this.progress,
      result: this.result,
    };
  }

  async start(mode = 'optimized') {
    if (this.isSyncing) return { started: false };
    this.isSyncing = true;
    this.progress = { processed: 0, total: 0, percentage: 0 };
    this.result = null;
    this.emitChange();

    try {
      // Throttle progress updates to avoid blocking UI
      let lastEmitTime = 0;
      let lastPercent = -1;
      const MIN_INTERVAL_MS = 300;
      const MIN_PERCENT_STEP = 1;

      const handleProgress = (p) => {
        const now = Date.now();
        const pct = Math.max(0, Math.min(100, Math.round(p?.percentage || 0)));
        const shouldEmit =
          now - lastEmitTime >= MIN_INTERVAL_MS || Math.abs(pct - lastPercent) >= MIN_PERCENT_STEP;
        if (!shouldEmit) return;
        lastEmitTime = now;
        lastPercent = pct;
        this.progress = { ...p, percentage: pct };
        this.emitChange();
      };

      const res = mode === 'missing_only'
        ? await runMissingOnlySync(handleProgress)
        : await runOptimizedBulkDownload(handleProgress);
      this.result = res;
      return { started: true, result: res };
    } catch (e) {
      this.result = { success: false, message: e?.message || 'sync failed' };
      return { started: true, result: this.result };
    } finally {
      this.isSyncing = false;
      this.emitChange();
    }
  }
}

const SyncManager = new SyncManagerInternal();
export default SyncManager;


