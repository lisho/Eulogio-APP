import type { Content } from '@google/genai';

export enum AppView {
  WELCOME = 'welcome',
  CHAT = 'chat',
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: number;
  isStreaming?: boolean;
}

export interface StoredConversation {
  id: string;
  name: string; // e.g., first user message, or a timestamp-based name
  messages: ChatMessage[];
  timestamp: number; // Timestamp of the last message or creation
  chatHistoryForAPI: Content[]; // History formatted for Gemini API
}

// Interface for the PWA BeforeInstallPromptEvent
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}
