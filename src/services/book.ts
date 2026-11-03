/**
 * 课本目录与课件配置加载
 * @module services/book
 */

import type { BookConfig, CatalogBook, ResolvedBook, Unit } from '../types';

/**
 * 编码单个路径段（文件名）。
 * 文件名含空格、&、,、全角字符，需编码后再拼接；但 `&` 与 `,` 在 URL 路径中是合法字符，
 * 故保留原样——Vite 开发服务器无法从 publicDir 提供含 `%26`/`%2C` 的路径（会回退到 SPA 的 index.html，
 * 导致 <audio> 收到 HTML 而报“音频加载失败”）。其余字符仍严格编码。
 */
function encodeSegment(value: string): string {
  return encodeURIComponent(value).replace(/%26/g, '&').replace(/%2C/g, ',');
}

export class BookService {
  private books: CatalogBook[] = [];
  private readonly catalogUrl: string;

  // data.json 位于 publicDir（static/），需拼接 BASE_URL 以兼容 GitHub Pages 子路径部署
  constructor(catalogUrl = `${import.meta.env.BASE_URL}data.json`) {
    this.catalogUrl = catalogUrl;
  }

  async loadCatalog(signal?: AbortSignal): Promise<CatalogBook[]> {
    const response = await fetch(this.catalogUrl, { signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    this.books = Array.isArray(data.books) ? data.books : [];
    return this.books;
  }

  resolve(bookKey: string, defaultKey: string): ResolvedBook | null {
    if (!this.books.length) return null;

    const getPath = (book: CatalogBook): string => book?.path || '';

    const exact = this.books.find((book) => book?.key === bookKey && getPath(book));
    if (exact) return exact;

    const fallback = this.books.find((book) => book?.key === defaultKey && getPath(book));
    if (fallback) return fallback;

    return this.books.find((book) => getPath(book)) || null;
  }

  async loadBook(
    book: ResolvedBook,
    signal?: AbortSignal,
  ): Promise<{ units: Unit[]; coverUrl: string; bookName: string; bookLevel: string }> {
    const rawPath = book.path || '';
    const bookPath = rawPath.trim().replace(/\/$/, '');
    const response = await fetch(`${bookPath}/book.json`, { signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: BookConfig = await response.json();
    const units: Unit[] = (Array.isArray(data.units) ? data.units : [])
      .filter((unit) => unit?.filename)
      .map((unit, index) => {
        // 文件名含空格、&、全角字符，URL 需编码后再拼接
        const encodedFilename = encodeSegment(unit.filename);
        return {
          ...unit,
          id: index + 1,
          title: unit.title || `Unit ${index + 1}`,
          audio: `${bookPath}/${encodedFilename}.mp3`,
          lrc: `${bookPath}/${encodedFilename}.lrc`,
        } as Unit;
      });

    return {
      units,
      coverUrl: data.cover ? `${bookPath}/${encodeSegment(data.cover)}` : '',
      bookName: data.name || book.title || '',
      bookLevel: data.level || book.key || '',
    };
  }
}
