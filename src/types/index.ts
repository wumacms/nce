/**
 * 共享类型定义
 * @module types
 */

export type LoopMode = 'off' | 'click' | 'one' | 'list' | 'book';
export type TranslationMode = 'show' | 'english' | 'chinese' | 'blur';

export interface CatalogBook {
  key: string;
  title: string;
  path: string;
}

export interface Unit {
  id: number;
  title: string;
  filename: string;
  audio: string;
  lrc: string;
}

export interface Lyric {
  time: number;
  english: string;
  chinese: string;
  fullText: string;
}

export interface BookConfig {
  name?: string;
  level?: string;
  cover?: string;
  units?: Array<{ title?: string; filename: string }>;
}

export interface ResolvedBook {
  key?: string;
  title?: string;
  path?: string;
  bookPath?: string;
  bookName?: string;
  bookLevel?: string;
}
