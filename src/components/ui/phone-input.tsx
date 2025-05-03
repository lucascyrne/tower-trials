import React from 'react';
import { Input } from './input';
import { formatPhoneNumber, normalizePhoneNumber } from '@/utils/phone-formatter';

interface PhoneInputProps extends Omit<React.ComponentProps<'input'>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({ value, onChange, ...props }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = normalizePhoneNumber(e.target.value);
    const formatted = formatPhoneNumber(normalized);
    onChange(formatted);
  };

  return (
    <Input
      {...props}
      value={value}
      onChange={handleChange}
      maxLength={15} // (99) 99999-9999
      placeholder="(99) 99999-9999"
    />
  );
};
