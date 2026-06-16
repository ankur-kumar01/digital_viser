import React, { useState, useEffect } from 'react';
import { walletAPI } from '../api';
import { Receipt, Search, Filter, RefreshCw } from 'lucide-react';
import { formatGlobalDate } from '../utils/dateFormatter';

export const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const fetchTransactions = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await walletAPI.getTransactions();
      setTransactions(data);
      setFilteredTransactions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch transaction logs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  // Filter transactions when filters change
  useEffect(() => {
    let result = transactions;

    if (typeFilter !== 'all') {
      result = result.filter(tx => tx.type === typeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(tx => 
        tx.description.toLowerCase().includes(query) ||
        tx.id.toString().includes(query) ||
        tx.type.toLowerCase().includes(query)
      );
    }

    setFilteredTransactions(result);
  }, [searchQuery, typeFilter, transactions]);

  const formatAmount = (amountStr: string, type: string) => {
    const amount = parseFloat(amountStr) || 0;
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(Math.abs(amount));

    if (amount < 0 || type.includes('withdrawal') || type === 'fdr_lock' || type === 'deposit_rejected' || type === 'game_bet') {
      return <span style={{ color: 'var(--accent-danger)', fontWeight: 600 }}>-{formatted}</span>;
    }
    
    return <span style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>+{formatted}</span>;
  };

  const getBadgeStyle = (type: string) => {
    if (type.includes('approved') || type === 'deposit' || type === 'interest' || type === 'fdr_maturity' || type === 'game_win') {
      return 'badge badge-completed';
    }
    if (type.includes('rejected') || type === 'fdr_lock' || type.includes('withdrawal_approved') || type === 'game_bet') {
      return 'badge badge-danger';
    }
    if (type.includes('pending')) {
      return 'badge badge-warning';
    }
    return 'badge';
  };

  const getFormatType = (type: string) => {
    return type.toUpperCase().replace('_', ' ');
  };

  const formatDate = (dateStr: string) => {
    return formatGlobalDate(dateStr, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>Transaction History Ledger</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Comprehensive and transparent logs of all capital activities and interest rewards.
          </p>
        </div>
        <button 
          className="btn btn-secondary" 
          onClick={fetchTransactions} 
          disabled={isLoading}
          style={{ display: 'flex', gap: '6px', padding: '10px 18px', fontSize: '0.85rem' }}
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div 
          style={{
            background: 'rgba(255, 71, 87, 0.08)',
            border: '1px solid rgba(255, 71, 87, 0.25)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            color: 'var(--accent-danger)',
            fontSize: '0.88rem'
          }}
        >
          {error}
        </div>
      )}

      {/* Filters bar */}
      <div 
        className="glass-card" 
        style={{ 
          padding: '16px 20px', 
          display: 'flex', 
          gap: '15px', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          flexWrap: 'wrap' 
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search 
            size={18} 
            color="var(--text-muted)" 
            style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} 
          />
          <input
            type="text"
            className="input-field"
            placeholder="Search description, reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '48px', paddingRight: '16px' }}
          />
        </div>

        {/* Filter Type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Filter size={18} color="var(--text-muted)" />
          <select
            className="input-field"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ width: '180px', background: 'var(--bg-tertiary)' }}
          >
            <option value="all">All Transactions</option>
            <option value="deposit">Deposits</option>
            <option value="fdr_lock">FDR Capital Locks</option>
            <option value="interest">FDR Interest Yields</option>
            <option value="fdr_maturity">FDR Maturity Payouts</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          <span>Loading ledger audits...</span>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div 
          className="glass-card" 
          style={{ 
            textAlign: 'center', 
            padding: '60px 40px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '16px' 
          }}
        >
          <Receipt size={40} color="var(--text-muted)" />
          <div>
            <h4 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', marginBottom: '6px' }}>No Transaction Records Found</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '380px', margin: '0 auto', lineHeight: '1.5' }}>
              We couldn't locate any records matching your filter parameters. Try adjusting your queries.
            </p>
          </div>
        </div>
      ) : (
        <>
        {/* TABLE (Desktop) */}
        <div className="table-container desktop-only animate-fade-in">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Audit ID</th>
                <th>Activity Type</th>
                <th>Description</th>
                <th>Amount (INR)</th>
                <th>Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => (
                <tr key={tx.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    TX-{tx.id.toString().padStart(6, '0')}
                  </td>
                  <td>
                    <span className={getBadgeStyle(tx.type)}>
                      {getFormatType(tx.type)}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>
                    {tx.description}
                  </td>
                  <td>
                    {formatAmount(tx.amount, tx.type)}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {formatDate(tx.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Transaction Cards */}
        <div className="mobile-tx-cards">
          {filteredTransactions.map((tx) => (
            <div className="mobile-tx-card" key={`m-${tx.id}`}>
              <div className="mobile-tx-card-header">
                <span className={getBadgeStyle(tx.type)}>
                  {getFormatType(tx.type)}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {formatDate(tx.created_at)}
                </span>
              </div>
              <div className="mobile-tx-card-body">
                <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>
                  {tx.description}
                </span>
                <span style={{ fontWeight: 600, fontSize: '0.95rem', flexShrink: 0 }}>
                  {formatAmount(tx.amount, tx.type)}
                </span>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

    </div>
  );
};
