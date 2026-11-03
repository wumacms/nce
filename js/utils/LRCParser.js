/**
 * LRC 歌词解析：`[mm:ss.xx]英文 | 中文`
 * @module utils/LRCParser
 */

const LYRIC_TIME_REGEX = /^\[(\d{1,2}):(\d{2})\.(\d{2,3})\](.*)/;

export class LRCParser {
  /**
   * @param {string} lrcText
   * @param {number} [timeOffset=0]
   * @returns {Array<{time: number, english: string, chinese: string, fullText: string}>}
   */
  static parse(lrcText, timeOffset = 0) {
    if (!lrcText || typeof lrcText !== 'string') return [];

    const lyrics = [];

    for (const raw of lrcText.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;

      const match = line.match(LYRIC_TIME_REGEX);
      if (!match) continue;

      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      if (seconds >= 60) continue; // 校验秒数范围

      // 将 2/3 位毫秒统一转化为秒（例："4"->0.4s, "45"->0.45s, "456"->0.456s）
      const fraction = Number(`0.${match[3]}`);
      const rawTime = minutes * 60 + seconds + fraction - timeOffset;
      // 保留三位小数，避免浮点误差；并钳制为非负，防止偏移后负时间导致开头高亮错乱
      const time = Math.max(0, Math.round(rawTime * 1000) / 1000);

      const text = match[4].trim(); // 提取后的歌词内容

      // 只按第一个 "|" 拆中英，避免中文里再出现 "|" 时丢内容
      const sep = text.indexOf('|');
      const english = (sep >= 0 ? text.slice(0, sep) : text).trim();
      const chinese = (sep >= 0 ? text.slice(sep + 1) : '').trim();

      if (!english) continue;

      // 跳过 "Lesson N" / "Lesson N｜第N课" 这类课号标题行，避免被当成可点击句子
      if (/^lesson\s*\d+/i.test(english)) continue;

      lyrics.push({ time, english, chinese, fullText: text });
    }

    return lyrics.sort((a, b) => a.time - b.time);
  }

  /**
   * 歌词按 time 升序，二分查找最后一条 time <= currentTime 的索引
   * @param {Array<{time: number}>} lyrics
   * @param {number} currentTime
   * @returns {number}
   */
  static findLyricIndexByTime(lyrics, currentTime) {
    if (!Array.isArray(lyrics) || lyrics.length === 0) return -1;

    let lo = 0;
    let hi = lyrics.length - 1;
    let result = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lyrics[mid].time <= currentTime) {
        result = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return result;
  }

  /**
   * @param {Array<{time: number}>} lyrics
   * @param {number} index
   * @param {number} [audioDuration=0]
   * @returns {{startTime: number, endTime: number, index: number}|null}
   */
  static getSentenceBoundaries(lyrics, index, audioDuration = 0) {
    if (!Array.isArray(lyrics) || index < 0 || index >= lyrics.length) return null;

    const startTime = lyrics[index].time;
    const endTime = index < lyrics.length - 1
      ? lyrics[index + 1].time
      : Math.max(audioDuration, startTime + 0.1);

    return { startTime, endTime, index };
  }
}
