import { describeFaces, loadFaceEngine } from './face-engine.js?v=thai-1';
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
    input.value = ''; $('match-options').hidden = true; $('view-results').hidden = true;
    say('ล้างรูปใบหน้าแล้ว ตอนนี้คุณกำลังดูรูปทั้งหมด'); onMatches(null); controls();
  }
  async function loadIndex() {
    if (index) return index;
    const response = await fetch(new URL('./face-index.json', import.meta.url));
    if (!response.ok) throw new Error('โหลดข้อมูลค้นหาไม่ได้ กรุณาเปิดหน้าเว็บอีกครั้งแล้วลองใหม่');
    const value = await response.json();
    if (!Array.isArray(value.photos) || value.photos.length === 0) throw new Error('ยังไม่มีข้อมูลสำหรับค้นหารูป กรุณาลองใหม่ภายหลัง');
    index = value; return index;
  }
  function match() {
    if (!query || !index) return;
    const threshold = Number($('match-range').value);
    $('range-label').textContent = threshold < 0.5 ? 'คล้ายมาก' : threshold > 0.6 ? 'ค้นหารูปเพิ่ม' : 'ปกติ';
    const found = findMatches(query, index, threshold);
    onMatches(found); $('view-results').hidden = found.length === 0; $('view-results').textContent = `ดูรูปที่ค้นพบ (${found.length} รูป)`;
    say(found.length ? `พบ ${found.length} รูปที่อาจมีคุณอยู่ กดปุ่มดูรูปที่ค้นพบด้านล่าง` : 'ยังไม่พบรูปที่คล้ายคุณ ลองเปลี่ยนรูปใบหน้า หรือเลื่อนแถบไปทางขวาเพื่อค้นหารูปเพิ่ม');
  }
  async function search(blob) {
    if (!consent.checked || busy) return;
    if (blob.size > 20 * 1024 * 1024) { say('รูปนี้มีขนาดเกิน 20 เมกะไบต์ กรุณาเลือกรูป JPEG หรือ PNG ที่เล็กลง', true); return; }
    const epoch = ++searchEpoch; busy = true; controls();
    query = null; $('match-options').hidden = true; $('view-results').hidden = true; onMatches(null);
    clearPreview();
    previewURL = URL.createObjectURL(blob); $('selfie-preview').src = previewURL; $('selfie-preview').hidden = false;
    say('กำลังเตรียมค้นหารูปในเครื่องของคุณ ครั้งแรกอาจใช้เวลาสักครู่ กรุณารอ…');
    let bitmap;
    try {
      const [, faceIndex] = await Promise.all([loadFaceEngine(), loadIndex()]);
      if (epoch !== searchEpoch) return;
      bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close(); bitmap = null;
      say('กำลังค้นหารูปที่มีใบหน้าคล้ายคุณ กรุณารอ…');
      const faces = await describeFaces(canvas);
      if (epoch !== searchEpoch) return;
      if (faces.length === 0) throw new Error('มองไม่เห็นใบหน้าชัดเจน กรุณาเลือกรูปหน้าตรงที่มีแสงเพียงพอ');
      if (faces.length > 1) throw new Error('พบหลายใบหน้า กรุณาเลือกรูปที่มีคุณเพียงคนเดียว');
      query = Array.from(faces[0].descriptor); index = faceIndex;
      $('match-options').hidden = false; match();
    } catch (error) {
      if (epoch === searchEpoch) say(/[ก-๙]/.test(error.message || '') ? error.message : 'ค้นหารูปไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต หรือเลือกรูปใบหน้าแบบ JPEG หรือ PNG แล้วลองอีกครั้ง', true);
    } finally {
      bitmap?.close();
      if (epoch === searchEpoch) { busy = false; controls(); }
    }
  }
  $('upload-button').addEventListener('click', () => input.click());
  input.addEventListener('change', () => { const file = input.files[0]; input.value = ''; if (file) search(file); });
  consent.addEventListener('change', () => {
    if (!consent.checked) { clearSearch(); say('กดช่องยินยอมด้านบนก่อน แล้วจึงเลือกรูปหรือเปิดกล้อง'); }
    controls();
  });
  $('match-range').addEventListener('input', match);
  $('clear-search').addEventListener('click', clearSearch);
  $('empty-reset').addEventListener('click', clearSearch);
  $('camera-button').addEventListener('click', async () => {
    if (!consent.checked || busy) return;
    if (!navigator.mediaDevices?.getUserMedia) { say('เครื่องนี้เปิดกล้องไม่ได้ กรุณากดเลือกรูปจากเครื่องแทน', true); return; }
    stopCamera(); const epoch = ++cameraEpoch;
    camera.hidden = false; $('capture-button').disabled = true; controls(); say('หากเครื่องถาม กรุณากดอนุญาตให้ใช้กล้องเพื่อถ่ายรูปของคุณ');
    try {
      const received = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      if (epoch !== cameraEpoch || !consent.checked) { received.getTracks().forEach(track => track.stop()); return; }
      stream = received; video.srcObject = stream; await video.play();
      if (epoch !== cameraEpoch) return;
      $('capture-button').disabled = false; say('ให้เห็นเฉพาะใบหน้าของคุณ แล้วกดถ่ายรูปและค้นหา');
    } catch (error) {
      if (epoch !== cameraEpoch) return;
      stopCamera(); say(error.name === 'NotAllowedError' ? 'ยังไม่ได้รับอนุญาตให้ใช้กล้อง กรุณากดเลือกรูปจากเครื่องแทน' : 'เปิดกล้องไม่ได้ กรุณากดเลือกรูปจากเครื่องแทน', true);
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
    if (blob) search(blob); else say('ถ่ายรูปไม่ได้ กรุณากดเลือกรูปจากเครื่องแทน', true);
  });
  $('cancel-camera').addEventListener('click', () => { stopCamera(); say('ปิดกล้องแล้ว คุณสามารถกดเลือกรูปจากเครื่องได้'); });
  window.addEventListener('pagehide', clearSearch);
  document.addEventListener('visibilitychange', () => { if (document.hidden && !camera.hidden) stopCamera(); });
  say('เริ่มค้นหาได้โดยกดช่องยินยอมด้านบน');
  controls();
}
