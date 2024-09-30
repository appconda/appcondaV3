// Brotli.ts

import * as iltorb from 'iltorb';
import { Compression } from '../Compression';

export class Brotli extends Compression {
  protected level: number = iltorb.constants.BROTLI_DEFAULT_QUALITY;
  protected mode: number = iltorb.constants.BROTLI_MODE_GENERIC;

  /**
   * @return string
   */
  public getName(): string {
    return 'brotli';
  }

  /**
   * Get the compression level.
   *
   * @return number
   */
  public getLevel(): number {
    return this.level;
  }

  /**
   * Sets the brotli compression mode to generic.
   *
   * This is the default mode
   */
  public useGenericMode(): void {
    this.mode = iltorb.constants.BROTLI_MODE_GENERIC;
  }

  /**
   * Sets the brotli compression mode to UTF-8 text mode.
   *
   * Optimizes compression for UTF-8 formatted text
   */
  public useTextMode(): void {
    this.mode = iltorb.constants.BROTLI_MODE_TEXT;
  }

  /**
   * Sets the brotli compression mode to font mode.
   *
   * Optimized compression for WOFF 2.0 Fonts
   */
  public useFontMode(): void {
    this.mode = iltorb.constants.BROTLI_MODE_FONT;
  }

  /**
   * Set the compression level.
   *
   * Allow values from 0 up to a current max of 11.
   *
   * @param  number  level
   * @return void
   */
  public setLevel(level: number): void {
    const min = iltorb.constants.BROTLI_MIN_QUALITY;
    const max = iltorb.constants.BROTLI_MAX_QUALITY;
    if (level < min || level > max) {
      throw new Error(`Level must be between ${min} and ${max}`);
    }
    this.level = level;
  }

  /**
   * Compress.
   *
   * @param data
   * @returns Promise<Buffer>
   */
  public compress(data: string): Promise<Buffer> {
    const buffer = Buffer.from(data, 'utf-8');
    return iltorb.compress(buffer, {
      mode: this.mode,
      quality: this.getLevel()
    });
  }

  /**
   * Decompress.
   *
   * @param data
   * @returns Promise<Buffer>
   */
  public decompress(data: Buffer): Promise<Buffer> {
    return iltorb.decompress(data);
  }
}

