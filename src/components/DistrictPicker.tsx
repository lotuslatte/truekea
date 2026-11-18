import { SelectField } from '@/components/ui/SelectField';
import { LIMA_DISTRICTS } from '@/constants/districts';

const OPTIONS = LIMA_DISTRICTS.map((d) => ({ label: d.name, value: d.name }));

type Props = {
  value: string | null;
  onChange: (district: string) => void;
  label?: string;
  error?: string;
};

/** District selector shared by sign-up, settings, publishing and editing. */
export function DistrictPicker({ value, onChange, label = 'Distrito', error }: Props) {
  return (
    <SelectField
      label={label}
      placeholder="Elige tu distrito"
      options={OPTIONS}
      value={value}
      onChange={onChange}
      searchable
      error={error}
    />
  );
}
