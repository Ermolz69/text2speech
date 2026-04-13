from __future__ import annotations

import io
import subprocess
import wave
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.models.segment import SegmentMetadata
from app.providers.piper import PiperSynthesisProvider, resolve_audio_output_dir

client = TestClient(app, raise_server_exceptions=False)


def make_wav_bytes(*, sample_rate: int = 22050, duration_ms: int = 50) -> bytes:
    frame_count = int(sample_rate * (duration_ms / 1000))
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(b"\x00\x00" * frame_count)
    return buffer.getvalue()


WAV_BYTES = make_wav_bytes()
SMILING_FACE = "\U0001F60A"


def test_piper_provider_reports_not_ready_when_model_is_missing(tmp_path: Path) -> None:
    provider = PiperSynthesisProvider(
        piper_bin="piper-bin",
        ffmpeg_bin="ffmpeg-bin",
        model_path=tmp_path / "missing-model.onnx",
        output_dir=tmp_path,
    )

    readiness = provider.get_readiness()

    assert readiness == {
        "piper_bin": "piper-bin",
        "ffmpeg_bin": "ffmpeg-bin",
        "model_path": str(tmp_path / "missing-model.onnx"),
        "binary_available": False,
        "ffmpeg_available": False,
        "model_configured": True,
        "model_exists": False,
        "ready": False,
    }


