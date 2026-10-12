interface IComposerDraft {
  readonly text: string;
  readonly error: string;
}

const drafts = new Map<string, IComposerDraft>();

export function keepComposerDraft(conversationId: string, draft: IComposerDraft): void {
  drafts.set(conversationId, draft);
}

export function takeComposerDraft(conversationId: string | null): IComposerDraft | null {
  if (conversationId === null) return null;
  const draft = drafts.get(conversationId) ?? null;
  drafts.delete(conversationId);
  return draft;
}
