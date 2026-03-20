class ShortUrl {
  constructor(
    public readonly id: string,
    public readonly code: string,
    public readonly originalUrl: string,
    public readonly expiresAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null
  ) {
    if (code.length !== 7) {
      throw new Error('Code must be 7 characters long');
    }

    if (!originalUrl.startsWith('https')) {
      throw new Error('Original URL must start with https');
    }
  }

  getCode(): string {
    return this.code;
  }

  getOriginalUrl(): string {
    return this.originalUrl;
  }
}

export default ShortUrl;
export { ShortUrl };
