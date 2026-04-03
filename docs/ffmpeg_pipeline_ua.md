# FFmpeg Pipeline

## Поточний стан

У поточній реалізації ffmpeg ще не бере участі в реальному synthesis pipeline.

Що вже є:

- `docker-compose.yml` містить env var `FFMPEG_BIN`
- `tts-adapter` conceptual layer допускає подальше підключення real synthesis/post-processing providers
- документація і структура сервісу вже відокремлюють adapter boundary від gateway logic

Що зараз відсутнє:

- реальний виклик ffmpeg у `tts-adapter`
- audio post-processing pipeline
- format conversion на рівні Python adapter service
- повернення справжнього згенерованого файла замість placeholder URL

## Чому документ важливий зараз

Цей документ фіксує, що ffmpeg у проекті є як майбутня integration point, але не як завершена частина runtime pipeline.

Тобто:

- `format` проходить через public gateway contract
- `tts-adapter` уже має clean integration boundary
- actual ffmpeg processing поки не імплементований

## Поточний next step для ffmpeg integration

Коли synthesis стане не-placeholder, ffmpeg логічно підключати в provider implementation або в окремий post-processing layer усередині `tts-adapter`, а не в endpoint logic.
