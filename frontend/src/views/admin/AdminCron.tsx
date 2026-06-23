import React, { useEffect, useState } from 'react';
import { adminCronAPI } from '../../api';
import { Play, RefreshCw, CheckCircle2, XCircle, AlertCircle, Clock, Activity, Terminal } from 'lucide-react';

export const AdminCron: React.FC = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Pagination state for history
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit, setHistoryLimit] = useState(20);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotalRecords, setHistoryTotalRecords] = useState(0);

  const fetchJobs = async () => {
    try {
      const res = await adminCronAPI.getJobs();
      setJobs(res.jobs || []);
    } catch (err: any) {
      console.error('Error fetching jobs:', err);
      setErrorMessage(err.message || 'Failed to fetch cron jobs.');
    }
  };

  const fetchHistory = async (p = historyPage, l = historyLimit) => {
    setIsHistoryLoading(true);
    try {
      const res = await adminCronAPI.getHistory(p, l);
      setHistory(res.history || []);
      setHistoryTotalPages(res.totalPages || 1);
      setHistoryTotalRecords(res.total || 0);
    } catch (err: any) {
      console.error('Error fetching history:', err);
      setErrorMessage(err.message || 'Failed to fetch execution history.');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(historyPage, historyLimit);
  }, [historyPage, historyLimit]);

  const fetchSettings = async () => {
    try {
      const res = await adminCronAPI.getSettings();
      setSettings(res || {});
    } catch (err: any) {
      console.error('Error fetching settings:', err);
    }
  };

  const loadAllData = async () => {
    setIsLoading(true);
    setErrorMessage('');
    await Promise.all([fetchJobs(), fetchSettings()]);
    setIsLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleToggleSetting = async (key: string, currentValue: boolean) => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const newValue = !currentValue;
      await adminCronAPI.updateSetting(key, newValue);
      setSettings(prev => ({ ...prev, [key]: newValue }));
      setSuccessMessage(`Cron setting '${key.replace('cron_enabled_', '').replace('cron_', '')}' updated successfully to ${newValue ? 'Enabled' : 'Disabled'}.`);
    } catch (err: any) {
      console.error('Error updating setting:', err);
      setErrorMessage(err.message || 'Failed to update cron setting.');
    }
  };

  const triggerJob = async (jobKey: string) => {
    if (!window.confirm(`Are you sure you want to manually trigger '${jobKey}' job right now?`)) {
      return;
    }

    setActionLoading(jobKey);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await adminCronAPI.triggerJob(jobKey);
      setSuccessMessage(res.message || `Cron job '${jobKey}' triggered and executed successfully!`);
      // Reload both jobs & history to reflect the latest run
      await Promise.all([fetchJobs(), fetchHistory()]);
    } catch (err: any) {
      console.error('Trigger job error:', err);
      setErrorMessage(err.message || `Execution failed for job '${jobKey}'.`);
      // Reload history to check logged failure
      fetchHistory();
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch (e) {
      return dateStr;
    }
  };

  const getDuration = (start: string, end: string) => {
    if (!start || !end) return 'N/A';
    try {
      const diff = new Date(end).getTime() - new Date(start).getTime();
      return `${(diff / 1000).toFixed(2)}s`;
    } catch (e) {
      return 'N/A';
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>System Cron Jobs Manager</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Monitor automated background operations, check real-time logs, and manually trigger payouts or database synchronizations.
          </p>
        </div>
        <button 
          onClick={loadAllData} 
          disabled={isLoading || isHistoryLoading}
          className="btn btn-secondary" 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}
        >
          <RefreshCw size={15} className={isLoading || isHistoryLoading ? 'animate-spin' : ''} />
          <span>Refresh All</span>
        </button>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div style={{ background: 'rgba(255, 71, 87, 0.08)', border: '1px solid rgba(255, 71, 87, 0.25)', borderRadius: '8px', padding: '12px 16px', color: 'var(--accent-danger)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div style={{ background: 'rgba(0, 245, 160, 0.08)', border: '1px solid rgba(0, 245, 160, 0.25)', borderRadius: '8px', padding: '12px 16px', color: 'var(--accent-secondary)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-secondary)' }}>
          <RefreshCw size={24} className="animate-spin" style={{ marginBottom: '10px' }} />
          <div>Loading scheduler statistics...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Global Schedulers Switchboard */}
          <div className="glass-card" style={{ padding: '20px 24px', background: settings.cron_global_enabled !== false ? 'rgba(0, 245, 160, 0.02)' : 'rgba(255, 71, 87, 0.02)', border: `1px solid ${settings.cron_global_enabled !== false ? 'rgba(0, 245, 160, 0.15)' : 'rgba(255, 71, 87, 0.15)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Activity size={24} color={settings.cron_global_enabled !== false ? 'var(--accent-secondary)' : 'var(--accent-danger)'} className={settings.cron_global_enabled !== false ? 'animate-pulse' : ''} />
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 4px 0' }}>
                  Global Automated Schedulers: {settings.cron_global_enabled !== false ? 'ACTIVE' : 'PAUSED'}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>
                  {settings.cron_global_enabled !== false 
                    ? 'All automated background cron tasks are running according to their normal timetables.' 
                    : 'All automated background executions are FORCE-STOPPED. Jobs will only run if triggered manually.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleToggleSetting('cron_global_enabled', settings.cron_global_enabled !== false)}
              className={`btn ${settings.cron_global_enabled !== false ? 'btn-secondary' : 'btn-primary'}`}
              style={{ 
                background: settings.cron_global_enabled !== false ? 'rgba(255, 71, 87, 0.1)' : 'var(--accent-secondary)', 
                border: `1px solid ${settings.cron_global_enabled !== false ? 'rgba(255, 71, 87, 0.3)' : 'var(--accent-secondary)'}`,
                color: settings.cron_global_enabled !== false ? 'var(--accent-danger)' : 'var(--bg-primary)',
                fontWeight: 700,
                padding: '10px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {settings.cron_global_enabled !== false ? 'Pause All Schedulers' : 'Resume Schedulers'}
            </button>
          </div>

          {/* Section 1: Scheduler Jobs */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              <Clock size={20} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Automated Cron Jobs Registry</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
              {jobs.map((job) => {
                const isJobRunning = actionLoading === job.key;
                const lastRun = job.last_run;
                
                let detailsObj: any = null;
                if (lastRun && lastRun.details) {
                  try {
                    detailsObj = typeof lastRun.details === 'string' ? JSON.parse(lastRun.details) : lastRun.details;
                  } catch (e) {
                    detailsObj = lastRun.details;
                  }
                }

                return (
                  <div 
                    key={job.key} 
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.02)', 
                      border: '1px solid var(--border-glass)', 
                      borderRadius: '12px', 
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '16px',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <div>
                      {/* Name / Schedule */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{job.name}</h4>
                        <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', background: 'rgba(0, 245, 160, 0.1)', border: '1px solid rgba(0, 245, 160, 0.2)', padding: '2px 8px', borderRadius: '20px', fontWeight: 600 }}>
                          {job.schedule}
                        </span>
                      </div>
                      
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '12px', fontFamily: 'monospace' }}>
                        Key: {job.key}
                      </div>

                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', lineHeight: '1.4', margin: '0 0 16px 0' }}>
                        {job.description}
                      </p>
                    </div>

                    {/* Last Run Stats */}
                    <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '12px', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Last Run Status:</span>
                        {lastRun ? (
                          <span style={{ 
                            fontWeight: 700,
                            color: lastRun.status === 'success' ? 'var(--accent-secondary)' : lastRun.status === 'failure' ? 'var(--accent-danger)' : 'var(--accent-info)' 
                          }}>
                            {lastRun.status.toUpperCase()}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Never Executed</span>
                        )}
                      </div>

                      {lastRun && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Executed At:</span>
                            <span style={{ color: 'var(--text-primary)' }}>{formatDate(lastRun.started_at)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Duration:</span>
                            <span style={{ color: 'var(--text-primary)' }}>
                              {lastRun.completed_at ? getDuration(lastRun.started_at, lastRun.completed_at) : 'Processing...'}
                            </span>
                          </div>
                          
                          {/* Render custom metadata if successful */}
                          {lastRun.status === 'success' && detailsObj && (
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '8px', paddingTop: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>Execution Details:</div>
                              {detailsObj.simulated_date && <div>Simulated Date: <strong style={{ color: '#fff' }}>{detailsObj.simulated_date}</strong></div>}
                              {detailsObj.processed_fdrs !== undefined && <div>Processed FDRs: <strong style={{ color: '#fff' }}>{detailsObj.processed_fdrs}</strong></div>}
                              {detailsObj.unlocked_funds !== undefined && <div>Unlocked Funds: <strong style={{ color: '#fff' }}>{detailsObj.unlocked_funds}</strong></div>}
                              {detailsObj.triggered_by && <div>Source: <strong style={{ color: '#fff', textTransform: 'capitalize' }}>{detailsObj.triggered_by}</strong></div>}
                            </div>
                          )}

                          {/* Render failure details */}
                          {lastRun.status === 'failure' && lastRun.error_message && (
                            <div style={{ borderTop: '1px solid rgba(255,71,87,0.15)', marginTop: '8px', paddingTop: '8px', fontSize: '0.75rem', color: 'var(--accent-danger)' }}>
                              <div style={{ fontWeight: 600, marginBottom: '2px' }}>Error Message:</div>
                              <div style={{ wordBreak: 'break-all', fontFamily: 'monospace', background: 'rgba(255,71,87,0.04)', padding: '6px', borderRadius: '4px' }}>
                                {lastRun.error_message}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Auto Execution Settings Toggle */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border-glass)', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Automatic Execution:</span>
                      <button
                        onClick={() => handleToggleSetting(`cron_enabled_${job.key}`, settings[`cron_enabled_${job.key}`] !== false)}
                        style={{
                          background: (settings[`cron_enabled_${job.key}`] !== false) ? 'rgba(0, 245, 160, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                          border: `1px solid ${(settings[`cron_enabled_${job.key}`] !== false) ? 'rgba(0, 245, 160, 0.2)' : 'var(--border-glass)'}`,
                          borderRadius: '4px',
                          color: (settings[`cron_enabled_${job.key}`] !== false) ? 'var(--accent-secondary)' : 'var(--text-secondary)',
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {settings[`cron_enabled_${job.key}`] !== false ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>

                    {/* Trigger Button */}
                    <button 
                      onClick={() => triggerJob(job.key)}
                      disabled={isJobRunning || actionLoading !== null}
                      className={`btn ${job.key === 'daily_financials' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ 
                        width: '100%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '8px',
                        padding: '10px'
                      }}
                    >
                      {isJobRunning ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Running execution...</span>
                        </>
                      ) : (
                        <>
                          <Play size={14} />
                          <span>Run Job Manually</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Cron History Logs */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Terminal size={20} color="var(--accent-secondary)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Execution Logs History</h3>
              </div>
              <button 
                onClick={fetchHistory} 
                disabled={isHistoryLoading}
                style={{ background: 'transparent', border: 'none', color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem', cursor: 'pointer' }}
              >
                <RefreshCw size={12} className={isHistoryLoading ? 'animate-spin' : ''} />
                <span>Reload Logs</span>
              </button>
            </div>

            {isHistoryLoading && history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
                Loading logs...
              </div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                No execution history recorded in `cron_history`.
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Job Name</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Run Status</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Start Time</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Duration</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Trigger Source</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Execution Parameters</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((run) => {
                      let detailsObj: any = null;
                      if (run.details) {
                        try {
                          detailsObj = typeof run.details === 'string' ? JSON.parse(run.details) : run.details;
                        } catch (e) {
                          detailsObj = run.details;
                        }
                      }

                      // Find matching job config name
                      const matchingJob = jobs.find(j => j.key === run.cron_name);
                      const jobName = matchingJob ? matchingJob.name : run.cron_name;
                      
                      const triggerSource = detailsObj?.triggered_by || (run.cron_name === 'daily_financials' && !detailsObj?.triggered_by ? 'system' : 'N/A');

                      return (
                        <tr 
                          key={run.id} 
                          style={{ 
                            borderBottom: '1px solid var(--border-glass)', 
                            fontSize: '0.85rem',
                            background: run.status === 'failure' ? 'rgba(255, 71, 87, 0.02)' : 'transparent'
                          }}
                        >
                          {/* Job Name */}
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{jobName}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{run.cron_name}</div>
                          </td>

                          {/* Status Badge */}
                          <td style={{ padding: '12px 8px' }}>
                            {run.status === 'success' ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-secondary)', fontSize: '0.76rem', fontWeight: 600 }}>
                                <CheckCircle2 size={12} /> Success
                              </span>
                            ) : run.status === 'failure' ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-danger)', fontSize: '0.76rem', fontWeight: 600 }}>
                                <XCircle size={12} /> Failure
                              </span>
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-info)', fontSize: '0.76rem', fontWeight: 600 }}>
                                <Activity size={12} className="animate-pulse" /> Running
                              </span>
                            )}
                          </td>

                          {/* Start Time */}
                          <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                            {formatDate(run.started_at)}
                          </td>

                          {/* Duration */}
                          <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                            {run.completed_at ? getDuration(run.started_at, run.completed_at) : 'N/A'}
                          </td>

                          {/* Trigger Source */}
                          <td style={{ padding: '12px 8px', textTransform: 'capitalize' }}>
                            <span style={{ 
                              background: triggerSource === 'admin' ? 'rgba(0, 184, 212, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                              border: `1px solid ${triggerSource === 'admin' ? 'rgba(0, 184, 212, 0.2)' : 'var(--border-glass)'}`,
                              borderRadius: '4px',
                              padding: '2px 6px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: triggerSource === 'admin' ? 'var(--accent-info)' : 'var(--text-secondary)'
                            }}>
                              {triggerSource}
                            </span>
                          </td>

                          {/* Parameters / Details or Error */}
                          <td style={{ padding: '12px 8px', fontSize: '0.78rem', maxWidth: '300px' }}>
                            {run.status === 'failure' && run.error_message ? (
                              <div style={{ color: 'var(--accent-danger)', fontFamily: 'monospace', fontSize: '0.75rem', background: 'rgba(255,71,87,0.03)', padding: '6px', borderRadius: '4px', border: '1px solid rgba(255,71,87,0.1)' }}>
                                {run.error_message}
                              </div>
                            ) : detailsObj ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {detailsObj.simulated_date && (
                                  <span style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem' }}>
                                    Date: {detailsObj.simulated_date}
                                  </span>
                                )}
                                {detailsObj.processed_fdrs !== undefined && (
                                  <span style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem' }}>
                                    FDRs: {detailsObj.processed_fdrs}
                                  </span>
                                )}
                                {detailsObj.unlocked_funds !== undefined && (
                                  <span style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem' }}>
                                    Unlocked: {detailsObj.unlocked_funds}
                                  </span>
                                )}
                                {detailsObj.duration_ms !== undefined && (
                                  <span style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem' }}>
                                    Took: {detailsObj.duration_ms}ms
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {historyTotalRecords > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Showing {((historyPage - 1) * historyLimit) + 1} to {Math.min(historyPage * historyLimit, historyTotalRecords)} of {historyTotalRecords} entries
                    </span>
                    <select 
                      value={historyLimit} 
                      onChange={(e) => {
                        setHistoryLimit(Number(e.target.value));
                        setHistoryPage(1);
                      }}
                      className="input-field"
                      style={{ padding: '4px 8px', width: 'auto', minHeight: 'auto', height: 'auto', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)' }}
                    >
                      <option value={20}>20 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={100}>100 per page</option>
                    </select>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="btn" 
                      style={{ padding: '6px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', opacity: historyPage === 1 ? 0.5 : 1 }}
                      disabled={historyPage === 1}
                      onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: '0.9rem', fontWeight: 600 }}>
                      Page {historyPage} of {historyTotalPages}
                    </div>
                    <button 
                      className="btn" 
                      style={{ padding: '6px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', opacity: historyPage === historyTotalPages ? 0.5 : 1 }}
                      disabled={historyPage === historyTotalPages}
                      onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
              </>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

export default AdminCron;
