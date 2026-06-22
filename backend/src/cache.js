class MemoryCache {
  constructor(defaultTTL = 60000) {
    this._store = new Map();
    this._defaultTTL = defaultTTL;
    this._interval = setInterval(() => this._evict(), 30000);
    this._interval.unref();
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttlMs) {
    this._store.set(key, { value, expiresAt: Date.now() + (ttlMs || this._defaultTTL) });
  }

  del(key) {
    this._store.delete(key);
  }

  flush(pattern) {
    if (!pattern) { this._store.clear(); return; }
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const key of this._store.keys()) {
      if (regex.test(key)) this._store.delete(key);
    }
  }

  _evict() {
    const now = Date.now();
    for (const [key, entry] of this._store) {
      if (now > entry.expiresAt) this._store.delete(key);
    }
  }

  destroy() {
    clearInterval(this._interval);
    this._store.clear();
  }
}

module.exports = new MemoryCache();
