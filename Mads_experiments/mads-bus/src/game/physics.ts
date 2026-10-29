export interface VehicleState {
  x: number;
  z: number;
  heading: number;
  speed: number;
  steering: number;
}

export interface VehicleControls {
  throttle: number;
  brake: number;
  steer: number;
}

export const VEHICLE_LIMITS = {
  maxForwardSpeed: 26,
  maxReverseSpeed: 7,
  maxOffRoadSpeed: 10,
  wheelBase: 4.4,
  maxSteerAngle: 0.54,
  worldBound: 232,
} as const;

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function approach(value: number, target: number, amount: number): number {
  if (value < target) return Math.min(value + amount, target);
  return Math.max(value - amount, target);
}

export function createVehicleState(
  x = -64,
  z = -80,
  heading = Math.PI / 2,
): VehicleState {
  return { x, z, heading, speed: 0, steering: 0 };
}

/**
 * A compact arcade-simulation bicycle model. Speed is metres/second and the
 * heading is measured around the Y axis, with zero pointing toward +Z.
 */
export function stepVehicle(
  state: VehicleState,
  controls: VehicleControls,
  deltaSeconds: number,
  onRoad = true,
  doorsOpen = false,
): VehicleState {
  const dt = clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.05);
  const throttle = doorsOpen ? 0 : clamp(controls.throttle, 0, 1);
  const brake = clamp(controls.brake, 0, 1);
  const steer = clamp(controls.steer, -1, 1);
  const steering = approach(state.steering, steer, dt * 4.2);
  const maximumForward = onRoad
    ? VEHICLE_LIMITS.maxForwardSpeed
    : VEHICLE_LIMITS.maxOffRoadSpeed;

  let speed = state.speed;
  if (throttle > 0) {
    const powerFalloff = 1 - clamp(Math.max(speed, 0) / maximumForward, 0, 0.92);
    speed += throttle * 6.4 * powerFalloff * dt;
  }

  if (brake > 0) {
    if (speed > 0.3) {
      speed -= brake * 9.8 * dt;
    } else if (!doorsOpen) {
      // Holding the brake at a standstill intentionally engages reverse.
      speed -= brake * 3.1 * dt;
    }
  }

  const rollingDrag = (onRoad ? 0.24 : 1.45) + speed * speed * 0.008;
  speed -= Math.sign(speed) * Math.min(Math.abs(speed), rollingDrag * dt);
  speed = clamp(speed, -VEHICLE_LIMITS.maxReverseSpeed, maximumForward);
  if (Math.abs(speed) < 0.025 && throttle === 0 && brake === 0) speed = 0;

  const steerAngle = steering * VEHICLE_LIMITS.maxSteerAngle;
  const heading = normalizeAngle(
    state.heading + (speed / VEHICLE_LIMITS.wheelBase) * Math.tan(steerAngle) * dt,
  );
  const distance = speed * dt;
  let x = state.x + Math.sin(heading) * distance;
  let z = state.z + Math.cos(heading) * distance;

  const boundedX = clamp(x, -VEHICLE_LIMITS.worldBound, VEHICLE_LIMITS.worldBound);
  const boundedZ = clamp(z, -VEHICLE_LIMITS.worldBound, VEHICLE_LIMITS.worldBound);
  if (boundedX !== x || boundedZ !== z) speed = 0;
  x = boundedX;
  z = boundedZ;

  return { x, z, heading, speed, steering };
}

export function gearForSpeed(speed: number): 'D' | 'N' | 'R' {
  if (speed < -0.15) return 'R';
  if (speed > 0.15) return 'D';
  return 'N';
}
