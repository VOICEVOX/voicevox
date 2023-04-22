#include <jni.h>
#include <dlfcn.h>
#include <android/log.h>
#include <string>
#include "functype.cpp"

#define LOG_TAG "voicevox_core_wrapper"
#define ASSERT_CORE_LOADED if (!assertCoreLoaded(env)) return NULL

void *voicevoxCore = NULL;

bool assertCoreLoaded(JNIEnv *env) {
    if (!voicevoxCore) {
        jclass jExceptionClass = env->FindClass("java/lang/RuntimeException");
        env->ThrowNew(jExceptionClass, "voicevoxCore is not loaded");
        return false;
    }
    return true;
}


extern "C" jstring
Java_jp_hiroshiba_voicevox_VoicevoxCore_voicevoxGetVersion(JNIEnv *env, jobject thiz) {
    ASSERT_CORE_LOADED;

    auto voicevox_get_version = (voicevox_get_version_t) dlsym(voicevoxCore, "voicevox_get_version");

    return env->NewStringUTF(voicevox_get_version());
//    return env->NewStringUTF("0.1.0");
}

extern "C"
JNIEXPORT void JNICALL
Java_jp_hiroshiba_voicevox_VoicevoxCore_loadLibrary(JNIEnv *env, jclass clazz) {
    __android_log_print(ANDROID_LOG_INFO, LOG_TAG, "loadLibrary");
    voicevoxCore = dlopen("libvoicevox_core.so", RTLD_LAZY);

    if (!voicevoxCore) {
        jclass jExceptionClass = env->FindClass("java/lang/RuntimeException");
        auto error = std::string(dlerror());
        env->ThrowNew(jExceptionClass, (std::string("loadLibrary failed: ") + error).c_str());
        return;
    }
    __android_log_print(ANDROID_LOG_INFO, LOG_TAG, "loadLibrary success");
}