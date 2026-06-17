const API = {
  async request(path, options = {}) {
    const res = await fetch('/api' + path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    });
    if (res.status === 401) {
      location.href = '/login.html';
      throw new Error('Unauthorized');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Ralat server.');
    return data;
  },
  get: (path) => API.request(path),
  post: (path, body) => API.request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => API.request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => API.request(path, { method: 'DELETE' })
};
