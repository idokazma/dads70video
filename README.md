# Dad's 70th birthday video

Remotion slideshow built from a shared Google Photos album.

```bash
npm install
npm run download -- https://photos.app.goo.gl/XXXX   # shared album -> photos-original/album/
npm run photos                                       # -> public/photos/ + src/photos.json
npm run dev                                          # live preview in the browser (Remotion Studio)
npm run render                                       # -> out/dad-70.mp4
```

- Titles, timing, colours and music: `src/config.ts` (put an mp3 at `public/music.mp3`).
- Per-photo `year` / `caption` text: edit `src/photos.json` (kept when you re-run `npm run photos`).
- Order: by date taken; `npm run photos -- --by-name` sorts by filename instead.
