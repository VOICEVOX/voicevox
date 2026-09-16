import { it, expect } from "vitest";
import { ufProjectFromVoicevox } from "@/sing/utaformatixProject/fromVoicevox";
import {
  createDefaultTempo,
  createDefaultTimeSignature,
  createDefaultTrack,
} from "@/sing/domain";
import { NoteId } from "@/type/preload";
import { randomInt32, uuid4 } from "@/helpers/random";

const createNoteId = () => NoteId(uuid4());

it("トラックを変換できる", async () => {
  const track = createDefaultTrack();
  track.notes.push({
    id: createNoteId(),
    noteNumber: 60,
    position: 0,
    duration: 480,
    lyric: "ど",
    phonemeSeedSource: randomInt32(),
  });

  const project = await ufProjectFromVoicevox(
    {
      tracks: [track],
      tpqn: 480,
      tempos: [createDefaultTempo(0)],
      timeSignatures: [createDefaultTimeSignature(1)],
    },
    "test",
  );

  const ufData = project.toUfDataObject();

  expect(ufData).toMatchSnapshot();
});
