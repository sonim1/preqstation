export function notePreview(value: string | null | undefined, maxLength = 170) {
  if (!value) return '';
  const text = value
    .replace(/`{1,3}[^`]*`{1,3}/g, ' ')
    .replace(/[\[\]#>*_\-()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}
