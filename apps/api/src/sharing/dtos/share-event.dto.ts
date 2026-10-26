import { IsIn } from 'class-validator';

export const VISITOR_EVENT_KINDS = ['offer', 'quote_sent'] as const;
export type TVisitorEventKind = (typeof VISITOR_EVENT_KINDS)[number];

/** The body of a visitor's event: the kind only. Anything else is refused, so no content can be sent along. */
export class VisitorEventDto {
  @IsIn(VISITOR_EVENT_KINDS)
  kind!: TVisitorEventKind;
}

export const LIST_VISITOR_EVENT_KINDS = ['offer', 'buy'] as const;
export type TListVisitorEventKind = (typeof LIST_VISITOR_EVENT_KINDS)[number];

/** The body of a visitor's event on a shared list: the kind only, so no content can be sent along. */
export class ListVisitorEventDto {
  @IsIn(LIST_VISITOR_EVENT_KINDS)
  kind!: TListVisitorEventKind;
}
