import React from 'react';
import { Cog, Crown, Paintbrush, Shield, Smile, Store } from 'lucide-react';
import {
  getAnyRoleBadgeSpec,
  type AnyRoleBadgeId,
  type RoleBadgeIconKind,
} from '../game/buddiesProfileIdentity';

export function renderRoleBadgeIcon(
  icon: RoleBadgeIconKind,
  className = 'w-3 h-3 stroke-[2.3]',
): React.ReactNode {
  switch (icon) {
    case 'gear':
      return <Cog className={className} aria-hidden="true" />;
    case 'crown':
      return <Crown className={className} aria-hidden="true" />;
    case 'paintbrush':
      return <Paintbrush className={className} aria-hidden="true" />;
    case 'smiley':
      return <Smile className={className} aria-hidden="true" />;
    case 'shield':
      return <Shield className={className} aria-hidden="true" />;
    case 'merchant':
      return <Store className={className} aria-hidden="true" />;
    default:
      return <Cog className={className} aria-hidden="true" />;
  }
}

export interface RoleBadgeCircleProps {
  roleId?: AnyRoleBadgeId | string | null;
  isNpcMerchant?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  title?: string;
}

const SIZE_CLASSES: Record<NonNullable<RoleBadgeCircleProps['size']>, { box: string; icon: string }> = {
  xs: { box: 'w-4 h-4 border-[1.5px]', icon: 'w-2.5 h-2.5 stroke-[2.5]' },
  sm: { box: 'w-5 h-5 border-[1.5px]', icon: 'w-3 h-3 stroke-[2.4]' },
  md: { box: 'w-6 h-6 border-2', icon: 'w-3.5 h-3.5 stroke-[2.3]' },
};

/**
 * Circular role badge matching the Buddies identity design:
 * filled role-colored circle, crisp white icon, and a thin dark ring.
 */
export const RoleBadgeCircle: React.FC<RoleBadgeCircleProps> = ({
  roleId,
  isNpcMerchant = false,
  size = 'sm',
  className = '',
  title,
}) => {
  const spec = getAnyRoleBadgeSpec(roleId, isNpcMerchant);
  const dims = SIZE_CLASSES[size];

  return (
    <span
      data-role-badge-circle={spec.id}
      title={title ?? spec.label}
      style={{ backgroundColor: spec.color }}
      className={`inline-flex items-center justify-center rounded-full text-white border-[#0f172a] shadow-sm shrink-0 ${dims.box} ${className}`}
    >
      {renderRoleBadgeIcon(spec.icon, dims.icon)}
    </span>
  );
};
