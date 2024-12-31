import { Project as UfProject } from "@sevenc-nanashi/utaformatix-ts";
import { ExhaustiveError } from "@/type/utility";

export const singleFileProjectFormats = ["smf", "ufdata"] as const;
export type SingleFileProjectFormat = (typeof singleFileProjectFormats)[number];
export const multiFileProjectFormats = ["ust", "musicxml"] as const;
export type MultiFileProjectFormat = (typeof multiFileProjectFormats)[number];
export type ProjectFormat = SingleFileProjectFormat | MultiFileProjectFormat;

export const isSingleFileProjectFormat = (
  format: ProjectFormat,
): format is SingleFileProjectFormat =>
  singleFileProjectFormats.includes(format as SingleFileProjectFormat);

export const isMultiFileProjectFormat = (
  format: ProjectFormat,
): format is MultiFileProjectFormat =>
  multiFileProjectFormats.includes(format as MultiFileProjectFormat);

export const projectFileExtensions: Record<
  SingleFileProjectFormat | MultiFileProjectFormat,
  string
> = {
  smf: "mid",
  ufdata: "ufdata",
  ust: "ust",
  musicxml: "xml",
};

export const ufProjectToSingleFile = async (
  project: UfProject,
  format: SingleFileProjectFormat,
): Promise<Uint8Array> => {
  switch (format) {
    case "smf":
      return await project.toStandardMid();
    case "ufdata":
      return await project.toUfData();
    default:
      throw new ExhaustiveError(format);
  }
};

export const ufProjectToMultiFile = async (
  project: UfProject,
  format: MultiFileProjectFormat,
): Promise<Uint8Array[]> => {
  switch (format) {
    case "ust":
      return await project.toUst();
    case "musicxml":
      return await project.toMusicXml();
    default:
      throw new ExhaustiveError(format);
  }
};
