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
// OFFLINE/SYNC DISABLED: provide inert manager preserving API shape
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
      isSyncing: false,
      progress: null,
      result: this.result,
    });
  }

  getState() {
    return {
      isSyncing: false,
      progress: null,
      result: this.result,
    };
  }

  async start(mode = 'optimized') {
    this.result = { success: false, message: 'offline sync disabled' };
    this.emitChange();
    return { started: true, result: this.result };
  }
}

const SyncManager = new SyncManagerInternal();
export default SyncManager;