def test_resolve_audio_output_dir_uses_env_override(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("TTS_OUTPUT_DIR", str(tmp_path / "persistent-audio"))

    resolved = resolve_audio_output_dir()

    assert resolved == tmp_path / "persistent-audio"


def test_prepare_synthesis_plan_makes_segment_assembly_explicit(tmp_path: Path) -> None:
    provider = PiperSynthesisProvider(
        piper_bin="piper-bin",
        ffmpeg_bin="ffmpeg-bin",
        model_path=tmp_path / "test.onnx",
        output_dir=tmp_path,
    )

    plan = provider._prepare_synthesis_plan(
        [
            SegmentMetadata(text=f"Hello! {SMILING_FACE}", pause_ms=120, rate=1.25, pitch_hint=2.0),
            SegmentMetadata(text=":)", pause_ms=80, rate=1.0, pitch_hint=0.0),
            SegmentMetadata(text="How are you?", pause_ms=80, rate=0.8, pitch_hint=-2.0),
        ]
    )

    assert plan.total_pause_ms == 200
    assert len(plan.segments) == 2
    assert plan.segments[0].original_text == f"Hello! {SMILING_FACE}"
    assert plan.segments[0].spoken_text == "Hello!"
    assert plan.segments[0].length_scale == 0.8
    assert plan.segments[1].spoken_text == "How are you?"
    assert plan.segments[1].length_scale == 1.25


def test_piper_provider_invokes_cli_per_segment_and_strips_non_spoken_markers(
    monkeypatch,
    tmp_path: Path,
) -> None:
    calls: list[dict[str, object]] = []
    model_path = tmp_path / "test.onnx"
    model_path.write_bytes(b"model")

    def fake_run(command: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        command_name = Path(command[0]).name
        if command_name == "piper-bin":
            output_path = Path(command[command.index("--output_file") + 1])
            output_path.write_bytes(make_wav_bytes())
        elif command_name == "ffmpeg-bin":
            if "-f" in command and command[command.index("-f") + 1] == "concat":
                output_path = Path(command[-1])
                output_path.write_bytes(make_wav_bytes(duration_ms=200))
            else:
                output_path = Path(command[-1])
                input_path = Path(command[command.index("-i") + 1])
                output_path.write_bytes(input_path.read_bytes())
        calls.append({"command": command, **kwargs})
        return subprocess.CompletedProcess(command, 0, "", "")

    monkeypatch.setattr("app.providers.piper.subprocess.run", fake_run)
    monkeypatch.setattr(
        "app.providers.piper.shutil.which",
        lambda binary: f"/usr/bin/{binary}" if binary in {"piper-bin", "ffmpeg-bin"} else None,
    )

    provider = PiperSynthesisProvider(
        piper_bin="piper-bin",
        ffmpeg_bin="ffmpeg-bin",
        model_path=model_path,
        output_dir=tmp_path,
    )

    result = provider.synthesize(
        [
            SegmentMetadata(text=f"Hello! {SMILING_FACE}", pause_ms=120, rate=1.25, pitch_hint=2.0),
            SegmentMetadata(text=":)", pause_ms=80, rate=1.0, pitch_hint=0.0),
            SegmentMetadata(text="How are you?", pause_ms=80, rate=0.8, pitch_hint=-2.0),
        ]
    )

    piper_calls = [call for call in calls if Path(call["command"][0]).name == "piper-bin"]
    ffmpeg_calls = [call for call in calls if Path(call["command"][0]).name == "ffmpeg-bin"]

    assert result.received_segments == 3
    assert result.total_pause_ms == 200
    assert result.audio_url.startswith("/audio/")
    assert len(piper_calls) == 2
    assert piper_calls[0]["input"] == "Hello!"
    assert piper_calls[1]["input"] == "How are you?"
    assert "--length-scale" in piper_calls[0]["command"]
    assert piper_calls[0]["command"][piper_calls[0]["command"].index("--length-scale") + 1] == "0.800"
    assert piper_calls[1]["command"][piper_calls[1]["command"].index("--length-scale") + 1] == "1.250"
    assert any("asetrate=" in " ".join(call["command"]) for call in ffmpeg_calls)
    assert any("concat" in call["command"] for call in ffmpeg_calls)


def test_synthesize_serves_generated_wav_from_piper_provider(monkeypatch, tmp_path: Path) -> None:
    model_path = tmp_path / "test.onnx"
    model_path.write_bytes(b"model")

    def fake_run(command: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        command_name = Path(command[0]).name
        if command_name == "piper-bin":
            output_path = Path(command[command.index("--output_file") + 1])
            output_path.write_bytes(make_wav_bytes())
        elif command_name == "ffmpeg-bin":
            output_path = Path(command[-1])
            if "-f" in command and command[command.index("-f") + 1] == "concat":
                output_path.write_bytes(make_wav_bytes(duration_ms=150))
            else:
                input_path = Path(command[command.index("-i") + 1])
                output_path.write_bytes(input_path.read_bytes())
        return subprocess.CompletedProcess(command, 0, "", "")

    monkeypatch.setattr("app.providers.piper.subprocess.run", fake_run)
    monkeypatch.setattr(
        "app.providers.piper.shutil.which",
        lambda binary: f"/usr/bin/{binary}" if binary in {"piper-bin", "ffmpeg-bin"} else None,
    )

    provider = PiperSynthesisProvider(
        piper_bin="piper-bin",
        ffmpeg_bin="ffmpeg-bin",
        model_path=model_path,
        output_dir=resolve_audio_output_dir(),
    )
    app.state.synthesis_provider = provider

    payload = {
        "segments": [
            {
                "text": f"Hello! {SMILING_FACE}",
                "emotion": "happy",
                "intensity": 0.8,
                "pause_ms": 250,
                "rate": 1.18,
                "pitch_hint": 3.0,
                "cues": ["emoji:positive", "punctuation:exclamation"],
            }
        ]
    }

    audio_file: Path | None = None
    try:
        response = client.post("/synthesize", json=payload)
        assert response.status_code == 200

        body = response.json()
        assert body["received_segments"] == 1
        assert body["total_pause_ms"] == 250
        assert body["audio_url"].startswith("/audio/")

        audio_file = resolve_audio_output_dir() / Path(body["audio_url"]).name
        assert audio_file.exists()

        audio_response = client.get(body["audio_url"])
        assert audio_response.status_code == 200
        with wave.open(io.BytesIO(audio_response.content), "rb") as wav_file:
            assert wav_file.getnchannels() == 1
            assert wav_file.getframerate() == 22050
    finally:
        del app.state.synthesis_provider
        if audio_file is not None and audio_file.exists():
            audio_file.unlink()
