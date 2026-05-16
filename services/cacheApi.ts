import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";

const CACHE_KEY_PREFIXES = [
  "cache:",
  "fanCache:",
  "fanMessageCache:",
  "historyBurst:",
  "liveFan:",
  "imageAnalysis:",
  "voiceTranscript:",
  "temp:",
  "uploadTemp:"
];

const LEGACY_CACHE_KEYS = new Set([
  "fan_message_cache",
  "fan_messages_cache",
  "history_burst_cache",
  "live_fan_message_cache",
  "live_fan_messages_cache",
  "image_analysis_cache",
  "voice_transcript_cache",
  "temporary_upload_cache",
  "temp_upload_cache"
]);

function isCacheKey(key: string): boolean {
  return CACHE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)) || LEGACY_CACHE_KEYS.has(key);
}

async function clearAsyncStorageCache() {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter(isCacheKey);
  if (cacheKeys.length > 0) {
    await AsyncStorage.multiRemove(cacheKeys);
  }
}

async function clearFileCache() {
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) return;

  await FileSystem.deleteAsync(cacheDirectory, { idempotent: true });
  await FileSystem.makeDirectoryAsync(cacheDirectory, { intermediates: true });
}

export async function clearAppCache(): Promise<void> {
  await Promise.all([
    clearAsyncStorageCache(),
    clearFileCache()
  ]);
}
