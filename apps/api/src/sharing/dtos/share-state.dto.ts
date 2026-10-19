export interface IShareState {
  url: string | null;
  token: string | null;
  showContact: boolean;
}

export interface ICreatedShare {
  url: string;
  token: string;
}
