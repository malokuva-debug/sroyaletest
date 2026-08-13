declare module 'web-push' {
  interface SendNotificationOptions {
    TTL?: number;
    urgency?: string;
    headers?: Record<string, string>;
  }
  interface WebPush {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(subscription: object, payload?: string | Buffer, options?: SendNotificationOptions): Promise<void>;
  }
  const webpush: WebPush;
  export default webpush;
}
