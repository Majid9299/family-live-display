// طبقة تخزين مشتركة بين واجهة العرض ولوحة الإدمن (localStorage فقط، بدون إنترنت)
const STORAGE_KEY = 'family_live_display_v1';
const BACKGROUNDS = [
  'assets/backgrounds/bg1.jpg',
  'assets/backgrounds/bg2.jpg',
  'assets/backgrounds/bg3.jpg',
  'assets/backgrounds/bg4.jpg',
  'assets/backgrounds/bg5.jpg'
];

function defaultData() {
  return { pin: '0000', members: [] };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaultData();
    if (!Array.isArray(parsed.members)) parsed.members = [];
    if (!parsed.pin) parsed.pin = '0000';
    return parsed;
  } catch (e) {
    return defaultData();
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function uid() {
  return 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function clampScore(n) {
  n = Number(n);
  if (isNaN(n)) return 0;
  return Math.max(0, Math.min(50, Math.round(n)));
}

// يضغط أي صورة مرفوعة إلى مربع صغير (JPEG) حتى لا تمتلئ مساحة التخزين المحلي
function compressImageFile(file, maxDim = 480, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذّرت قراءة الملف'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('تعذّرت قراءة الصورة'));
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
