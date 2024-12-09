# music-tools

scripts related to music tagging and downloading. written in typescript and made for [bun](https://bun.sh).

for personal purposes, so everything is very opinionated and i probably won't accept your pull requests.

## scripts

### spotitags

for each track found in a directory that's not fully tagged, query the spotify API, grab the album art (if not present), and update the ID3 tags accordingly.

`bun spotify-id3-tags.ts <music_dir> (--instrumental)`

- `music_dir`: the directory containing the music files (searches for mp3 files only).
- `--instrumental`: if present, adds ` - Instrumental` to each track's title.

required environment variables:

- `SPOTIFY_CLIENT_ID`: the spotify client id.
- `SPOTIFY_CLIENT_SECRET`: the spotify client secret.
- `THUMBNAILS_DIR`: the directory where the album art thumbnails will be saved.

### clear-tags

clears id3 tags from a given file. useful if you're dumb-dumb and accidentally tagged a file that shouldn't be tagged and no tool can remove the tags because ???

`bun clear-tags.ts <file>`

- `file`: the file to clear the tags from.
