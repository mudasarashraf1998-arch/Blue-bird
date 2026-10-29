import './style.css';
import { BusGame, type InputName, type Telemetry } from './game/Game';
import { formatMoney, ProfileStore } from './game/store';
import { getLivery, LIVERIES, ROUTES, type RouteDefinition } from './game/routes';

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing UI element: ${id}`);
  return node as T;
}

const store = new ProfileStore();
const sceneContainer = byId('scene');
const menuScreen = byId('menu-screen');
const pauseScreen = byId('pause-screen');
const hud = byId('hud');
const routeList = byId('route-list');
const liveryList = byId('livery-list');
const moneyButton = byId<HTMLButtonElement>('money-button');
const minimap = byId<HTMLCanvasElement>('minimap');
const mapContext = minimap.getContext('2d');
let selectedRoute: RouteDefinition = ROUTES[0];
let game: BusGame | null = null;
let paused = false;
let toastTimer = 0;

function updateBalances(): void {
  const formatted = formatMoney(store.snapshot.balance);
  document.querySelectorAll<HTMLElement>('.balance-value').forEach((node) => {
    node.textContent = formatted;
  });
}

function showToast(message: string): void {
  const toast = byId('toast');
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2_400);
}

function creditParticles(amount: number): void {
  const layer = byId('credit-particles');
  const origin = game ? moneyButton : byId('menu-screen');
  const bounds = origin.getBoundingClientRect();
  for (let index = 0; index < 6; index += 1) {
    const particle = document.createElement('span');
    particle.textContent = index === 0 ? `+${formatMoney(amount)}` : '●';
    particle.style.left = `${bounds.left + bounds.width / 2}px`;
    particle.style.top = `${bounds.top + Math.min(bounds.height / 2, 80)}px`;
    particle.style.setProperty('--drift', `${(index - 2.5) * 22}px`);
    particle.style.animationDelay = `${index * 45}ms`;
    layer.appendChild(particle);
    window.setTimeout(() => particle.remove(), 1_400);
  }
}

function addInstantCredit(): void {
  store.credit(10_000);
  updateBalances();
  creditParticles(10_000);
  moneyButton.classList.remove('credit-pulse');
  void moneyButton.offsetWidth;
  moneyButton.classList.add('credit-pulse');
  showToast('Instant credit added · Rp 10.000');
}

function selectRoute(route: RouteDefinition): void {
  selectedRoute = route;
  routeList.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    const selected = button.dataset.route === route.id;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

ROUTES.forEach((route) => {
  const button = document.createElement('button');
  button.className = 'route-card';
  button.dataset.route = route.id;
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = `
    <span class="route-meta">${route.difficulty} · ${route.distance}</span>
    <strong>${route.name}</strong>
    <small>${route.description}</small>
    <i>${route.stops.length} passenger stops</i>
  `;
  button.addEventListener('click', () => selectRoute(route));
  routeList.appendChild(button);
});
selectRoute(selectedRoute);

function selectLivery(id: string): void {
  store.setLivery(id);
  liveryList.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    const selected = button.dataset.livery === id;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

LIVERIES.forEach((livery) => {
  const button = document.createElement('button');
  button.className = 'livery-button';
  button.dataset.livery = livery.id;
  button.style.setProperty('--livery-color', livery.color);
  button.style.setProperty('--livery-accent', livery.accent);
  button.setAttribute('aria-label', `${livery.name} livery`);
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = `<span></span><small>${livery.name}</small>`;
  button.addEventListener('click', () => selectLivery(livery.id));
  liveryList.appendChild(button);
});
selectLivery(store.snapshot.livery);

function drawMinimap(telemetry: Telemetry): void {
  if (!mapContext) return;
  const context = mapContext;
  const scale = 0.56;
  const mapX = (x: number) => 90 + x * scale;
  const mapY = (z: number) => 90 + z * scale;
  context.clearRect(0, 0, 180, 180);
  context.fillStyle = 'rgba(4, 15, 25, 0.88)';
  context.fillRect(0, 0, 180, 180);
  context.strokeStyle = '#43515b';
  context.lineWidth = 16 * scale;
  context.lineJoin = 'round';
  context.strokeRect(mapX(-100), mapY(-80), 200 * scale, 160 * scale);
  context.strokeStyle = '#89939a';
  context.lineWidth = 0.7;
  context.setLineDash([4, 5]);
  context.strokeRect(mapX(-100), mapY(-80), 200 * scale, 160 * scale);
  context.setLineDash([]);

  selectedRoute.stops.forEach((stop, index) => {
    context.beginPath();
    context.arc(mapX(stop.x), mapY(stop.z), index === telemetry.nextStopIndex ? 4 : 2.4, 0, Math.PI * 2);
    context.fillStyle = index === telemetry.nextStopIndex ? '#43edc9' : '#81958f';
    context.fill();
  });

  context.save();
  context.translate(mapX(telemetry.x), mapY(telemetry.z));
  context.rotate(Math.PI - telemetry.heading);
  context.beginPath();
  context.moveTo(0, -7);
  context.lineTo(5, 5);
  context.lineTo(0, 3);
  context.lineTo(-5, 5);
  context.closePath();
  context.fillStyle = '#ffd166';
  context.fill();
  context.restore();
}

function updateTelemetry(telemetry: Telemetry): void {
  byId('speed-value').textContent = String(telemetry.speedKmh);
  byId('speed-fill').style.width = `${Math.min(100, (telemetry.speedKmh / 94) * 100)}%`;
  byId('gear').textContent = telemetry.gear;
  byId('route-label').textContent = `${selectedRoute.name.toUpperCase()} · STOP ${telemetry.nextStopIndex + 1}/${telemetry.stopCount} · ${telemetry.passengers} PASSENGERS`;
  byId('next-stop').textContent = telemetry.nextStopName;
  byId('stop-distance').textContent = `${telemetry.stopDistance} m`;
  byId('surface-warning').classList.toggle('hidden', telemetry.onRoad);
  byId('doors-button').classList.toggle('active', telemetry.doorsOpen);
  const prompt = byId('drive-prompt');
  prompt.textContent = telemetry.prompt;
  prompt.classList.toggle('hidden', telemetry.prompt.length === 0);
  drawMinimap(telemetry);
}

function startGame(): void {
  if (game) return;
  const profile = store.snapshot;
  document.body.classList.add('driving');
  menuScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  paused = false;
  game = new BusGame(sceneContainer, selectedRoute, getLivery(profile.livery), profile.sound, {
    onTelemetry: updateTelemetry,
    onEarn(amount) {
      store.completeStop(amount);
      updateBalances();
      creditParticles(amount);
    },
    onToast: showToast,
  });
  game.setSound(profile.sound);
}

function pauseGame(): void {
  if (!game || paused) return;
  paused = true;
  game.setPaused(true);
  pauseScreen.classList.remove('hidden');
}

function resumeGame(): void {
  if (!game) return;
  paused = false;
  game.setPaused(false);
  pauseScreen.classList.add('hidden');
}

function exitGame(): void {
  game?.dispose();
  game = null;
  paused = false;
  pauseScreen.classList.add('hidden');
  hud.classList.add('hidden');
  menuScreen.classList.remove('hidden');
  document.body.classList.remove('driving');
  updateBalances();
}

function toggleSound(): void {
  const enabled = !store.snapshot.sound;
  store.setSound(enabled);
  byId('menu-sound').textContent = enabled ? 'Sound on' : 'Sound off';
  game?.setSound(enabled);
  showToast(enabled ? 'Sound enabled' : 'Sound muted');
}

byId('start-button').addEventListener('click', startGame);
byId('pause-button').addEventListener('click', pauseGame);
byId('resume-button').addEventListener('click', resumeGame);
byId('reset-button').addEventListener('click', () => {
  game?.reset();
  resumeGame();
});
byId('exit-button').addEventListener('click', exitGame);
byId('camera-button').addEventListener('click', () => game?.cycleCamera());
byId('doors-button').addEventListener('click', () => game?.toggleDoors());
byId('lights-button').addEventListener('click', (event) => {
  game?.toggleLights();
  (event.currentTarget as HTMLButtonElement).classList.toggle('active');
});
byId('menu-sound').addEventListener('click', toggleSound);
moneyButton.addEventListener('click', addInstantCredit);

const holdButtons = document.querySelectorAll<HTMLButtonElement>('[data-hold]');
holdButtons.forEach((button) => {
  const control = button.dataset.hold;
  const release = () => {
    button.classList.remove('pressed');
    if (control === 'horn') game?.stopHorn();
    else if (control) game?.setInput(control as InputName, false);
  };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (!game || paused) return;
    button.setPointerCapture(event.pointerId);
    button.classList.add('pressed');
    if (control === 'horn') game.startHorn();
    else if (control) game.setInput(control as InputName, true);
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
  button.addEventListener('contextmenu', (event) => event.preventDefault());
});

const keyControls: Partial<Record<string, InputName>> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'throttle',
  KeyW: 'throttle',
  ArrowDown: 'brake',
  KeyS: 'brake',
  Space: 'brake',
};

window.addEventListener('keydown', (event) => {
  if (event.code === 'Escape' && game) {
    if (paused) resumeGame();
    else pauseGame();
    return;
  }
  if (!game || paused) return;
  const control = keyControls[event.code];
  if (control) {
    event.preventDefault();
    game.setInput(control, true);
  }
  if (event.code === 'KeyH') game.startHorn();
  if (event.repeat) return;
  if (event.code === 'KeyE') game.toggleDoors();
  if (event.code === 'KeyC') game.cycleCamera();
  if (event.code === 'KeyL') game.toggleLights();
  if (event.code === 'KeyM') addInstantCredit();
});

window.addEventListener('keyup', (event) => {
  if (!game) return;
  const control = keyControls[event.code];
  if (control) game.setInput(control, false);
  if (event.code === 'KeyH') game.stopHorn();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGame();
});

updateBalances();
byId('menu-sound').textContent = store.snapshot.sound ? 'Sound on' : 'Sound off';
