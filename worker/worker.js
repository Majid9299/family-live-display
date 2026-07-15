const REPO = 'Majid9299/family-live-display';
const FILE_PATH = 'data.json';
const BRANCH = 'master';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

async function githubApi(path, token, init = {}) {
  return fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'family-live-display-worker',
      ...(init.headers || {}),
    },
  });
}

function b64EncodeUnicode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function b64DecodeUnicode(b64) {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function getCurrentFile(token) {
  const res = await githubApi(`/contents/${FILE_PATH}?ref=${BRANCH}`, token);
  if (!res.ok) throw new Error('تعذّرت قراءة ملف البيانات من GitHub');
  const meta = await res.json();
  const content = JSON.parse(b64DecodeUnicode(meta.content));
  return { content, sha: meta.sha };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    try {
      if (request.method === 'GET' && url.pathname === '/data') {
        const { content } = await getCurrentFile(env.GITHUB_TOKEN);
        return json(content);
      }

      if (request.method === 'POST' && url.pathname === '/save') {
        const body = await request.json();
        const { pin, data } = body || {};
        if (!pin || !data) return json({ error: 'طلب غير صالح' }, 400);

        const { content: current, sha } = await getCurrentFile(env.GITHUB_TOKEN);
        if (String(pin) !== String(current.pin)) {
          return json({ error: 'رقم سري غير صحيح' }, 401);
        }

        const newContent = b64EncodeUnicode(JSON.stringify(data, null, 2));
        const putRes = await githubApi(`/contents/${FILE_PATH}`, env.GITHUB_TOKEN, {
          method: 'PUT',
          body: JSON.stringify({
            message: 'تحديث بيانات عرضة العائلة',
            content: newContent,
            sha,
            branch: BRANCH,
          }),
        });
        if (!putRes.ok) {
          const errText = await putRes.text();
          return json({ error: 'فشل الحفظ على GitHub', detail: errText }, 502);
        }
        return json({ ok: true });
      }

      return json({ error: 'مسار غير معروف' }, 404);
    } catch (err) {
      return json({ error: err.message || 'خطأ غير متوقع' }, 500);
    }
  },
};
