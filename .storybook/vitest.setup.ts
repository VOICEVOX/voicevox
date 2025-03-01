import { beforeAll } from "vitest";
import { setProjectAnnotations } from "@storybook/vue3";
import * as previewAnnotations from "./preview.ts";

const annotations = setProjectAnnotations([previewAnnotations]);

beforeAll(annotations.beforeAll);
