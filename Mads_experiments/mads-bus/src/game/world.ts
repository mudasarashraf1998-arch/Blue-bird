import * as THREE from 'three';
import type { RouteDefinition } from './routes';

interface TrafficCar {
  group: THREE.Group;
  distance: number;
  speed: number;
}

interface LoopPose {
  x: number;
  z: number;
  heading: number;
}

const LOOP_LENGTH = 720;

function sampleLoop(distance: number): LoopPose {
  let cursor = ((distance % LOOP_LENGTH) + LOOP_LENGTH) % LOOP_LENGTH;
  if (cursor < 200) {
    return { x: -100 + cursor, z: -80, heading: Math.PI / 2 };
  }
  cursor -= 200;
  if (cursor < 160) {
    return { x: 100, z: -80 + cursor, heading: 0 };
  }
  cursor -= 160;
  if (cursor < 200) {
    return { x: 100 - cursor, z: 80, heading: -Math.PI / 2 };
  }
  cursor -= 200;
  return { x: -100, z: 80 - cursor, heading: Math.PI };
}

function makeRandom(seedValue: number): () => number {
  let seed = seedValue >>> 0;
  return () => {
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
    return seed / 4_294_967_296;
  };
}

export class World {
  public readonly root = new THREE.Group();
  private readonly stopRings: THREE.Mesh<THREE.RingGeometry, THREE.MeshStandardMaterial>[] = [];
  private readonly traffic: TrafficCar[] = [];
  private activeStop = 0;

  public constructor(
    private readonly scene: THREE.Scene,
    private readonly route: RouteDefinition,
  ) {
    this.scene.add(this.root);
    const palette = {
      city: { ground: '#6f9f72', sky: '#8fc6dd', fog: '#a9cfda', road: '#303942' },
      highland: { ground: '#537b5d', sky: '#8eb6c1', fog: '#a4bec0', road: '#343b40' },
      village: { ground: '#83a965', sky: '#add2d5', fog: '#c0d6c7', road: '#3c4040' },
    }[route.theme];
    this.scene.background = new THREE.Color(palette.sky);
    this.scene.fog = new THREE.Fog(palette.fog, 95, 330);
    this.buildGround(palette.ground);
    this.buildRoads(palette.road);
    this.buildScenery();
    this.buildStops();
    this.buildTraffic();
  }

  private buildGround(color: string): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(520, 520),
      new THREE.MeshStandardMaterial({ color, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    ground.receiveShadow = true;
    this.root.add(ground);
  }

  private buildRoads(color: string): void {
    const roadMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.93 });
    const lineMaterial = new THREE.MeshBasicMaterial({ color: '#e9e3c8' });
    const edgeMaterial = new THREE.MeshBasicMaterial({ color: '#d7d9d4' });
    const addRoad = (width: number, depth: number, x: number, z: number) => {
      const road = new THREE.Mesh(new THREE.BoxGeometry(width, 0.1, depth), roadMaterial);
      road.position.set(x, 0, z);
      road.receiveShadow = true;
      this.root.add(road);
    };
    addRoad(216, 16, 0, -80);
    addRoad(216, 16, 0, 80);
    addRoad(16, 176, -100, 0);
    addRoad(16, 176, 100, 0);

