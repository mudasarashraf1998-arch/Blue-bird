export interface BusStop {
  name: string;
  x: number;
  z: number;
  reward: number;
}

export interface RouteDefinition {
  id: string;
  name: string;
  description: string;
  distance: string;
  difficulty: 'Easy' | 'Medium' | 'Scenic';
  theme: 'city' | 'highland' | 'village';
  start: { x: number; z: number; heading: number };
  stops: BusStop[];
}

export const ROUTES: RouteDefinition[] = [
  {
    id: 'city-loop',
    name: 'City Loop',
    description: 'Terminals, markets, and a complete city circuit.',
    distance: '4.8 km',
    difficulty: 'Easy',
    theme: 'city',
    start: { x: -64, z: -80, heading: Math.PI / 2 },
    stops: [
      { name: 'Central Terminal', x: 0, z: -80, reward: 650 },
      { name: 'East Market', x: 100, z: -30, reward: 800 },
      { name: 'Riverside', x: 62, z: 80, reward: 900 },
      { name: 'Old Town', x: -52, z: 80, reward: 950 },
      { name: 'West Depot', x: -100, z: 4, reward: 1_100 },
    ],
  },
  {
    id: 'highland-line',
    name: 'Highland Line',
    description: 'Longer legs through pine country and hill viewpoints.',
    distance: '6.2 km',
    difficulty: 'Scenic',
    theme: 'highland',
    start: { x: -100, z: 54, heading: Math.PI },
    stops: [
      { name: 'Hill Gate', x: -100, z: -24, reward: 850 },
      { name: 'Pine Ridge', x: -44, z: -80, reward: 950 },
      { name: 'Summit Stop', x: 100, z: -12, reward: 1_100 },
      { name: 'Lake View', x: 26, z: 80, reward: 1_250 },
      { name: 'Highland Depot', x: -100, z: 40, reward: 1_300 },
    ],
  },
  {
    id: 'village-express',
    name: 'Village Express',
    description: 'A relaxed countryside service with fewer stops.',
    distance: '3.6 km',
    difficulty: 'Medium',
    theme: 'village',
    start: { x: 100, z: 48, heading: Math.PI },
    stops: [
      { name: 'Garden Depot', x: 100, z: -38, reward: 750 },
      { name: 'Rice Fields', x: 42, z: -80, reward: 900 },
      { name: 'Village Market', x: -100, z: -8, reward: 1_000 },
      { name: 'Harbor Road', x: 24, z: 80, reward: 1_200 },
    ],
  },
];

export interface Livery {
  id: string;
  name: string;
  color: string;
  accent: string;
}

export const LIVERIES: Livery[] = [
  { id: 'lagoon', name: 'Lagoon', color: '#16bfa5', accent: '#e6fffa' },
  { id: 'sunset', name: 'Sunset', color: '#ef6a4c', accent: '#fff0df' },
  { id: 'electric', name: 'Electric', color: '#5277ed', accent: '#e9edff' },
  { id: 'citrus', name: 'Citrus', color: '#e8ad32', accent: '#fff8db' },
  { id: 'midnight', name: 'Midnight', color: '#28344d', accent: '#dce8ff' },
];

export function getRoute(id: string): RouteDefinition {
  return ROUTES.find((route) => route.id === id) ?? ROUTES[0];
}

export function getLivery(id: string): Livery {
  return LIVERIES.find((livery) => livery.id === id) ?? LIVERIES[0];
}
