import { SynthesisForm } from "@features/synthesis";
import { uiClass } from "@shared/ui/styles";
import { DiagnosticsPanel } from "@widgets/diagnostics-panel";
import { ResultPanel } from "@widgets/synthesis-result";

import { useHomePage } from "@pages/home/model";

export function HomePage() {
  const {
    formState,
    requestState,
    errorMessage,
    segments,
    summary,
    audioUrl,
    generationMs,
    showDiagnostics,
    voiceOptions,
    handleSubmit,
    handleTextChange,
    handleVoiceChange,
    handleModeChange,
    handleFormatChange,
    toggleDiagnostics,
  } = useHomePage();

  return (
    <main className="relative mx-auto min-h-screen w-full max-w-6xl px-4 pb-10 pt-6">
      <div className="pointer-events-none absolute -left-16 top-8 h-44 w-44 rounded-full bg-emerald-300/35 blur-sm" />
      <div className="pointer-events-none absolute -right-20 top-24 h-56 w-56 rounded-full bg-orange-300/35 blur-sm" />

      <section
        className={`relative z-10 mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between ${uiClass.card}`}
      >
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-800 md:text-4xl">
            Emotional TTS Playground
          </h1>
          <p className="mt-2 max-w-2xl text-stone-600">
            Enter text, choose a voice and mode, then generate speech with an emotional segment
            preview.
          </p>
        </div>
      </section>

      <section className="relative z-10 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <SynthesisForm
          formState={formState}
          requestState={requestState}
          errorMessage={errorMessage}
          voiceOptions={voiceOptions}
          onSubmit={handleSubmit}
          onTextChange={handleTextChange}
          onVoiceChange={handleVoiceChange}
          onModeChange={handleModeChange}
          onFormatChange={handleFormatChange}
        />

        <ResultPanel
          requestState={requestState}
          summary={summary}
          outputFormat={formState.outputFormat}
          generationMs={generationMs}
          audioUrl={audioUrl}
        />
      </section>

      <section className="relative z-10 mt-4">
        <DiagnosticsPanel
          showDiagnostics={showDiagnostics}
          segments={segments}
          onToggle={toggleDiagnostics}
        />
      </section>
    </main>
  );
}
