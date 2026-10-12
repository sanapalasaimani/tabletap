// Runtime Natural Language Processing (NLP) Sentiment & Aspect Analyzer

export interface NLPAnalysisResult {
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  emoji: '😊' | '😐' | '😞';
  score: number; // -1.0 to 1.0
  confidence: number; // 0 to 100%
  aspects: {
    food: 'Positive' | 'Negative' | 'Neutral' | 'Not Mentioned';
    service: 'Positive' | 'Negative' | 'Neutral' | 'Not Mentioned';
    speed: 'Fast' | 'Slow' | 'Normal' | 'Not Mentioned';
  };
  keyPhrases: string[];
  kitchenAlert: boolean;
  kitchenAlertReason?: string;
}

const POSITIVE_WORDS = [
  'delicious', 'tasty', 'amazing', 'great', 'excellent', 'superb', 'best', 
  'fresh', 'hot', 'crispy', 'flavourful', 'flavorful', 'wonderful', 'perfect', 
  'loved', 'good', 'quick', 'fast', 'friendly', 'courteous', 'awesome', 'yummy',
  'satisfying', 'top notch', 'mouthwatering', 'authentic', 'clean', 'polite'
];

const NEGATIVE_WORDS = [
  'terrible', 'bad', 'horrible', 'worst', 'stale', 'cold', 'salty', 'bland', 
  'burnt', 'undercooked', 'raw', 'tasteless', 'slow', 'delay', 'delayed', 
  'rude', 'dirty', 'poor', 'disappointed', 'disappointing', 'oily', 'greasy',
  'late', 'overcooked', 'inedible', 'waste', 'smelly', 'sour'
];

const KITCHEN_CRITICAL_KEYWORDS = [
  'cold', 'burnt', 'undercooked', 'raw', 'salty', 'too spicy', 'stale', 
  'hair', 'plastic', 'tasteless', 'inedible', 'sour', 'smelly'
];

export function analyzeReviewSentiment(text: string, starRating: number = 5): NLPAnalysisResult {
  if (!text || text.trim().length === 0) {
    const isHigh = starRating >= 4;
    const isLow = starRating <= 2;
    return {
      sentiment: isHigh ? 'Positive' : (isLow ? 'Negative' : 'Neutral'),
      emoji: isHigh ? '😊' : (isLow ? '😞' : '😐'),
      score: isHigh ? 0.8 : (isLow ? -0.8 : 0.0),
      confidence: 85,
      aspects: { food: 'Neutral', service: 'Neutral', speed: 'Normal' },
      keyPhrases: [`${starRating} Star Rating`],
      kitchenAlert: isLow,
      kitchenAlertReason: isLow ? `Customer gave low ${starRating}-star rating` : undefined
    };
  }

  const clean = text.toLowerCase();
  const words = clean.split(/\W+/).filter(w => w.length > 2);

  let positiveCount = 0;
  let negativeCount = 0;
  const keyPhrases: string[] = [];
  let kitchenAlert = false;
  let kitchenAlertReason: string | undefined = undefined;

  // Check critical kitchen warning triggers
  for (const crit of KITCHEN_CRITICAL_KEYWORDS) {
    if (clean.includes(crit)) {
      kitchenAlert = true;
      kitchenAlertReason = `Food issue reported: "${crit}"`;
      keyPhrases.push(`Issue: ${crit}`);
      negativeCount += 2; // heavier penalty
    }
  }

  words.forEach(w => {
    if (POSITIVE_WORDS.includes(w)) {
      positiveCount++;
      if (!keyPhrases.includes(w)) keyPhrases.push(w);
    }
    if (NEGATIVE_WORDS.includes(w)) {
      negativeCount++;
      if (!keyPhrases.includes(w)) keyPhrases.push(w);
    }
  });

  // Calculate sentiment score
  const totalMatches = positiveCount + negativeCount;
  let rawScore = 0;

  if (totalMatches > 0) {
    rawScore = (positiveCount - negativeCount) / totalMatches;
  } else {
    // Rely on star rating if no strong text markers
    rawScore = (starRating - 3) / 2; // maps 1..5 to -1..1
  }

  // Weight with star rating (60% text, 40% rating)
  const starScore = (starRating - 3) / 2;
  const finalScore = Number(((rawScore * 0.65) + (starScore * 0.35)).toFixed(2));

  let sentiment: 'Positive' | 'Neutral' | 'Negative' = 'Neutral';
  let emoji: '😊' | '😐' | '😞' = '😐';

  if (finalScore >= 0.2 || (starRating >= 4 && finalScore >= 0)) {
    sentiment = 'Positive';
    emoji = '😊';
  } else if (finalScore <= -0.2 || starRating <= 2) {
    sentiment = 'Negative';
    emoji = '😞';
    if (!kitchenAlert && starRating <= 2) {
      kitchenAlert = true;
      kitchenAlertReason = `Low rating alert: ${starRating} stars`;
    }
  } else {
    sentiment = 'Neutral';
    emoji = '😐';
  }

  const confidence = Math.min(99, Math.max(65, Math.round(50 + Math.abs(finalScore) * 50)));

  // Aspect Detection
  let foodAspect: NLPAnalysisResult['aspects']['food'] = 'Not Mentioned';
  if (clean.includes('food') || clean.includes('taste') || clean.includes('dish') || clean.includes('biryani') || clean.includes('paneer') || clean.includes('dosa')) {
    foodAspect = sentiment === 'Positive' ? 'Positive' : (sentiment === 'Negative' ? 'Negative' : 'Neutral');
  }

  let serviceAspect: NLPAnalysisResult['aspects']['service'] = 'Not Mentioned';
  if (clean.includes('waiter') || clean.includes('staff') || clean.includes('service') || clean.includes('behavior')) {
    serviceAspect = sentiment === 'Positive' ? 'Positive' : (sentiment === 'Negative' ? 'Negative' : 'Neutral');
  }

  let speedAspect: NLPAnalysisResult['aspects']['speed'] = 'Not Mentioned';
  if (clean.includes('fast') || clean.includes('quick') || clean.includes('prompt')) {
    speedAspect = 'Fast';
  } else if (clean.includes('slow') || clean.includes('delay') || clean.includes('late') || clean.includes('wait')) {
    speedAspect = 'Slow';
  }

  return {
    sentiment,
    emoji,
    score: finalScore,
    confidence,
    aspects: {
      food: foodAspect,
      service: serviceAspect,
      speed: speedAspect
    },
    keyPhrases: keyPhrases.slice(0, 4),
    kitchenAlert,
    kitchenAlertReason
  };
}
