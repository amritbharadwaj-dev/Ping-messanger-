// Ping — one-time Appwrite schema setup.  Run LOCALLY (never put the API key in the website):
//   APPWRITE_KEY=your_server_api_key node setup-appwrite.mjs
// API key scopes: databases.read/write, collections/tables read/write, attributes, indexes, buckets.read/write, files.read/write
const E = 'https://fra.cloud.appwrite.io/v1', P = '6ae1b2bc002257e5e2c2', DB = '6ae1dd930022f00a4480';
const T = { users: '6ae1dd930022f00a4480', messages: '6ae1df41000faeef7c09', stories: '6ae1e29f000f611ba1e0' }, BUCKET = '6ae1e1b90017e95db195';
const KEY = process.env.APPWRITE_KEY; if (!KEY) { console.error('Set APPWRITE_KEY'); process.exit(1); }
const H = { 'Content-Type': 'application/json', 'X-Appwrite-Project': P, 'X-Appwrite-Key': KEY };
const call = async (m, p, b) => { const r = await fetch(E + p, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined }); const j = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, j }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const S = (key, size, req = false, def) => ({ t: 'string', key, size, required: req, default: def });
const B = (key, def = false) => ({ t: 'boolean', key, required: false, default: def });
const I = (key, req = false) => ({ t: 'integer', key, required: req, min: 0, max: 9007199254740991 });
const schema = {
  users: [S('username', 24, true), S('name', 60, false, ''), S('bio', 200, false, ''), S('avatar', 40, false, ''), S('pub', 200, false, ''), I('lastSeen'), S('note', 120, false, ''), I('noteTs'), S('music', 300, false, ''), B('isBot'), S('owner', 40, false, '')],
  messages: [S('mid', 40, true), S('sender', 40, true), S('rcpt', 40, true), S('chat', 40, false, ''), S('kind', 4, false, 'm'), S('ct', 1000000, true), I('ts', true), S('fileId', 40, false, ''), B('dlv')],
  stories: [S('userId', 40, true), S('kind', 8, true), S('fileId', 40, false, ''), S('key', 100, false, ''), S('iv', 60, false, ''), S('mime', 80, false, ''), S('caption', 300, false, ''), S('bg', 20, false, ''), I('ts', true), I('exp', true)]
};
const indexes = { users: [['username_u', 'unique', ['username']]], messages: [['rcpt_ts', 'key', ['rcpt', 'ts']], ['ts_i', 'key', ['ts']]], stories: [['exp_i', 'key', ['exp']]] };
(async () => {
  let r = await call('GET', `/databases/${DB}`); if (!r.ok) { r = await call('POST', '/databases', { databaseId: DB, name: 'ping' }); console.log('database', r.status, r.j.message || 'created'); }
  for (const [name, id] of Object.entries(T)) {
    r = await call('GET', `/databases/${DB}/collections/${id}`);
    if (!r.ok) { r = await call('POST', `/databases/${DB}/collections`, { collectionId: id, name, permissions: name === 'users' ? ['create("users")'] : name === 'messages' ? ['create("users")'] : ['create("users")'], documentSecurity: true }); console.log(name, 'collection', r.status, r.j.message || 'created'); }
    else { await call('PUT', `/databases/${DB}/collections/${id}`, { name, permissions: ['create("users")'], documentSecurity: true }); }
    for (const a of schema[name]) {
      const path = `/databases/${DB}/collections/${id}/attributes/${a.t}`;
      const body = { key: a.key, required: a.required }; if (a.t === 'string') body.size = a.size; if (a.t === 'integer') { body.min = a.min; body.max = a.max; }
      if (!a.required && a.default !== undefined) body.default = a.default;
      const x = await call('POST', path, body); console.log(' ', name + '.' + a.key, x.status === 409 ? 'exists' : x.ok ? 'ok' : x.j.message);
    }
    console.log(' waiting for attributes…'); await sleep(6000);
    for (const [k, t, attrs] of indexes[name]) { const x = await call('POST', `/databases/${DB}/collections/${id}/indexes`, { key: k, type: t, attributes: attrs }); console.log(' index', k, x.status === 409 ? 'exists' : x.ok ? 'ok' : x.j.message); }
  }
  let b = await call('GET', `/storage/buckets/${BUCKET}`);
  if (!b.ok) { b = await call('POST', '/storage/buckets', { bucketId: BUCKET, name: 'ping-files', permissions: ['create("users")'], fileSecurity: true, maximumFileSize: 50000000, encryption: false, antivirus: false }); console.log('bucket', b.status, b.j.message || 'created'); }
  else { await call('PUT', `/storage/buckets/${BUCKET}`, { name: b.j.name || 'ping-files', permissions: ['create("users")'], fileSecurity: true, maximumFileSize: 50000000 }); console.log('bucket updated (create=users, fileSecurity on)'); }
  console.log('Done. Now: Console → Auth → enable Phone/Email OTP (Messaging providers), and Overview → Platforms → add your GitHub Pages domain (Web).');
})();
