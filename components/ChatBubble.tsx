import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";
import { ChatAttachmentType, QuotedFanMessage } from "@/types/idol";

type ChatBubbleProps = {
  text: string;
  side: "left" | "right";
  time?: string;
  status?: string;
  onArrowPress?: () => void;
  onLongPress?: () => void;
  dark?: boolean;
  attachmentType?: ChatAttachmentType;
  attachmentUri?: string;
  audioDurationMs?: number;
  recognizedText?: string;
  quotedFanMessage?: QuotedFanMessage;
};

function formatDuration(durationMs?: number) {
  if (!durationMs || durationMs <= 0) return "语音";
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  return `${seconds}\"`;
}

export default function ChatBubble({ text, side, time, status, onArrowPress, onLongPress, dark, attachmentType, attachmentUri, audioDurationMs, recognizedText, quotedFanMessage }: ChatBubbleProps) {
  const isRight = side === "right";
  const isSticker = attachmentType === "sticker";
  const isVoice = attachmentType === "voice";
  const voiceText = recognizedText || (text !== "语音消息" ? text : "");
  const [showTranscript, setShowTranscript] = useState(false);
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const playVoice = async () => {
    if (!attachmentUri) return;
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: attachmentUri },
        { shouldPlay: true },
        (playbackStatus) => {
          if (!playbackStatus.isLoaded) return;
          if (playbackStatus.didJustFinish) {
            setPlaying(false);
            sound.unloadAsync().catch(() => {});
            if (soundRef.current === sound) soundRef.current = null;
          }
        }
      );
      soundRef.current = sound;
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  return (
    <View style={[styles.row, isRight ? styles.rightRow : styles.leftRow]}>
      {!isRight && onArrowPress ? <Arrow onPress={onArrowPress} /> : null}
      <Pressable
        onPress={() => onArrowPress?.()}
        onLongPress={onLongPress}
        delayLongPress={500}
        style={({ pressed }) => [
          styles.bubble,
          isRight ? styles.rightBubble : styles.leftBubble,
          dark && !isRight && styles.darkLeftBubble,
          isSticker && styles.stickerBubble,
          isVoice && styles.voiceBubble,
          pressed && styles.bubblePressed
        ]}
      >
        {quotedFanMessage ? (
          <View style={[styles.quote, isRight && styles.rightQuote, dark && !isRight && styles.darkQuote]}>
            <Text numberOfLines={2} style={[styles.quoteText, isRight && styles.rightQuoteText, dark && !isRight && styles.darkQuoteText]}>
              {quotedFanMessage.content}
            </Text>
          </View>
        ) : null}

        {isVoice ? (
          <Pressable onPress={playVoice} style={({ pressed }) => [styles.voiceRow, pressed && styles.voicePressed]}>
            <Ionicons name={playing ? "pause" : "play"} size={17} color={isRight ? colors.card : colors.primaryDeep} />
            <View style={[styles.voiceWave, isRight && styles.rightVoiceWave]}>
              <View style={[styles.voiceWaveBar, isRight && styles.rightVoiceWaveBar, playing && styles.playingVoiceWaveBar, { height: 10 }]} />
              <View style={[styles.voiceWaveBar, isRight && styles.rightVoiceWaveBar, playing && styles.playingVoiceWaveBar, { height: 18 }]} />
              <View style={[styles.voiceWaveBar, isRight && styles.rightVoiceWaveBar, playing && styles.playingVoiceWaveBar, { height: 13 }]} />
              <View style={[styles.voiceWaveBar, isRight && styles.rightVoiceWaveBar, playing && styles.playingVoiceWaveBar, { height: 20 }]} />
            </View>
            <Text style={[styles.voiceDuration, isRight && styles.rightVoiceDuration]}>{formatDuration(audioDurationMs)}</Text>
            {voiceText ? (
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  setShowTranscript((value) => !value);
                }}
                style={[styles.transcriptButton, isRight && styles.rightTranscriptButton]}
              >
                <Ionicons name="text" size={13} color={isRight ? colors.primaryDeep : colors.card} />
              </Pressable>
            ) : null}
          </Pressable>
        ) : attachmentUri ? (
          <Image
            source={{ uri: attachmentUri }}
            style={attachmentType === "sticker" ? styles.stickerImage : styles.backgroundImage}
          />
        ) : null}

        {isVoice && voiceText && showTranscript ? (
          <Text style={[styles.text, styles.voiceTranscript, isRight ? styles.rightText : dark ? styles.darkText : styles.leftText]}>
            {voiceText}
          </Text>
        ) : !isVoice && text ? (
          <Text style={[styles.text, isRight ? styles.rightText : dark ? styles.darkText : styles.leftText]}>
            {text}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          {time ? <Text style={[styles.meta, dark && !isRight && styles.darkMeta]}>{time}</Text> : null}
          {status ? <Text style={styles.status}>{status}</Text> : null}
        </View>
      </Pressable>
      {isRight && onArrowPress ? <Arrow onPress={onArrowPress} /> : null}
    </View>
  );
}

