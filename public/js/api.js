const API = {
  async request(path, options = {}) {
    const { _skipOffline, _fromQueue, ...fetchOpts } = options;
    const method = (fetchOpts.method || 'GET').toUpperCase();

    function parseBody() {
      if (!fetchOpts.body) return null;
      try { return JSON.parse(fetchOpts.body); } catch { return null; }
    }

    function runOffline() {
      if (_skipOffline || typeof Offline === 'undefined') {
        throw new Error('Tiada sambungan internet.');
      }
      return Offline.handle(method, path, parseBody());
    }

    if (!_skipOffline && typeof Offline !== 'undefined' && !Offline.isOnline()) {
      try {
        return runOffline();
      } catch (err) {
        if (err.status === 401) location.href = '/login.html';
        throw err;
      }
    }

    try {
      const res = await fetch('/api' + path, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...fetchOpts.headers },
        ...fetchOpts
      });

      if (res.status === 401) {
        location.href = '/login.html';
        throw new Error('Unauthorized');
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Ralat server.');

      if (!_fromQueue && typeof Offline !== 'undefined' && method === 'GET') {
        if (path === '/me') Offline.cacheMe(data);
        if (path === '/clients') Offline.cacheClients(data);
        if (path === '/auth/check' && data.authenticated && data.user) {
          Offline.setSession(data.user);
        }
      }

      return data;
    } catch (err) {
      if (err.message === 'Unauthorized') throw err;
      if (!_skipOffline && typeof Offline !== 'undefined') {
        try {
          return runOffline();
        } catch (offlineErr) {
          if (offlineErr.status === 401) location.href = '/login.html';
          throw offlineErr;
        }
      }
      throw err;
    }
  },
  get: (path) => API.request(path),
  post: (path, body) => API.request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => API.request(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) => API.request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => API.request(path, { method: 'DELETE' })
};

function registerPseServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW register failed', err);
    });
  });
}

registerPseServiceWorker();
