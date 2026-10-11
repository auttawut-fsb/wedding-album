import { describeFaces, loadFaceEngine } from './face-engine.js';
import { findMatches } from './gallery-core.mjs';
const $ = id => document.getElementById(id);

export function initFaceSearch(onMatches) {
  let index, query, stream, previewURL, busy = false, searchEpoch = 0, cameraEpoch = 0;
  const consent = $('search-consent'), input = $('selfie-input'), status = $('search-status');
  const camera = $('camera-panel'), video = $('camera-video');
  function say(message, error = false) { status.textContent = message; status.dataset.error = String(error); }
  function controls() {
    const blocked = !consent.checked || busy || !camera.hidden;
    $('upload-button').disabled = $('camera-button').disabled = blocked;
  }
  function stopCamera() {
    cameraEpoch++;
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    video.srcObject = null; camera.hidden = true; controls();
  }
  function clearPreview() {
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = null; $('selfie-preview').removeAttribute('src'); $('selfie-preview').hidden = true;
  }
  function clearSearch() {
    searchEpoch++; query = null; busy = false; stopCamera(); clearPreview();
    input.value = ''; $('match-options').hidden = true;
    say('Selfie cleared. You’re viewing the full album.'); onMatches(null); controls();
  }
  async function loadIndex() {
    if (index) return index;
    const response = await fetch(new URL('./face-index.json', import.meta.url));
    if (!response.ok) throw new Error('The album’s face index could not load. Reload the page and try again.');
    const value = await response.json();
    if (!Array.isArray(value.photos) || value.photos.length === 0) throw new Error('The album’s face index is unavailable. Please try again later.');
    index = value; return index;
  }
  function match() {
    if (!query || !index) return;
    const threshold = Number($('match-range').value);
    $('range-label').textContent = threshold < 0.5 ? 'Closer' : threshold > 0.6 ? 'Wider' : 'Balanced';
    const found = findMatches(query, index, threshold);
    onMatches(found);
    say(found.length ? `Found ${found.length} suggested ${found.length === 1 ? 'match' : 'matches'}. Scroll down to see them.` : 'No close matches. Try another selfie or widen the match range.');
  }
  async function search(blob) {
    if (!consent.checked || busy) return;
    if (blob.size > 20 * 1024 * 1024) { say('That photo is over 20 MB. Choose a smaller JPEG or PNG.', true); return; }
    const epoch = ++searchEpoch; busy = true; controls();
    query = null; $('match-options').hidden = true; onMatches(null);
    clearPreview();
    previewURL = URL.createObjectURL(blob); $('selfie-preview').src = previewURL; $('selfie-preview').hidden = false;
    say('Loading face matching on your device. The first search may take a moment…');
    let bitmap;
    try {
      const [, faceIndex] = await Promise.all([loadFaceEngine(), loadIndex()]);
      if (epoch !== searchEpoch) return;
      bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close(); bitmap = null;
      say('Looking for your face…');
      const faces = await describeFaces(canvas);
      if (epoch !== searchEpoch) return;
      if (faces.length === 0) throw new Error('No clear face found. Try a front-facing selfie in good light.');
      if (faces.length > 1) throw new Error('More than one face found. Choose a photo with only you in it.');
      query = Array.from(faces[0].descriptor); index = faceIndex;
      $('match-options').hidden = false; match();
    } catch (error) {
      if (epoch === searchEpoch) say(error.message?.includes('face') || error.message?.includes('index') || error.message?.includes('load') ? error.message : 'This photo couldn’t be read. Try a JPEG or PNG selfie.', true);
    } finally {
      bitmap?.close();
      if (epoch === searchEpoch) { busy = false; controls(); }
    }
  }
  $('upload-button').addEventListener('click', () => input.click());
  input.addEventListener('change', () => { const file = input.files[0]; input.value = ''; if (file) search(file); });
  consent.addEventListener('change', () => {
    if (!consent.checked) { clearSearch(); say('Enable the checkbox to use selfie search.'); }
    controls();
  });
  $('match-range').addEventListener('input', match);
  $('clear-search').addEventListener('click', clearSearch);
  $('empty-reset').addEventListener('click', clearSearch);
  $('camera-button').addEventListener('click', async () => {
    if (!consent.checked || busy) return;
    if (!navigator.mediaDevices?.getUserMedia) { say('Camera access isn’t available here. Choose a selfie instead, or open this site over HTTPS.', true); return; }
    stopCamera(); const epoch = ++cameraEpoch;
    camera.hidden = false; $('capture-button').disabled = true; controls(); say('Allow camera access to take your selfie.');
    try {
      const received = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      if (epoch !== cameraEpoch || !consent.checked) { received.getTracks().forEach(track => track.stop()); return; }
      stream = received; video.srcObject = stream; await video.play();
      if (epoch !== cameraEpoch) return;
      $('capture-button').disabled = false; say('Keep just your face in the frame, then capture your selfie.');
    } catch (error) {
      if (epoch !== cameraEpoch) return;
      stopCamera(); say(error.name === 'NotAllowedError' ? 'Camera permission was denied. You can choose a selfie instead.' : 'The camera couldn’t open. Choose a selfie instead.', true);
    }
  });
  $('capture-button').addEventListener('click', async () => {
    if (!video.videoWidth || !video.videoHeight) return;
    const epoch = cameraEpoch;
    $('capture-button').disabled = true;
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (epoch !== cameraEpoch) return;
    stopCamera();
    if (blob) search(blob); else say('The selfie couldn’t be captured. Choose a photo instead.', true);
  });
  $('cancel-camera').addEventListener('click', () => { stopCamera(); say('Camera closed. You can choose a selfie instead.'); });
  window.addEventListener('pagehide', clearSearch);
  document.addEventListener('visibilitychange', () => { if (document.hidden && !camera.hidden) stopCamera(); });
  controls();
}
