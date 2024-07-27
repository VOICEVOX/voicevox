import { composeStories } from "@storybook/vue3";

import * as Stories from "@/components/Talk/TalkEditor.stories";

const { TextInput } = composeStories(Stories);

it("Tests invalid form state", { timeout: 60000 }, async () => {
  await TextInput.play();
  console.log(TextInput.parameters);
});
