import { read as readID3, update as updateID3 } from "node-id3";
import { readdirSync } from "node:fs";
import { SpotifyApi, type Track } from "@spotify/web-api-ts-sdk";
import Enquirer from "enquirer";
import { Logger, Spinner } from "@paperdave/logger";
const { prompt } = Enquirer;

if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
  throw new Error(
    "Missing SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables"
  );
}

if (!process.env.THUMBNAILS_DIR) {
  throw new Error("Missing THUMBNAILS_DIR environment variable");
}

const bannedCharacters = /[\\/:*?"<>|]/g;

const musicDirectory = process.argv[2];
const musicThumbnailsDirectory = process.env.THUMBNAILS_DIR;
const instrumentalMode = process.argv.includes("--instrumental");

const spotifyClient = SpotifyApi.withClientCredentials(
  process.env.SPOTIFY_CLIENT_ID,
  process.env.SPOTIFY_CLIENT_SECRET
);

let skipped = await Bun.file("skipped.txt").text();

// read the directory
const files = readdirSync(musicDirectory).filter(
  (file) => /\.(mp3|flac|m4a|aif|wav)$/.test(file) && !skipped.includes(file)
);

for (const file of files) {
  const { title, artist, album, year, image, trackNumber } = readID3(
    `${musicDirectory}/${file}`
  );

  if (!title || !artist || !album || !year || !image || !trackNumber) {
    console.table({
      file,
      title,
      artist,
      album,
      year,
      trackNumber,
    });

    const { query } = await prompt<{ query: string }>({
      type: "input",
      name: "query",
      message: `Missing tags. Search Spotify, paste a track URL (or enter nothing to skip): `,
      ...(title && artist
        ? {
            initial: `${title
              .replace(/instrumental/gi, "")
              .replace(/offvocal/gi, "")} ${artist}`,
          }
        : {}),
    });

    if (query === "") {
      Logger.info("Skipping file");
      skipped += `\n${file}`;
      Bun.write("./skipped.txt", skipped);
      continue;
    }

    let track: Track | undefined;

    const SPOTIFY_TRACK_REGEX =
      /https:\/\/open\.spotify\.com\/track\/([a-zA-Z0-9]+)(\?[^#]*)?/;
    const matches = query.match(SPOTIFY_TRACK_REGEX);

    if (matches && matches[1]) {
      track = await spotifyClient.tracks.get(matches[1]);
    } else {
      const { tracks } = await spotifyClient.search(
        query,
        ["track"],
        undefined,
        10
      );

      const { selectedId } = await prompt<{
        selectedId: string;
      }>({
        type: "select",
        message: "Multiple tracks found, select one (or skip):",
        name: "selectedId",
        choices: [
          ...tracks.items.map((track) => ({
            message: track.name,
            name: track.id,
            hint: `${track.artists.map((artist) => artist.name).join(", ")} - ${
              track.album.name
            }`,
          })),
          { message: "Skip", name: "skip" },
        ],
      });

      if (selectedId === "skip") {
        Logger.info("Skipping file");
        skipped += `\n${file}`;
        Bun.write("./skipped.txt", skipped);
        continue;
      }

      track = tracks.items.find((track) => track.id === selectedId);

      if (!track) {
        console.error("Track not found");
        continue;
      }

      Logger.debug(track);
    }

    const thumbnailFileName = `${track.album.artists[0].name.replace(
      bannedCharacters,
      "_"
    )} - ${track.album.name.replace(bannedCharacters, "_")}.jpg`;

    // check if album art is already downloaded
    const thumbnail = await Bun.file(
      `${musicThumbnailsDirectory}/${thumbnailFileName}`
    ).exists();

    if (!thumbnail) {
      // download album art
      const req = await Bun.fetch(track.album.images[0].url);
      const dlSpinner = new Spinner(`Downloading ${thumbnailFileName}`);

      if (req.ok) {
        const blob = await req.blob();
        await Bun.write(
          `${musicThumbnailsDirectory}/${thumbnailFileName}`,
          blob
        );
        dlSpinner.success(`Wrote to ${thumbnailFileName}`);
      }
    } else {
      Logger.info(`Using existing thumbnail ${thumbnailFileName}`);
    }

    updateID3(
      {
        title: track.name + instrumentalMode ? " - Instrumental" : "",
        artist: track.artists.map((artist) => artist.name).join(", "),
        album: track.album.name,
        trackNumber: track.track_number.toString(),
        year: new Date(track.album.release_date).getFullYear().toString(),
        image: `${musicThumbnailsDirectory}/${thumbnailFileName}`,
      },
      `${musicDirectory}/${file}`
    );

    Logger.success(`Tagged ${file}`);
  } else {
    Logger.info(`Skipped already tagged file: ${file}`);
  }
}
