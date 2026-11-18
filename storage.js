export function read(key, sample) {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? sample : JSON.parse(stored);
  } catch {
    return sample;
  }
}
export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function today() {
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part) => String(part).padStart(2, '0')).join('-');
}
