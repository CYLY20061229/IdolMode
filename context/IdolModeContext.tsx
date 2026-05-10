import React, { createContext, ReactNode, useContext, useMemo, useState } from "react";
import {
  addedArtists as initialAddedArtists,
  fanMessages as initialFanMessages,
  generateFanEmojiReply,
  idolChatMessages as initialIdolChatMessages,
  myProfile as initialProfile,
  selfChatMessages as initialSelfChatMessages
} from "@/services/mockData";
import {
  generateFanMessagesAfterSend,
  generateLiveFanMessages,
  generateLiveFanMessage
} from "@/services/fanMessageApi";
import { Artist, ChatMessage, FanMessage, IdolChatThread, Profile } from "@/types/idol";

type IdolModeContextValue = {
  myProfile: Profile;
  updateProfile: (profile: Profile) => void;
  addedArtists: Artist[];
  addArtist: (artist: Artist) => void;
  removeArtist: (artistId: string) => void;
  isArtistAdded: (artistId: string) => boolean;
  selfMessages: ChatMessage[];
  sendSelfDraft: (text: string) => ChatMessage;
  confirmSelfMessage: (messageId: string) => Promise<void>;
  fanMessages: FanMessage[];
  appendLiveFanMessage: () => Promise<void>;
  appendLiveFanMessages: (messages: FanMessage[]) => void;
  getRecentArtistMessage: () => string | undefined;
  translatedMessageIds: string[];
  toggleFanMessageTranslation: (messageId: string) => void;
  idolThreads: IdolChatThread[];
  sendIdolChatMessage: (artistId: string, text: string) => void;
};

const IdolModeContext = createContext<IdolModeContextValue | null>(null);

function timeNow() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function IdolModeProvider({ children }: { children: ReactNode }) {
  const [myProfile, setMyProfile] = useState<Profile>(initialProfile);
  const [addedArtists, setAddedArtists] = useState<Artist[]>(initialAddedArtists);
  const [selfMessages, setSelfMessages] = useState<ChatMessage[]>(initialSelfChatMessages);
  const [fanMessages, setFanMessages] = useState<FanMessage[]>(initialFanMessages);
  const [translatedMessageIds, setTranslatedMessageIds] = useState<string[]>([]);
  const [idolThreads, setIdolThreads] = useState<IdolChatThread[]>(initialIdolChatMessages);

  const value = useMemo<IdolModeContextValue>(() => {
    const updateProfile = (profile: Profile) => setMyProfile(profile);

    const addArtist = (artist: Artist) => {
      setAddedArtists((current) => {
        if (current.some((item) => item.id === artist.id)) return current;
        return [...current, artist];
      });
    };

    const removeArtist = (artistId: string) => {
      setAddedArtists((current) => current.filter((artist) => artist.id !== artistId));
    };

    const isArtistAdded = (artistId: string) => addedArtists.some((artist) => artist.id === artistId);

    const sendSelfDraft = (text: string) => {
      const message: ChatMessage = {
        id: `self-${Date.now()}`,
        sender: "self",
        text,
        status: "pending",
        createdAt: timeNow()
      };
      setSelfMessages((current) => [...current, message]);
      return message;
    };

    const confirmSelfMessage = async (messageId: string) => {
      const target = selfMessages.find((message) => message.id === messageId);
      setSelfMessages((current) =>
        current.map((message) => {
          if (message.id !== messageId) return message;
          return { ...message, status: "sent" };
        })
      );

      const reply: ChatMessage = {
        id: `fan-emoji-${Date.now()}`,
        sender: "fan",
        text: generateFanEmojiReply(),
        createdAt: timeNow()
      };
      setSelfMessages((current) => [...current, reply]);
      const generatedFanMessages = await generateFanMessagesAfterSend(target?.text ?? messageId);
      setFanMessages((current) => [...current, ...generatedFanMessages]);
    };

    const getRecentArtistMessage = () =>
      [...selfMessages]
        .reverse()
        .find((message) => message.sender === "self" && message.status === "sent")?.text;

    const appendLiveFanMessages = (messages: FanMessage[]) => {
      setFanMessages((current) => {
        const next = [...current, ...messages];
        return next.slice(Math.max(next.length - 90, 0));
      });
    };

    const appendLiveFanMessage = async () => {
      const recentArtistMessage = getRecentArtistMessage();
      const liveMessage = await generateLiveFanMessage(recentArtistMessage);
      appendLiveFanMessages([liveMessage]);
    };

    const toggleFanMessageTranslation = (messageId: string) => {
      setTranslatedMessageIds((current) =>
        current.includes(messageId)
          ? current.filter((id) => id !== messageId)
          : [...current, messageId]
      );
    };

    const sendIdolChatMessage = (artistId: string, text: string) => {
      const message: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: "user",
        text,
        createdAt: timeNow()
      };
      setIdolThreads((current) =>
        current.map((thread) =>
          thread.artistId === artistId
            ? { ...thread, messages: [...thread.messages, message] }
            : thread
        )
      );
    };

    return {
      myProfile,
      updateProfile,
      addedArtists,
      addArtist,
      removeArtist,
      isArtistAdded,
      selfMessages,
      sendSelfDraft,
      confirmSelfMessage,
      fanMessages,
      appendLiveFanMessage,
      appendLiveFanMessages,
      getRecentArtistMessage,
      translatedMessageIds,
      toggleFanMessageTranslation,
      idolThreads,
      sendIdolChatMessage
    };
  }, [addedArtists, fanMessages, idolThreads, myProfile, selfMessages, translatedMessageIds]);

  return <IdolModeContext.Provider value={value}>{children}</IdolModeContext.Provider>;
}

export function useIdolMode() {
  const context = useContext(IdolModeContext);
  if (!context) {
    throw new Error("useIdolMode must be used inside IdolModeProvider");
  }
  return context;
}
