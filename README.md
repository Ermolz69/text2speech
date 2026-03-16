# Emotional TTS

Local MVP for **emotion-aware text-to-speech** where expression is inferred from emoji, punctuation, and simple contextual text signals.

## Overview
This repository contains a prototype pipeline that:
- accepts text with emoji and punctuation cues;
- parses emotional signals from text;
- builds structured emotional metadata;
- synthesizes speech with **Piper**;
- compares neutral and expressive outputs;
- supports benchmarking against stronger references such as **ElevenLabs**.

## Status
**Roadmap / MVP planning + implementation setup**

## Pipeline
```text
text
  -> normalizer
  -> segmenter
  -> emoji/context parser
  -> emotion mapping
  -> prosody planning
  -> Piper TTS
  -> post-processing
  -> audio output + evaluation
```

## Core stack
- Python
- Piper
- Docker / Docker Compose
- FastAPI or Flask
- ffmpeg
- librosa

## Documentation
- [Roadmap (EN)](./roadmap.md)
- [Roadmap (RU)](./roadmap_RU.md)
- [Roadmap (UA)](./roadmap_UA.md)

## Planned structure
```text
project-root/
  docs/
  data/
  services/
    parser/
    tts/
    evaluation/
  docker/
  outputs/
  README.md
```

## MVP scope
Included:
- text input with emoji and punctuation;
- rule-based parsing;
- emotion mapping;
- segment-level metadata;
- local synthesis with Piper;
- basic objective and subjective evaluation.

Not included:
- training a new TTS model from scratch;
- full STT + TTS workflow;
- production-scale deployment;
- voice cloning as a primary goal.

## Quick start
```bash
git clone https://github.com/Ermolz69/text2speech.git
cd text2speech
docker compose up --build
```

Expected services:
- parser service;
- Piper TTS service;
- test endpoint or demo UI;
- generated files in `outputs/`.

## Benchmarking
Planned comparison levels:
1. Piper neutral vs Piper expressive pipeline
2. Piper vs ElevenLabs
3. Synthetic audio vs human reference audio

## Notes
- **Piper** is the main local synthesis engine.
- **librosa** is used for evaluation, not generation.
- **ElevenLabs** is used as a benchmark/reference, not as the base for the free local MVP.

## License
Add the project license here.