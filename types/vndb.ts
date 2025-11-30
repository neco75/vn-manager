export interface VNImage {
  id: string;
  url: string;
  dims: [number, number];
  sexual: number;
  violence: number;
}

export interface VNTag {
  id: string;
  name: string;
  category: string;
}

export interface VNDeveloper {
  id: string;
  name: string;
  original: string;
}

export interface VNScreenshot {
  url: string;
  thumbnail: string;
  sexual: number;
  violence: number;
}

export interface VNExtLink {
  url: string;
  label: string;
  name?: string;
  id: string;
}

export interface VN {
  id: string;
  title: string;
  released: string;
  languages: string[];
  platforms: string[];
  image: VNImage | null;
  description: string;
  rating: number;
  votecount: number;
  length_minutes: number | null;
  tags: VNTag[];
  developers: VNDeveloper[];
  screenshots: VNScreenshot[];
  extlinks: VNExtLink[];
}

export interface VNDBResponse<T> {
  results: T[];
  more: boolean;
  count?: number;
}
