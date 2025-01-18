import { writeFile } from 'fs/promises';
import { join } from 'path';

const VOICE_IDS = [
  'IKne3meq5aSn9XLyUdCD', // Charlie - Australian male
  'CwhRBWXzGAHq8TQ4Fs17', // Roger - American male
  'FGY2WhTYpPnrIDTdsKH5', // Laura - American female
  'XB0fDUnXU5powFXDhCwa', // Charlotte - Swedish female
];

interface SpeechSegment {
  text: string;
  speaker: number;
  audioPath: string;
}

export async function generateSpeech(
  conversations: { speaker: string; text: string }[],
  outputDir: string
): Promise<string[]> {
  console.log('Generating speech with ElevenLabs...');
  console.log('API Key present:', !!process.env.ELEVENLABS_API_KEY);
  console.log('Voice IDs available:', VOICE_IDS.filter(Boolean).length);
  console.log('Number of conversations:', conversations.length);

  const audioPaths: string[] = [];

  for (const [index, conversation] of conversations.entries()) {
    const speakerIndex = conversation.speaker.includes('A') ? 0 : 
                        conversation.speaker.includes('B') ? 1 : 
                        conversation.speaker.includes('1') ? 0 :
                        conversation.speaker.includes('2') ? 1 : 0;
    const voiceId = VOICE_IDS[speakerIndex];
    
    if (!voiceId) {
      console.error(`No voice ID found for speaker ${conversation.speaker}`);
      continue;
    }

    try {
      console.log(`Generating speech for conversation ${index + 1}/${conversations.length}`);
      console.log('Using voice ID:', voiceId);
      
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': process.env.ELEVENLABS_API_KEY || '',
          },
          body: JSON.stringify({
            text: conversation.text,
            model_id: 'eleven_turbo_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`ElevenLabs API error: ${error}`);
      }

      const audioBuffer = await response.arrayBuffer();
      const audioPath = join(outputDir, `speech_${index + 1}.mp3`);
      await writeFile(audioPath, Buffer.from(audioBuffer));
      audioPaths.push(audioPath);
      console.log(`Speech generated and saved to: ${audioPath}`);
    } catch (error) {
      console.error(`Error generating speech for line ${index + 1}:`, error);
      throw error;
    }
  }

  return audioPaths;
} 