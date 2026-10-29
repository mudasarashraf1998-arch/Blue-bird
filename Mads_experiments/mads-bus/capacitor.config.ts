import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mads.experiments.bus',
  appName: 'Mads Bus',
  webDir: 'dist',
  backgroundColor: '#07111f',
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
