const { io } = require('/home/devbox/project/node_modules/socket.io-client');

const BASE = 'http://localhost:3005';
const TOKEN = 'v_sock_' + Date.now();

(async () => {
  const init = await fetch(`${BASE}/api/v1/widget/session/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Key': 'wgetcloud_live', 'X-Visitor-Token': TOKEN },
    body: JSON.stringify({ visitor_token: TOKEN, source_url: 'http://t' }),
  }).then(r => r.json());
  const convId = init.data.conversation._id;
  console.log('convId:', convId);

  const sock = io(BASE, {
    path: '/socket.io',
    extraHeaders: { 'X-Tenant-Key': 'wgetcloud_live', 'X-Visitor-Token': TOKEN },
    transports: ['websocket'],
  });

  await new Promise(res => sock.once('connect', res));
  console.log('connected, id:', sock.id);

  await new Promise((res, rej) => {
    sock.emit('join_conversation', { conversation_id: convId }, (a) => { console.log('join ack:', JSON.stringify(a)); res(); });
    setTimeout(() => rej('join timeout'), 3000);
  });

  // TEXT message first (baseline)
  console.log('\n--- TEXT ---');
  await new Promise((res, rej) => {
    sock.timeout(5000).emit('send_message', {
      conversation_id: convId, type: 'text', content: 'hello text',
    }, (err, ack) => { console.log('text ack:', err || JSON.stringify(ack)); res(); });
    setTimeout(() => rej('timeout'), 6000);
  });

  // FILE message
  console.log('\n--- FILE ---');
  const payload = {
    conversation_id: convId,
    type: 'file',
    content: '[文件] test.docx',
    payload: { file_url: '/uploads/2026-09-15/c34bc599-7b67-43f8-99a5-a3b1303c0f77.docx', file_name: 'test.docx', file_size: 8 },
  };
  console.log('sending:', JSON.stringify(payload));
  await new Promise((res, rej) => {
    sock.timeout(5000).emit('send_message', payload, (err, ack) => { console.log('file ack:', err || JSON.stringify(ack)); res(); });
    setTimeout(() => rej('timeout'), 6000);
  });

  sock.on('new_message', m => console.log('echo:', m.type, m.content));
  setTimeout(() => { sock.disconnect(); process.exit(0); }, 2000);
})();
