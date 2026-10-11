import { groupPhotos } from './gallery-core.mjs';
import { initFaceSearch } from './face-search.js';
const $ = id => document.getElementById(id);
let photos = [], groups = [], visible = [], activeGroup = 'all', matches = null;
let playlist = [], current = 0, playing = false, timer = null, imageSettled = false;
const viewer = $('viewer'), image = $('viewer-image');
const humanDate = stamp => new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${stamp.slice(0, 10)}T12:00:00Z`));
const cameraTime = stamp => stamp.slice(11, 19);

function render() {
  const gallery = $('gallery');
  gallery.replaceChildren();
  $('results-heading').hidden = matches === null;
  $('album-nav').hidden = matches !== null;
  const selectedGroups = activeGroup === 'all' ? groups : groups.filter(g => g.id === activeGroup);
  const byId = new Map(photos.map(p => [p.id, p]));
  visible = matches === null ? selectedGroups.flatMap(g => g.photos) : matches.map(m => byId.get(m.id)).filter(Boolean);
  $('album-summary').textContent = matches === null ? `${visible.length} photographs · ${humanDate(photos[0].capturedAt)} · in time order` : `${visible.length} suggested ${visible.length === 1 ? 'match' : 'matches'} · closest first`;
  $('slideshow-button').disabled = visible.length === 0;
  $('album-empty').hidden = matches === null || visible.length > 0;
  const fragment = document.createDocumentFragment();
  const addPhoto = photo => {
    const button = document.createElement('button');
    button.className = 'photo';
    button.setAttribute('aria-label', `Open photo ${photo.id}, taken at ${cameraTime(photo.capturedAt)}`);
    const frame = document.createElement('div'); frame.className = 'photo-image';
    const img = document.createElement('img');
    img.src = photo.thumbnail; img.loading = 'lazy'; img.decoding = 'async';
    img.alt = `Wedding photograph ${photo.id}`; img.width = photo.width; img.height = photo.height;
    img.style.setProperty('--ratio', `${photo.width}/${photo.height}`);
    frame.append(img);
    const caption = document.createElement('span'); caption.className = 'photo-caption';
    const time = document.createElement('time'); time.dateTime = photo.capturedAt; time.textContent = cameraTime(photo.capturedAt);
    const name = document.createElement('span'); name.className = 'photo-name'; name.textContent = photo.id;
    caption.append(time, name); button.append(frame, caption);
    button.addEventListener('click', () => openViewer(photo.id)); fragment.append(button);
  };
  if (matches !== null) visible.forEach(addPhoto);
  else for (const group of selectedGroups) {
    const heading = document.createElement('div'); heading.className = 'group-heading';
    const title = document.createElement('h3'); title.textContent = group.label;
    const count = document.createElement('span'); count.textContent = `${group.photos.length} photographs`;
    heading.append(title, count); fragment.append(heading); group.photos.forEach(addPhoto);
  }
  gallery.append(fragment);
  for (const button of $('album-nav').children) button.setAttribute('aria-pressed', String(button.dataset.group === activeGroup));
}

function scheduleSlide() {
  clearTimeout(timer);
  if (playing && viewer.open && playlist.length > 1 && imageSettled) timer = setTimeout(() => showPhoto(current + 1), Number($('slide-speed').value));
}
function setPlaying(value) {
  playing = value && playlist.length > 1;
  $('toggle-play').textContent = playing ? 'Pause slideshow' : 'Play slideshow';
  $('toggle-play').setAttribute('aria-pressed', String(playing));
  if (playing) scheduleSlide(); else clearTimeout(timer);
}
function showPhoto(position) {
  clearTimeout(timer);
  if (!playlist.length) return;
  current = (position + playlist.length) % playlist.length;
  const photo = playlist[current];
  $('viewer-image-error').hidden = true;
  imageSettled = false;
  image.onload = () => { imageSettled = true; scheduleSlide(); };
  image.onerror = () => { imageSettled = true; $('viewer-image-error').hidden = false; scheduleSlide(); };
  image.src = photo.src; image.alt = `Wedding photograph ${photo.id}, taken at ${cameraTime(photo.capturedAt)}`;
  $('viewer-caption').textContent = `${humanDate(photo.capturedAt)} · ${cameraTime(photo.capturedAt)} · ${photo.id}`;
  $('viewer-position').textContent = `${current + 1} / ${playlist.length}`;
  $('download-photo').href = photo.src; $('download-photo').download = `${photo.id}.jpg`;
  $('previous-photo').disabled = $('next-photo').disabled = $('toggle-play').disabled = playlist.length <= 1;
  if (image.complete && image.naturalWidth) { imageSettled = true; scheduleSlide(); }
}
function openViewer(id, autoplay = false) {
  playlist = [...visible];
  if (!playlist.length) return;
  viewer.showModal(); document.body.style.overflow = 'hidden';
  showPhoto(Math.max(0, playlist.findIndex(photo => photo.id === id)));
  setPlaying(autoplay);
}
$('slideshow-button').addEventListener('click', () => openViewer(visible[0]?.id, true));
$('close-viewer').addEventListener('click', () => viewer.close());
viewer.addEventListener('close', () => { setPlaying(false); document.body.style.overflow = ''; });
$('previous-photo').addEventListener('click', () => showPhoto(current - 1));
$('next-photo').addEventListener('click', () => showPhoto(current + 1));
$('toggle-play').addEventListener('click', () => setPlaying(!playing));
$('slide-speed').addEventListener('change', scheduleSlide);
viewer.addEventListener('keydown', event => {
  if (['SELECT', 'INPUT'].includes(event.target.tagName)) return;
  if (event.key === 'ArrowLeft') { event.preventDefault(); showPhoto(current - 1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); showPhoto(current + 1); }
  if (event.code === 'Space' && event.target === viewer) { event.preventDefault(); setPlaying(!playing); }
});
let touchStart;
image.addEventListener('touchstart', event => { touchStart = event.changedTouches[0].clientX; }, { passive: true });
image.addEventListener('touchend', event => {
  const delta = event.changedTouches[0].clientX - touchStart;
  if (Math.abs(delta) > 60) showPhoto(current + (delta < 0 ? 1 : -1));
}, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) setPlaying(false); });

try {
  const response = await fetch(new URL('./album.json', import.meta.url));
  if (!response.ok) throw new Error('Album request failed');
  const album = await response.json(); photos = album.photos; groups = groupPhotos(photos);
  if (!photos.length) throw new Error('Album contains no photographs');
  const all = { id: 'all', label: 'All photos' };
  for (const group of [all, ...groups]) {
    const button = document.createElement('button');
    button.textContent = group.label; button.dataset.group = group.id;
    button.addEventListener('click', () => { activeGroup = group.id; render(); });
    $('album-nav').append(button);
  }
  render();
  initFaceSearch(found => { matches = found; activeGroup = 'all'; render(); });
} catch (error) {
  $('album-error').hidden = false;
  $('album-summary').textContent = 'The photo list is unavailable.';
  $('search-status').textContent = 'Selfie search will be available once the album loads.';
  console.error('Album load failed:', error);
}
