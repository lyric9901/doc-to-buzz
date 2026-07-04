export const INTERESTS = [
  "Anime", "K-pop", "Bollywood", "Indie music", "Hip-hop", "EDM",
  "Cricket", "Football", "F1", "Gaming", "Valorant", "BGMI",
  "Coding", "Startups", "Crypto", "AI", "Design", "Photography",
  "Fashion", "Streetwear", "Skincare", "Foodie", "Cafe hopping", "Traveling",
  "Reading", "Poetry", "Memes", "Movies", "Netflix", "Standup",
  "Astrology", "Meditation", "Gym", "Yoga", "Running", "Dance",
] as const;

export type Interest = (typeof INTERESTS)[number];
