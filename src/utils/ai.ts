import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Conversation {
  speaker: string;
  text: string;
}

export async function generateConversation(
  videoTitle: string,
  personalities: string[],
  commentaryStyle: string,
  conversationSpeed: string
): Promise<Conversation[]> {
  console.log('Generating conversation with OpenAI...');
  console.log('API Key present:', !!process.env.OPENAI_API_KEY);
  console.log('Parameters:', { videoTitle, personalities, commentaryStyle, conversationSpeed });

  const prompt = `Generate a natural conversation between ${personalities.length} people discussing a YouTube video titled "${videoTitle}".
Each person has the following personality: ${personalities.join(', ')}.
The conversation should be ${commentaryStyle} in style and have a ${conversationSpeed} pace.
Format the response as a JSON array of objects with "speaker" and "text" fields.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are a group of friends having a casual conversation about a video. Your responses should be in JSON format with an array of conversations, each having 'speaker' and 'text' fields. Always use 'Speaker A' and 'Speaker B' as the speaker names."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    console.log('OpenAI response received:', response.choices[0].message.content);

    const result = JSON.parse(response.choices[0].message.content || '{"conversations": []}');
    return result.conversations;
  } catch (error) {
    console.error('Error with OpenAI API:', error);
    throw error;
  }
} 