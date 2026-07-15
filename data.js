// طبقة تخزين مشتركة بين واجهة العرض ولوحة الإدمن.
// - على الجهاز/الفلاش (file://): تخزين محلي بالكامل عبر localStorage، بدون إنترنت.
// - على النسخة اللايف (GitHub Pages): البيانات تُقرأ وتُحفظ فعليًا داخل مستودع GitHub
//   عبر خدمة صغيرة (Cloudflare Worker)، حتى لا تضيع لو المتصفح مسح بياناته.
const STORAGE_KEY = 'family_live_display_v1';
const CACHE_KEY = 'family_live_display_v1_cache'; // نسخة احتياطية محلية من آخر بيانات ناجحة (وضع اللايف فقط)
const API_BASE = 'https://family-live-display-api.majid9299.workers.dev';
const IS_LOCAL = location.protocol === 'file:';

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

function normalize(parsed) {
  if (!parsed || typeof parsed !== 'object') return defaultData();
  if (!Array.isArray(parsed.members)) parsed.members = [];
  if (!parsed.pin) parsed.pin = '0000';
  return parsed;
}

function loadLocalData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    return normalize(JSON.parse(raw));
  } catch (e) {
    return defaultData();
  }
}

// يقرأ البيانات: محليًا فورًا، أو من اللايف عبر الشبكة (مع نسخة احتياطية محلية عند انقطاع الشبكة)
async function loadData() {
  if (IS_LOCAL) return loadLocalData();

  try {
    const res = await fetch(`${API_BASE}/data?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('تعذّرت قراءة البيانات');
    const data = normalize(await res.json());
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    return data;
  } catch (e) {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? normalize(JSON.parse(raw)) : defaultData();
  }
}

// يحفظ البيانات: محليًا فورًا، أو على اللايف (يتطلب الرقم السري الحالي الصحيح authPin للتوثيق)
async function saveData(data, authPin) {
  if (IS_LOCAL) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return { ok: true };
  }

  const res = await fetch(`${API_BASE}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: authPin, data }),
  });
  const result = await res.json();
  if (res.ok) localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  return { ok: res.ok, error: result.error };
}

function uid() {
  return 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function clampScore(n) {
  n = Number(n);
  if (isNaN(n)) return 0;
  return Math.max(0, Math.min(50, Math.round(n)));
}

// يضغط أي صورة مرفوعة إلى مربع صغير (JPEG) حتى لا تمتلئ مساحة التخزين
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
