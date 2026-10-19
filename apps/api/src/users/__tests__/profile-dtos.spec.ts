import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateContactDto } from '../dtos/update-contact.dto';
import { UpdateDisplayNameDto } from '../dtos/update-display-name.dto';

describe('UpdateDisplayNameDto', () => {
  it('trims before checking the length', async () => {
    const dto = plainToInstance(UpdateDisplayNameDto, { displayName: '  Rodrigo  ' });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.displayName).toBe('Rodrigo');
  });

  it.each(['a', '   a   ', 'x'.repeat(41), 42])('rejects %p', async (displayName) => {
    const dto = plainToInstance(UpdateDisplayNameDto, { displayName });

    expect(await validate(dto)).not.toHaveLength(0);
  });
});

describe('UpdateContactDto', () => {
  it('accepts a string and null', async () => {
    expect(await validate(plainToInstance(UpdateContactDto, { whatsappNumber: '51999990000' }))).toHaveLength(0);
    expect(await validate(plainToInstance(UpdateContactDto, { whatsappNumber: null }))).toHaveLength(0);
  });

  it('rejects an absent field and a non-string', async () => {
    expect(await validate(plainToInstance(UpdateContactDto, {}))).not.toHaveLength(0);
    expect(await validate(plainToInstance(UpdateContactDto, { whatsappNumber: 5 }))).not.toHaveLength(0);
  });
});
