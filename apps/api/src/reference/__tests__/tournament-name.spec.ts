import { parseTournamentName, ulidTime } from '../tournament-name';

describe('tournament deck names', () => {
  it('parses event and placement or leaves both null', () => {
    const cases: Array<[string, string | null, number | null]> = [
      ['Calling: São Paulo 5th 🇧🇷', 'Calling: São Paulo', 5],
      ['100th Calling: Atlanta 1st 🇺🇸', '100th Calling: Atlanta', 1],
      ['Sunday Showdown: Bilbao 2nd 🇪🇸', 'Sunday Showdown: Bilbao', 2],
      ['ProQuest 3rd', 'ProQuest', 3],
      ['Nationals 22nd', 'Nationals', 22],
      ['My spicy brew', null, null],
      ['Top 8 Calling', null, null],
    ];

    const parsed = cases.map(([name]) => [name, parseTournamentName(name).eventName, parseTournamentName(name).placement]);

    expect(parsed).toEqual(cases);
  });

  it('deck date comes from the ULID timestamp', () => {
    const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    const ulid = '01M441KWV10XFZDC1ZJ4589A0P';
    const expectedMillis = [...ulid.slice(0, 10)].reduce((acc, char) => acc * 32 + alphabet.indexOf(char), 0);

    const date = ulidTime(ulid);

    expect(date.getTime()).toBe(expectedMillis);
    expect(date.toISOString()).toBe(new Date(expectedMillis).toISOString());
  });
});
