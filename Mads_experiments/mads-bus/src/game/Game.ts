import * as THREE from 'three';
import { SoundSystem } from './audio';
import { createBus, type BusModel } from './bus';
import { createVehicleState, gearForSpeed, stepVehicle, type VehicleState } from './physics';
import type { Livery, RouteDefinition } from './routes';
import { World } from './world';

export type InputName = 'left' | 'right' | 'throttle' | 'brake';
export type CameraMode = 'Chase' | 'Cab' | 'Aerial';

export interface Telemetry {
  speedKmh: number;
  gear: 'D' | 'N' | 'R';
  x: number;
  z: number;
  heading: number;
  nextStopIndex: number;
  nextStopName: string;
  stopDistance: number;
  stopCount: number;
  doorsOpen: boolean;
  onRoad: boolean;
  passengers: number;
  cameraMode: CameraMode;
  prompt: string;
}

export interface GameEvents {
  onTelemetry: (telemetry: Telemetry) => void;
  onEarn: (amount: number, stopName: string) => void;
  onToast: (message: string) => void;
}

const CAMERA_MODES: CameraMode[] = ['Chase', 'Cab', 'Aerial'];
const START_INPUT: Record<InputName, boolean> = {
  left: false,
  right: false,
  throttle: false,
  brake: false,
};

