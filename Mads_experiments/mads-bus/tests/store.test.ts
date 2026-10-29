import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, ProfileStore, type StorageLike } from '../src/game/store';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('player profile store', () => {
  it('starts with an original local driver balance', () => {
    const store = new ProfileStore(new MemoryStorage());
    expect(store.snapshot).toEqual(DEFAULT_PROFILE);
  });

  it('credits instant money and persists it', () => {
    const storage = new MemoryStorage();
    const store = new ProfileStore(storage);
    store.credit(10_000);
    expect(store.snapshot.balance).toBe(DEFAULT_PROFILE.balance + 10_000);
    expect(new ProfileStore(storage).snapshot.balance).toBe(DEFAULT_PROFILE.balance + 10_000);
  });

  it('counts each completed passenger stop and pays its reward', () => {
    const store = new ProfileStore(new MemoryStorage());
    store.completeStop(750);
    expect(store.snapshot.stopsCompleted).toBe(1);
    expect(store.snapshot.balance).toBe(DEFAULT_PROFILE.balance + 750);
  });

  it('rejects invalid credit amounts', () => {
    const store = new ProfileStore(new MemoryStorage());
    expect(() => store.credit(Number.NaN)).toThrow();
    expect(() => store.credit(-100)).toThrow();
    expect(store.snapshot.balance).toBe(DEFAULT_PROFILE.balance);
  });

  it('recovers safely from malformed saves', () => {
    const storage = new MemoryStorage();
    storage.setItem('mads-bus-profile-v1', '{not-json');
    expect(new ProfileStore(storage).snapshot).toEqual(DEFAULT_PROFILE);
  });

  it('persists livery and sound preferences', () => {
    const storage = new MemoryStorage();
    const store = new ProfileStore(storage);
    store.setLivery('sunset');
    store.setSound(false);
    const restored = new ProfileStore(storage).snapshot;
    expect(restored.livery).toBe('sunset');
    expect(restored.sound).toBe(false);
  });
});
