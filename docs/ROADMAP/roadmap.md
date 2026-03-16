# Emotional TTS Roadmap

## Table of Contents
- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Product Scope](#product-scope)
- [Goals and Non Goals](#goals-and-non-goals)
- [Key Decisions](#key-decisions)
- [Source Documents and Knowledge Base](#source-documents-and-knowledge-base)
- [System Vision](#system-vision)
- [Target Architecture](#target-architecture)
- [Core Modules](#core-modules)
  - [Input Layer](#input-layer)
  - [Normalization and Segmentation](#normalization-and-segmentation)
  - [Emoji and Context Parser](#emoji-and-context-parser)
  - [Emotion Mapping Layer](#emotion-mapping-layer)
  - [Prosody Planning Layer](#prosody-planning-layer)
  - [TTS Provider Layer](#tts-provider-layer)
  - [Audio Post Processing](#audio-post-processing)
  - [Evaluation and Analytics](#evaluation-and-analytics)
- [Technology Stack](#technology-stack)
- [Data and Test Inputs](#data-and-test-inputs)
- [How the System Should Work End to End](#how-the-system-should-work-end-to-end)
- [Delivery Plan](#delivery-plan)
  - [Phase 1 Discovery](#phase-1-discovery)
  - [Phase 2 Core Design](#phase-2-core-design)
  - [Phase 3 MVP Implementation](#phase-3-mvp-implementation)
  - [Phase 4 Quality Improvement](#phase-4-quality-improvement)
  - [Phase 5 Benchmarking and Release Preparation](#phase-5-benchmarking-and-release-preparation)
- [Sprint Plan](#sprint-plan)
  - [Sprint 1 Foundation and Research](#sprint-1-foundation-and-research)
  - [Sprint 2 Parser and Emotion Metadata](#sprint-2-parser-and-emotion-metadata)
  - [Sprint 3 Piper Service and First End to End MVP](#sprint-3-piper-service-and-first-end-to-end-mvp)
  - [Sprint 4 Quality Controls and Edge Cases](#sprint-4-quality-controls-and-edge-cases)
  - [Sprint 5 Benchmarking Against Higher Quality TTS](#sprint-5-benchmarking-against-higher-quality-tts)
  - [Sprint 6 Stabilization Demo and Documentation](#sprint-6-stabilization-demo-and-documentation)
- [Team Structure for 7 Participants](#team-structure-for-7-participants)
- [Role Based Task Split by Sprint](#role-based-task-split-by-sprint)
- [Benchmark Strategy](#benchmark-strategy)
  - [Benchmark A Piper Neutral vs Piper Emotion Aware Pipeline](#benchmark-a-piper-neutral-vs-piper-emotion-aware-pipeline)
  - [Benchmark B Piper vs ElevenLabs](#benchmark-b-piper-vs-elevenlabs)
  - [Benchmark C Synthetic Audio vs Human Reference Audio](#benchmark-c-synthetic-audio-vs-human-reference-audio)
- [Acceptance Criteria](#acceptance-criteria)
- [Risks and Mitigations](#risks-and-mitigations)
- [Expected Deliverables](#expected-deliverables)
- [Open Questions](#open-questions)
- [Appendix A Example Metadata Contract](#appendix-a-example-metadata-contract)
- [Appendix B Suggested Repository Structure](#appendix-b-suggested-repository-structure)

## Overview
This document defines the implementation roadmap for an **emotion-aware text-to-speech system** that takes text containing emoji and punctuation cues, interprets emotional intent, and generates expressive speech locally.

The roadmap is designed for a **7-person team** and assumes the following strategic decision:

- **Primary local TTS engine:** Piper
- **Primary target for MVP:** local, free, Docker-friendly deployment
- **Main product challenge:** not building a new TTS model from scratch, but building a **control layer** on top of TTS that turns textual emotional cues into expressive synthesis behavior
- **Benchmark target:** compare local results against a higher-quality cloud baseline such as ElevenLabs

See [Key Decisions](#key-decisions) and [Technology Stack](#technology-stack).

## Problem Statement
The input is plain text that may contain emoji, punctuation emphasis, repeated symbols, and contextual sentiment markers. The system must:

1. detect emotional cues in text,
2. map them to structured emotional metadata,
3. transform the metadata into synthesis instructions,
4. generate audio through a local TTS engine,
5. evaluate whether the generated speech is more expressive than neutral synthesis.

This is primarily a **text-to-speech** problem, not speech-to-text. Speech-to-text may be introduced later only for benchmarking, voice input, or transcription-based evaluation. See [Benchmark Strategy](#benchmark-strategy).

## Product Scope
### In scope
- Text input with emoji and punctuation
- Emotion parsing and rule-based interpretation
- Segment-level emotional metadata
- Local synthesis with Piper
- Dockerized local development flow
- Basic UI or API for testing
- Objective and subjective evaluation
- Benchmarking against a stronger external reference system

### Out of scope for MVP
- Training a new emotional TTS model from scratch
- Full end-to-end STT + TTS voice assistant workflow
- Production-grade distributed infrastructure
- Voice cloning as a core deliverable
- Real-time conversational streaming as a hard requirement

## Goals and Non Goals
### Goals
- Deliver a working local MVP quickly
- Keep the initial system free to run locally
- Separate emotional interpretation from synthesis backend
- Make the pipeline measurable and benchmarkable
- Build a codebase that can later swap Piper for another engine

### Non Goals
- Beat state of the art emotional cloud TTS in the first iteration
- Solve all sarcasm and irony cases perfectly in MVP
- Depend entirely on a paid vendor from day one

## Key Decisions
1. **Use Piper for the primary synthesis layer.** Piper is a fast local neural TTS engine and the current maintained project is under OHF-Voice. Its current README also exposes CLI, web server, Python API, and training documentation, which makes it suitable as a practical local baseline.
2. **Do not fine-tune or retrain the TTS model in the first phase.** First, build a control layer around the model.
3. **Represent emotion explicitly as metadata.** The parser should return structured information, not only raw emoji detection.
4. **Use Docker for reproducibility.** Everyone on the team should be able to run the same local stack.
5. **Use librosa for evaluation, not for synthesis.** librosa is useful for extracting features such as MFCC, RMS, spectral centroid, spectral bandwidth, and spectral contrast.
6. **Use ElevenLabs only as a benchmark and quality reference.** It is useful for comparison, but it is not the best fit for a free local-first MVP.
7. **Keep the system provider-agnostic.** The TTS layer must be abstract enough to later plug in ElevenLabs, Azure, Coqui, or another provider.

## Source Documents and Knowledge Base
This roadmap is based on a mix of **primary sources** and **supplementary reading**.

### Primary sources for implementation decisions
- [OHF-Voice Piper repository](https://github.com/OHF-Voice/piper1-gpl)
- [Previous Piper repository notice with move to OHF-Voice](https://github.com/rhasspy/piper)
- [librosa feature extraction documentation](https://librosa.org/doc/0.11.0/feature.html)
- [ElevenLabs TTS capabilities documentation](https://elevenlabs.io/docs/overview/capabilities/text-to-speech)
- [ElevenLabs real-time audio generation documentation](https://elevenlabs.io/docs/eleven-api/websockets)
- [EmoSphere++ paper](https://arxiv.org/pdf/2411.02625)

### Supplementary background reading
- [GenAI Guidebook: Audio feature extraction](https://ravinkumar.com/GenAiGuidebook/audio/audio_feature_extraction.html)
- [Text-to-speech overview, part 1](https://towardsdatascience.com/text-to-speech-lifelike-speech-synthesis-demo-part-1-f991ffe9e41e/)
- [Text-to-speech overview, part 2](https://towardsdatascience.com/text-to-speech-foundational-knowledge-part-2-4db2a3657335/)

### How these documents are used
- Use Piper docs for **runtime integration and local deployment decisions**.
- Use librosa docs for **evaluation and analysis design**.
- Use ElevenLabs docs for **benchmark target definition**, not for the main free local stack.
- Use EmoSphere++ as **research inspiration** for future emotional control design beyond simple rules.
- Use the tutorial articles as **background reading**, not as the final architectural authority.

## System Vision
The system should behave like a pipeline that converts text cues into expressive synthesis behavior.

```text
User text
  -> normalizer
  -> segmenter
  -> emoji and context parser
  -> emotion mapping
  -> prosody planner
  -> TTS adapter
  -> audio post processing
  -> output audio + metrics
```

The most important architectural principle is separation of concerns:
- text understanding must be independent from the synthesis engine,
- the synthesis engine must be swappable,
- evaluation must be reproducible.

## Target Architecture
The architecture should contain the following services or modules:

1. **Client layer**
   - simple UI, CLI, or API consumer,
   - sends text input and receives audio.

2. **Parser and control service**
   - normalizes text,
   - extracts cues,
   - generates emotional metadata.

3. **TTS service**
   - accepts text segments plus synthesis hints,
   - synthesizes with Piper.

4. **Audio utility layer**
   - converts WAV to MP3 if needed,
   - stitches segments,
   - normalizes loudness.

5. **Evaluation layer**
   - calculates objective metrics,
   - stores benchmark outputs,
   - supports listening tests.

See [Core Modules](#core-modules) and [How the System Should Work End to End](#how-the-system-should-work-end-to-end).

## Core Modules

### Input Layer
Responsibilities:
- accept plain text,
- accept text with emoji,
- accept text with punctuation patterns such as `!!!`, `???`, `...`,
- optionally accept batch test files.

Initial interface options:
- CLI for developers,
- minimal web form for demos,
- REST endpoint for automation.

### Normalization and Segmentation
Responsibilities:
- normalize whitespace,
- preserve emoji,
- split text into sentences or meaningful chunks,
- detect repeated punctuation,
- mark uppercase emphasis.

Output of this module should be a normalized internal representation, not final emotion labels.

### Emoji and Context Parser
Responsibilities:
- detect emoji,
- detect punctuation amplifiers,
- detect modifier words such as “very”, “so”, “really”,
- detect location of cues relative to the sentence,
- identify whether a cue is global or local.

This module should answer:
- which emotional cues exist,
- where they apply,
- how strong they appear.

### Emotion Mapping Layer
Responsibilities:
- convert detected cues into a small controlled label space,
- assign intensity levels,
- combine emoji, punctuation, and lexical cues.

Recommended initial label set:
- neutral
- joy
- playful
- sadness
- anger
- surprise

Recommended intensity scale:
- 0 neutral
- 1 weak
- 2 medium
- 3 strong

This is where the first version of rule logic should live.

### Prosody Planning Layer
Responsibilities:
- translate emotion metadata into synthesis hints,
- decide segment boundaries,
- choose pause lengths,
- adjust emphasis strategy,
- prepare synthesis-ready chunks.

Important note: in MVP, this layer mostly controls **how text is prepared** for synthesis. It does not require true internal emotional control inside Piper.

### TTS Provider Layer
Responsibilities:
- expose a unified synthesis interface,
- wrap Piper as the primary provider,
- allow future providers to be added later.

Recommended interface:

```python
synthesize(text: str, voice_id: str, output_path: str, metadata: dict | None = None) -> str
```

Provider implementations:
- `PiperProvider`
- `ElevenLabsProvider` later for benchmark only
- optional `AzureProvider` or `CoquiProvider` later

### Audio Post Processing
Responsibilities:
- merge segment audio files,
- normalize volume,
- trim silent edges if necessary,
- convert output format for playback.

Suggested tools:
- `ffmpeg`
- `pydub` or another small utility layer

### Evaluation and Analytics
Responsibilities:
- compute audio features with librosa,
- compare neutral and expressive outputs,
- store benchmark metadata,
- support listening tests.

Suggested metrics:
- duration
- pause count and pause length
- RMS energy
- MFCC summary statistics
- spectral centroid
- spectral bandwidth
- spectral contrast

See [Benchmark Strategy](#benchmark-strategy).

## Technology Stack
### Target stack
- **Frontend:** React + TypeScript
- **Gateway backend:** TypeScript + Fastify
- **Text analysis service:** Python
- **TTS service:** Piper
- **Storage / logs:** local filesystem first, optional object storage later

### Notes on stack choice
- The **frontend** is responsible only for user interaction and calls the gateway API.
- The **gateway backend** aggregates requests, coordinates calls to the text analysis and TTS services, and exposes a single public API.
- The **text analysis service** implements normalization, emoji and context parsing, emotion mapping, and prosody planning logic.
- The **TTS service (Piper)** is treated as a replaceable synthesizer behind a simple adapter interface.
- **Storage/logs** start with local volumes for simplicity; S3-compatible object storage can be added later if needed for long-term artifacts and metrics.

## Data and Test Inputs
You need a structured test corpus from the beginning.

### Input groups
1. **Neutral sentences**
   - no emoji,
   - minimal punctuation emphasis.
2. **Simple emotional cases**
   - one emoji, clear meaning.
3. **Amplified cases**
   - repeated emoji, repeated punctuation, uppercase.
4. **Ambiguous cases**
   - irony, sarcasm templates, mixed signals.
5. **Multi segment cases**
   - long text where emotion changes across segments.

### Example corpus format
Each test item should include:
- input text,
- expected label,
- expected intensity,
- notes on ambiguity,
- benchmark outputs.

## How the System Should Work End to End
1. User enters text.
2. Input goes through normalization and segmentation.
3. The parser detects emoji, punctuation, and lexical amplifiers.
4. The emotion mapping layer assigns labels and intensities.
5. The prosody planner converts metadata into synthesis-ready segments.
6. Piper synthesizes each segment.
7. Audio utilities stitch and normalize the final output.
8. Evaluation utilities optionally compute metrics and save reports.

### Example flow
Input:

```text
I am so happy to see you 😊😊!
```

Intermediate metadata:

```json
{
  "segments": [
    {
      "text": "I am so happy to see you",
      "emotion": "joy",
      "intensity": 2,
      "emoji": ["😊", "😊"],
      "punctuation": ["!"],
      "pause_after_ms": 120
    }
  ]
}
```

Output:
- one synthesized audio file,
- optional metrics file,
- optional comparison against neutral synthesis.

## Delivery Plan

### Phase 1 Discovery
Objectives:
- define emotion label set,
- confirm local runtime stack,
- gather test corpus,
- confirm voices and language support to be used in MVP.

Exit criteria:
- architecture sketch approved,
- test corpus v1 created,
- Piper integration feasibility confirmed.

### Phase 2 Core Design
Objectives:
- define metadata contract,
- define parser outputs,
- define provider interface,
- define repository layout.

Exit criteria:
- interface spec frozen for MVP,
- team roles assigned,
- issue breakdown ready.

### Phase 3 MVP Implementation
Objectives:
- implement parser v1,
- implement emotion mapping v1,
- run Piper locally through an API,
- generate first expressive vs neutral outputs.

Exit criteria:
- full text to audio path works locally,
- example demo works in Docker.

### Phase 4 Quality Improvement
Objectives:
- improve segmentation,
- improve edge-case handling,
- add objective evaluation,
- add logging and reproducibility.

Exit criteria:
- emotion metadata produces audible differences on the test corpus,
- objective metrics are recorded.

### Phase 5 Benchmarking and Release Preparation
Objectives:
- compare with ElevenLabs,
- compare with human reference recordings,
- prepare demo and documentation,
- summarize limitations and next steps.

Exit criteria:
- benchmark report complete,
- demo scenario ready,
- documentation complete.

## Sprint Plan
Assume 6 sprints with 2 weeks each.

### Sprint 1 Foundation and Research
Deliverables:
- final scope,
- source review,
- architecture draft,
- test corpus v1,
- repository and CI setup.

### Sprint 2 Parser and Emotion Metadata
Deliverables:
- text normalizer,
- emoji detector,
- punctuation amplifier logic,
- initial emotion taxonomy,
- metadata contract v1.

### Sprint 3 Piper Service and First End to End MVP
Deliverables:
- Dockerized Piper service,
- synthesis endpoint,
- parser to TTS integration,
- first working demo.

### Sprint 4 Quality Controls and Edge Cases
Deliverables:
- ambiguity handling,
- multi segment handling,
- post processing,
- objective evaluation scripts.

### Sprint 5 Benchmarking Against Higher Quality TTS
Deliverables:
- comparative benchmark against ElevenLabs,
- quality notes,
- cost and tradeoff summary,
- human listening protocol.

### Sprint 6 Stabilization Demo and Documentation
Deliverables:
- polished demo,
- final roadmap alignment review,
- technical documentation,
- benchmark summary,
- known issues list.

## Team Structure for 7 Participants
### Participant 1
Project coordination, requirements, sprint tracking, documentation consistency.

### Participant 2
Text normalization, parsing, emoji extraction, lexical cues.

### Participant 3
Emotion mapping rules, intensity logic, ambiguity handling.

### Participant 4
Piper integration, API layer, Docker service.

### Participant 5
Audio post processing, output management, basic UI or playback layer.

### Participant 6
Evaluation, librosa metrics, benchmark scripts, reporting.

### Participant 7
QA, CI, environment reproducibility, demo packaging, release support.

## Role Based Task Split by Sprint
### Sprint 1
- Participant 1: finalize scope and issue tree
- Participant 2: research text cue categories
- Participant 3: draft emotion taxonomy and rules
- Participant 4: validate Piper setup and voices
- Participant 5: draft input and output UX
- Participant 6: define evaluation framework
- Participant 7: repository, Docker, CI setup

### Sprint 2
- Participant 1: approve metadata and acceptance criteria
- Participant 2: implement normalization and segmentation
- Participant 3: implement emoji to emotion mapping v1
- Participant 4: define TTS adapter contract
- Participant 5: prepare test harness or small UI
- Participant 6: prepare parser evaluation set
- Participant 7: test automation skeleton

### Sprint 3
- Participant 1: integrate sprint outputs into one backlog view
- Participant 2: improve parser for sentence boundaries
- Participant 3: add punctuation and intensity rules
- Participant 4: expose Piper synthesis service in Docker
- Participant 5: add audio playback and export path
- Participant 6: compare neutral vs expressive runs
- Participant 7: environment hardening and regression checks

### Sprint 4
- Participant 1: prioritize edge cases
- Participant 2: handle repeated emoji and mixed punctuation
- Participant 3: handle sarcasm patterns and fallback logic
- Participant 4: improve service reliability and logging
- Participant 5: add audio stitching and format conversion
- Participant 6: implement librosa metric scripts
- Participant 7: QA on cross-machine reproducibility

### Sprint 5
- Participant 1: benchmark review and decision summary
- Participant 2: prepare benchmark inputs
- Participant 3: annotate expected emotional perception
- Participant 4: integrate ElevenLabs benchmark client
- Participant 5: collect playback outputs for listening tests
- Participant 6: aggregate subjective and objective benchmark results
- Participant 7: verify reproducibility and release candidates

### Sprint 6
- Participant 1: final narrative, roadmap closure, presentation logic
- Participant 2: parser documentation
- Participant 3: emotion rule documentation
- Participant 4: deployment and service documentation
- Participant 5: demo flow and UI cleanup
- Participant 6: final benchmark report
- Participant 7: final QA, release packaging, README polish

## Benchmark Strategy

### Benchmark A Piper Neutral vs Piper Emotion Aware Pipeline
Purpose:
- prove that the control layer changes output behavior.

Method:
- synthesize each input twice,
- once with plain synthesis,
- once with parsed emotional metadata,
- compare audio features and listening impressions.

Success signal:
- emotional and neutral outputs are audibly distinct in the right direction.

### Benchmark B Piper vs ElevenLabs
Purpose:
- understand the gap between the local free MVP and a high-quality cloud reference.

Method:
- use the same sentences and the same intended emotional labels,
- generate audio through Piper and ElevenLabs,
- compare naturalness, perceived emotion, and latency.

What to record:
- synthesis latency,
- total audio duration,
- subjective rating,
- reproducibility notes,
- cost and dependency notes.

### Benchmark C Synthetic Audio vs Human Reference Audio
Purpose:
- understand how close the system gets to natural expressive reading.

Method:
- record a human reading the same prompts in intended emotions,
- compare human audio, Piper output, and benchmark output,
- conduct blind listening tests if possible.

Suggested rating axes:
- naturalness,
- emotional clarity,
- intelligibility,
- listening comfort.

## Acceptance Criteria
The MVP is accepted if all of the following are true:

1. The system accepts text containing emoji.
2. The parser produces structured emotional metadata.
3. The metadata affects generated audio in a reproducible way.
4. Piper runs locally in Docker for the team.
5. At least one voice is integrated and usable end to end.
6. A benchmark corpus exists and is versioned.
7. A basic comparison against neutral synthesis is implemented.
8. A benchmark plan against ElevenLabs is documented and at least partially executed.
9. The repository contains setup instructions and a demo path.

## Risks and Mitigations
### Risk 1 Ambiguous emoji meaning
Mitigation:
- start with a small label set,
- log ambiguous cases,
- use explicit fallback to neutral.

### Risk 2 Piper expressiveness is limited
Mitigation:
- control expressiveness through segmentation and synthesis hints,
- use benchmark comparisons to identify gaps,
- keep provider abstraction ready.

### Risk 3 Language or voice limitations
Mitigation:
- lock MVP to known supported voices early,
- keep voice assets versioned,
- run early voice quality validation.

### Risk 4 Local reproducibility issues
Mitigation:
- use Docker,
- pin versions,
- document runtime setup early.

### Risk 5 Over-engineering in early sprints
Mitigation:
- avoid retraining and advanced research features in MVP,
- focus on control layer first.

## Expected Deliverables
- `roadmap.md`
- architecture diagram
- metadata contract
- parser implementation
- Piper service in Docker
- evaluation scripts using librosa
- benchmark dataset
- benchmark report
- demo instructions
- final README and runbook

## Open Questions
- Which exact language and voice will be used for MVP?
- Should the parser be pure rule-based in v1, or include light sentiment heuristics?
- Is real-time streaming required in a later phase, or only offline generation?
- Do we need STT at all in this course project, or only for optional benchmarking?
- What level of irony detection is realistic for the available timeline?

## Appendix A Example Metadata Contract
```json
{
  "request_id": "sample-001",
  "source_text": "I am so happy to see you 😊😊!",
  "segments": [
    {
      "segment_id": 1,
      "text": "I am so happy to see you",
      "emotion": "joy",
      "intensity": 2,
      "emoji": ["😊", "😊"],
      "punctuation": ["!"],
      "pause_after_ms": 120,
      "notes": "positive with amplification"
    }
  ]
}
```

## Appendix B Suggested Repository Structure
```text
project-root/
  docs/
    roadmap.md
    architecture.md
    benchmark-plan.md
  data/
    test_corpus/
    human_reference/
  services/
    parser/
    tts/
    evaluation/
  docker/
    docker-compose.yml
  notebooks/
    evaluation/
  scripts/
  outputs/
    generated_audio/
    reports/
  README.md
```
