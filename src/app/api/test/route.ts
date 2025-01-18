import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function GET() {
  const results: any = {
    openai: { working: false, error: null },
    elevenlabs: { working: false, error: null }
  };

  // Test OpenAI
  try {
    console.log('Testing OpenAI API...');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: "Say hello" }],
    });

    results.openai.working = true;
    results.openai.response = response.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error);
    results.openai.error = error instanceof Error ? error.message : 'Unknown error';
  }

  // Test ElevenLabs
  try {
    console.log('Testing ElevenLabs API...');
    
    // First get available voices
    const voicesResponse = await fetch(
      'https://api.elevenlabs.io/v1/voices',
      {
        headers: {
          'Accept': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY || '',
        },
      }
    );

    if (!voicesResponse.ok) {
      const error = await voicesResponse.text();
      throw new Error(`ElevenLabs API error: ${error}`);
    }

    const voices = await voicesResponse.json();
    results.elevenlabs.voices = voices;

    // Test text-to-speech generation
    const voiceId = 'IKne3meq5aSn9XLyUdCD'; // Charlie
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY || '',
        },
        body: JSON.stringify({
          text: 'Hello, this is a test.',
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        }),
      }
    );

    if (!ttsResponse.ok) {
      const error = await ttsResponse.text();
      throw new Error(`ElevenLabs API error: ${error}`);
    }

    results.elevenlabs.working = true;
  } catch (error) {
    console.error('ElevenLabs API error:', error);
    results.elevenlabs.error = error instanceof Error ? error.message : 'Unknown error';
  }

  return NextResponse.json(results);
} 