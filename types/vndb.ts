export interface VNImage {
  id: string;
  url: string;
  dims: [number, number];
  sexual?: number | null;
  violence?: number | null;
}

export interface VNTag {
  id: string;
  name: string;
  category: string;
  /**
   * VNDBのネタバレ区分（0 = ネタバレなし、1 = 軽度、2 = 重度）。
   * 旧版で保存したタグやAPIが返さない場合は undefined。
   * 不明な値を安全とみなさないため、判定は lib/spoiler-safety.ts を使う。
   */
  spoiler?: number | null;
}

export interface VNDeveloper {
  id: string;
  name: string;
  original: string;
}

export interface VNScreenshot {
  url: string;
  thumbnail: string;
  sexual?: number | null;
  violence?: number | null;
}

export interface VNExtLink {
  url: string;
  label: string;
  name?: string;
  id: string;
}
export interface VNRelease {
  id?: string;
  minage: number | null;
  vns?: Array<Pick<VN, "id">>;
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
  releases: VNRelease[];
}

export interface VNDBResponse<T> {
  results: T[];
  more: boolean;
  count?: number;
}
