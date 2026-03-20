class ShortUrl {
  constructor(
    public readonly id: string,
    public readonly code: string,
    public readonly url: string,
    public readonly expiresAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null
  ) {
    if (code.length > 7) {
      throw new Error('Code must be less than 7 characters long');
    }

    if (!url.startsWith('https')) {
      throw new Error('URL must start with https');
    }
  }

  getCode(): string {
    return this.code;
  }

  getUrl(): string {
    return this.url;
  }
}

export default ShortUrl;
export { ShortUrl };
