export type PitchFacts = {
  clientName: string;
  projectTitle: string;
  location: string;
  wallDimensions: string;
  timeline: string;
  budget: string;
  notes: string;
};

export function pitchFactsText(facts: PitchFacts): string {
  return Object.entries(facts)
    .filter(([, value]) => value.trim())
    .map(([key, value]) => `${key}: ${value.trim()}`)
    .join("\n");
}

export function emailDraftBlob(to: string, subject: string, body: string): Blob {
  const clean = (s: string) => s.replace(/[\r\n]/g, " ");
  return new Blob([
    `To: ${clean(to)}\r\nSubject: ${clean(subject)}\r\nX-Unsent: 1\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`,
  ], { type: "message/rfc822" });
}

export function mailtoDraft(to: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}