    for (const z of [-80, 80]) {
      for (let x = -96; x <= 96; x += 12) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(5, 0.025, 0.18), lineMaterial);
        dash.position.set(x, 0.065, z);
        this.root.add(dash);
      }
      for (const edge of [-6.8, 6.8]) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(200, 0.02, 0.12), edgeMaterial);
        line.position.set(0, 0.062, z + edge);
        this.root.add(line);
      }
    }
    for (const x of [-100, 100]) {
      for (let z = -72; z <= 72; z += 12) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 5), lineMaterial);
        dash.position.set(x, 0.065, z);
        this.root.add(dash);
      }
      for (const edge of [-6.8, 6.8]) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 160), edgeMaterial);
        line.position.set(x + edge, 0.062, 0);
        this.root.add(line);
      }
    }
  }

  public isOnRoad(x: number, z: number, margin = 0): boolean {
    const horizontal =
      Math.abs(x) <= 108 + margin &&
      (Math.abs(z - 80) <= 8 + margin || Math.abs(z + 80) <= 8 + margin);
    const vertical =
      Math.abs(z) <= 88 + margin &&
      (Math.abs(x - 100) <= 8 + margin || Math.abs(x + 100) <= 8 + margin);
    return horizontal || vertical;
  }

  private buildScenery(): void {
    const random = makeRandom(1_337 + this.route.id.length * 97);
    const buildingColors = ['#d9c6a5', '#b8c8ce', '#d6a68f', '#b5b8d4', '#d7d4bd'];
    const treeTrunk = new THREE.CylinderGeometry(0.22, 0.3, 1.8, 7);
    const treeCrown = new THREE.ConeGeometry(1.65, 4.2, 9);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#65513b', roughness: 1 });
    const crownMaterial = new THREE.MeshStandardMaterial({
      color: this.route.theme === 'highland' ? '#285a43' : '#3e7948',
      roughness: 0.95,
    });

    const addTree = (x: number, z: number, scale: number) => {
      const group = new THREE.Group();
      const trunk = new THREE.Mesh(treeTrunk, trunkMaterial);
      trunk.position.y = 0.9;
      trunk.castShadow = true;
      const crown = new THREE.Mesh(treeCrown, crownMaterial);
      crown.position.y = 3.2;
      crown.castShadow = true;
      group.add(trunk, crown);
      group.position.set(x, 0, z);
      group.scale.setScalar(scale);
      this.root.add(group);
    };

    for (let x = -190; x <= 190; x += 38) {
      for (let z = -190; z <= 190; z += 38) {
        if (this.isOnRoad(x, z, 18)) continue;
        const choice = random();
        const treeChance = this.route.theme === 'city' ? 0.42 : 0.7;
        if (choice < treeChance) {
          addTree(x + (random() - 0.5) * 12, z + (random() - 0.5) * 12, 0.75 + random() * 0.8);
          continue;
        }
        const height = this.route.theme === 'city' ? 7 + random() * 19 : 4 + random() * 7;
        const width = 11 + random() * 9;
        const depth = 11 + random() * 9;
        const material = new THREE.MeshStandardMaterial({
          color: buildingColors[Math.floor(random() * buildingColors.length)],
          roughness: 0.88,
        });
        const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
        building.position.set(x, height / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        this.root.add(building);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(width + 0.5, 0.35, depth + 0.5),
          new THREE.MeshStandardMaterial({ color: '#55616a', roughness: 0.85 }),
        );
        roof.position.set(x, height + 0.17, z);
        this.root.add(roof);
      }
    }

    for (let index = 0; index < 55; index += 1) {
      const x = (random() - 0.5) * 460;
      const z = (random() - 0.5) * 460;
      if (!this.isOnRoad(x, z, 9)) addTree(x, z, 0.65 + random() * 0.65);
    }

    if (this.route.theme !== 'city') {
      const hillMaterial = new THREE.MeshStandardMaterial({ color: '#56745c', roughness: 1 });
      for (let index = 0; index < 12; index += 1) {
        const angle = (index / 12) * Math.PI * 2;
        const hill = new THREE.Mesh(new THREE.ConeGeometry(38 + random() * 24, 40 + random() * 35, 7), hillMaterial);
        hill.position.set(Math.sin(angle) * 245, 12, Math.cos(angle) * 245);
        this.root.add(hill);
      }
    }
  }

  private buildStops(): void {
    const poleMaterial = new THREE.MeshStandardMaterial({ color: '#263746', metalness: 0.45 });
    const signMaterial = new THREE.MeshStandardMaterial({ color: '#e9fff9', roughness: 0.5 });
    this.route.stops.forEach((stop) => {
      const material = new THREE.MeshStandardMaterial({
        color: '#47e6c5',
        emissive: '#1fc7a7',
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(5.4, 6.05, 40), material);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(stop.x, 0.1, stop.z);
      this.root.add(ring);
      this.stopRings.push(ring);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.5, 8), poleMaterial);
      pole.position.set(stop.x + 7.2, 1.75, stop.z + 5.5);
      pole.castShadow = true;
      this.root.add(pole);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, 0.12), signMaterial);
      sign.position.set(stop.x + 7.2, 3.25, stop.z + 5.5);
      this.root.add(sign);
    });
  }

  private buildTraffic(): void {
    const colors = ['#e56b55', '#e3b341', '#5d8ee8', '#eceff1', '#9b6fd0'];
    for (let index = 0; index < 6; index += 1) {
      const group = new THREE.Group();
      const bodyMaterial = new THREE.MeshStandardMaterial({ color: colors[index % colors.length], roughness: 0.5 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 4.1), bodyMaterial);
      body.position.y = 0.82;
      body.castShadow = true;
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.55, 0.65, 2.0),
        new THREE.MeshStandardMaterial({ color: '#203646', roughness: 0.3, metalness: 0.25 }),
      );
      cabin.position.set(0, 1.48, -0.25);
      group.add(body, cabin);
      this.root.add(group);
      this.traffic.push({ group, distance: index * 117 + 45, speed: 7 + (index % 3) * 1.4 });
    }
  }

  public setActiveStop(index: number): void {
    this.activeStop = index;
  }

  public update(dt: number, elapsed: number): void {
    this.traffic.forEach((car) => {
      car.distance += car.speed * dt;
      const pose = sampleLoop(car.distance);
      car.group.position.set(pose.x, 0, pose.z);
      car.group.rotation.y = pose.heading;
    });
    this.stopRings.forEach((ring, index) => {
      const active = index === this.activeStop;
      const pulse = active ? 1 + Math.sin(elapsed * 4) * 0.055 : 1;
      ring.scale.setScalar(pulse);
      ring.material.opacity = active ? 0.9 : 0.25;
      ring.material.emissiveIntensity = active ? 1.2 : 0.1;
    });
  }

  public hasTrafficCollision(x: number, z: number): boolean {
    return this.traffic.some((car) => {
      const dx = car.group.position.x - x;
      const dz = car.group.position.z - z;
      return dx * dx + dz * dz < 22;
    });
  }

  public dispose(): void {
    this.scene.remove(this.root);
  }
}
