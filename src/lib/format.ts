function pad(n: number, w = 2) {
  return String(n).padStart(w, "0");
}

export function nowStamp() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}
