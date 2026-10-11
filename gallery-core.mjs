export function groupPhotos(photos) {
  const groups = new Map();
  for (const photo of [...photos].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.id.localeCompare(b.id))) {
    const stamp = photo.capturedAt;
    const minute = Number(stamp.slice(14, 16)) < 30 ? '00' : '30';
    const id = `${stamp.slice(0, 13)}:${minute}`;
    if (!groups.has(id)) {
      const hour = Number(stamp.slice(11, 13));
      const end = minute === '00' ? `${String(hour).padStart(2, '0')}:30` : `${String((hour + 1) % 24).padStart(2, '0')}:00`;
      groups.set(id, { id, date: stamp.slice(0, 10), label: `${id.slice(11)}–${end}`, photos: [] });
    }
    groups.get(id).photos.push(photo);
  }
  return [...groups.values()];
}

export function findMatches(query, index, threshold = 0.55) {
  const valid = vector => vector?.length === 128 && Array.from(vector).every(Number.isFinite);
  if (!valid(query)) return [];
  const matches = [];
  for (const photo of index.photos ?? []) {
    let distance = Infinity;
    for (const item of photo.faces ?? []) {
      const vector = item.descriptor ?? item;
      if (!valid(vector)) continue;
      const d = Math.sqrt(Array.from(query).reduce((sum, value, i) => sum + (value - vector[i]) ** 2, 0));
      distance = Math.min(distance, d);
    }
    if (distance <= threshold) matches.push({ id: photo.id, distance });
  }
  return matches.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
}
