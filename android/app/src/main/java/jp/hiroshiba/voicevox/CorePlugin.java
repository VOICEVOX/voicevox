package jp.hiroshiba.voicevox;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "VoicevoxCore")
public class CorePlugin extends Plugin {
    VoicevoxCore core;

    @Override
    public void load() {
        core = new VoicevoxCore();
    }

    @PluginMethod()
    public void getVersion(PluginCall call) {

        JSObject ret = new JSObject();
        ret.put("value", core.voicevoxGetVersion());
        call.resolve(ret);
    }
}