# Current MVP Baseline Review

## Scope

This review documents the current MVP behavior on the fixed 10-prompt corpus requested by the task. It covers:

- environment and service readiness,
- analysis/debug behavior,
- synthesis behavior,
- pairwise comparisons,
- strengths, weaknesses, and next-step recommendations.

The task specifically asks for a structured baseline review using 10 controlled prompts, with setup/readiness notes, per-prompt analysis and synthesis observations, direct prompt-pair comparisons, and prioritized improvement suggestions.

## Setup used

- Startup method: `docker compose up -d --build`
- Services checked manually:
  - `GET /health` on gateway: OK
  - `GET /health` on text-analysis: OK
  - `GET /health` on tts-adapter: OK
  - `GET /health/ready` on tts-adapter: `ready = true`
- Piper model/voice: repo-provided local model in `models/piper` was used. Exact voice/model name was not separately recorded during this run.
- Smoke/integration scripts:
  - `scripts/smoke_check.ps1 -RequireSynthesisReady`: passed
  - `scripts/synthesis_integration_check.ps1`: passed
  - Recorded results:
    - smoke summary: `GatewayStatus=ok`, `WebProxyStatus=ok`, `TextAnalysisStatus=ok`, `TtsAdapterStatus=ok`, `TtsReady=True`, `SegmentCount=2`
    - synthesis integration summary: `AudioUrl=/audio/8b121088d143418c81d09eee2c55dd47.wav`, `OutputPath=reports/latest-synthesis-check.wav`, `Bytes=93740`, `ContentType=audio/x-wav`, `SegmentCount=2`

## Overall summary

The current MVP is already usable as a research baseline:

- the services start,
- the pipeline is stable,
- segmentation works,
- punctuation/emoticon cues affect metadata,
- synthesis returns real WAV files.

However, the strongest behavior is currently in **analysis metadata**, not in **audible synthesis differences**.
The system often produces distinct segment-level metadata, but those differences are only weakly reflected in the final audio.

The biggest mismatch observed is:

- analysis/debug often shows meaningful changes in emotion, intensity, pause, rate, and pitch hints,
- but the produced audio usually changes only slightly, mainly as small speed differences,
- and clear emotional/prosodic differences are often not audible.

## Per-prompt results

