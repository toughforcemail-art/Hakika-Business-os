// @ts-nocheck
import React from 'react';
import { Plus } from 'lucide-react';

interface FinanceAccountOption {
  value: string;
  label: string;
  accountId: string | null;
}

interface FinanceAccountSelectProps {
  label: string;
  value: string;
  options: FinanceAccountOption[];
  onChange: (selection: string) => void;
  inputCls: string;
  labelCls: string;
  subtleButtonCls: string;
  iconActionButtonCls: string;
  placeholder?: string;
  disabled?: boolean;
  onAdd?: () => void;
  addButtonTitle?: string;
  addButtonAriaLabel?: string;
  addButtonDisabled?: boolean;
  helpText?: string;
  details?: React.ReactNode;
}

const FinanceAccountSelect: React.FC<FinanceAccountSelectProps> = ({
  label,
  value,
  options,
  onChange,
  inputCls,
  labelCls,
  subtleButtonCls,
  iconActionButtonCls,
  placeholder = 'Select account',
  disabled = false,
  onAdd,
  addButtonTitle,
  addButtonAriaLabel,
  addButtonDisabled = false,
  helpText,
  details,
}) => {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex gap-2">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputCls} min-w-0 flex-1`}
          disabled={disabled}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {onAdd ? (
          <button
            type="button"
            onClick={onAdd}
            className={`${iconActionButtonCls} shrink-0`}
            title={addButtonTitle}
            aria-label={addButtonAriaLabel}
            disabled={disabled || addButtonDisabled}
          >
            <Plus size={18} />
          </button>
        ) : null}
      </div>
      {details ? <div className="mt-2">{details}</div> : null}
      {helpText ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{helpText}</p> : null}
    </div>
  );
};

export default FinanceAccountSelect;
