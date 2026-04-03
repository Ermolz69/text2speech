from __future__ import annotations

import subprocess
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.models.segment import SegmentMetadata
from app.providers.piper import PiperSynthesisProvider, resolve_audio_output_dir

client = TestClient(app, raise_server_exceptions=False)


WAV_BYTES = b"RIFF\x24\x00\x00\x00WAVEfmt "


def test_piper_provider_invokes_cli_and_returns_generated_audio_url(
    monkeypatch,
    tmp_path: Path,
) -> None:
    calls: list[dict[str, object]] = []

    def fake_run(command: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        output_path = Path(command[command.index("--output_file") + 1])
        output_path.write_bytes(WAV_BYTES)
        calls.append({"command": command, **kwargs})
        return subprocess.CompletedProcess(command, 0, "", "")

    monkeypatch.setattr("app.providers.piper.subprocess.run", fake_run)

    provider = PiperSynthesisProvider(
        piper_bin="piper-bin",
        model_path="/models/test.onnx",
        output_dir=tmp_path,
    )

    result = provider.synthesize(
        [
            SegmentMetadata(text="Hello!", pause_ms=120),
            SegmentMetadata(text="How are you?", pause_ms=80),
        ]
    )

    assert result.received_segments == 2
    assert result.total_pause_ms == 200
    assert result.audio_url.startswith("/audio/")
    assert result.audio_url.endswith(".wav")
    assert calls == [
        {
            "command": calls[0]["command"],
            "input": "Hello! How are you?",
            "text": True,
            "capture_output": True,
            "check": True,
        }
    ]
    assert calls[0]["command"][:3] == ["piper-bin", "--model", "/models/test.onnx"]


def test_synthesize_serves_generated_wav_from_piper_provider(monkeypatch) -> None:
    def fake_run(command: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        output_path = Path(command[command.index("--output_file") + 1])
        output_path.write_bytes(WAV_BYTES)
        return subprocess.CompletedProcess(command, 0, "", "")

    monkeypatch.setattr("app.providers.piper.subprocess.run", fake_run)

    provider = PiperSynthesisProvider(
        piper_bin="piper-bin",
        model_path="/models/test.onnx",
        output_dir=resolve_audio_output_dir(),
    )
    app.state.synthesis_provider = provider

    payload = {
        "segments": [
            {
                "text": "Hello! :)",
                "emotion": "happy",
                "intensity": 0.8,
                "pause_ms": 250,
                "rate": 1.1,
                "pitch_hint": 2.0,
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
        assert audio_response.content == WAV_BYTES
    finally:
        del app.state.synthesis_provider
        if audio_file is not None and audio_file.exists():
            audio_file.unlink()
