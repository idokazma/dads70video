import photos from "./photos.json";

export type Photo = {
  src: string;
  original: string;
  width: number;
  height: number;
  date: string | null;
  caption: string;
  year: string;
};

export const PHOTOS = photos as Photo[];
