const FRAME_WIDTH = 1170;
const FRAME_HEIGHT = 720;
const params = new URLSearchParams(window.location.search);
const SESSION_TOKEN = params.get('token');
let apiBase = normalizeApiBase(params.get('apiBase') || '/api');
let clientConfigPromise = null;
let clientConfigLoaded = false;

const SPIN_STATES = {
  NEED_DEPOSIT: 'need_deposit',
  NEED_WAGER: 'need_wager',
  READY: 'ready',
  COMPLETE: 'complete',
};

const PRIZES = [
  { angle: 0, category: 'E', label: '', icon: 'assets/prize_safe.png' },
  { angle: 76, category: 'A', label: '', icon: 'assets/prize_coin_pile.png' },
  { angle: 140, category: 'C', label: '', icon: 'assets/prize_money_bag.png' },
  { angle: 219, category: 'D', label: '', icon: 'assets/prize_statue.png' },
  { angle: 285, category: 'B', label: '', icon: 'assets/prize_coin_plate.png' },
];

const FALLBACK_PRIZES = {
  1: { A: '₱1', B: '₱5', C: '₱20', D: '₱50', E: '₱100' },
  2: { A: '₱5', B: '₱25', C: '₱100', D: '₱250', E: '₱500' },
  3: { A: '₱20', B: '₱100', C: '₱400', D: '₱1,000', E: '₱2,000' },
  4: { A: '₱50', B: '₱250', C: '₱1,000', D: '₱2,500', E: '₱5,000' },
  5: { A: '₱100', B: '₱500', C: '₱2,000', D: '₱5,000', E: '₱10,000' },
};

const VIP_SPRITE = {
  bright: { 1: '20', 2: '16', 3: '29', 4: '23', 5: '17' },
  locked: { 1: '28', 2: '15', 3: '31', 4: '27', 5: '18' },
};

const VIP_ARROW_TOP = {
  5: { L: 48, R: 45 },
  4: { L: 139, R: 136 },
  3: { L: 238, R: 235 },
  2: { L: 333, R: 330 },
  1: { L: 438, R: 435 },
};

const WHEEL_LIGHT_ORDER = ['wlb-3', 'wlb-2', 'wlb-1', 'wlb-0', 'wlb-5', 'wlb-4'];
const EDGE_NEAR_MISS_RATE = 0.35;

let sessionState = null;
let currentSpinState = SPIN_STATES.NEED_WAGER;
let currentStageNumber = 1;
let totalRot = 0;
let canSpin = false;
let spinning = false;
let pendingWheelReset = false;
let pollTimer = null;

const rotator = document.getElementById('wheelRotator');
const spinBtn = document.getElementById('spinBtn');

function fitFrame() {
  const scale = Math.min(window.innerWidth / FRAME_WIDTH, window.innerHeight / FRAME_HEIGHT);
  document.documentElement.style.setProperty('--frame-scale', String(Math.max(scale, 0.2)));
}

function formatPoints(value) {
  return Number(value || 0).toLocaleString();
}

function formatPrizeLabel(prize) {
  if (!prize) return '';
  const name = String(prize.name || '').trim();
  if (name && !/^[A-E]\s*Prize$/i.test(name)) {
    return name;
  }
  return `₱${formatPoints(prize.amountPoints)}`;
}