| ID  | Input text                                         | Segmentation result                              | Detected cues                            | Mapped emotion              | Intensity | Prosody hints                                                               | Synthesis succeeded? | Audio              | Subjective listening notes                                                                            | Difference vs related prompt                                               | Issue / observation                                                      |
| --- | -------------------------------------------------- | ------------------------------------------------ | ---------------------------------------- | --------------------------- | --------: | --------------------------------------------------------------------------- | -------------------- | ------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | `Hello. This is a neutral test.`                   | 2 segments: `Hello.` / `This is a neutral test.` | none                                     | neutral / neutral           |     0 / 0 | pause 150, rate 1.0, pitch 0                                                | Yes                  | [1.wav](./1.wav)   | Neutral, stable, baseline reference.                                                                  | Baseline for `1 vs 2` and `3 vs 1`.                                        | Good neutral reference case.                                             |
| 2   | `Hello! This is amazing!`                          | 2 segments                                       | exclamation on both segments             | neutral / neutral           |     0 / 0 | pause 150, rate 1.1, pitch 2                                                | Yes                  | [2.wav](./2.wav)   | Sounds only slightly faster than 1; intonation change is weak.                                        | `1 vs 2`: weak difference.                                                 | Exclamation affects metadata/prosody hints, but audible change is small. |
| 3   | `Hello... I am not sure about this...`             | 2 segments                                       | ellipsis on both segments                | sadness / sadness           |     1 / 1 | pause 300, rate 0.9, pitch 0                                                | Yes                  | [3.wav](./3.wav)   | Did **not** sound clearly sadder; may even sound faster than 1.                                       | `3 vs 1`: metadata strongly different, audio difference weak/inconsistent. | Strong metadata shift is not reliably reflected in audio.                |
| 4   | `Hello?! What happened here?!`                     | 2 segments                                       | exclamation, question, mixed             | neutral / neutral           |     0 / 0 | pause 150, rate 1.1, pitch 2                                                | Yes                  | [4.wav](./4.wav)   | Sounds more like a question; otherwise not much more expressive than prompt 2.                        | `4 vs 2`: weak-to-medium difference.                                       | Mixed punctuation is detected, but audible effect is limited.            |
| 5   | `I got the job! :)`                                | 1 segment                                        | exclamation + positive emoticon          | joy                         |         2 | pause 150, rate 1.1, pitch 2                                                | Yes                  | [5.wav](./5.wav)   | Slightly happier and faster than 6; more energetic than 2.                                            | `5 vs 6`: medium difference. `2 vs 5`: medium difference.                  | Positive cue helps, but synthesis still remains fairly subtle.           |
| 6   | `I got the job.`                                   | 1 segment                                        | none                                     | neutral                     |         0 | pause 150, rate 1.0, pitch 0                                                | Yes                  | [6.wav](./6.wav)   | Slower and calmer than 5.                                                                             | `5 vs 6`: medium difference.                                               | Good plain-statement baseline.                                           |
| 7   | `I am happy 😊`                                    | 1 segment                                        | none detected for Unicode emoji          | neutral                     |         0 | pause 150, rate 1.0, pitch 0                                                | Yes                  | [7.wav](./7.wav)   | Sounds neutral/slower and literally speaks “smiling face with smiling eyes”.                          | `7 vs 8`: weak difference, but undesirable.                                | Unicode emoji is spoken literally instead of becoming a positive cue.    |
| 8   | `I am happy.`                                      | 1 segment                                        | none                                     | neutral                     |         0 | pause 150, rate 1.0, pitch 0                                                | Yes                  | [8.wav](./8.wav)   | Slightly faster/livelier than 7.                                                                      | `7 vs 8`: weak difference.                                                 | Plain statement works, but emoji handling is worse than plain text.      |
| 9   | `Wait. I need to think. Then I will answer.`       | 3 segments                                       | none                                     | neutral / neutral / neutral | 0 / 0 / 0 | pause 150, rate 1.0, pitch 0                                                | Yes                  | [9.wav](./9.wav)   | Slightly slower, neutral intonation.                                                                  | Baseline for `3 vs 9` and `9 vs 10`.                                       | Multi-segment neutral case behaves consistently.                         |
| 10  | `Wait... I need to think!!! Then I will answer :)` | 3 segments                                       | ellipsis, exclamation, positive emoticon | sadness / neutral / joy     | 1 / 0 / 2 | seg1: pause 300, rate 0.9; seg2: rate 1.1 pitch 2; seg3: rate 1.0 pitch 1.5 | Yes                  | [10.wav](./10.wav) | Noticeably faster than 9, but still mostly neutral in intonation. `:)` was **not** spoken as “colon”. | `9 vs 10`: medium difference.                                              | Metadata is rich, but audio still under-expresses it.                    |

## Pairwise comparison notes

### 1 vs 2 — neutral vs emphatic

- Metadata difference: clear.
- Audio difference: **weak**.
- Audible result: prompt 2 sounds only a little faster; intonation change is minimal.

### 2 vs 5 — exclamation vs exclamation + positive cue

- Metadata difference: clear.
- Audio difference: **medium**.
- Audible result: prompt 5 sounds somewhat more energetic than 2.
- Observation: positive emoticon seems to help more than plain exclamation, but the effect is still not strong.

### 3 vs 9 — hesitation/ellipsis vs calm segmented speech

- Metadata difference: very strong.
- Audio difference: **weak/inconsistent**.
- Audible result: prompt 3 did not reliably sound sadder or more hesitant than 9/1.
- Observation: ellipsis strongly affects metadata but not convincingly the synthesized audio.

### 4 vs 2 — mixed punctuation vs simple excitement

- Metadata difference: present (`question`, `mixed` added).
- Audio difference: **weak-to-medium**.
- Audible result: prompt 4 sounds more like a question, but otherwise not much more expressive than prompt 2.

### 6 vs 8 — plain statement variants

- Both are plain neutral statements.
- Audio difference: **weak**.
- Observation: behavior is consistent enough for baseline neutral prompts.

### 7 vs 8 — emoji influence

- Metadata difference: essentially absent for Unicode emoji.
- Audio difference: **weak**, but in the wrong direction.
- Audible result: prompt 7 speaks the emoji label (“smiling face with smiling eyes”) instead of sounding happier.
- Observation: Unicode emoji handling is currently weak and undesirable for TTS quality.

