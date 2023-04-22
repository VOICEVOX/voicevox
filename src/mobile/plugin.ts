import { registerPlugin } from "@capacitor/core";

const loadPlugin = () => {
  const plugin =
    registerPlugin<{
      get_version: () => Promise<{ value: string }>;
    }>("VoicevoxCore");

  plugin.get_version().then((value) => {
    alert(value.value);
  });
  return plugin;
};

export default loadPlugin;