function normalizeApiBase(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${apiBase}${normalizedPath}`;
}

async function loadClientConfig() {
  if (clientConfigLoaded) return;

  if (!clientConfigPromise) {
    clientConfigPromise = (async () => {
      if (params.get('apiBase') && !params.get('configUrl')) return;

      const configUrl = params.get('configUrl') || apiUrl('/demo/client-config');
      const response = await fetch(configUrl, {
        headers: { Accept: 'application/json' },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      if (typeof data.apiBaseUrl === 'string' && data.apiBaseUrl.trim()) {
        apiBase = normalizeApiBase(data.apiBaseUrl);
      }
    })().catch((error) => {
      console.warn('[webview] client config failed:', error);
    });
  }

  await clientConfigPromise;
  clientConfigLoaded = true;
}

function showAuthError(message) {
  document.body.insertAdjacentHTML(
    'beforeend',
    `
    <div style="
      position:fixed;inset:0;z-index:9999;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      background:rgba(10,5,20,.92);backdrop-filter:blur(6px);
      color:#fff;font-family:sans-serif;text-align:center;padding:2rem;">
      <div style="font-size:1.1rem;font-weight:700;margin-bottom:.5rem;">無法進入遊戲</div>
      <div style="font-size:.9rem;color:rgba(255,255,255,.68);max-width:320px;">${message}</div>
    </div>
  `,
  );
}

async function apiJson(path, options = {}) {
  await loadClientConfig();

  const response = await fetch(apiUrl(path), {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `HTTP ${response.status}`);
  }
  return data;
}

async function fetchSessionState() {
  if (!SESSION_TOKEN) {
    throw new Error('缺少 token，請從 Demo 網站建立連結');
  }
  const date = params.get('date');
  const query = new URLSearchParams({ token: SESSION_TOKEN });
  if (date) query.set('date', date);
  return apiJson(`/demo/session?${query.toString()}`);
}

function sortedStages() {
  return [...(sessionState?.stages || [])].sort((a, b) => a.stageNumber - b.stageNumber);
}

function currentProgress() {
  return sessionState?.progress || {
    turnoverPoints: 0,
    unlockedStage: 0,
    playedStages: [],
    spins: [],
  };
}

function nextPlayableStageNumber() {
  const progress = currentProgress();
  const playedStages = progress.playedStages || [];
  for (let stageNumber = 1; stageNumber <= (progress.unlockedStage || 0); stageNumber += 1) {
    if (!playedStages.includes(stageNumber)) {
      return stageNumber;
    }
  }
  return 0;
}

function displayStageNumber() {
  const playable = nextPlayableStageNumber();
  if (playable > 0) return playable;
  const unlockedStage = currentProgress().unlockedStage || 0;
  return Math.min(Math.max(unlockedStage || 1, 1), 5);
}

function hasCompletedToday() {
  const progress = currentProgress();
  return (progress.unlockedStage || 0) >= 5 && (progress.playedStages || []).length >= 5;
}

function stageConfig(stageNumber) {
  return sortedStages().find((stage) => stage.stageNumber === stageNumber);
}

function updateThresholdPanel() {
  sortedStages().forEach((stage) => {
    const el = document.getElementById(`lv-threshold-${stage.stageNumber}`);
    if (el) el.textContent = `流水 ${formatPoints(stage.turnoverThresholdPoints)}`;
  });
}

function updateWheelPrizes(stageNumber) {
  const stage = stageConfig(stageNumber);
  const prizesByCode = new Map((stage?.prizes || []).map((prize) => [prize.rewardCode, prize]));
  const fallback = FALLBACK_PRIZES[stageNumber] || FALLBACK_PRIZES[1];

  PRIZES.forEach((prize, index) => {
    const apiPrize = prizesByCode.get(prize.category);
    prize.label = apiPrize ? formatPrizeLabel(apiPrize) : fallback[prize.category];
    prize.amountPoints = apiPrize?.amountPoints || 0;

    const label = document.getElementById(`prize-label-${index}`);
    if (label) label.textContent = prize.label;
  });
}

function setVipLevel(stageNumber) {
  const level = Math.min(5, Math.max(1, stageNumber));
  currentStageNumber = level;

  for (let row = 1; row <= 5; row += 1) {
    const image = document.getElementById(`vip-row-img-${row}`);
    if (image) {
      const sprite = row <= level ? VIP_SPRITE.bright[row] : VIP_SPRITE.locked[row];
      image.src = `assets/images/${sprite}_sprite.png`;
      image.style.opacity = '1';
    }

    const text = document.getElementById(`vip-text-${row}`);
    if (text) text.classList.toggle('active', row === level);
  }

  const arrowTop = VIP_ARROW_TOP[level] || VIP_ARROW_TOP[1];
  const arrowLeft = document.getElementById('vip-arrow-left');
  const arrowRight = document.getElementById('vip-arrow-right');
  if (arrowLeft) arrowLeft.style.top = `${arrowTop.L}px`;
  if (arrowRight) arrowRight.style.top = `${arrowTop.R}px`;

  updateWheelPrizes(level);
  if (document.getElementById('resultOverlay')?.classList.contains('show')) {
    pendingWheelReset = true;
  } else {
    resetWheelToInitialPrizePosition();
  }
}

function setSpinVisualState(state) {
  currentSpinState = state;
  const isDeposited = state !== SPIN_STATES.NEED_DEPOSIT;
  const isReady = state === SPIN_STATES.READY;
  canSpin = isReady;

  document.getElementById('spinGray').style.display = isReady ? 'none' : 'block';
  document.getElementById('spinGold').style.display = isReady ? 'block' : 'none';
  spinBtn.classList.toggle('spin-disabled', !isReady);
  spinBtn.classList.toggle('spin-idle', isReady && !spinning);

  const depositBtn = document.getElementById('depositBtn');
  const labelImg = document.getElementById('labelImg');
  const labelText = document.getElementById('labelText');
  const subtitle = document.querySelector('.btn-subtitle');
  if (depositBtn) depositBtn.style.display = isDeposited ? 'none' : 'block';
  if (labelImg) labelImg.style.display = isDeposited ? 'none' : 'block';
  if (labelText) labelText.style.display = isDeposited ? 'none' : 'flex';
  if (subtitle) subtitle.style.display = isDeposited ? 'none' : 'block';

  document.getElementById('textBg')?.classList.toggle('show', isDeposited);
  document.getElementById('textBgMessage')?.classList.toggle('show', isDeposited);
  document.getElementById('goBetBtn')?.classList.toggle('show', isDeposited);
  document.getElementById('progressBar')?.classList.toggle('show', isDeposited);
}

function setStatusMessage(message) {
  const messageEl = document.getElementById('textBgMessage');
  if (messageEl) messageEl.textContent = message;
}

function setSpinProgress(current, target) {
  const currentEl = document.getElementById('progressCurrent');
  const targetEl = document.getElementById('progressTarget');
  if (currentEl) currentEl.textContent = formatPoints(current);
  if (targetEl) targetEl.textContent = formatPoints(target);
}

function updateProgressPanel() {
  const progress = currentProgress();
  const stages = sortedStages();
  const current = progress.turnoverPoints || 0;
  const maxThreshold = stages.at(-1)?.turnoverThresholdPoints || current;
  const nextThreshold = stages.find((stage) => current < stage.turnoverThresholdPoints)?.turnoverThresholdPoints || maxThreshold;
  const target = Math.max(nextThreshold, current);
  const playableStage = nextPlayableStageNumber();

  if (playableStage > 0) {
    const playableTarget = stageConfig(playableStage)?.turnoverThresholdPoints || current;
    setSpinProgress(Math.min(current, playableTarget), playableTarget);
    setStatusMessage(`LV${playableStage} 今日可抽獎`);
    setSpinVisualState(SPIN_STATES.READY);
    return;
  }

  setSpinProgress(current, target);

  if (hasCompletedToday()) {
    setStatusMessage('今日 5 階段已完成');
    setSpinVisualState(SPIN_STATES.COMPLETE);
    return;
  }

  setStatusMessage(`尚差 ${formatPoints(Math.max(target - current, 0))} 流水`);
  setSpinVisualState(SPIN_STATES.NEED_WAGER);
}

function formatHistoryTime(timestamp) {
  if (!timestamp) return '--:--:--';
  const milliseconds = typeof timestamp === 'number' ? timestamp * 1000 : Date.parse(timestamp);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toTimeString().slice(0, 8) : '--:--:--';
}

function renderHistory(spins) {
  const list = document.getElementById('winnerList');
  if (!list) return;
  list.innerHTML = '';

  if (!spins || spins.length === 0) {
    const empty = document.createElement('div');
    empty.className = 't-row';
    empty.innerHTML = '<span class="t-name" style="color:#9080b8;grid-column:1/-1;text-align:center;">No records yet</span>';
    list.appendChild(empty);
    return;
  }

  spins.slice(0, 15).forEach((spin, index) => {
    const row = document.createElement('div');
    row.className = `t-row${index === 0 ? ' new-entry' : ''}`;
    row.innerHTML =
      `<span class="t-name">LV${spin.stageNumber}</span>` +
      `<span class="t-amt">${spin.prizeName || `₱${formatPoints(spin.amountPoints)}`}</span>` +
      `<span class="t-time">${formatHistoryTime(spin.createdAt)}</span>`;
    list.appendChild(row);
  });
}

function applySessionState(nextState) {
  sessionState = nextState;
  updateThresholdPanel();
  setVipLevel(displayStageNumber());
  renderHistory(currentProgress().spins || []);
  updateProgressPanel();

  if (currentSpinState === SPIN_STATES.NEED_WAGER) {
    startPolling();
  } else {
    stopPolling();
  }
}

async function refreshSessionState() {
  applySessionState(await fetchSessionState());
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = window.setInterval(async () => {
    if (spinning) return;
    try {
      await refreshSessionState();
    } catch (error) {
      console.warn('[webview] polling failed:', error);
    }
  }, 3000);
}

function stopPolling() {
  if (!pollTimer) return;
  window.clearInterval(pollTimer);
  pollTimer = null;
}

function setWheelChaseSpeed(durationSec) {
  WHEEL_LIGHT_ORDER.forEach((id, index) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.animationName = 'wheelChase';
    el.style.animationDuration = `${durationSec}s`;
    el.style.animationDelay = `${(index * durationSec) / 6}s`;
    el.style.animationTimingFunction = 'linear';
    el.style.animationIterationCount = 'infinite';
  });
}

function flashWheelLights(onDone) {
  document.querySelectorAll('.wlb').forEach((el) => {
    el.style.animationName = 'wheelFlashAll';
    el.style.animationDuration = '0.18s';
    el.style.animationDelay = '0s';
    el.style.animationTimingFunction = 'ease-in-out';
    el.style.animationIterationCount = '5';
  });
  window.setTimeout(() => {
    setWheelChaseSpeed(3);
    onDone?.();
  }, 1050);
}

function resetWheelToInitialPrizePosition() {
  if (!rotator || spinning) return;
  totalRot = 0;
  rotator.style.transition = 'none';
  rotator.style.transform = 'rotate(0deg)';
}

function spinToPrize(prize, onComplete) {
  spinning = true;
  canSpin = false;
  spinBtn.classList.add('spinning');
  spinBtn.classList.remove('spin-idle');
  spinBtn.style.cursor = 'not-allowed';
  setWheelChaseSpeed(0.5);

  const currentAngle = ((totalRot % 360) + 360) % 360;
  const targetPos = (360 - prize.angle + 360) % 360;
  let delta = (targetPos - currentAngle + 360) % 360;
  const fullRevs = (5 + Math.floor(Math.random() * 3)) * 360;
  const startRot = totalRot;

  if (delta < 45) delta += 360;

  let finalJitter;
  const useEdgeNearMiss = ['A', 'B'].includes(prize.category) && Math.random() < EDGE_NEAR_MISS_RATE;
  if (useEdgeNearMiss && prize.category === 'A') {
    finalJitter = 24 + Math.random() * 8;
  } else if (useEdgeNearMiss && prize.category === 'B') {
    finalJitter = -30 + Math.random() * 8;
  } else {
    finalJitter = -16 + Math.random() * 32;
  }

  const finalPos = startRot + fullRevs + delta + finalJitter;
  const totalSweep = finalPos - startRot;
  const accelDur = 700;
  const decelDur = 4300;

  totalRot = startRot + totalSweep * 0.13;
  rotator.style.transition = `transform ${accelDur}ms cubic-bezier(0.50, 0, 1, 0.40)`;
  rotator.style.transform = `rotate(${totalRot}deg)`;

  window.setTimeout(() => {
    totalRot = finalPos;
    rotator.style.transition = `transform ${decelDur}ms cubic-bezier(0, 0.85, 0.30, 1)`;
    rotator.style.transform = `rotate(${totalRot}deg)`;
    window.setTimeout(() => {
      spinning = false;
      spinBtn.classList.remove('spinning');
      spinBtn.style.cursor = 'pointer';
      flashWheelLights(() => {
        showResult(prize);
        onComplete?.();
      });
    }, decelDur + 80);
  }, accelDur + 20);
}

function mapApiPrize(apiPrize) {
  const target = PRIZES.find((prize) => prize.category === apiPrize?.rewardCode) || PRIZES[0];
  return {
    ...target,
    label: formatPrizeLabel(apiPrize) || target.label,
    amountPoints: apiPrize?.amountPoints || target.amountPoints || 0,
  };
}

async function doSpin() {
  if (spinning || !canSpin) return;

  const stageNumber = nextPlayableStageNumber() || currentStageNumber;
  canSpin = false;
  setStatusMessage('抽獎中...');

  try {
    const result = await apiJson('/spins/real', {
      method: 'POST',
      body: JSON.stringify({
        token: SESSION_TOKEN,
        stageNumber,
      }),
    });

    const prize = mapApiPrize(result.prize);
    spinToPrize(prize, async () => {
      try {
        await refreshSessionState();
      } catch (error) {
        console.warn('[webview] refresh after spin failed:', error);
      }
    });
  } catch (error) {
    window.alert?.(error instanceof Error ? error.message : '抽獎請求失敗，請稍後再試');
    await refreshSessionState().catch(() => {});
  }
}

function showResult(prize) {
  document.getElementById('resultPrize').textContent = prize.label;
  document.getElementById('resultIcon').src = prize.icon;
  document.getElementById('resultOverlay').classList.add('show');
}

function closeResult() {
  document.getElementById('resultOverlay').classList.remove('show');
  if (pendingWheelReset) {
    pendingWheelReset = false;
    resetWheelToInitialPrizePosition();
  }
}

function handleSpinClick() {
  if (spinning) return;
  if (canSpin) {
    doSpin();
    return;
  }
  handleGoBet();
}

function handleGoBet() {
  setStatusMessage('Go Bet 將於接平台後導向投注頁');
}

function showDepositPrompt() {
  handleGoBet();
}

function closeDepositPrompt() {
  document.getElementById('depositOverlay')?.classList.remove('show');
}

function goDeposit() {
  handleGoBet();
}

function initTicker() {
  const list = document.getElementById('winnerList');
  if (!list) return;
  Array.from(list.querySelectorAll('.t-row')).forEach((row) => {
    const clone = row.cloneNode(true);
    clone.dataset.clone = '1';
    list.appendChild(clone);
  });
}

async function init() {
  fitFrame();
  initTicker();
  setVipLevel(1);
  setSpinVisualState(SPIN_STATES.NEED_WAGER);
  setStatusMessage('載入玩家資料中...');

  try {
    await refreshSessionState();
  } catch (error) {
    console.warn('[webview] init failed:', error);
    showAuthError(error instanceof Error ? error.message : '初始化失敗');
  }
}

window.addEventListener('resize', fitFrame);
window.handleSpinClick = handleSpinClick;
window.closeResult = closeResult;
window.showDepositPrompt = showDepositPrompt;
window.closeDepositPrompt = closeDepositPrompt;
window.goDeposit = goDeposit;
window.handleGoBet = handleGoBet;
window.setVipLevel = setVipLevel;
window.setCurrentLv = setVipLevel;
window.setSpinProgress = setSpinProgress;
window.doSpin = doSpin;
window.SPIN_STATES = SPIN_STATES;

init();
