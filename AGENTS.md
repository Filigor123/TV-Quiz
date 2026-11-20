# Работа над TV Quiz

## Общая очередь задач
Источник согласованных задач — GitHub Issues репозитория Filigor123/TV-Quiz.
Перед началом работы, после завершения текущей задачи и перед выбором следующей проверяй открытые Issues и новые комментарии к текущей задаче через доступный GitHub инструмент или gh.
Не считай переписку в другом чате автоматически доступной.

1. Сначала проверь локальные инструкции, git status, текущую ветку и незавершённую работу. Локальные изменения пользователя не затирай. Не прерывай текущую реализацию ради нового issue без явного указания.
2. Читай полное описание задачи и комментарии. Соблюдай явные зависимости и приоритеты. Текущая последовательность: завершить уже начатую работу; каталог #2; квиз по сленгу #3 с учётом архитектурных решений #1. #1 содержит аудит и общий план, а не требование сразу реализовать всё.
3. Перед началом оставь краткий комментарий в issue: что берёшь в работу, затрагиваемые части и критерии готовности. Проверь, не выполняет ли эту задачу другой агент.
4. Реализуй в отдельной ветке, проводи необходимые проверки. Успешные проверки не повторяй без новых изменений или нерешённой причины.
5. После локальных проверок обязательно сделай git commit и git push в удалённую ветку GitHub, затем создай или обнови PR со ссылкой на issue, результатами проверок и ограничениями. Не оставляй готовые изменения только на диске H. Если push невозможен, явно сообщи причину и команды для исправления.
6. Для небольших безопасных изменений разрешено самостоятельно объединять PR в main только если все доступные автоматические проверки прошли, нет конфликтов, незавершённых зависимостей и замечаний, а изменение не затрагивает критические сценарии подключения игроков, подсчёта очков, хранения данных и деплоя. Не сливай PR, который требует дополнительного ручного review или проверки; для крупных изменений и изменений критических сценариев обязательно запроси подтверждение на merge. После merge проверь результат публикации GitHub Pages и сообщи точную ссылку. Если проверки отсутствуют, публикация не подтверждена или функциональность не проверена на нужных устройствах, не объявляй её готовой: оставь PR и сообщи, что требуется проверить.
7. В конце каждой сессии сообщай: локальная ветка, commit SHA, push выполнен или нет, ссылка и статус PR, попали ли изменения в main, доступна ли обновлённая версия сайта. Не заявляй о публикации без проверки.
8. После выполнения разрешённого объёма проверь очередь снова. Не начинай зависимую задачу, если ей нужен ещё не принятый результат предыдущей. При блокировке сообщи конкретную причину в issue.
9. Если GitHub недоступен, сообщи об этом; не выдумывай задачи, комментарии или статусы. Если локальный AGENTS.md уже содержит дополнительные инструкции, сохрани их при синхронизации, объедини без потери правил.

## Границы автоматизации
Эти инструкции действуют в запущенной сессии агента. Они не запускают приложение Codex, не пробуждают остановленную сессию и не обеспечивают фоновую проверку GitHub.
Новые согласованные идеи оформляются отдельными Issues; существующие задачи дополняются без создания дублей.

---

# Repository Guidelines

## Project Structure

This is a small, static Russian-language multiplayer quiz with no build system. `index.html` contains the host setup, lobby, game UI, styles, and host-side JavaScript. `join.html` is the player-facing join and answer screen. `questions.js` defines the question bank as `window.QUIZ_QUESTIONS`. `README.md` is a brief project description. There are currently no separate source, asset, or test directories; keep additions at the root unless the project grows enough to justify grouping them.

## Build, Run, and Development

There are no package scripts or compilation steps. For local UI work, open `index.html` and `join.html` in a modern browser. To exercise multiplayer flows, serve the directory over HTTP (for example, `python -m http.server 8000`) and open the host page and its generated join link on separate browser sessions/devices. PeerJS and QRCode.js load from public CDNs, so those features require network access.

## Coding Style & Naming

Use plain HTML, CSS, and browser JavaScript; avoid adding a framework or dependency without a clear need. Match the existing Russian UI copy and preserve mobile-friendly layouts. Use descriptive camelCase names for JavaScript variables/functions, kebab-case for CSS classes, and stable IDs for DOM hooks. Keep question records consistent with the existing fields: `category`, `topic`, `difficulty`, `text`, `answers`, `correct`, and `explanation`; `correct` is a zero-based answer index. The existing pages are compact and largely inline; when editing, keep related markup/styles/scripts together and format new or substantially revised code for readability.

## Testing Guidelines

Для релиза достаточно общих проверок браузерного сценария и опубликованной версии. Отдельные прогоны на физических LG и iPhone не входят в критерии готовности. Проверяем конкретное устройство, когда есть сообщение о проблеме на нём.

No automated test framework or coverage requirement is configured. After changes, manually check host setup through room creation, player joining/readiness, answering, and results, as applicable. Check `join.html` at a narrow mobile width. For question-bank edits, verify that every question has four answers and a valid `correct` index, and that category/topic/difficulty values match the selectors in `index.html`.

## Commits & Pull Requests

Git metadata is not present in this checkout, so repository-specific commit conventions could not be confirmed. Use short imperative commit subjects (for example, `Add science quiz questions`). Pull requests should summarize the user-visible change, list manual checks performed, link related issues when available, and include screenshots for visual changes.

## Configuration & Safety

The app currently depends on public CDN scripts for PeerJS and QRCode.js. Do not commit secrets or private connection details. Escape player-provided text before inserting it into HTML, following the existing `escapeHtml`/`safe` helpers.
