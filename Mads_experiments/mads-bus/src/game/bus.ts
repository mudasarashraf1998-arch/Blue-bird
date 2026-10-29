import * as THREE from 'three';
import type { Livery } from './routes';

export interface BusModel {
  group: THREE.Group;
  update: (speed: number, steering: number, doorsOpen: boolean, dt: number) => void;
  setLights: (enabled: boolean) => void;
  setLivery: (livery: Livery) => void;
}

function box(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function createBus(livery: Livery): BusModel {
  const group = new THREE.Group();
  const suspension = new THREE.Group();
  group.add(suspension);

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: livery.color,
    roughness: 0.42,
    metalness: 0.12,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: livery.accent,
    roughness: 0.5,
  });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: '#102b3d',
    roughness: 0.18,
    metalness: 0.42,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: '#101820', roughness: 0.72 });
  const tireMaterial = new THREE.MeshStandardMaterial({ color: '#111315', roughness: 0.94 });
  const hubMaterial = new THREE.MeshStandardMaterial({ color: '#9da9b1', metalness: 0.72, roughness: 0.3 });
  const headlightMaterial = new THREE.MeshStandardMaterial({
    color: '#fff4c4',
    emissive: '#ffd970',
    emissiveIntensity: 0.15,
  });

  box(suspension, [2.7, 1.5, 8.4], [0, 1.45, 0], bodyMaterial);
  box(suspension, [2.64, 1.25, 8.05], [0, 2.72, -0.08], accentMaterial);
  box(suspension, [2.72, 0.18, 8.2], [0, 3.42, -0.08], accentMaterial);
  box(suspension, [2.76, 0.24, 8.5], [0, 0.86, 0], trimMaterial);
  box(suspension, [2.25, 1.0, 0.08], [0, 2.72, 3.98], glassMaterial);
  box(suspension, [2.18, 0.86, 0.08], [0, 2.72, -4.13], glassMaterial);
  box(suspension, [2.74, 0.17, 0.16], [0, 1.96, 4.19], trimMaterial);
  box(suspension, [2.35, 0.28, 0.12], [0, 1.12, 4.23], accentMaterial);

  for (const side of [-1, 1]) {
    for (let index = 0; index < 5; index += 1) {
      box(
        suspension,
        [0.06, 0.86, 1.22],
        [side * 1.34, 2.72, 2.55 - index * 1.43],
        glassMaterial,
      );
    }
    box(suspension, [0.08, 0.12, 7.8], [side * 1.37, 1.96, -0.05], trimMaterial);
  }

  const door = box(suspension, [0.08, 2.08, 1.08], [-1.37, 1.86, 2.42], glassMaterial);
  const doorClosedZ = door.position.z;
  box(suspension, [0.1, 0.12, 1.12], [-1.39, 0.84, 2.42], trimMaterial);

  const mirrorMaterial = new THREE.MeshStandardMaterial({ color: '#18232c', roughness: 0.5 });
  for (const side of [-1, 1]) {
    box(suspension, [0.18, 0.5, 0.3], [side * 1.55, 2.72, 3.7], mirrorMaterial);
    box(suspension, [0.52, 0.28, 0.1], [side * 0.82, 1.35, 4.25], headlightMaterial);
    const tailMaterial = new THREE.MeshStandardMaterial({ color: '#8f1d24', emissive: '#5f080c' });
    box(suspension, [0.34, 0.38, 0.1], [side * 0.9, 1.25, -4.24], tailMaterial);
  }

  const wheelGeometry = new THREE.CylinderGeometry(0.68, 0.68, 0.42, 24);
  wheelGeometry.rotateZ(Math.PI / 2);
  const hubGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.44, 20);
  hubGeometry.rotateZ(Math.PI / 2);
  const wheels: THREE.Mesh[] = [];
  const frontPivots: THREE.Group[] = [];

  for (const z of [-2.72, 2.72]) {
    for (const x of [-1.36, 1.36]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.72, z);
      suspension.add(pivot);
      const wheel = new THREE.Mesh(wheelGeometry, tireMaterial);
      wheel.castShadow = true;
      pivot.add(wheel);
      const hub = new THREE.Mesh(hubGeometry, hubMaterial);
      pivot.add(hub);
      wheels.push(wheel, hub);
      if (z > 0) frontPivots.push(pivot);
    }
  }

  const headlight = new THREE.SpotLight('#ffe7a3', 0, 42, Math.PI / 5, 0.5, 1.2);
  headlight.position.set(0, 1.5, 4.0);
  headlight.target.position.set(0, 0.2, 24);
  suspension.add(headlight, headlight.target);

  return {
    group,
    update(speed, steering, doorsOpen, dt) {
      const spin = (speed * dt) / 0.68;
      wheels.forEach((wheel) => {
        wheel.rotation.x -= spin;
      });
      frontPivots.forEach((pivot) => {
        pivot.rotation.y = steering * 0.54;
      });
      door.position.z = THREE.MathUtils.damp(
        door.position.z,
        doorClosedZ + (doorsOpen ? 1.0 : 0),
        9,
        dt,
      );
      suspension.rotation.z = THREE.MathUtils.damp(
        suspension.rotation.z,
        -steering * Math.min(Math.abs(speed) / 26, 1) * 0.055,
        5,
        dt,
      );
    },
    setLights(enabled) {
      headlight.intensity = enabled ? 55 : 0;
      headlightMaterial.emissiveIntensity = enabled ? 2.4 : 0.15;
    },
    setLivery(nextLivery) {
      bodyMaterial.color.set(nextLivery.color);
      accentMaterial.color.set(nextLivery.accent);
    },
  };
}
