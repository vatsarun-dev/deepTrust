function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function splitText(text, maxWords = 150, overlapWords = 30) {
  const words = clean(text).split(" ").filter(Boolean);
  if (!words.length) return [];

  const chunks = [];
  const step = Math.max(1, maxWords - overlapWords);
  for (let start = 0; start < words.length; start += step) {
    const slice = words.slice(start, start + maxWords);
    if (!slice.length) break;
    chunks.push(slice.join(" "));
    if (start + maxWords >= words.length) break;
  }
  return chunks;
}

function chunkEvidence(documents = []) {
  return documents.flatMap((document) => {
    const text = [document.title, document.description, document.content].filter(Boolean).join(". ");
    const sections = splitText(text);
    return (sections.length ? sections : [document.title]).map((chunkText, index) => ({
      id: `${document.id}-C${index + 1}`,
      documentId: document.id,
      chunkIndex: index,
      text: chunkText,
      title: document.title,
      sourceName: document.sourceName,
      url: document.url,
      publishedAt: document.publishedAt,
      retrievedAt: document.retrievedAt,
      author: document.author,
      sourceQuality: document.sourceQuality,
    }));
  });
}

module.exports = {
  chunkEvidence,
};
