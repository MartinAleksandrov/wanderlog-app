import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Combines class names and resolves Tailwind conflicts, so a component's default classes
// can be overridden: cn('px-4 bg-primary', 'px-6') -> 'bg-primary px-6'
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