export class BusGame {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 650);
  private readonly bus: BusModel;
  private readonly world: World;
  private readonly sound: SoundSystem;
  private readonly resizeObserver: ResizeObserver;
  private readonly input: Record<InputName, boolean> = { ...START_INPUT };
  private state: VehicleState;
  private animationFrame = 0;
  private previousTime = performance.now();
  private elapsed = 0;
  private telemetryCountdown = 0;
  private paused = false;
  private disposed = false;
  private doorsOpen = false;
  private lightsOn = false;
  private cameraIndex = 0;
  private nextStopIndex = 0;
  private stopDwell = 0;
  private passengers = 0;
  private prompt = '';
  private lastCollision = -10;

  public constructor(
    private readonly container: HTMLElement,
    private readonly route: RouteDefinition,
    livery: Livery,
    soundEnabled: boolean,
    private readonly events: GameEvents,
  ) {
    this.state = createVehicleState(route.start.x, route.start.z, route.start.heading);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);

    const hemisphere = new THREE.HemisphereLight('#e5f5ff', '#40513a', 2.0);
    this.scene.add(hemisphere);
    const sun = new THREE.DirectionalLight('#fff3d6', 3.1);
    sun.position.set(75, 125, -65);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -135;
    sun.shadow.camera.right = 135;
    sun.shadow.camera.top = 135;
    sun.shadow.camera.bottom = -135;
    sun.shadow.camera.far = 360;
    sun.shadow.bias = -0.0003;
    this.scene.add(sun);

    this.world = new World(this.scene, route);
    this.bus = createBus(livery);
    this.scene.add(this.bus.group);
    this.sound = new SoundSystem(soundEnabled);
    this.reset(false);
    this.resize();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.animationFrame = requestAnimationFrame(this.animate);
  }

  private resize(): void {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private animate = (now: number): void => {
    if (this.disposed) return;
    this.animationFrame = requestAnimationFrame(this.animate);
    const dt = Math.min(Math.max((now - this.previousTime) / 1000, 0), 0.05);
    this.previousTime = now;
    if (!this.paused) this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number): void {
    this.elapsed += dt;
    const onRoad = this.world.isOnRoad(this.state.x, this.state.z);
    this.state = stepVehicle(
      this.state,
      {
        throttle: this.input.throttle ? 1 : 0,
        brake: this.input.brake ? 1 : 0,
        steer: Number(this.input.right) - Number(this.input.left),
      },
      dt,
      onRoad,
      this.doorsOpen,
    );

    this.bus.group.position.set(this.state.x, 0, this.state.z);
    this.bus.group.rotation.y = this.state.heading;
    this.bus.update(this.state.speed, this.state.steering, this.doorsOpen, dt);
    this.world.update(dt, this.elapsed);
    this.updateStopInteraction(dt);
    this.updateCamera(dt);

    if (
      this.world.hasTrafficCollision(this.state.x, this.state.z) &&
      Math.abs(this.state.speed) > 1 &&
      this.elapsed - this.lastCollision > 1.5
    ) {
      this.state = { ...this.state, speed: -this.state.speed * 0.12 };
      this.lastCollision = this.elapsed;
      this.events.onToast('Traffic contact · slow down near other vehicles');
    }

    this.sound.update(this.state.speed, this.input.throttle ? 1 : 0, false);
    this.telemetryCountdown -= dt;
    if (this.telemetryCountdown <= 0) {
      this.emitTelemetry();
      this.telemetryCountdown = 0.08;
    }
  }

  private updateStopInteraction(dt: number): void {
    const stop = this.route.stops[this.nextStopIndex];
    const distance = Math.hypot(stop.x - this.state.x, stop.z - this.state.z);
    this.prompt = '';
    if (distance > 10) {
      this.stopDwell = 0;
      return;
    }
    if (Math.abs(this.state.speed) > 0.55) {
      this.prompt = 'Stop inside the marked passenger zone';
      this.stopDwell = 0;
      return;
    }
    if (!this.doorsOpen) {
      this.prompt = `Open the doors at ${stop.name}`;
      this.stopDwell = 0;
      return;
    }

    this.stopDwell += dt;
    const remaining = Math.max(0, 1.6 - this.stopDwell);
    this.prompt = remaining > 0 ? `Boarding passengers · ${remaining.toFixed(1)} s` : '';
    if (this.stopDwell < 1.6) return;

    const completedIndex = this.nextStopIndex;
    this.passengers += 4 + ((completedIndex * 3 + this.route.id.length) % 9);
    this.events.onEarn(stop.reward, stop.name);
    this.nextStopIndex = (this.nextStopIndex + 1) % this.route.stops.length;
    this.world.setActiveStop(this.nextStopIndex);
    this.stopDwell = 0;
    this.doorsOpen = false;
    const routeCompleted = this.nextStopIndex === 0;
    this.events.onToast(
      routeCompleted
        ? `Route complete · ${stop.name} paid Rp ${stop.reward.toLocaleString('id-ID')}`
        : `${stop.name} complete · next: ${this.route.stops[this.nextStopIndex].name}`,
    );
  }

  private updateCamera(dt: number): void {
    const forward = new THREE.Vector3(Math.sin(this.state.heading), 0, Math.cos(this.state.heading));
    const busPosition = new THREE.Vector3(this.state.x, 0, this.state.z);
    const mode = CAMERA_MODES[this.cameraIndex];
    if (mode === 'Cab') {
      const right = new THREE.Vector3(forward.z, 0, -forward.x);
      this.camera.position.copy(busPosition)
        .addScaledVector(forward, 4.35)
        .addScaledVector(right, 0.62)
        .add(new THREE.Vector3(0, 2.85, 0));
      this.camera.lookAt(busPosition.clone().addScaledVector(forward, 36).add(new THREE.Vector3(0, 2.5, 0)));
      return;
    }
    if (mode === 'Aerial') {
      const desired = busPosition.clone().add(new THREE.Vector3(0, 42, 0)).addScaledVector(forward, -3);
      this.camera.position.lerp(desired, 1 - Math.exp(-dt * 4));
      this.camera.lookAt(busPosition.clone().addScaledVector(forward, 5));
      return;
    }
    const desired = busPosition.clone().addScaledVector(forward, -14).add(new THREE.Vector3(0, 7.2, 0));
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 5));
    this.camera.lookAt(busPosition.clone().addScaledVector(forward, 5).add(new THREE.Vector3(0, 2.0, 0)));
  }

  private emitTelemetry(): void {
    const stop = this.route.stops[this.nextStopIndex];
    this.events.onTelemetry({
      speedKmh: Math.round(Math.abs(this.state.speed) * 3.6),
      gear: gearForSpeed(this.state.speed),
      x: this.state.x,
      z: this.state.z,
      heading: this.state.heading,
      nextStopIndex: this.nextStopIndex,
      nextStopName: stop.name,
      stopDistance: Math.round(Math.hypot(stop.x - this.state.x, stop.z - this.state.z)),
      stopCount: this.route.stops.length,
      doorsOpen: this.doorsOpen,
      onRoad: this.world.isOnRoad(this.state.x, this.state.z),
      passengers: this.passengers,
      cameraMode: CAMERA_MODES[this.cameraIndex],
      prompt: this.prompt,
    });
  }

  public setInput(name: InputName, active: boolean): void {
    this.input[name] = active;
    if (active) this.sound.unlock();
  }

  public startHorn(): void {
    this.sound.startHorn();
  }

  public stopHorn(): void {
    this.sound.stopHorn();
  }

  public toggleDoors(): void {
    if (Math.abs(this.state.speed) > 0.45) {
      this.events.onToast('Stop the bus before operating the doors');
      return;
    }
    this.doorsOpen = !this.doorsOpen;
    this.stopDwell = 0;
    this.events.onToast(this.doorsOpen ? 'Passenger doors open' : 'Passenger doors closed');
    this.emitTelemetry();
  }

  public toggleLights(): void {
    this.lightsOn = !this.lightsOn;
    this.bus.setLights(this.lightsOn);
    this.events.onToast(this.lightsOn ? 'Headlights on' : 'Headlights off');
  }

  public cycleCamera(): void {
    this.cameraIndex = (this.cameraIndex + 1) % CAMERA_MODES.length;
    this.events.onToast(`${CAMERA_MODES[this.cameraIndex]} camera`);
    this.emitTelemetry();
  }

  public setSound(enabled: boolean): void {
    this.sound.setEnabled(enabled);
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    Object.assign(this.input, START_INPUT);
    this.stopHorn();
    this.sound.update(this.state.speed, 0, paused);
  }

  public reset(notify = true): void {
    this.state = createVehicleState(this.route.start.x, this.route.start.z, this.route.start.heading);
    this.nextStopIndex = 0;
    this.stopDwell = 0;
    this.passengers = 0;
    this.doorsOpen = false;
    this.world.setActiveStop(0);
    this.bus.group.position.set(this.state.x, 0, this.state.z);
    this.bus.group.rotation.y = this.state.heading;
    const forward = new THREE.Vector3(Math.sin(this.state.heading), 0, Math.cos(this.state.heading));
    this.camera.position.set(this.state.x, 7.2, this.state.z).addScaledVector(forward, -14);
    this.camera.lookAt(this.state.x, 2, this.state.z);
    this.emitTelemetry();
    if (notify) this.events.onToast('Route restarted');
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.sound.dispose();
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
    this.world.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
