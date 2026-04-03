export interface Location {
  id: string;
  name: string;
  coordinates: [number, number]; // [lng, lat]
  date: string;
  description: string;
  images: string[];
}

export interface NextDestinationData {
  name: string;
  flag: string;
  startDate: string;
  targetDate: string;
}

export interface AppConfig {
  nextDestination: NextDestinationData;
}
