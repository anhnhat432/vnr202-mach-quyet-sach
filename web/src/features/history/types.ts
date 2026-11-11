import type { HistoryPeriod } from "./domain";

export type HistorySource = {
  title: string;
  publisher: string;
  url: string;
  scope: string;
  checkedAt: string;
};

export type HistoryImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  credit: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
};

export type HistoryVideo = {
  title: string;
  youtubeId: string;
  publisher: string;
  sourceUrl: string;
  checkedAt: string;
};

export type HistoryEvent = {
  id: string;
  date: string;
  dateLabel: string;
  period: HistoryPeriod;
  title: string;
  location: string;
  people: string[];
  summary: string;
  context: string[];
  keyDevelopments: string[];
  significance: string[];
  keywords: string[];
  takeaway: string;
  remember: string;
  textbookChapter: 1 | 2 | 3;
  images: HistoryImage[];
  videos: HistoryVideo[];
  sources: HistorySource[];
  quiz: { question: string; options: string[]; answer: number; explanation: string }[];
};
