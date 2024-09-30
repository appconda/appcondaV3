// LZ4.ts

import * as lz4 from 'lz4';
import { Compression } from '../Compression';

export class LZ4 extends Compression {
  /**
   * Compression level from 0 up to a current max of 12.
   * Recommended values are between 4 and 9.
   *
   * Default value is 0, Not high compression mode.
   */
  protected level: number = 0;

  constructor(level: number = 0) {
    super();
    this.setLevel(level);
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
   * Set the compression level.
   *
   * Allow values from 0 up to a current max of 12.
   *
   * @param level number
   * @return void
   */
  public setLevel(level: number): void {
    if (level < 0 || level > 12) {
      throw new Error('Level must be between 0 and 12');
    }
    this.level = level;
  }

  /**
   * Get the name of the algorithm.
   *
   * @return string
   */
  public getName(): string {
    return 'lz4';
  }

  /**
   * Compress.
   *
   * @param data string
   * @returns Buffer
   */
  public compress(data: string): Promise<Buffer> {
    const input = Buffer.from(data, 'utf-8');
    const output = Buffer.alloc(lz4.encodeBound(input.length));
    const compressedSize = lz4.encodeBlock(input, output, { highCompression: this.level > 0 });

    return Promise.resolve(output.slice(0, compressedSize));
  }

  /**
   * Decompress.
   *
   * @param data Buffer
   * @returns string
   */
  public decompress(data: Buffer): string {
    const output = Buffer.alloc(data.length * 255); // Allocate more space for decompression
    const decompressedSize = lz4.decodeBlock(data, output);

    return output.slice(0, decompressedSize).toString('utf-8');
  }
}

