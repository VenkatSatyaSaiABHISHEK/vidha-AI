import io
import wave
import math
import numpy as np
from ..utils.logger import get_logger

logger = get_logger("VoiceService")

class VoiceService:
    _kokoro_model = None

    @classmethod
    def initialize_kokoro(cls):
        """Attempts to initialize hexgrad/Kokoro-82M model using kokoro-onnx or similar weights."""
        if cls._kokoro_model is not None:
            return True
        try:
            # Check for kokoro package installation
            from kokoro import Kokoro
            logger.info("Initializing hexgrad/Kokoro-82M offline TTS pipeline...")
            # Kokoro automatically handles downloading or loading the 82M model weights
            cls._kokoro_model = Kokoro("hexgrad/Kokoro-82M", lang="en-us")
            logger.info("Successfully loaded Kokoro-82M model.")
            return True
        except ImportError:
            logger.warning("kokoro package not installed. Falling back to synthetic tone synthesis.")
            return False
        except Exception as e:
            logger.error(f"Failed loading hexgrad/Kokoro-82M model: {str(e)}")
            return False

    @classmethod
    def synthesize_speech(cls, text: str) -> bytes:
        """Synthesizes text to WAV audio bytes. Uses Kokoro if available; otherwise falls back to a synthetic audio tone."""
        # Clean text
        text = text.strip() or "Hello"

        if cls.initialize_kokoro() and cls._kokoro_model:
            try:
                # Synthesize using Kokoro-82M
                audio, sample_rate = cls._kokoro_model.create(text, voice="af_bella", speed=1.0)
                
                # Convert float32 array to int16 PCM WAV bytes
                audio_int16 = (audio * 32767).astype(np.int16)
                
                wav_io = io.BytesIO()
                with wave.open(wav_io, 'wb') as wav_file:
                    wav_file.setnchannels(1)  # Mono
                    wav_file.setsampwidth(2)  # 16-bit PCM
                    wav_file.setframerate(sample_rate)
                    wav_file.writeframes(audio_int16.tobytes())
                
                logger.info(f"Synthesized voice audio using Kokoro-82M ({len(text)} chars)")
                return wav_io.getvalue()
            except Exception as e:
                logger.error(f"Kokoro synthesis failed: {str(e)}. Falling back to synthetic voice.")

        # Fallback: Generate a synthetic speech-like WAV sweep (so API is fully functional without native ONNX models)
        return cls._generate_synthetic_tone(text)

    @classmethod
    def _generate_synthetic_tone(cls, text: str) -> bytes:
        """Generates a synthetic voice-like WAV stream representing words spoken."""
        sample_rate = 16000
        words = text.split()
        duration_per_word = 0.35  # seconds
        total_duration = max(0.5, len(words) * duration_per_word)
        num_samples = int(sample_rate * total_duration)
        
        t = np.linspace(0, total_duration, num_samples, endpoint=False)
        
        # Create a speech-like complex wave (modulated sine waves mimicking human speech formants)
        carrier_freq = 130.0  # Base pitch (male/female frequency)
        speech_wave = np.zeros(num_samples)
        
        # Add basic speech formants (harmonics)
        speech_wave += np.sin(2 * math.pi * carrier_freq * t)
        speech_wave += 0.5 * np.sin(2 * math.pi * (carrier_freq * 2) * t)
        speech_wave += 0.25 * np.sin(2 * math.pi * (carrier_freq * 3) * t)
        
        # Modulate amplitude dynamically to simulate word gaps
        modulation = np.zeros(num_samples)
        for idx in range(len(words)):
            start_idx = int(idx * duration_per_word * sample_rate)
            end_idx = int((idx + 0.8) * duration_per_word * sample_rate)
            if start_idx < num_samples:
                end_idx = min(end_idx, num_samples)
                # Apply envelope curve to mock a word
                word_len = end_idx - start_idx
                envelope = np.sin(np.linspace(0, math.pi, word_len))
                modulation[start_idx:end_idx] = envelope
        
        modulated_wave = speech_wave * modulation
        
        # Normalize and convert to int16 PCM
        max_val = np.max(np.abs(modulated_wave))
        if max_val > 0:
            modulated_wave = modulated_wave / max_val
        audio_int16 = (modulated_wave * 12000).astype(np.int16)
        
        wav_io = io.BytesIO()
        with wave.open(wav_io, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(audio_int16.tobytes())
            
        logger.info(f"Generated synthetic fallback voice audio ({len(words)} words)")
        return wav_io.getvalue()
