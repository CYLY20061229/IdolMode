export type Profile = {
  id: string;
  nickname: string;
  signature: string;
  email: string;
  avatar: string;
};

export type Artist = {
  id: string;
  nickname: string;
  avatar: string;
  background: string;
  bio: string;
  signature: string;
  identity: string;
  fans: string;
  intro: string;
};

export type ChatMessage = {
  id: string;
  sender: "self" | "artist" | "fan" | "user";
  text: string;
  status?: "draft" | "pending" | "sent";
  createdAt: string;
};

export type IdolChatThread = {
  artistId: string;
  messages: ChatMessage[];
};

export type FanMessage = {
  id: string;
  fanName: string;
  avatar: string;
  language: "zh" | "en" | "ko" | "jp" | "es";
  content: string;
  translatedContent: string;
  fromMessageId?: string;
  personaType?: string;
  messageKind?: "ambient" | "reaction";
};
