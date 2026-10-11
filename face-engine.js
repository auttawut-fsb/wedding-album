let ready;
export async function loadFaceEngine() {
  if (ready) return ready;
  ready = (async () => {
    if (!window.faceapi) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = new URL('./vendor/face-api.min.js', import.meta.url).href;
        script.onload = resolve;
        script.onerror = () => { script.remove(); reject(new Error('โหลดระบบค้นหาไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วเปิดหน้าเว็บอีกครั้ง')); };
        document.head.append(script);
      });
    }
    const api = window.faceapi;
    const models = new URL('./models/', import.meta.url).href;
    await Promise.all([
      api.nets.ssdMobilenetv1.loadFromUri(models),
      api.nets.faceLandmark68Net.loadFromUri(models),
      api.nets.faceRecognitionNet.loadFromUri(models),
    ]);
    return api;
  })();
  try { return await ready; }
  catch (error) { ready = null; throw error; }
}

export async function describeFaces(image) {
  const api = await loadFaceEngine();
  return api.detectAllFaces(image, new api.SsdMobilenetv1Options({ minConfidence: 0.4, maxResults: 100 }))
    .withFaceLandmarks().withFaceDescriptors();
}
