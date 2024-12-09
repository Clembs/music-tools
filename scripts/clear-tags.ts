import { removeTags } from "node-id3";

const file = Bun.argv[2];

if (!file) {
  throw new Error("Missing file argument. Usage: bun clear-tags <file>");
}

removeTags(file);
