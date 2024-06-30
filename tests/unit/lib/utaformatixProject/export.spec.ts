import { it, expect } from "vitest";
import { ufProjectFromVoicevox } from "@/sing/utaformatixProject/fromVoicevox";
import {
  createDefaultTempo,
  createDefaultTimeSignature,
  createDefaultTrack,
} from "@/sing/domain";
import { NoteId } from "@/type/preload";

const createNoteId = () => NoteId(crypto.randomUUID());

it("トラックを変換できる", async () => {
  const track = createDefaultTrack();
  track.notes.push({
    id: createNoteId(),
    noteNumber: 60,
    position: 0,
    duration: 480,
    lyric: "ど",
  });

  const project = ufProjectFromVoicevox(
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
