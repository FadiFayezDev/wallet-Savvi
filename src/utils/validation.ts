export const assertPositiveAmount = (amount: number, label = 'Amount') => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${label} must be greater than 0.`);
  }
};

export const assertRequired = (value: string, label: string) => {
  if (!value.trim()) {
    throw new Error(`${label} is required.`);
  }
};
