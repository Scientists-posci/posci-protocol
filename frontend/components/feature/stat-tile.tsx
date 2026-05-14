'use client';

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  /** kept for API compat; ignored in monochrome theme */
  accent?: 'primary' | 'accent' | 'success' | 'warning';
  loading?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'glass rounded-lg p-5 hover:bg-foreground/[0.03] transition-colors'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <div className="eyebrow">{label}</div>
          <div className="text-2xl font-light tabular leading-none tracking-tight">
            {loading ? <span className="shimmer rounded h-7 w-32 inline-block" /> : value}
          </div>
          {hint && <div className="text-xs text-muted-foreground/80 mt-2">{hint}</div>}
        </div>
        <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      </div>
    </motion.div>
  );
}