### 9 vs 10 — multi-segment plain vs expressive multi-segment

- Metadata difference: strong and structured across segments.
- Audio difference: **medium**.
- Audible result: prompt 10 is faster than 9, but still mostly neutral in intonation.
- Observation: segmentation is working, but per-segment expressive control is not strongly realized in synthesis.

## What is already good

1. **Service readiness and stability**
   - The stack starts successfully through the documented Docker flow.
   - Gateway, text-analysis, and tts-adapter health endpoints respond correctly.
   - TTS readiness reaches `ready = true`.
   - Smoke and synthesis integration scripts both pass.

2. **Segmentation quality is already useful**
   - Neutral and expressive prompts are split into sensible segments.
   - Multi-sentence prompts (1, 9, 10) are segmented cleanly.

3. **Cue detection is already meaningful for several cases**
   - Exclamation, ellipsis, mixed punctuation, and ASCII emoticon-style positivity are recognized.
   - Prompt 10 shows that the pipeline can assign different metadata to different segments.

4. **Real WAV generation works**
   - Every tested prompt returned a real `audioUrl`.
   - The documented synthesis integration check also downloaded a real WAV successfully.
   - This is enough to use the current system as a real baseline implementation review.

## What is partially working

1. **Prosody metadata generation**
   - The analysis layer already produces pause/rate/pitch changes.
   - These changes are visible in debug output and are directionally sensible.

2. **Positive cue handling for ASCII emoticons**
   - `:)` helps prompt 5 and the third segment of prompt 10 receive `joy` / positive metadata.
   - Some audible increase in speed/energy is present.

3. **Mixed punctuation behavior**
   - `?!` produces question-like audible behavior in prompt 4.
   - But the effect is not substantially richer than simple exclamation.

## What is weak or inconsistent

1. **Metadata-to-audio transfer is weak**
   - The biggest issue in the current MVP.
   - The analysis/debug layer often shows strong expressive differences, but the audio only changes slightly.

2. **Ellipsis handling is over-strong in metadata, under-strong in audio**
   - Prompt 3 gets `sadness` and intensity `1`, but the resulting audio does not convincingly sound sadder or more hesitant.

3. **Unicode emoji handling is poor**
   - `😊` does not become a positive cue in analysis.
   - In synthesis it is spoken literally as “smiling face with smiling eyes”, which hurts output quality.

4. **Intonation changes are generally weak**
   - Many differences are heard mainly as speed changes, not as convincing emotional delivery.

5. **Pause differences are not clearly audible**
   - Even where metadata sets longer pauses, the final output does not strongly reflect them.

## Prioritized next-step recommendations

1. **Improve metadata-to-synthesis transfer first**
   - Make sure segment-level pause/rate/pitch/emotion hints materially affect the generated audio.
   - This is the highest-value next step because the analysis layer already has useful signal.

2. **Handle Unicode emoji properly**
   - Map common Unicode emoji (for example `😊`) to positive cues in analysis.
   - Strip or transform emoji before raw TTS text is sent to Piper so they are not spoken literally.

3. **Refine punctuation/emotion mapping balance**
   - Ellipsis currently appears too aggressive in metadata.
   - Exclamation currently appears too weak emotionally.
   - The mapping should be rebalanced to produce more believable behavior.

4. **Add stronger listening-oriented regression prompts**
   - Keep this 10-prompt corpus as the fixed baseline set.
   - Re-run it after each major prosody/synthesis change and compare audio differences systematically.

5. **Explicitly log the active Piper model/voice in future reviews**
   - The startup succeeded, but the exact voice/model name was not written down during this run.
   - That should be recorded next time for cleaner reproducibility.

## Final conclusion

The current MVP is a **good baseline analysis prototype and a partially convincing synthesis prototype**.

What already works well:

- the stack starts,
- analysis is structured,
- segmentation is useful,
- cues are detected,
- WAV generation is real and stable.

What prevents it from feeling strong end-to-end:

- expressive metadata does not yet translate strongly enough into audible synthesis differences,
- Unicode emoji handling is weak,
- pause and emotional contrast are often much more visible in JSON than audible in WAV.

This makes the current system suitable as the requested **baseline implementation review for the current project stage**, and it also makes the next improvement priorities very clear: improve metadata-to-audio transfer, emoji handling, and the audibility of pause/intensity/prosody differences.
