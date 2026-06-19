import React, { useEffect, useCallback } from 'react';
import { adminAPI } from '../../api';
import { EyeOff, Eye, Loader2 } from 'lucide-react';

interface Props {
  userId: number;
  allPlans: any[];
  setAllPlans: (plans: any[]) => void;
  blockedPlanIds: number[];
  setBlockedPlanIds: (ids: number[]) => void;
  restrictionsLoading: boolean;
  setRestrictionsLoading: (v: boolean) => void;
}

export const FdrRestrictionsSection: React.FC<Props> = ({
  userId,
  allPlans,
  setAllPlans,
  blockedPlanIds,
  setBlockedPlanIds,
  restrictionsLoading,
  setRestrictionsLoading,
}) => {
  const fetchRestrictions = useCallback(async () => {
    setRestrictionsLoading(true);
    try {
      const [plans, blocked] = await Promise.all([
        adminAPI.getFdrPlans(),
        adminAPI.getUserFdrPlanBlocks(userId),
      ]);
      setAllPlans(plans);
      setBlockedPlanIds(blocked);
    } catch (err) {
      console.error('Failed to load FDR restrictions', err);
    } finally {
      setRestrictionsLoading(false);
    }
  }, [userId, setAllPlans, setBlockedPlanIds, setRestrictionsLoading]);

  useEffect(() => {
    fetchRestrictions();
  }, [fetchRestrictions]);

  const isBlocked = (planId: number) => blockedPlanIds.includes(planId);

  const toggleBlock = async (planId: number) => {
    const currentlyBlocked = isBlocked(planId);
    try {
      if (currentlyBlocked) {
        await adminAPI.unblockUserFdrPlan(userId, planId);
        setBlockedPlanIds(blockedPlanIds.filter(id => id !== planId));
      } else {
        await adminAPI.blockUserFdrPlan(userId, planId);
        setBlockedPlanIds([...blockedPlanIds, planId]);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update restriction');
    }
  };

  if (restrictionsLoading) {
    return (
      <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginRight: '8px' }} />
        Loading FDR plans...
      </div>
    );
  }

  return (
    <div className="glass-card">
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <EyeOff size={18} color="var(--accent-warning)" />
          FDR Plan Restrictions
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
          Toggle a plan off to hide it from this user. Blocked plans will not appear in their "Create FDR" page.
        </p>
      </div>

      {allPlans.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No FDR plans found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {allPlans.map((plan) => {
            const blocked = isBlocked(plan.id);
            return (
              <div
                key={plan.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: blocked ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.04)',
                  border: `1px solid ${blocked ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.15)'}`,
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: blocked ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                      color: blocked ? '#ef4444' : '#22c55e',
                    }}
                  >
                    {blocked ? <EyeOff size={20} /> : <Eye size={20} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{plan.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      ₹{parseFloat(plan.min_amount).toLocaleString()} – ₹{parseFloat(plan.max_amount).toLocaleString()} &middot; {plan.interest_percent}% / {plan.period_days}d &middot; {plan.duration_days} days
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => toggleBlock(plan.id)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '50px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    background: blocked ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                    color: blocked ? '#ef4444' : '#22c55e',
                    transition: 'all 0.2s',
                    minWidth: '80px',
                  }}
                >
                  {blocked ? 'Blocked' : 'Allowed'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        Changes take effect immediately. The user will need to refresh to see updated plan availability.
      </div>
    </div>
  );
};
