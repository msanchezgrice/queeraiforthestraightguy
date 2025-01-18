declare module 'elevenlabs-node' {
  export class Voice {
    constructor(apiKey: string);
    textToSpeech(
      voiceId: string,
      options: {
        text: string;
        model_id?: string;
        voice_settings?: {
          stability?: number;
          similarity_boost?: number;
        };
      }
    ): Promise<Buffer>;
  }
} 