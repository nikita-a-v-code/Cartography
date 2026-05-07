/**
 * addressNormalizer.ts — Нормализация адресов для улучшения качества геокодирования
 *
 * Геокодеры (особенно Nominatim/OSM) плохо справляются с типичными
 * русскими сокращениями в адресах: "г. Киров, ул. Ленина, д. 5, кв. 12".
 * После нормализации: "Киров, Ленина, 5"  — геокодер находит точнее.
 *
 * Стратегия: удаляем ВСЁ лишнее.
 * Квартиры, корпуса, строения — они только мешают поиску здания на карте.
 */

export function normalizeAddress(address: string): string {
  let normalized = address;

  // ─── Типы населённых пунктов (сокращения с точкой) ───────────────────────────
  // Убираем "г. Киров" → "Киров", "пос. Стрижи" → "Стрижи" и т.д.
  // Регекс: сокращение + точка + один или более пробелов
  normalized = normalized.replace(/г\.\s+/g, '');
  normalized = normalized.replace(/гор\.\s+/g, '');
  normalized = normalized.replace(/пгт\.\s+/g, '');
  normalized = normalized.replace(/п\.г\.т\.\s+/g, '');
  normalized = normalized.replace(/пос\.\s+/g, '');
  normalized = normalized.replace(/с\.\s+/g, '');
  normalized = normalized.replace(/д\.\s+/g, '');
  normalized = normalized.replace(/дер\.\s+/g, '');
  normalized = normalized.replace(/рп\.\s+/g, '');
  normalized = normalized.replace(/р\.п\.\s+/g, '');

  // ─── Типы населённых пунктов (полные слова) ───────────────────────────────────
  // "город Киров" → "Киров", "деревня Чистые Пруды" → "Чистые Пруды"
  normalized = normalized.replace(/город\s+/gi, '');
  normalized = normalized.replace(/посёлок\s+/gi, '');
  normalized = normalized.replace(/поселок\s+/gi, '');
  normalized = normalized.replace(/село\s+/gi, '');
  normalized = normalized.replace(/деревня\s+/gi, '');

  // ─── Типы улиц (сокращения с точкой) ─────────────────────────────────────────
  // "ул. Ленина" → "Ленина", "пр. Октябрьский" → "Октябрьский"
  // Используем \s* (0 или более пробелов) — бывает "ул.Ленина" без пробела
  normalized = normalized.replace(/ул\.\s*/g, '');
  normalized = normalized.replace(/пр\.\s*/g, '');
  normalized = normalized.replace(/просп\.\s*/g, '');
  normalized = normalized.replace(/пер\.\s*/g, '');
  normalized = normalized.replace(/б-р\.\s*/g, '');
  normalized = normalized.replace(/бул\.\s*/g, '');
  normalized = normalized.replace(/наб\.\s*/g, '');
  normalized = normalized.replace(/пл\.\s*/g, '');
  normalized = normalized.replace(/ш\.\s*/g, '');
  normalized = normalized.replace(/туп\.\s*/g, '');
  normalized = normalized.replace(/мкр\.\s*/g, '');

  // ─── Типы улиц (полные слова) ─────────────────────────────────────────────────
  normalized = normalized.replace(/улица\s+/gi, '');
  normalized = normalized.replace(/проспект\s+/gi, '');
  normalized = normalized.replace(/переулок\s+/gi, '');
  normalized = normalized.replace(/бульвар\s+/gi, '');
  normalized = normalized.replace(/набережная\s+/gi, '');
  normalized = normalized.replace(/площадь\s+/gi, '');
  normalized = normalized.replace(/шоссе\s+/gi, '');
  normalized = normalized.replace(/тупик\s+/gi, '');
  normalized = normalized.replace(/квартал\s+/gi, '');
  normalized = normalized.replace(/кв-л\s+/gi, '');
  normalized = normalized.replace(/микрорайон\s+/gi, '');

  // ─── Обозначение домового номера ─────────────────────────────────────────────
  // "дом 5" → ", 5" (заменяем на запятую + пробел, чтобы не слиплось с предыдущим)
  normalized = normalized.replace(/,?\s*дом\s+/gi, ', ');

  // ─── Квартиры — полностью удаляем вместе с номером ───────────────────────────
  // Квартира не нужна для геолокации — нам важен только дом
  // Варианты: "кв. 12", "квартира 12", "кв 12"
  normalized = normalized.replace(/,?\s*кв\.\s*\d+/gi, '');
  normalized = normalized.replace(/,?\s*квартира\s*\d+/gi, '');
  normalized = normalized.replace(/,?\s*кв\s+\d+/gi, '');

  // ─── Корпуса, строения, боксы — тоже удаляем ─────────────────────────────────
  // Они уточняют конкретный подъезд/блок, но геокодер их не знает
  normalized = normalized.replace(/,?\s*корп\.\s*\w*/gi, '');
  normalized = normalized.replace(/,?\s*корпус\s*\w*/gi, '');
  normalized = normalized.replace(/,?\s*стр\.\s*\w*/gi, '');
  normalized = normalized.replace(/,?\s*строение\s*\w*/gi, '');
  normalized = normalized.replace(/,?\s*гаражный\s*бокс\s*\d*/gi, '');
  normalized = normalized.replace(/,?\s*бокс\s*\d*/gi, '');

  // ─── Финальная очистка ────────────────────────────────────────────────────────
  normalized = normalized.replace(/,\s*,/g, ',');   // двойные запятые → одна
  normalized = normalized.replace(/\s+/g, ' ');      // множественные пробелы → один
  normalized = normalized.replace(/,\s*$/g, '');     // запятая в конце строки
  normalized = normalized.replace(/^\s*,\s*/g, '');  // запятая в начале строки
  normalized = normalized.trim();

  return normalized;
}
