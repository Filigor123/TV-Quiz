# Локальная подготовка медиа

Скрипт помогает найти публичные видео YouTube, загрузить доступный URL, сделать расшифровку с таймкодами, вырезать фрагмент и извлечь кадр. Он не распознаёт автоматически фильм, мем, песню или исполнителя: найденный результат проверяет человек. Для вопросов, которые попадут в публичную игру, отдельно проверьте права на файл и отсутствие подсказки с ответом.

## Окружение

Для текущей локальной установки среда хранится в `H:\TV-Quiz\.local-tools\media-13`; модели и временные исходники также остаются на H: и не входят в Git. Установленные версии: Python 3.13.17, yt-dlp 2026.10.26, faster-whisper 1.2.1, CTranslate2 4.9.0, PyAV 18.1.0, imageio-ffmpeg 0.8.1 (FFmpeg 9.0.2). PyAV зафиксирован ниже 19 из-за несовместимого аргумента в faster-whisper 1.2.1. Whisper `small` инициализирована на CPU с `int8`.

Если Python уже установлен, создайте отдельное виртуальное окружение на диске с достаточным местом и установите зависимости:

```powershell
$env:TVQUIZ_MEDIA_HOME = 'H:\TV-Quiz\.local-tools\media-13'
python -m venv "$env:TVQUIZ_MEDIA_HOME\venv"
& "$env:TVQUIZ_MEDIA_HOME\venv\Scripts\python.exe" -m pip install -r .\scripts\requirements-media.txt
```

Задайте путь к каталогу кэша модели через `TVQUIZ_MEDIA_HOME`. В этой установке используется portable Python вместо системного; запускайте скрипт этим же `python.exe` из каталога `python`.

## Команды

Все примеры запускаются из корня репозитория. Создайте `sources` локально или укажите собственный временный каталог; не добавляйте исходные полные видео, кэш модели, cookies и секреты в Git.

```powershell
$env:TVQUIZ_MEDIA_HOME = 'H:\TV-Quiz\.local-tools\media-13'
$py = "$env:TVQUIZ_MEDIA_HOME\python\python.exe"
$work = 'H:\TV-Quiz\.local-tools\media-13\sources'

# Поиск пяти кандидатов; сохраняет ID, название, длительность и URL в терминал.
& $py .\scripts\media_pipeline.py search 'короткий мемный фрагмент' --limit 5

# Загрузите только доступный публичный источник, найденный вами ранее.
# В имени локального файла не используется заголовок источника.
& $py .\scripts\media_pipeline.py fetch 'https://example.org/public-clip' --output "$work\sample"
& $py .\scripts\media_pipeline.py fetch 'https://example.org/public-audio' --audio --output "$work\sample-audio"

# Русская расшифровка small с таймкодами; для определения языка укажите --language auto.
& $py .\scripts\media_pipeline.py transcribe "$work\sample-audio.mp3" --language ru

# Извлечение короткого фрагмента и одного кадра.
& $py .\scripts\media_pipeline.py clip "$work\sample.mp4" --start 12.5 --duration 10 --output "$work\quiz-clip.mp4"
& $py .\scripts\media_pipeline.py clip "$work\sample.mp4" --start 12.5 --duration 10 --audio --output "$work\quiz-audio.mp3"
& $py .\scripts\media_pipeline.py frame "$work\sample.mp4" --at 15 --output "$work\frame.jpg"
```

`fetch` принимает отдельный URL и не импортирует cookies браузера. Скрипт не обходит DRM, paywall или закрытый доступ. Ошибки доступа означают, что этот источник не подходит; найдите другой открытый источник и сохраните причину замены в редакторском реестре.

Для каждого кандидата в редакторском реестре укажите ID, прямой URL и страницу источника, название, таймкод, формулировку вопроса, правильный ответ, путь и статус проверки. Расшифровка и исходное имя файла могут содержать ответ: храните их только локально и никогда не подключайте к экрану игроков. Случайную выдачу допускайте только после проверки соответствия клипа вопросу, таймкода, ответа и прав на распространение.
