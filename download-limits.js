const MAX_ACTIVE_DOWNLOADS = 3;
const MAX_ACTIVE_BYTES = 250 * 1024 * 1024;
const active = new Map();

export function beginDownload(userId, bytes = 0) {
  const key = String(userId || "anonymous");
  const size = Math.max(0, Number(bytes || 0));
  const current = active.get(key) || { count:0, bytes:0 };
  if (current.count >= MAX_ACTIVE_DOWNLOADS) {
    throw new Error(`Maximum ${MAX_ACTIVE_DOWNLOADS} simultaneous downloads`);
  }
  if (current.bytes + size > MAX_ACTIVE_BYTES) {
    throw new Error("Combined active download limit is 250 MB");
  }
  const next = { count:current.count + 1, bytes:current.bytes + size };
  active.set(key,next);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const value = active.get(key) || next;
    const updated = { count:Math.max(0,value.count-1), bytes:Math.max(0,value.bytes-size) };
    if (!updated.count) active.delete(key);
    else active.set(key,updated);
  };
}

export { MAX_ACTIVE_DOWNLOADS, MAX_ACTIVE_BYTES };
