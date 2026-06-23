import React, { useEffect, useState } from 'react';
import { dailyTasksAPI } from '../../api';
import { Plus, Trash2, Edit, Save, Power, PowerOff, X, CheckCircle2, Award, ClipboardList } from 'lucide-react';

const TASK_TYPE_OPTIONS = [
  { key: 'check_in', label: 'Check-In Today' },
  { key: 'ludo', label: 'Play Ludo Matches' },
  { key: 'colour-trading', label: 'Predict Colour Trading rounds' },
  { key: 'aviator', label: 'Play Aviator' },
  { key: 'fruit-slasher', label: 'Play Fruit Slasher' },
  { key: 'cricket-fantasy', label: 'Join Cricket Fantasy Contests' },
  { key: 'custom', label: 'Custom Task' }
];

export const AdminDailyTasks: React.FC = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [globalSettings, setGlobalSettings] = useState({
    all_done_reward: 15.00,
    all_done_wallet: 'main'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // New Task State
  const [newTask, setNewTask] = useState({
    task_type: 'check_in',
    title: '',
    description: '',
    target_count: '1',
    reward_amount: '',
    reward_wallet: 'bonus',
    is_active: true
  });

  // Edit Task State
  const [editingTask, setEditingTask] = useState<any | null>(null);

  const fetchTasksData = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await dailyTasksAPI.getAdminTasks();
      setTasks(res.tasks || []);
      setGlobalSettings({
        all_done_reward: parseFloat(res.all_done_reward) || 15.00,
        all_done_wallet: res.all_done_wallet || 'main'
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to load task configurations.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasksData();
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    try {
      await dailyTasksAPI.saveAdminSettings({
        reward_amount: globalSettings.all_done_reward,
        wallet_type: globalSettings.all_done_wallet as any
      });
      showSuccess('Daily task global settings saved successfully.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save settings.');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    try {
      await dailyTasksAPI.createAdminTask({
        ...newTask,
        target_count: parseInt(newTask.target_count, 10),
        reward_amount: parseFloat(newTask.reward_amount)
      });
      showSuccess('Daily task created successfully.');
      setNewTask({
        task_type: 'check_in',
        title: '',
        description: '',
        target_count: '1',
        reward_amount: '',
        reward_wallet: 'bonus',
        is_active: true
      });
      fetchTasksData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create task.');
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    setErrorMessage('');
    try {
      await dailyTasksAPI.updateAdminTask(editingTask.id, {
        ...editingTask,
        target_count: parseInt(editingTask.target_count, 10),
        reward_amount: parseFloat(editingTask.reward_amount)
      });
      showSuccess('Daily task updated successfully.');
      setEditingTask(null);
      fetchTasksData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update task.');
    }
  };

  const handleDeleteTask = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this daily task?')) return;
    setErrorMessage('');
    try {
      await dailyTasksAPI.deleteAdminTask(id);
      showSuccess('Daily task deleted.');
      fetchTasksData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete task.');
    }
  };

  const handleToggleStatus = async (task: any) => {
    setErrorMessage('');
    try {
      await dailyTasksAPI.updateAdminTask(task.id, {
        ...task,
        is_active: !task.is_active
      });
      showSuccess(`Task status changed.`);
      fetchTasksData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to toggle status.');
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>Daily Task Board Manager</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Configure checklist goals, award targets, and release global daily cash bonuses for users.
        </p>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div style={{ background: 'rgba(255, 71, 87, 0.08)', border: '1px solid rgba(255, 71, 87, 0.25)', borderRadius: '8px', padding: '12px 16px', color: 'var(--accent-danger)', fontSize: '0.88rem' }}>
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div style={{ background: 'rgba(0, 245, 160, 0.08)', border: '1px solid rgba(0, 245, 160, 0.25)', borderRadius: '8px', padding: '12px 16px', color: 'var(--accent-secondary)', fontSize: '0.88rem' }}>
          {successMessage}
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Fetching checklist settings...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', alignItems: 'start' }}>
          
          {/* Main tasks lists */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Task list card */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
                <ClipboardList size={20} color="var(--accent-primary)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Configured Daily Goals</h3>
              </div>

              {tasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                  No daily tasks configured. Add one on the right to start!
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                        <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Goal Detail</th>
                        <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Type</th>
                        <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Target</th>
                        <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Reward</th>
                        <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Wallet</th>
                        <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Status</th>
                        <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((task) => (
                        <tr key={task.id} style={{ borderBottom: '1px solid var(--border-glass)', fontSize: '0.88rem' }}>
                          <td style={{ padding: '14px 8px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{task.title}</div>
                            {task.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{task.description}</div>}
                          </td>
                          <td style={{ padding: '14px 8px', textTransform: 'capitalize' }}>
                            <span style={{ color: 'var(--accent-info)', background: 'rgba(0, 184, 212, 0.1)', borderRadius: '4px', padding: '2px 6px', fontSize: '0.72rem', fontWeight: 600 }}>
                              {task.task_type.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ padding: '14px 8px', fontWeight: 700 }}>{task.target_count} play(s)</td>
                          <td style={{ padding: '14px 8px', color: 'var(--accent-secondary)', fontWeight: 700 }}>₹{parseFloat(task.reward_amount).toFixed(2)}</td>
                          <td style={{ padding: '14px 8px', textTransform: 'uppercase', fontSize: '0.75rem' }}>{task.reward_wallet}</td>
                          <td style={{ padding: '14px 8px' }}>
                            <button 
                              onClick={() => handleToggleStatus(task)}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                              title={task.is_active ? 'Disable task' : 'Enable task'}
                            >
                              {task.is_active ? (
                                <span style={{ color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}>
                                  <Power size={13} /> Active
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}>
                                  <PowerOff size={13} /> Paused
                                </span>
                              )}
                            </button>
                          </td>
                          <td style={{ padding: '14px 8px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button 
                                onClick={() => setEditingTask(task)} 
                                style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-glass)', borderRadius: '4px', padding: '6px', color: 'var(--text-primary)', cursor: 'pointer' }}
                              >
                                <Edit size={14} />
                              </button>
                              <button 
                                onClick={() => handleDeleteTask(task.id)} 
                                style={{ background: 'rgba(255, 71, 87, 0.05)', border: '1px solid rgba(255, 71, 87, 0.2)', borderRadius: '4px', padding: '6px', color: 'var(--accent-danger)', cursor: 'pointer' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Global Settings Configuration */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
                <Award size={20} color="var(--accent-secondary)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>All Done Bonus Configuration</h3>
              </div>

              <form onSubmit={handleSaveSettings} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', alignItems: 'end' }}>
                <div>
                  <label className="input-label">All Done Reward Cash (₹)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="input-field" 
                    placeholder="15.00" 
                    value={globalSettings.all_done_reward}
                    onChange={(e) => setGlobalSettings({ ...globalSettings, all_done_reward: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div>
                  <label className="input-label">Target Wallet</label>
                  <select 
                    className="input-field" 
                    value={globalSettings.all_done_wallet}
                    onChange={(e) => setGlobalSettings({ ...globalSettings, all_done_wallet: e.target.value })}
                  >
                    <option value="main">Main Wallet Cash</option>
                    <option value="bonus">Bonus Wallet Credits</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary" style={{ padding: '12px 20px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <Save size={16} />
                  <span>Save Config</span>
                </button>
              </form>
            </div>
          </div>

          {/* Sidebar Editor / Add Forms */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {editingTask ? (
              /* Edit Task Card */
              <div className="glass-card" style={{ padding: '24px', border: '1px solid var(--accent-primary-glow)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--accent-primary)' }}>Edit Task Goal</h3>
                  <button onClick={() => setEditingTask(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleUpdateTask} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label className="input-label">Task Type</label>
                    <select 
                      className="input-field"
                      value={editingTask.task_type}
                      onChange={(e) => setEditingTask({ ...editingTask, task_type: e.target.value })}
                    >
                      {TASK_TYPE_OPTIONS.map(o => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Goal Title</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. Play 3 Ludo matches" 
                      value={editingTask.title}
                      onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="input-label">Description (Optional)</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. Complete 3 matches today" 
                      value={editingTask.description}
                      onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="input-label">Target Count (Wagers)</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      placeholder="3" 
                      value={editingTask.target_count}
                      onChange={(e) => setEditingTask({ ...editingTask, target_count: e.target.value })}
                      required
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="input-label">Reward Amount (₹)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="input-field" 
                      placeholder="3.00" 
                      value={editingTask.reward_amount}
                      onChange={(e) => setEditingTask({ ...editingTask, reward_amount: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="input-label">Reward Wallet</label>
                    <select 
                      className="input-field"
                      value={editingTask.reward_wallet}
                      onChange={(e) => setEditingTask({ ...editingTask, reward_wallet: e.target.value })}
                    >
                      <option value="bonus">Bonus Wallet Credits</option>
                      <option value="main">Main Wallet Cash</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <input 
                      type="checkbox" 
                      id="edit_is_active" 
                      checked={editingTask.is_active}
                      onChange={(e) => setEditingTask({ ...editingTask, is_active: e.target.checked })}
                    />
                    <label htmlFor="edit_is_active" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>Is Active Goal</label>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingTask(null)} style={{ flex: 1 }}>Cancel</button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Changes</button>
                  </div>
                </form>
              </div>
            ) : (
              /* Add Task Card */
              <div className="glass-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
                  <Plus size={18} color="var(--accent-primary)" />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Add New Daily Goal</h3>
                </div>

                <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label className="input-label">Task Type</label>
                    <select 
                      className="input-field"
                      value={newTask.task_type}
                      onChange={(e) => setNewTask({ ...newTask, task_type: e.target.value })}
                    >
                      {TASK_TYPE_OPTIONS.map(o => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Goal Title</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. Play 3 Ludo matches" 
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="input-label">Description (Optional)</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. Complete 3 matches today" 
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="input-label">Target Count (Wagers)</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      placeholder="3" 
                      value={newTask.target_count}
                      onChange={(e) => setNewTask({ ...newTask, target_count: e.target.value })}
                      required
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="input-label">Reward Amount (₹)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="input-field" 
                      placeholder="3.00" 
                      value={newTask.reward_amount}
                      onChange={(e) => setNewTask({ ...newTask, reward_amount: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="input-label">Reward Wallet</label>
                    <select 
                      className="input-field"
                      value={newTask.reward_wallet}
                      onChange={(e) => setNewTask({ ...newTask, reward_wallet: e.target.value })}
                    >
                      <option value="bonus">Bonus Wallet Credits</option>
                      <option value="main">Main Wallet Cash</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <input 
                      type="checkbox" 
                      id="new_is_active" 
                      checked={newTask.is_active}
                      onChange={(e) => setNewTask({ ...newTask, is_active: e.target.checked })}
                    />
                    <label htmlFor="new_is_active" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>Is Active Goal</label>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>Add Goal</button>
                </form>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
export default AdminDailyTasks;
