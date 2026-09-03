import { idb, idbSupported } from './idb.js'

/**
 * Progress adapters are the single seam between the app and where progress lives.
 * Today everything is on-device; a backend can be added later without touching
 * the UI by writing an adapter with the same three methods.
 *
 * @typedef {Object} LessonRecord
 * @property {string}  id          `lesson:<lessonId>` — the storage key
 * @property {string}  lessonId
 * @property {number}  attempts    how many times the lesson has been finished
 * @property {number}  bestScore   best correct-answer count
 * @property {number}  lastScore   most recent correct-answer count
 * @property {number}  total       questions in the lesson at the time of the attempt
 * @property {number}  completedAt epoch ms of the first completion
 * @property {number}  updatedAt   epoch ms of the last write — the merge key for sync
 * @property {boolean} dirty       true until a remote adapter has acknowledged the record
 *
 * @typedef {Object} ProgressAdapter
 * @property {string} name
 * @property {() => Promise<LessonRecord[]>} load
 * @property {(records: LessonRecord[]) => Promise<void>} save
 * @property {() => Promise<void>} clear
 */

/** Fallback when IndexedDB is unavailable (private windows, blocked storage). */
function createMemoryAdapter() {
  let records = []
  return {
    name: 'memory',
    load: async () => records,
    save: async (incoming) => {
      const byId = new Map(records.map((r) => [r.id, r]))
      incoming.forEach((r) => byId.set(r.id, r))
      records = [...byId.values()]
    },
    clear: async () => {
      records = []
    },
  }
}

/** @returns {ProgressAdapter} */
export function createLocalAdapter() {
  if (!idbSupported) return createMemoryAdapter()
  const memory = createMemoryAdapter()
  return {
    name: 'indexeddb',
    load: async () => {
      try {
        return await idb.getAll()
      } catch {
        return memory.load()
      }
    },
    save: async (records) => {
      try {
        await idb.putMany(records)
      } catch {
        await memory.save(records)
      }
    },
    clear: async () => {
      try {
        await idb.clear()
      } catch {
        await memory.clear()
      }
    },
  }
}

/**
 * Records still awaiting a push to a remote adapter. Nothing consumes this yet —
 * it is the hook a future sync loop drains after a successful upload.
 * @param {LessonRecord[]} records
 */
export function pendingSync(records) {
  return records.filter((record) => record.dirty)
}
