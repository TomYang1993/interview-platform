// ponytail: hand-maintained list; a question is attributed to a company by carrying
// its name as a tag (case-insensitive). Move to a real column if attribution grows.
export const COMPANIES = [
  'Meta', 'DoorDash', 'Netflix', 'Roblox', 'LinkedIn', 'TikTok', 'Pinterest',
  'Snowflake', 'Coinbase', 'Stripe', 'Google', 'Amazon', 'Microsoft',
  'Bloomberg', 'Uber', 'Anthropic', 'OpenAI',
] as const;

const byLower = new Map(COMPANIES.map((c) => [c.toLowerCase(), c]));

/** Splits a question's tags into recognised company names and everything else. */
export function splitCompanyTags(tags: string[]): { companies: string[]; topics: string[] } {
  const companies: string[] = [];
  const topics: string[] = [];
  for (const tag of tags) {
    const company = byLower.get(tag.trim().toLowerCase());
    if (company) companies.push(company);
    else topics.push(tag);
  }
  return { companies, topics };
}
