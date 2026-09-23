import { buildPitchSlides } from '../lib/pitch';
import type {
  DistrictProjection,
  Measure,
  PitchSlideData,
} from '../types';

interface GeneratePitchInput {
  selectedMeasures: Measure[];
  projections: DistrictProjection[];
  spent: number;
  analysisMarkdown: string;
}

function isPitchSlide(value: unknown): value is PitchSlideData {
  if (!value || typeof value !== 'object') return false;
  const slide = value as Partial<PitchSlideData>;
  return Boolean(
    typeof slide.id === 'string' &&
      typeof slide.eyebrow === 'string' &&
      typeof slide.title === 'string' &&
      Array.isArray(slide.bullets) &&
      slide.bullets.every((item) => typeof item === 'string') &&
      typeof slide.speakerNotes === 'string' &&
      ['ink', 'mint', 'amber', 'blue'].includes(slide.tone ?? ''),
  );
}

function validateDeck(value: unknown): PitchSlideData[] {
  const slides =
    value && typeof value === 'object' && 'slides' in value
      ? (value as { slides?: unknown }).slides
      : value;
  if (!Array.isArray(slides) || slides.length < 3 || slides.length > 4) {
    throw new Error('AI должен вернуть от 3 до 4 слайдов.');
  }
  if (!slides.every(isPitchSlide)) {
    throw new Error('Структура одного из слайдов не прошла проверку.');
  }
  return slides;
}

export async function generatePitchDeck(
  input: GeneratePitchInput,
): Promise<PitchSlideData[]> {
  if (import.meta.env.VITE_ANALYSIS_MODE !== 'api') {
    await new Promise((resolve) => window.setTimeout(resolve, 720));
    return buildPitchSlides(input);
  }

  const response = await fetch('/api/ai/pitch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      decisionIds: input.selectedMeasures.map((measure) => measure.id),
      analysisMarkdown: input.analysisMarkdown,
      locale: 'ru-KZ',
      minSlides: 3,
      maxSlides: 4,
    }),
  });

  if (!response.ok) {
    throw new Error(`Сервис питча вернул HTTP ${response.status}.`);
  }

  return validateDeck(await response.json());
}
