const API_BASE = 'http://127.0.0.1:3001/api';
// 如果你是在同源 webview 裡測，也可以改成：const API_BASE = '/api';

async function callApi(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${JSON.stringify(data)}`);
  }

  return data;
}

async function testWheelApi() {
  const session = await callApi('/webview/sessions', {
    method: 'POST',
    body: JSON.stringify({
      playerId: 'test-player-001',
      turnoverPoints: 999999,
      unlockedStage: 5,
    }),
  });

  console.log('session:', session);
  console.log('webviewUrl:', session.webviewUrl);

  const gameConfig = await callApi('/webview/game-config');
  console.log('gameConfig:', gameConfig);

  const current = await callApi(
    `/webview/sessions/current?token=${encodeURIComponent(session.token)}`
  );
  console.log('current:', current);

  const spin = await callApi('/spins/real', {
    method: 'POST',
    body: JSON.stringify({
      token: session.token,
      stageNumber: 1,
    }),
  });

  console.log('spin result:', spin);
}

testWheelApi().catch(console.error);
