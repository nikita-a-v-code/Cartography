/**
 * Модуль нормализации адресов для улучшения геокодирования
 * Убирает типичные русские префиксы и сокращения
 */

export function normalizeAddress(address: string): string {
  let normalized = address;

  // Типы населённых пунктов (с точкой)
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

  // Типы населённых пунктов (слова)
  normalized = normalized.replace(/город\s+/gi, '');
  normalized = normalized.replace(/посёлок\s+/gi, '');
  normalized = normalized.replace(/поселок\s+/gi, '');
  normalized = normalized.replace(/село\s+/gi, '');
  normalized = normalized.replace(/деревня\s+/gi, '');

  // Типы улиц (с точкой)
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

  // Типы улиц (слова)
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

  // Обозначения домов
  normalized = normalized.replace(/,?\s*дом\s+/gi, ', ');

  // Удаляем квартиры полностью (с номером)
  normalized = normalized.replace(/,?\s*кв\.\s*\d+/gi, '');
  normalized = normalized.replace(/,?\s*квартира\s*\d+/gi, '');
  normalized = normalized.replace(/,?\s*кв\s+\d+/gi, '');

  // Удаляем корпуса, строения, боксы
  normalized = normalized.replace(/,?\s*корп\.\s*\w*/gi, '');
  normalized = normalized.replace(/,?\s*корпус\s*\w*/gi, '');
  normalized = normalized.replace(/,?\s*стр\.\s*\w*/gi, '');
  normalized = normalized.replace(/,?\s*строение\s*\w*/gi, '');
  normalized = normalized.replace(/,?\s*гаражный\s*бокс\s*\d*/gi, '');
  normalized = normalized.replace(/,?\s*бокс\s*\d*/gi, '');

  // Убираем лишние запятые и пробелы
  normalized = normalized.replace(/,\s*,/g, ',');
  normalized = normalized.replace(/\s+/g, ' ');
  normalized = normalized.replace(/,\s*$/g, '');
  normalized = normalized.replace(/^\s*,\s*/g, '');
  normalized = normalized.trim();

  return normalized;
}
