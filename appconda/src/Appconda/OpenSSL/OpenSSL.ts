import { randomBytes, createCipheriv, createDecipheriv, CipherGCMTypes } from 'crypto';

export class OpenSSL {
    public static readonly CIPHER_AES_128_GCM = 'aes-128-gcm' as CipherGCMTypes;

    /**
     * Encrypts data using the specified method and key.
     *
     * @param data - The data to encrypt.
     * @param method - The encryption method (e.g., 'aes-128-gcm').
     * @param key - The encryption key.
     * @param options - Encryption options.
     * @param iv - Initialization vector.
     * @param tag - Authentication tag for GCM.
     * @param aad - Additional authenticated data.
     * @param tagLength - Length of the authentication tag.
     * @returns The encrypted data.
     */
    public static encrypt(
        data: string,
        method: CipherGCMTypes,
        key: Buffer,
        options: number = 0,
        iv: Buffer = randomBytes(12),
        tag: Buffer | null = null,
        aad: Buffer = Buffer.alloc(0),
        tagLength: number = 16
    ): string {
        const cipher = createCipheriv(method, key, iv, { authTagLength: tagLength });
        if (aad.length > 0) {
            cipher.setAAD(aad);
        }
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        if (cipher.getAuthTag) {
            tag = cipher.getAuthTag();
        }
        // You might want to store the IV and tag along with the encrypted data
        return iv.toString('hex') + ':' + (tag ? tag.toString('hex') : '') + ':' + encrypted;
    }

    /**
     * Decrypts data using the specified method and key.
     *
     * @param data - The data to decrypt.
     * @param method - The decryption method (e.g., 'aes-128-gcm').
     * @param key - The decryption key.
     * @param options - Decryption options.
     * @param iv - Initialization vector.
     * @param tag - Authentication tag for GCM.
     * @param aad - Additional authenticated data.
     * @returns The decrypted data.
     */
    public static decrypt(
        data: string,
        method: CipherGCMTypes,
        key: Buffer,
        options: number = 0,
        iv: Buffer,
        tag: Buffer,
        aad: Buffer = Buffer.alloc(0)
    ): string {
        const decipher = createDecipheriv(method, key, iv, { authTagLength: tag.length });
        if (aad.length > 0) {
            decipher.setAAD(aad);
        }
        if (tag) {
            decipher.setAuthTag(tag);
        }
        let decrypted = decipher.update(data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    /**
     * Gets the Initialization Vector length for the specified cipher method.
     *
     * @param method - The cipher method.
     * @returns The IV length.
     */
    public static cipherIVLength(method: CipherGCMTypes): number {
        return createCipheriv(method, Buffer.alloc(16), Buffer.alloc(12)).getAuthTag().length;
    }

    /**
     * Generates cryptographically strong pseudo-random data.
     *
     * @param length - The number of bytes to generate.
     * @returns The random bytes as a hex string.
     */
    public static randomPseudoBytes(length: number): Buffer {
        return randomBytes(length);
    }
}