function Arrow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.arrow}>
      <Ionicons name="arrow-forward" size={15} color={colors.primaryDeep} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
    gap: 8
  },
  leftRow: {
    justifyContent: "flex-start"
  },
  rightRow: {
    justifyContent: "flex-end"
  },
  bubble: {
    maxWidth: "76%",
    borderRadius: 24,
    paddingHorizontal: 15,
    paddingVertical: 11
  },
  bubblePressed: {
    opacity: 0.75
  },
  stickerBubble: {
    backgroundColor: "transparent",
    paddingHorizontal: 4,
    paddingVertical: 4
  },
  voiceBubble: {
    minWidth: 156
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryDeep,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 7,
    marginBottom: 8
  },
  rightQuote: {
    backgroundColor: "rgba(255,255,255,0.24)",
    borderLeftColor: colors.card
  },
  darkQuote: {
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  quoteText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 17
  },
  rightQuoteText: {
    color: "rgba(255,255,255,0.9)"
  },
  darkQuoteText: {
    color: "#D6CBDF"
  },
  backgroundImage: {
    width: 210,
    height: 150,
    borderRadius: 18,
    marginBottom: 8,
    resizeMode: "cover"
  },
  stickerImage: {
    width: 108,
    height: 108,
    resizeMode: "contain"
  },
  leftBubble: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 8
  },
  darkLeftBubble: {
    backgroundColor: colors.nightCard
  },
  rightBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 8
  },
  text: {
    fontSize: 15,
    lineHeight: 21
  },
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minWidth: 132
  },
  voicePressed: {
    opacity: 0.76
  },
  voiceWave: {
    flex: 1,
    height: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  voiceWaveBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: colors.primaryDeep,
    opacity: 0.72
  },
  rightVoiceWave: {
    justifyContent: "flex-end"
  },
  rightVoiceWaveBar: {
    backgroundColor: colors.card,
    opacity: 0.82
  },
  playingVoiceWaveBar: {
    opacity: 1
  },
  voiceDuration: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: "800"
  },
  rightVoiceDuration: {
    color: colors.card
  },
  transcriptButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primaryDeep,
    alignItems: "center",
    justifyContent: "center"
  },
  rightTranscriptButton: {
    backgroundColor: colors.card
  },
  voiceTranscript: {
    marginTop: 8
  },
  leftText: {
    color: colors.text
  },
  darkText: {
    color: colors.card
  },
  rightText: {
    color: colors.card
  },
  metaRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 5
  },
  meta: {
    color: colors.mutedText,
    fontSize: 10
  },
  darkMeta: {
    color: "#BEB2CF"
  },
  status: {
    color: colors.card,
    fontSize: 10,
    fontWeight: "700"
  },
  arrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center"
  }
});
