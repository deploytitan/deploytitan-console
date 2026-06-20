import { helpArticles, type HelpArticle } from "./content";

function normalize(text: string) {
  return text.toLowerCase().trim();
}

export function listHelpArticles() {
  return helpArticles.map(({ slug, title, summary, keywords }) => ({
    slug,
    title,
    summary,
    keywords,
  }));
}

export function getHelpArticle(slug: string): HelpArticle | null {
  return helpArticles.find((article) => article.slug === slug) ?? null;
}

export function searchHelpArticles(query: string) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return helpArticles;
  }

  return [...helpArticles]
    .map((article) => {
      const haystack = normalize(
        [article.title, article.summary, article.body, ...article.keywords].join(" "),
      );
      const score = normalizedQuery
        .split(/\s+/)
        .reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
      return { article, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.article);
}
