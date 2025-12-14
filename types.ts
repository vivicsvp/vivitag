
export enum LayerType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
}

export interface Position {
  x: number;
  y: number;
}

export interface Layer {
  id: string;
  type: LayerType;
  content: string | File; // Text string or Image File
  x: number;
  y: number;
  scale: number;
  opacity: number;
  color?: string; // For text
  fontSize?: number; // For text
  fontFamily?: string; // For text
}

export enum AppMode {
  PHOTO = 'PHOTO',
  VIDEO = 'VIDEO',
}

export interface VideoTag {
  id: string;
  text: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  speed: number;
  opacity: number;
}

export interface VideoConfig {
  tags: VideoTag[];
  blurLevel: number; // 0 to 20
  trimStart: number; // Seconds
  trimEnd: number; // Seconds
}

export interface Project {
  id: string;
  file: File;
  type: AppMode;
  layers: Layer[];       // For Photos
  videoConfig: VideoConfig; // For Videos
  caption?: string; // For AI Captions
}

// Telegram WebApp Types
declare global {
  interface Window {
    JSZip: any;
    Telegram: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        isVersionAtLeast: (version: string) => boolean;
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
        };
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        backgroundColor: string;
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          button_color?: string;
          button_text_color?: string;
        };
        showPopup: (params: {
            title?: string;
            message: string;
            buttons?: { id?: string; type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'; text?: string }[];
        }, callback?: (buttonId: string) => void) => void;
      };
    };
  }
}
