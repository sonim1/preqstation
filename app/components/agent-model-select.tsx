'use client';

import { Select } from '@mantine/core';
import { useMemo } from 'react';

import {
  type AgentModelCatalog,
  DEFAULT_AGENT_MODEL_CATALOG,
  DEFAULT_AGENT_MODEL_SELECT_VALUE,
  getAgentModelSelectOptions,
  normalizeAgentModel,
} from '@/lib/agent-model-catalog';

type AgentModelSelectProps = {
  engineKey: string | null | undefined;
  catalog?: AgentModelCatalog | null;
  value: string | null;
  disabled?: boolean;
  onChange: (value: string | null) => void;
};

export function AgentModelSelect({
  engineKey,
  catalog,
  value,
  disabled = false,
  onChange,
}: AgentModelSelectProps) {
  const normalizedValue = normalizeAgentModel(value);
  const data = useMemo(() => {
    const options = getAgentModelSelectOptions(catalog ?? DEFAULT_AGENT_MODEL_CATALOG, engineKey);
    if (normalizedValue && !options.some((option) => option.value === normalizedValue)) {
      return [...options, { label: normalizedValue, value: normalizedValue }];
    }
    return options;
  }, [catalog, engineKey, normalizedValue]);

  return (
    <Select
      label="Model"
      aria-label="Model"
      data={data}
      value={normalizedValue ?? DEFAULT_AGENT_MODEL_SELECT_VALUE}
      allowDeselect={false}
      disabled={disabled}
      onChange={(nextValue) => onChange(normalizeAgentModel(nextValue))}
    />
  );
}
