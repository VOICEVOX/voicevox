#include "voicevox_core/voicevox_core.h"

typedef struct VoicevoxInitializeOptions (*voicevox_make_default_initialize_options_t)(void);

typedef VoicevoxResultCode (*voicevox_initialize_t)(struct VoicevoxInitializeOptions options);

typedef const char *(*voicevox_get_version_t)(void);

typedef VoicevoxResultCode (*voicevox_load_model_t)(uint32_t speaker_id);

typedef bool (*voicevox_is_gpu_mode_t)(void);

typedef bool (*voicevox_is_model_loaded_t)(uint32_t speaker_id);

typedef void (*voicevox_finalize_t)(void);

typedef const char *(*voicevox_get_metas_json_t)(void);

typedef const char *(*voicevox_get_supported_devices_json_t)(void);

typedef VoicevoxResultCode (*voicevox_predict_duration_t)(uintptr_t length,
                                                          int64_t *phoneme_vector,
                                                          uint32_t speaker_id,
                                                          uintptr_t *output_predict_duration_data_length,
                                                          float **output_predict_duration_data);

typedef void (*voicevox_predict_duration_data_free_t)(float *predict_duration_data);

typedef VoicevoxResultCode (*voicevox_predict_intonation_t)(uintptr_t length,
                                                            int64_t *vowel_phoneme_vector,
                                                            int64_t *consonant_phoneme_vector,
                                                            int64_t *start_accent_vector,
                                                            int64_t *end_accent_vector,
                                                            int64_t *start_accent_phrase_vector,
                                                            int64_t *end_accent_phrase_vector,
                                                            uint32_t speaker_id,
                                                            uintptr_t *output_predict_intonation_data_length,
                                                            float **output_predict_intonation_data);

typedef void (*voicevox_predict_intonation_data_free_t)(float *predict_intonation_data);

typedef VoicevoxResultCode (*voicevox_decode_t)(uintptr_t length,
                                                uintptr_t phoneme_size,
                                                float *f0,
                                                float *phoneme_vector,
                                                uint32_t speaker_id,
                                                uintptr_t *output_decode_data_length,
                                                float **output_decode_data);

typedef void (*voicevox_decode_data_free_t)(float *decode_data);

typedef struct VoicevoxAudioQueryOptions (*voicevox_make_default_audio_query_options_t)(void);

typedef VoicevoxResultCode (*voicevox_audio_query_t)(const char *text,
                                                     uint32_t speaker_id,
                                                     struct VoicevoxAudioQueryOptions options,
                                                     char **output_audio_query_json);

typedef struct VoicevoxSynthesisOptions (*voicevox_make_default_synthesis_options_t)(void);

typedef VoicevoxResultCode (*voicevox_synthesis_t)(const char *audio_query_json,
                                                   uint32_t speaker_id,
                                                   struct VoicevoxSynthesisOptions options,
                                                   uintptr_t *output_wav_length,
                                                   uint8_t **output_wav);

typedef struct VoicevoxTtsOptions (*voicevox_make_default_tts_options_t)(void);

typedef VoicevoxResultCode (*voicevox_tts_t)(const char *text,
                                             uint32_t speaker_id,
                                             struct VoicevoxTtsOptions options,
                                             uintptr_t *output_wav_length,
                                             uint8_t **output_wav);

typedef void (*voicevox_audio_query_json_free_t)(char *audio_query_json);

typedef void (*voicevox_wav_free_t)(uint8_t *wav);

typedef const char *(*voicevox_error_result_to_message_t)(VoicevoxResultCode result_code);
