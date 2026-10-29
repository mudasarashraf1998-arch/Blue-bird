const STORAGE_KEY = 'mads-bus-profile-v1';

export interface PlayerProfile {
  balance: number;
  lifetimeCredits: number;
  stopsCompleted: number;
  livery: string;
  sound: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DEFAULT_PROFILE: PlayerProfile = {
  balance: 25_000,
  lifetimeCredits: 25_000,
  stopsCompleted: 0,
  livery: 'lagoon',
  sound: true,
};

function nonNegative(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

function sanitize(value: unknown): PlayerProfile {
  if (!value || typeof value !== 'object') return { ...DEFAULT_PROFILE };
  const source = value as Record<string, unknown>;
  return {
    balance: nonNegative(source.balance, DEFAULT_PROFILE.balance),
    lifetimeCredits: nonNegative(source.lifetimeCredits, DEFAULT_PROFILE.lifetimeCredits),
    stopsCompleted: nonNegative(source.stopsCompleted, 0),
    livery: typeof source.livery === 'string' ? source.livery : DEFAULT_PROFILE.livery,
    sound: typeof source.sound === 'boolean' ? source.sound : DEFAULT_PROFILE.sound,
  };
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export class ProfileStore {
  private profile: PlayerProfile;

  public constructor(private readonly storage: StorageLike | null = browserStorage()) {
    this.profile = this.read();
  }

  private read(): PlayerProfile {
    if (!this.storage) return { ...DEFAULT_PROFILE };
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      return raw ? sanitize(JSON.parse(raw)) : { ...DEFAULT_PROFILE };
    } catch {
      return { ...DEFAULT_PROFILE };
    }
  }

  private persist(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.profile));
    } catch {
      // Storage can be unavailable in private WebViews; the session still works.
    }
  }

  public get snapshot(): PlayerProfile {
    return { ...this.profile };
  }

  public credit(amount: number): PlayerProfile {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Credit amount must be a positive finite number.');
    }
    const credit = Math.floor(amount);
    this.profile = {
      ...this.profile,
      balance: this.profile.balance + credit,
      lifetimeCredits: this.profile.lifetimeCredits + credit,
    };
    this.persist();
    return this.snapshot;
  }

  public completeStop(reward: number): PlayerProfile {
    this.credit(reward);
    this.profile = { ...this.profile, stopsCompleted: this.profile.stopsCompleted + 1 };
    this.persist();
    return this.snapshot;
  }

  public setLivery(livery: string): PlayerProfile {
    this.profile = { ...this.profile, livery };
    this.persist();
    return this.snapshot;
  }

  public setSound(sound: boolean): PlayerProfile {
    this.profile = { ...this.profile, sound };
    this.persist();
    return this.snapshot;
  }
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}
