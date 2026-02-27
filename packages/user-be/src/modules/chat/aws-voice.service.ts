import { TranscribeStreamingClient, StartStreamTranscriptionCommand } from "@aws-sdk/client-transcribe-streaming";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { env } from "../../config/env";
import { PassThrough } from "stream";

// Initialize AWS Clients
const transcribeClient = new TranscribeStreamingClient({
  region: env.awsRegion,
  credentials: {
    accessKeyId: env.awsAccessKeyId || "",
    secretAccessKey: env.awsSecretAccessKey || "",
  },
});

const pollyClient = new PollyClient({
  region: env.awsRegion,
  credentials: {
    accessKeyId: env.awsAccessKeyId || "",
    secretAccessKey: env.awsSecretAccessKey || "",
  },
});

export async function transcribeAudioStream(audioBuffer: Buffer): Promise<string> {
  if (!env.awsAccessKeyId || !env.awsSecretAccessKey) {
    throw new Error("AWS Credentials not configured for Transcribe");
  }

  // A helper generator to yield chunks of the buffer as an async iterable
  const asyncIterable = async function* () {
    const chunkSize = 2000; // Yield in small chunks
    for (let i = 0; i < audioBuffer.length; i += chunkSize) {
      yield {
        AudioEvent: {
          AudioChunk: audioBuffer.slice(i, i + chunkSize),
        },
      };
    }
  };

  const command = new StartStreamTranscriptionCommand({
    LanguageCode: "en-IN", // Indian English
    MediaSampleRateHertz: 16000, 
    MediaEncoding: "pcm", 
    AudioStream: asyncIterable(),
  });

  try {
    const response = await transcribeClient.send(command);
    let fullText = "";

    if (response.TranscriptResultStream) {
      for await (const event of response.TranscriptResultStream) {
        if (event.TranscriptEvent && event.TranscriptEvent.Transcript) {
          const results = event.TranscriptEvent.Transcript.Results || [];
          for (const result of results) {
            if (!result.IsPartial) {
              const alternatives = result.Alternatives || [];
              if (alternatives[0]?.Transcript) {
                fullText += alternatives[0].Transcript + " ";
              }
            }
          }
        }
      }
    }
    return fullText.trim();
  } catch (err) {
    console.error("[AWS Transcribe] Transcription error:", err);
    throw err;
  }
}

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  if (!env.awsAccessKeyId || !env.awsSecretAccessKey) {
    throw new Error("AWS Credentials not configured for Polly");
  }

  const command = new SynthesizeSpeechCommand({
    OutputFormat: "mp3",
    Text: text,
    VoiceId: "Aditi", // Indian English Voice
    Engine: "standard",
  });

  try {
    const response = await pollyClient.send(command);
    
    if (response.AudioStream) {
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const stream = response.AudioStream as any;
        
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
      });
    } else {
      throw new Error("No AudioStream returned from Polly");
    }
  } catch (err) {
    console.error("[AWS Polly] Synthesize Error:", err);
    throw err;
  }
}
