package jp.hiroshiba.voicevox;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CorePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
