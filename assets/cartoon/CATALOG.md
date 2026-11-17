# Мультяшные анимированные спрайты

20 новых изображений созданы отдельными задачами субагентов встроенным ImageGen. Сохранены исходные PNG и точные промпты. Это 18 спрайт-листов со 168 кадрами и 2 статичных изображения (фон и замок).

У 12 персонажей: кадры 0–3 — ходьба или полёт, 4–7 — атака, 8–11 — падение и положение на земле. У 6 построек: ожидание, подготовка, срабатывание, возврат. В игре смерть проигрывается до последнего кадра, останки немного задерживаются и затухают. Анимации замедляются вместе с врагами и останавливаются на паузе.

| Вид | Кадров | Оригинал | Точный запрос |
| --- | --- | --- | --- |
| Фон долины | 1 | [PNG](/home/rest/ai/proj/td/assets/cartoon/originals/background.png) | [Промпт](/home/rest/ai/proj/td/assets/cartoon/prompts/background.txt) |
| Замок | 1 | [PNG](/home/rest/ai/proj/td/assets/cartoon/originals/castle.png) | [Промпт](/home/rest/ai/proj/td/assets/cartoon/prompts/castle.txt) |
| Лучная башня | 4 | [PNG](/home/rest/ai/proj/td/assets/cartoon/originals/archer.png) | [Промпт](/home/rest/ai/proj/td/assets/cartoon/prompts/archer.txt) |
| Мортира | 4 | [PNG](/home/rest/ai/proj/td/assets/cartoon/originals/mortar.png) | [Промпт](/home/rest/ai/proj/td/assets/cartoon/prompts/mortar.txt) |
| Ледяной обелиск | 4 | [PNG](/home/rest/ai/proj/td/assets/cartoon/originals/frost.png) | [Промпт](/home/rest/ai/proj/td/assets/cartoon/prompts/frost.txt) |
| Казарма | 4 | [PNG](/home/rest/ai/proj/td/assets/cartoon/originals/barracks.png) | [Промпт](/home/rest/ai/proj/td/assets/cartoon/prompts/barracks.txt) |
| Арканная башня | 4 | [PNG](/home/rest/ai/proj/td/assets/cartoon/originals/arcane.png) | [Промпт](/home/rest/ai/proj/td/assets/cartoon/prompts/arcane.txt) |
| Рунная ловушка | 4 | [PNG](/home/rest/ai/proj/td/assets/cartoon/originals/trap.png) | [Промпт](/home/rest/ai/proj/td/assets/cartoon/prompts/trap.txt) |
| Налётчик | 12 | [PNG](/home/rest/ai/proj/td/assets/cartoon/originals/raider.png) | [Промпт](/home/rest/ai/proj/td/assets/cartoon/prompts/raider.txt) |
| Волкоскок | 12 | [PNG](/home/rest/ai/proj/td/assets/cartoon/originals/runner.png) | [Промпт](/home/rest/ai/proj/td/assets/cartoon/prompts/runner.txt) |
| Чёрный рыцарь | 12 | [PNG](/home/rest/ai/proj/td/assets/cartoon/originals/knight.png) | [Промпт](/home/rest/ai/proj/td/assets/cartoon/prompts/knight.txt) |
| Шаман | 12 | [PNG](/home/rest/ai/proj/td/assets/cartoon/originals/shaman.png) | [Промпт](/home/rest/ai/proj/td/assets/cartoon/prompts/shaman.txt) |
| Призрак | 12 | [PNG](/home/rest/ai/proj/td/assets/cartoon/originals/wraith.png) | [Промпт](/home/rest/ai/proj/td/assets/cartoon/prompts/wraith.txt) |
| Голем | 12 | [PNG](/home/rest/ai/proj/td/assets/cartoon/originals/golem.png) | [Промпт](/home/rest/ai/proj/td/assets/cartoon/prompts/golem.txt) |
| Молодой дракон | 12 | [PNG](/home/rest/ai/proj/td/assets/cartoon/originals/dragon.png) | [Промпт](/home/rest/ai/proj/td/assets/cartoon/prompts/dragon.txt) |
| Огр | 12 | [PNG](/home/rest/ai/proj/td/assets/cartoon/originals/boss5.png) | [Промпт](/home/rest/ai/proj/td/assets/cartoon/prompts/boss5.txt) |
| Ледяной великан | 12 | [PNG](/home/rest/ai/proj/td/assets/cartoon/originals/boss10.png) | [Промпт](/home/rest/ai/proj/td/assets/cartoon/prompts/boss10.txt) |
| Теневой дракон | 12 | [PNG](/home/rest/ai/proj/td/assets/cartoon/originals/boss15.png) | [Промпт](/home/rest/ai/proj/td/assets/cartoon/prompts/boss15.txt) |
| Король Пепла | 12 | [PNG](/home/rest/ai/proj/td/assets/cartoon/originals/boss20.png) | [Промпт](/home/rest/ai/proj/td/assets/cartoon/prompts/boss20.txt) |
| Страж | 12 | [PNG](/home/rest/ai/proj/td/assets/cartoon/originals/guard.png) | [Промпт](/home/rest/ai/proj/td/assets/cartoon/prompts/guard.txt) |

`optimized/` содержит выровненные WebP-постеры и атласы; оригиналы сохранены без изменений. `pack.py` упаковывает их, а `animation.js` выбирает и отрисовывает кадры. Все данные встроены в `index.html`, внешние файлы для запуска не требуются.

Художественное направление — [STYLE.md](/home/rest/ai/proj/td/assets/cartoon/STYLE.md). В игровом атласе доступны переключатели «Движение», «Атака», «Смерть».


Обновление фона: встроенным ImageGen отредактирована палитра и умеренно добавлена структура луга. Активный фон — `originals/background.png`, точный запрос — `prompts/background-muted.txt` (также скопирован в `prompts/background.txt`). Версионная копия — `revisions/background-muted.png`; прежний яркий фон и его промпт сохранены в `archive/background-bright-v1.*`. Дополнительные небольшие кусты, камни и травяные пучки рисуются при подготовке игрового поля, с отступами от дороги и всех площадок.
