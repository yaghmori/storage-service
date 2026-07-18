const MinIO = require('minio');

async function tryClient(label, opts) {
  console.log('---', label, JSON.stringify(opts));
  const c = new MinIO.Client(opts);
  try {
    const exists = await c.bucketExists('storage');
    console.log('ok exists=', exists);
  } catch (err) {
    console.log('fail type=', typeof err, 'name=', err && err.name);
    console.log('message=', err && err.message);
    console.log('code=', err && err.code);
    console.log('keys=', err && Object.keys(err));
    console.log('string=', String(err));
    try { console.log('json=', JSON.stringify(err)); } catch {}
  }
}

(async () => {
  await tryClient('minio hostname', {
    endPoint: 'minio',
    port: 9000,
    useSSL: false,
    accessKey: 'minioadmin',
    secretKey: 'minioadmin',
  });
  await tryClient('localhost', {
    endPoint: 'localhost',
    port: 9000,
    useSSL: false,
    accessKey: 'minioadmin',
    secretKey: 'minioadmin',
  });
  await tryClient('bad host:port as endPoint', {
    endPoint: 'localhost:9000',
    port: 9000,
    useSSL: false,
    accessKey: 'minioadmin',
    secretKey: 'minioadmin',
  });
})();
