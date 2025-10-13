import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, stat } from 'fs/promises';
import { logger } from './logger';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * Convert audio to PTT (Push-to-Talk) format for WhatsApp
 * Returns the path to the converted .oga file and duration in seconds
 * Format: OGG FLAC, 48kHz, mono (lossless - required for waveform visualization)
 */
export async function convertAudioToPTT(inputBuffer: Buffer): Promise<{ filePath: string; duration: number }> {
  // Use volume mount if configured, fallback to /tmp
  const audioDir = process.env.AUDIO_CACHE_DIR || os.tmpdir();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const inputFile = path.join(audioDir, `audio_input_${timestamp}_${random}.tmp`);
  const outputFile = path.join(audioDir, `audio_ptt_${timestamp}_${random}.oga`);

  try {
    // Write input buffer to temporary file
    await writeFile(inputFile, inputBuffer);
    logger.info({ inputSize: inputBuffer.length, inputFile }, 'Converting audio to PTT format');

    // Convert using ffmpeg with WhatsApp PTT specifications
    // -ar 48000: Sample rate 48kHz
    // -ac 1: Mono (1 channel)
    // -c:a flac: FLAC codec (lossless - required for waveform visualization in WhatsApp)
    // FLAC is what N8N uses successfully for PTT with waveform
    const ffmpegCommand = `ffmpeg -i "${inputFile}" -ar 48000 -ac 1 -c:a flac -y "${outputFile}"`;

    const { stdout, stderr } = await execAsync(ffmpegCommand);

    if (stderr) {
      logger.debug({ stderr: stderr.substring(0, 200) }, 'ffmpeg stderr output');
    }

    // Verify output file was created
    const fileStats = await stat(outputFile);

    // Get audio duration using ffprobe
    let duration = 0;
    try {
      const ffprobeCommand = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outputFile}"`;
      const { stdout: durationOutput } = await execAsync(ffprobeCommand);
      duration = Math.round(parseFloat(durationOutput.trim()));
    } catch (error: any) {
      logger.warn({ error: error.message }, 'Failed to extract audio duration, using 0');
    }

    logger.info({ outputSize: fileStats.size, outputFile, duration }, 'Audio converted successfully to PTT format');

    // Clean up input file immediately
    await unlink(inputFile).catch(() => {});

    return { filePath: outputFile, duration };
  } catch (error: any) {
    logger.error({ error: error.message, inputFile, outputFile }, 'Failed to convert audio to PTT format');
    // Clean up on error
    await unlink(inputFile).catch(() => {});
    await unlink(outputFile).catch(() => {});
    throw new Error(`Audio conversion failed: ${error.message}`);
  }
}
