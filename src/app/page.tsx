'use client';

import React, { useState, useEffect } from 'react';

interface FormData {
  youtubeUrl: string;
  numAgents: number;
  personalities: string[];
  commentaryStyle: string;
  clipInterval: number;
  conversationSpeed: string;
  targetLength: number;
}

interface VideoStatus {
  status: string;
  output_path?: string;
  error?: string;
  videoUrl?: string;
}

export default function Home() {
  const [formData, setFormData] = useState<FormData>({
    youtubeUrl: '',
    numAgents: 2,
    personalities: ['', ''],
    commentaryStyle: 'roast',
    clipInterval: 1,
    conversationSpeed: 'medium',
    targetLength: 15
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<any>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<VideoStatus | null>(null);

  const handleNumAgentsChange = (value: number) => {
    setFormData(prev => ({
      ...prev,
      numAgents: value,
      personalities: Array(value).fill('')
    }));
  };

  const handlePersonalityChange = (index: number, value: string) => {
    const newPersonalities = [...formData.personalities];
    newPersonalities[index] = value;
    setFormData(prev => ({
      ...prev,
      personalities: newPersonalities
    }));
  };

  useEffect(() => {
    if (generationId && !error) {
      console.log(`Checking status for video ${generationId}...`);
      
      const checkStatus = async () => {
        try {
          const res = await fetch(`/api/status/${generationId}`);
          if (!res.ok) {
            throw new Error('Failed to fetch status');
          }
          const data = await res.json();
          console.log('Status response:', data);
          
          if (data.status === 'completed' && data.output_path) {
            const videoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/public-videos/${data.output_path}`;
            console.log('Video URL:', videoUrl);
            setVideoStatus({
              status: data.status,
              output_path: data.output_path,
              videoUrl
            });
            setError(null);
          } else if (data.status === 'failed') {
            setError(data.error || 'Video processing failed');
            setVideoStatus(data);
          } else {
            setVideoStatus(data);
          }
        } catch (err) {
          setError('Failed to check video status');
          console.error('Error checking status:', err);
        }
      };

      // Check immediately
      checkStatus();
      
      // Then check every 30 seconds
      const interval = setInterval(checkStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [generationId, error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResponse(null);
    setGenerationId(null);
    setVideoStatus(null);

    try {
      console.log('Submitting form with data:', formData);
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      let errorData;
      try {
        errorData = await res.json();
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        const text = await res.text();
        console.error('Response text:', text);
        throw new Error(`Invalid response from server: ${text.substring(0, 100)}...`);
      }

      if (!res.ok) {
        throw new Error(`Generation failed: ${errorData.error || res.statusText}`);
      }

      console.log('Response:', errorData);
      setResponse(errorData);
      setGenerationId(errorData.videoId);
    } catch (err) {
      console.error('Error submitting form:', err);
      setError(err instanceof Error ? err.message : 'Failed to start video generation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-2">Queer Eye for the AI</h1>
      <p className="text-xl mb-8">Transform your YouTube content with AI-powered commentary</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* YouTube URL */}
        <div>
          <label htmlFor="youtubeUrl" className="block text-sm font-medium mb-1">
            YouTube URL
          </label>
          <input
            type="url"
            id="youtubeUrl"
            value={formData.youtubeUrl}
            onChange={e => setFormData(prev => ({ ...prev, youtubeUrl: e.target.value }))}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        {/* Number of AI Agents */}
        <div>
          <label htmlFor="numAgents" className="block text-sm font-medium mb-1">
            Number of AI Agents
          </label>
          <select
            id="numAgents"
            value={formData.numAgents}
            onChange={e => handleNumAgentsChange(Number(e.target.value))}
            className="w-full p-2 border rounded"
          >
            <option value={2}>2 Agents</option>
            <option value={3}>3 Agents</option>
            <option value={4}>4 Agents</option>
          </select>
        </div>

        {/* Personality Descriptors */}
        <div className="space-y-4">
          <label className="block text-sm font-medium">Personality Descriptors</label>
          {formData.personalities.map((personality, index) => (
            <input
              key={index}
              type="text"
              value={personality}
              onChange={e => handlePersonalityChange(index, e.target.value)}
              placeholder={`Agent ${index + 1} personality (e.g., Sassy Fashionista)`}
              className="w-full p-2 border rounded"
              required
            />
          ))}
        </div>

        {/* Commentary Style */}
        <div>
          <label htmlFor="commentaryStyle" className="block text-sm font-medium mb-1">
            Commentary Style
          </label>
          <select
            id="commentaryStyle"
            value={formData.commentaryStyle}
            onChange={e => setFormData(prev => ({ ...prev, commentaryStyle: e.target.value }))}
            className="w-full p-2 border rounded"
          >
            <option value="roast">Roast</option>
            <option value="praise">Praise Fest</option>
            <option value="cerebral">Cerebral</option>
          </select>
        </div>

        {/* Clip Interval */}
        <div>
          <label htmlFor="clipInterval" className="block text-sm font-medium mb-1">
            Clip Sampling Interval (seconds)
          </label>
          <select
            id="clipInterval"
            value={formData.clipInterval}
            onChange={e => setFormData(prev => ({ ...prev, clipInterval: Number(e.target.value) }))}
            className="w-full p-2 border rounded"
          >
            <option value={0.5}>0.5s</option>
            <option value={1}>1.0s</option>
            <option value={1.5}>1.5s</option>
            <option value={2}>2.0s</option>
            <option value={2.5}>2.5s</option>
          </select>
        </div>

        {/* Conversation Speed */}
        <div>
          <label htmlFor="conversationSpeed" className="block text-sm font-medium mb-1">
            Conversation Speed
          </label>
          <select
            id="conversationSpeed"
            value={formData.conversationSpeed}
            onChange={e => setFormData(prev => ({ ...prev, conversationSpeed: e.target.value }))}
            className="w-full p-2 border rounded"
          >
            <option value="rapid">Rapid Fire</option>
            <option value="medium">Medium Pace</option>
            <option value="slow">Slow & Steady</option>
          </select>
        </div>

        {/* Target Length */}
        <div>
          <label htmlFor="targetLength" className="block text-sm font-medium mb-1">
            Target Video Length (seconds)
          </label>
          <select
            id="targetLength"
            value={formData.targetLength}
            onChange={e => setFormData(prev => ({ ...prev, targetLength: Number(e.target.value) }))}
            className="w-full p-2 border rounded"
          >
            <option value={15}>15 seconds</option>
            <option value={30}>30 seconds</option>
            <option value={60}>60 seconds</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-blue-300"
        >
          {isLoading ? 'Generating...' : 'Generate Commentary'}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {response && (
        <div className="mt-4 p-4 bg-green-100 text-green-700 rounded">
          <h2 className="font-bold">Success!</h2>
          <p>Video generation started</p>
          <p>Generation ID: {response.id}</p>
          <p>Video ID: {response.videoId}</p>
          <p>Status: {videoStatus?.status || response.status}</p>
          {videoStatus?.error && (
            <p className="text-red-600">Error: {videoStatus.error}</p>
          )}
          {videoStatus?.output_path && (
            <div>
              <p>Video URL:</p>
              <code className="block p-2 bg-gray-100 rounded mt-1 break-all">
                {`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/public-videos/${videoStatus.output_path}`}
              </code>
              <p className="mt-2">
                <a 
                  href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/public-videos/${videoStatus.output_path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  View Generated Video
                </a>
              </p>
            </div>
          )}
        </div>
      )}

      {videoStatus && (
        <div className="mt-4 space-y-2">
          <p className="font-medium">Status: {videoStatus.status}</p>
          {videoStatus.error && (
            <p className="text-red-500">Error: {videoStatus.error}</p>
          )}
          {videoStatus.status === 'completed' && videoStatus.output_path && (
            <div className="space-y-2">
              <p className="font-medium">Video URL:</p>
              <code className="block bg-gray-100 p-2 rounded">
                {`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/public-videos/${videoStatus.output_path}`}
              </code>
              <div className="space-y-4">
                <a 
                  href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/public-videos/${videoStatus.output_path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  View Generated Video
                </a>
                <video 
                  controls
                  className="w-full max-w-2xl mt-4"
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/public-videos/${videoStatus.output_path}`}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
} 