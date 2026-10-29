import { describe, expect, it } from 'vitest';
import {
  createVehicleState,
  gearForSpeed,
  stepVehicle,
  VEHICLE_LIMITS,
} from '../src/game/physics';

describe('vehicle physics', () => {
  it('accelerates forward under throttle', () => {
    let state = createVehicleState();
    for (let index = 0; index < 20; index += 1) {
      state = stepVehicle(state, { throttle: 1, brake: 0, steer: 0 }, 0.05);
    }
    expect(state.speed).toBeGreaterThan(3);
    expect(state.x).toBeGreaterThan(-64);
  });

  it('slows the bus under braking', () => {
    const initial = { ...createVehicleState(), speed: 12 };
    const result = stepVehicle(initial, { throttle: 0, brake: 1, steer: 0 }, 0.05);
    expect(result.speed).toBeGreaterThan(0);
    expect(result.speed).toBeLessThan(initial.speed);
  });

  it('turns in the direction of steering input', () => {
    const initial = { ...createVehicleState(0, 0, 0), speed: 10 };
    let state = initial;
    for (let index = 0; index < 10; index += 1) {
      state = stepVehicle(state, { throttle: 0, brake: 0, steer: 1 }, 0.05);
    }
    expect(state.heading).toBeGreaterThan(initial.heading);
    expect(state.x).toBeGreaterThan(0);
  });

  it('limits off-road speed', () => {
    const initial = { ...createVehicleState(), speed: 25 };
    const result = stepVehicle(initial, { throttle: 1, brake: 0, steer: 0 }, 0.05, false);
    expect(result.speed).toBeLessThanOrEqual(VEHICLE_LIMITS.maxOffRoadSpeed);
  });

  it('immobilizes the bus while passenger doors are open', () => {
    const initial = createVehicleState();
    const result = stepVehicle(initial, { throttle: 1, brake: 0, steer: 1 }, 0.05, true, true);
    expect(result.speed).toBe(0);
    expect(result.x).toBe(initial.x);
    expect(result.z).toBe(initial.z);
  });

  it('bounds invalid and oversized time steps', () => {
    const initial = createVehicleState();
    const invalid = stepVehicle(initial, { throttle: 1, brake: 0, steer: 0 }, Number.NaN);
    const oversized = stepVehicle(initial, { throttle: 1, brake: 0, steer: 0 }, 10);
    expect(invalid).toEqual(initial);
    expect(oversized.x - initial.x).toBeLessThan(1);
  });

  it('reports drive, neutral, and reverse gears', () => {
    expect(gearForSpeed(4)).toBe('D');
    expect(gearForSpeed(0)).toBe('N');
    expect(gearForSpeed(-2)).toBe('R');
  });
});
