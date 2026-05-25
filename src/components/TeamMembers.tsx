import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search,
  Loader2,
  Trash2,
  ShieldCheck,
  UserPlus,
  Mail,
  UserCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  serverTimestamp, 
  deleteDoc, 
  doc,
  setDoc
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useWorkspace } from '../lib/WorkspaceContext';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: any;
}

export default function TeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('staff');

  const roles = [
    { id: 'admin', label: 'Admin / Owner' },
    { id: 'Salesman', label: 'Salesman / SPO' },
    { id: 'Accountant', label: 'Accountant / Finance' },
    { id: 'Business Development Manager', label: 'BDM' },
    { id: 'Marketing Manager', label: 'Marketing Manager' },
    { id: 'Deliveryman', label: 'Deliveryman' },
    { id: 'Driver', label: 'Driver' },
    { id: 'IT', label: 'IT / System Admin' },
    { id: 'Office Boy', label: 'Office Boy (Limited)' },
    { id: 'staff', label: 'Read-Only Staff' }
  ];
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const user = auth.currentUser;
  const { workspaceUid } = useWorkspace();

  useEffect(() => {
    if (!user || !workspaceUid) return;

    const teamQuery = query(collection(db, 'users', workspaceUid, 'teamMembers'));

    const unsubscribe = onSnapshot(teamQuery, (snapshot) => {
      const memberList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamMember));
      setMembers(memberList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${workspaceUid}/teamMembers`);
    });

    return () => unsubscribe();
  }, [user, workspaceUid]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !workspaceUid || !newName.trim() || !newEmail.trim()) return;

    setIsSubmitting(true);
    try {
      // 1. Add to user's teamMembers collection
      await addDoc(collection(db, 'users', workspaceUid, 'teamMembers'), {
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        role: newRole.trim(),
        createdAt: serverTimestamp()
      });

      // 2. Create a global access grant
      // Use a predictable ID for efficient rules checking
      const grantId = `${workspaceUid}_${newEmail.trim().toLowerCase()}`;
      await setDoc(doc(db, 'access_grants', grantId), {
        bossUid: workspaceUid,
        bossEmail: user.email,
        subordinateEmail: newEmail.trim().toLowerCase(),
        role: newRole.trim(),
        grantedAt: serverTimestamp()
      });

      setNewName('');
      setNewEmail('');
      setNewRole('staff');
      setShowMemberModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${workspaceUid}/teamMembers`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!user || !workspaceUid) return;
    try {
      await deleteDoc(doc(db, 'users', workspaceUid, 'teamMembers', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${workspaceUid}/teamMembers/${id}`);
    }
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            TEAM <span className="text-primary italic">MEMBERS</span>
            <ShieldCheck className="w-8 h-8 text-slate-200" />
          </h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.2em] mt-1">Authorized Taskforce • Privilege Control</p>
        </div>
        <button 
          onClick={() => setShowMemberModal(true)}
          className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          Add Member
        </button>
      </div>

      <div className="erp-card p-6 border-none shadow-sm flex items-center gap-4">
        <Search className="w-5 h-5 text-slate-400" />
        <input 
          type="text" 
          placeholder="Locate member by ID or Designation..." 
          className="bg-transparent border-none outline-none flex-1 font-bold text-slate-600 text-sm placeholder:text-slate-300"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p className="text-[10px] font-black uppercase tracking-widest">Scanning Authorization Matrix...</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredMembers.length === 0 ? (
            <div className="erp-card p-20 text-center border-dashed border-2 border-slate-200">
              <Users className="w-12 h-12 text-slate-100 mx-auto mb-4" />
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No subordinate members mapped</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMembers.map(member => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={member.id}
                  className="erp-card p-6 border-none shadow-sm flex items-center gap-4 hover:shadow-md transition-all group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all ring-4 ring-transparent group-hover:ring-primary/10">
                    <UserCircle className="w-8 h-8" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-slate-900 uppercase truncate tracking-tight">{member.name}</h3>
                    <div className="flex flex-col gap-1 mt-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                        <Mail className="w-3 h-3" />
                        {member.email}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-slate-100 text-slate-500 rounded flex items-center gap-1">
                          <ShieldCheck className="w-2 h-2 text-emerald-500" /> {roles.find(r => r.id === member.role)?.label || member.role}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteMember(member.id)}
                    className="p-2 text-slate-200 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Member Modal */}
      <AnimatePresence>
        {showMemberModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMemberModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white ring-4 ring-slate-100">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">ENLIST MEMBER</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Authorization Registry</p>
                </div>
              </div>

              <form onSubmit={handleAddMember} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block ml-1">Member Identity</label>
                  <input 
                    autoFocus
                    required
                    type="text" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900 outline-none focus:border-slate-900 transition-all"
                    placeholder="e.g. Lt. Commander Khan"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block ml-1">Email Access</label>
                  <input 
                    required
                    type="email" 
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900 outline-none focus:border-slate-900 transition-all"
                    placeholder="subordinate@example.com"
                  />
                  <p className="text-[8px] font-bold text-slate-400 uppercase mt-2 ml-1">Subordinate will use this email to access your data</p>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block ml-1">Designation Role</label>
                  <select 
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900 outline-none focus:border-slate-900 transition-all appearance-none"
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowMemberModal(false)}
                    className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={isSubmitting}
                    className="flex-[2] bg-slate-900 text-white rounded-2xl py-4 text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Enlisting...' : 'Confirm Enlistment'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
