const DB_NAME = 'mpt-ai'
const PROGRESS = 'progress'
const CONTENT = 'content'
const VERSION = 2

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      // v1 shipped with `progress` only; v2 adds author-created content.
      if (!db.objectStoreNames.contains(PROGRESS)) db.createObjectStore(PROGRESS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(CONTENT)) db.createObjectStore(CONTENT, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

function run(store, mode, work) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode)
        const request = work(tx.objectStore(store))
        tx.onerror = () => reject(tx.error)
        tx.oncomplete = () => resolve(request?.result)
      }),
  )
}

function storeApi(name) {
  return {
    getAll: () => run(name, 'readonly', (store) => store.getAll()),
    put: (record) => run(name, 'readwrite', (store) => store.put(record)),
    putMany: (records) =>
      run(name, 'readwrite', (store) => {
        records.forEach((record) => store.put(record))
      }),
    delete: (id) => run(name, 'readwrite', (store) => store.delete(id)),
    deleteMany: (ids) =>
      run(name, 'readwrite', (store) => {
        ids.forEach((id) => store.delete(id))
      }),
    clear: () => run(name, 'readwrite', (store) => store.clear()),
  }
}

export const idbSupported = typeof indexedDB !== 'undefined'

export const idb = storeApi(PROGRESS)
export const idbContent = storeApi(CONTENT)
