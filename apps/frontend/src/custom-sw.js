importScripts('./ngsw-worker.js');

// Listen to sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'issue-sync') {
    event.waitUntil(drainOfflineQueue());
  }
});

// Helper to open IndexedDB and retrieve the pending queue + access token
function openDB() {
  return new Promise((resolve, reject) => {
    // The DB name used in OfflineQueueService is 'dd-offline'
    const request = indexedDB.open('dd-offline', 2);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getStoreData(db, storeName) {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) {
      return resolve([]);
    }
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function getAuthToken(db) {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains('auth-store')) {
      return resolve(null);
    }
    const tx = db.transaction('auth-store', 'readonly');
    const store = tx.objectStore('auth-store');
    const req = store.get('accessToken');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function saveAuthToken(db, token) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('auth-store', 'readwrite');
    const store = tx.objectStore('auth-store');
    const req = store.put(token, 'accessToken');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function deleteQueueEntry(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('issue-queue', 'readwrite');
    const store = tx.objectStore('issue-queue');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function updateQueueEntry(db, entry) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('issue-queue', 'readwrite');
    const store = tx.objectStore('issue-queue');
    const req = store.put(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function drainOfflineQueue() {
  const db = await openDB();
  const allIssues = await getStoreData(db, 'issue-queue');
  let token = await getAuthToken(db);

  for (const entry of allIssues) {
    if (entry.dead) continue;
    
    let attempts = entry.attempts;
    try {
      await sendIssue(entry, token);
      await deleteQueueEntry(db, entry.id);
    } catch (err) {
      if (err.status === 401) {
        // Token might be expired, try to refresh it
        try {
          const newToken = await refreshAuthToken();
          if (newToken) {
            token = newToken;
            await saveAuthToken(db, token);
            // Retry submission
            await sendIssue(entry, token);
            await deleteQueueEntry(db, entry.id);
            continue;
          }
        } catch (refreshErr) {
          console.error('Failed to refresh token during sync:', refreshErr);
        }
      }

      // Record failure
      attempts++;
      const dead = attempts >= 5;
      const updated = {
        ...entry,
        attempts,
        dead,
        lastError: err.message || 'Network sync error',
      };
      await updateQueueEntry(db, updated);
    }
  }
}

async function sendIssue(entry, token) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch('/api/v1/issues', {
    method: 'POST',
    headers,
    body: JSON.stringify(entry.payload),
  });

  if (!res.ok) {
    const err = new Error(`HTTP error ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const created = await res.json();
  if (entry.attachment && created?.data?.id) {
    try {
      const fd = new FormData();
      fd.append('file', entry.attachment.blob, entry.attachment.name);
      await fetch(`/api/v1/issues/${created.data.id}/attachments`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: fd,
      });
    } catch (attachErr) {
      console.warn('Attachment upload failed during background sync, issue created successfully:', attachErr);
    }
  }
}

async function refreshAuthToken() {
  const res = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error('Refresh failed');
  }
  const body = await res.json();
  return body.success ? body.data.accessToken : null;
}
