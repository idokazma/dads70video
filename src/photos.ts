import photos from "./photos.json";
import story from "./story.json";

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

// src/story.json is the hand-picked, ordered cut: chapter cards and photos
// (referenced by original filename, so re-running `npm run photos` doesn't break it).
export type StoryItem = { kind: "chapter"; title: string; sub: string } | { kind: "photo"; photo: Photo };

const byOriginal = new Map(PHOTOS.map((p) => [p.original, p]));
export const STORY: StoryItem[] = (story as Array<{ chapter?: string; sub?: string; photo?: string }>).flatMap(
  (s): StoryItem[] => {
    if (s.chapter) return [{ kind: "chapter", title: s.chapter, sub: s.sub ?? "" }];
    const p = s.photo && byOriginal.get(s.photo);
    if (!p) {
      console.warn(`story.json: photo not found: ${s.photo}`);
      return [];
    }
    return [{ kind: "photo", photo: p }];
  },
);
